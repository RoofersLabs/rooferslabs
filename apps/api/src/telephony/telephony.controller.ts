import { Body, Controller, Get, Headers, Post, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CallStatus, UserRole } from '@rooferslabs/shared';
import { Public } from '../common/decorators/public.decorator';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { respond } from '../common/response';
import { AppConfigService } from '../config/app-config.service';
import { CallProcessingService } from '../calls/call-processing.service';
import { CompaniesService } from '../companies/companies.service';
import { PhoneNumbersService } from './phone-numbers.service';
import { TwilioService } from './twilio.service';
import { AssignPhoneNumberDto } from './dto/phone-number.dto';

interface TwilioVoiceWebhookBody {
  CallSid?: string;
  From?: string;
  To?: string;
  /** The business number a forwarded call originally rang (carrier-dependent). */
  ForwardedFrom?: string;
  CallStatus?: string;
  RecordingUrl?: string;
}

@ApiTags('Telephony')
@Controller({ path: 'telephony', version: '1' })
export class TelephonyController {
  constructor(
    private readonly config: AppConfigService,
    private readonly twilio: TwilioService,
    private readonly phoneNumbers: PhoneNumbersService,
    private readonly callProcessing: CallProcessingService,
    private readonly companies: CompaniesService,
  ) {}

  /** Twilio Programmable Voice webhook for inbound calls. Returns TwiML. */
  @Post('incoming')
  @Public()
  @ApiExcludeEndpoint()
  async incoming(
    @Res() res: Response,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Body() body: TwilioVoiceWebhookBody,
  ): Promise<void> {
    const url = `${this.config.api.publicUrl}/v1/telephony/incoming`;
    if (!this.twilio.validateSignature(signature, url, body as Record<string, unknown>)) {
      res.status(403).type('text/xml').send(this.twilio.buildRejectTwiml('Unauthorized.'));
      return;
    }

    const toNumber = body.To ?? '';
    const resolved = await this.phoneNumbers.resolveByNumber(toNumber);
    if (!resolved) {
      res
        .status(200)
        .type('text/xml')
        .send(
          this.twilio.buildRejectTwiml(
            'This number is not yet configured. Please try again later.',
          ),
        );
      return;
    }

    // Master switch: when the owner has turned the receptionist off, answer
    // politely and end the call — no session, stream, records, or notifications.
    const company = await this.companies.getById(resolved.companyId);
    if (!company.receptionistEnabled) {
      res
        .status(200)
        .type('text/xml')
        .send(
          this.twilio.buildRejectTwiml(
            'Thank you for calling. The receptionist is currently unavailable. Please contact the roofing company directly.',
          ),
        );
      return;
    }

    const call = await this.callProcessing.createInboundCall({
      companyId: resolved.companyId,
      phoneNumberId: resolved.phoneNumberId,
      twilioCallSid: body.CallSid ?? null,
      fromNumber: body.From ?? null,
      toNumber,
      forwardedFrom: body.ForwardedFrom ?? null,
    });

    const twiml = this.twilio.buildStreamTwiml({
      wssUrl: this.config.twilio.mediaStreamUrl,
      callId: call.id,
      companyId: resolved.companyId,
    });
    // Twilio expects 200 with TwiML (Nest would default POST to 201).
    res.status(200).type('text/xml').send(twiml);
  }

  /** Twilio call status callback (fallback for calls that never streamed). */
  @Post('status')
  @Public()
  @ApiExcludeEndpoint()
  async status(
    @Res() res: Response,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Body() body: TwilioVoiceWebhookBody,
  ): Promise<void> {
    const url = `${this.config.api.publicUrl}/v1/telephony/status`;
    if (!this.twilio.validateSignature(signature, url, body as Record<string, unknown>)) {
      res.status(403).send();
      return;
    }

    const status = mapTwilioStatus(body.CallStatus);
    if (status && body.CallSid) {
      await this.callProcessing.handleStatusCallback(body.CallSid, status);
    }
    res.status(204).send();
  }

  @Get('phone-number')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the company's assigned AI phone number" })
  async getPhoneNumber(@CurrentCompanyId() companyId: string) {
    const number = await this.phoneNumbers.getForCompany(companyId);
    return respond(number, number ? 'Phone number retrieved.' : 'No phone number assigned yet.');
  }

  @Post('phone-number/provision')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Purchase the company’s dedicated AI phone number',
    description:
      'Buys a local US Twilio number (preferring the company’s area code), configures its voice and status webhooks, and assigns it. Idempotent — returns the existing number when one is already assigned. Runs automatically when onboarding completes; this endpoint retries after a failure.',
  })
  async provision(@CurrentCompanyId() companyId: string) {
    const company = await this.companies.getById(companyId);
    const number = await this.phoneNumbers.provisionForCompany(companyId, {
      companyName: company.name,
      businessPhone: company.phone,
    });
    return respond(number, 'AI phone number ready.');
  }

  @Post('phone-numbers/assign')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign a provisioned Twilio number to the company' })
  async assign(@CurrentCompanyId() companyId: string, @Body() dto: AssignPhoneNumberDto) {
    const number = await this.phoneNumbers.assign(companyId, dto.phoneNumber, {
      twilioSid: dto.twilioSid,
      friendlyName: dto.friendlyName,
    });
    return respond(number, 'Phone number assigned.');
  }

  @Get('receptionist/status')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'AI receptionist control-center status' })
  async receptionistStatus(@CurrentCompanyId() companyId: string) {
    return respond(await this.buildReceptionistStatus(companyId), 'Receptionist status.');
  }

  @Post('receptionist/enable')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turn the AI receptionist on (answers forwarded calls immediately)' })
  async enableReceptionist(@CurrentCompanyId() companyId: string) {
    await this.companies.setReceptionistEnabled(companyId, true);
    return respond(
      await this.buildReceptionistStatus(companyId),
      'AI receptionist is on — forwarded calls are answered.',
    );
  }

  @Post('receptionist/disable')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Turn the AI receptionist off (callers hear a polite unavailable message)',
    description:
      'Nothing is deleted or released: the number stays reserved, and turning it back on resumes instantly.',
  })
  async disableReceptionist(@CurrentCompanyId() companyId: string) {
    await this.companies.setReceptionistEnabled(companyId, false);
    return respond(
      await this.buildReceptionistStatus(companyId),
      'AI receptionist is off. Your number stays reserved.',
    );
  }

  /** One payload with everything the control center displays. */
  private async buildReceptionistStatus(companyId: string) {
    const [company, number] = await Promise.all([
      this.companies.getById(companyId),
      this.phoneNumbers.getForCompany(companyId),
    ]);
    return {
      enabled: company.receptionistEnabled,
      businessPhone: company.phone,
      carrier: company.phoneCarrier,
      aiPhoneNumber: number?.phoneNumber ?? null,
      forwardingVerifiedAt: number?.forwardingVerifiedAt ?? null,
      forwardingVerified: Boolean(number?.forwardingVerifiedAt),
    };
  }

  @Post('phone-number/verify-forwarding')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify call forwarding',
    description:
      'Confirms a real call has reached the AI number (forwarded-call evidence or a recent test call) and activates the receptionist.',
  })
  async verifyForwarding(@CurrentCompanyId() companyId: string) {
    const number = await this.phoneNumbers.verifyForwarding(companyId);
    return respond(number, 'Forwarding verified — your AI receptionist is live.');
  }
}

function mapTwilioStatus(status: string | undefined): CallStatus | null {
  switch (status) {
    case 'no-answer':
      return CallStatus.NO_ANSWER;
    case 'busy':
    case 'failed':
    case 'canceled':
      return CallStatus.FAILED;
    case 'completed':
      return CallStatus.COMPLETED;
    default:
      return null;
  }
}

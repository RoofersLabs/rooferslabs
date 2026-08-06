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
import { CallsRepository } from '../calls/calls.repository';
import { CompaniesService } from '../companies/companies.service';
import { AccountStatusService } from '../tenant-status/account-status.service';
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

/**
 * What a caller hears when the tenant's account is not active.
 *
 * Deliberately says nothing about *why*. The caller is a homeowner with a leak,
 * not a party to the roofing company's account status — "awaiting approval" or
 * "paused" would be both meaningless and embarrassing to the business. It reads
 * as an ordinary out-of-hours message, which from the caller's side is exactly
 * what it is.
 */
const UNAVAILABLE_MESSAGE =
  'Thank you for calling. The office is currently unavailable. Please try again later.';

interface TwilioRecordingWebhookBody {
  CallSid?: string;
  RecordingSid?: string;
  RecordingUrl?: string;
  RecordingStatus?: string;
  RecordingDuration?: string;
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
    private readonly calls: CallsRepository,
    private readonly accountStatus: AccountStatusService,
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

    // The platform gate, checked before anything is spent.
    //
    // This is the earliest point at which a call can be refused, and therefore
    // the cheapest: no Call row, no media stream, no OpenAI Realtime session, no
    // recording, no tokens, no downstream pipeline. Everything the receptionist
    // would cost is downstream of this `if`.
    //
    // It is checked ahead of `receptionistEnabled` deliberately. That switch is
    // the owner's, and an owner whose account is paused does not get a say —
    // reading their preference first would let a paused tenant's configuration
    // decide which of two refusals the caller hears.
    const gate = await this.accountStatus.ensureActive(
      resolved.companyId,
      'telephony.inbound',
      'answer-call',
    );
    if (!gate.allowed) {
      res.status(200).type('text/xml').send(this.twilio.buildRejectTwiml(UNAVAILABLE_MESSAGE));
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
      // Gated on the call's own tenant. A status callback for a call that was
      // answered before the pause still arrives afterwards, and writing it would
      // be the platform recording work for a tenant it has stopped serving.
      //
      // 204 either way: Twilio is told the webhook was received, because it was.
      // Answering an error would earn a retry schedule for a delivery that is
      // never going to be accepted.
      const call = await this.calls.findByTwilioSid(body.CallSid);
      const gate = call
        ? await this.accountStatus.ensureActive(
            call.companyId,
            'telephony.status-webhook',
            'record-call-status',
          )
        : { allowed: false, status: null };
      if (gate.allowed) {
        await this.callProcessing.handleStatusCallback(body.CallSid, status);
      }
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

  /** Twilio recording lifecycle callback: persists SID/URL/status/duration. */
  @Post('recording-status')
  @Public()
  @ApiExcludeEndpoint()
  async recordingStatus(
    @Res() res: Response,
    @Headers('x-twilio-signature') signature: string | undefined,
    @Body() body: TwilioRecordingWebhookBody,
  ): Promise<void> {
    const url = `${this.config.api.publicUrl}/v1/telephony/recording-status`;
    if (!this.twilio.validateSignature(signature, url, body as Record<string, unknown>)) {
      res.status(403).send();
      return;
    }

    if (body.CallSid && body.RecordingSid) {
      const call = await this.calls.findByTwilioSid(body.CallSid);
      const gate = call
        ? await this.accountStatus.ensureActive(
            call.companyId,
            'telephony.recording-webhook',
            'attach-recording',
          )
        : { allowed: false, status: null };
      if (call && gate.allowed) {
        await this.calls.update(call.id, {
          recordingSid: body.RecordingSid,
          recordingUrl: body.RecordingUrl ?? null,
          recordingStatus: body.RecordingStatus ?? null,
          recordingDuration: body.RecordingDuration ? Number(body.RecordingDuration) : null,
        });
      }
    }
    res.status(204).send();
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

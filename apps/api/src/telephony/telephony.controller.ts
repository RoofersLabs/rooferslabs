import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CallStatus, UserRole } from '@rooferslabs/shared';
import { Public } from '../common/decorators/public.decorator';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ForbiddenError } from '../common/exceptions/domain.exception';
import { respond } from '../common/response';
import { AppConfigService } from '../config/app-config.service';
import { CallProcessingService } from '../calls/call-processing.service';
import { PhoneNumbersService } from './phone-numbers.service';
import { TwilioService } from './twilio.service';
import { AssignPhoneNumberDto } from './dto/phone-number.dto';

interface TwilioVoiceWebhookBody {
  CallSid?: string;
  From?: string;
  To?: string;
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
  ) {}

  /** Twilio Programmable Voice webhook for inbound calls. Returns TwiML. */
  @Post('incoming')
  @Public()
  @ApiExcludeEndpoint()
  async incoming(
    @Req() req: Request,
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
        .type('text/xml')
        .send(this.twilio.buildRejectTwiml('This number is not yet configured. Please try again later.'));
      return;
    }

    const call = await this.callProcessing.createInboundCall({
      companyId: resolved.companyId,
      phoneNumberId: resolved.phoneNumberId,
      twilioCallSid: body.CallSid ?? null,
      fromNumber: body.From ?? null,
      toNumber,
    });

    const twiml = this.twilio.buildStreamTwiml({
      wssUrl: this.config.twilio.mediaStreamUrl,
      callId: call.id,
      companyId: resolved.companyId,
    });
    res.type('text/xml').send(twiml);
  }

  /** Twilio call status callback (fallback for calls that never streamed). */
  @Post('status')
  @Public()
  @ApiExcludeEndpoint()
  async status(@Res() res: Response, @Body() body: TwilioVoiceWebhookBody): Promise<void> {
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

  @Post('phone-number/verify-forwarding')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark call forwarding as verified' })
  async verifyForwarding(@CurrentCompanyId() companyId: string) {
    const number = await this.phoneNumbers.markForwardingVerified(companyId);
    if (!number) throw new ForbiddenError('Assign a phone number before verifying forwarding.');
    return respond(number, 'Forwarding verified.');
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

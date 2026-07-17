import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Readable } from 'node:stream';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { NotFoundError } from '../common/exceptions/domain.exception';
import { paginated, respond } from '../common/response';
import { TwilioService } from '../telephony/twilio.service';
import { CallsService } from './calls.service';
import { CallQueryDto, ConversationQueryDto } from './dto/calls.dto';

@ApiTags('Calls')
@ApiBearerAuth()
@Controller({ version: '1' })
export class CallsController {
  constructor(
    private readonly calls: CallsService,
    private readonly twilio: TwilioService,
  ) {}

  /**
   * Stream a call's recording audio (Twilio recordings require account auth,
   * so the dashboard plays and downloads them through this tenant-scoped
   * proxy). `?download=1` sets an attachment disposition.
   */
  @Get('calls/:id/recording')
  @ApiOperation({ summary: "Play or download a call's recording" })
  async getRecording(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Query('download') download: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const call = await this.calls.getCall(companyId, id);
    if (!call.recordingSid || call.recordingStatus !== 'completed') {
      throw new NotFoundError('No recording is available for this call.');
    }

    const upstream = await this.twilio.fetchRecordingMedia(call.recordingSid);
    if (!upstream.ok || !upstream.body) {
      throw new NotFoundError('The recording could not be retrieved.');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader(
      'Content-Disposition',
      download
        ? `attachment; filename="call-${call.id}.mp3"`
        : `inline; filename="call-${call.id}.mp3"`,
    );
    Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream).pipe(res);
  }

  @Get('calls')
  @ApiOperation({ summary: 'List calls' })
  async listCalls(@CurrentCompanyId() companyId: string, @Query() query: CallQueryDto) {
    const { items, pagination } = await this.calls.listCalls(companyId, query);
    return paginated(items, pagination, 'Calls retrieved.');
  }

  @Get('calls/:id')
  @ApiOperation({ summary: 'Get a call with its conversation' })
  async getCall(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    const call = await this.calls.getCall(companyId, id);
    return respond(call, 'Call retrieved.');
  }

  @Get('conversations')
  @ApiOperation({ summary: 'List conversations' })
  async listConversations(
    @CurrentCompanyId() companyId: string,
    @Query() query: ConversationQueryDto,
  ) {
    const { items, pagination } = await this.calls.listConversations(companyId, query);
    return paginated(items, pagination, 'Conversations retrieved.');
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Get a conversation with transcript and summary' })
  async getConversation(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    const conversation = await this.calls.getConversation(companyId, id);
    return respond(conversation, 'Conversation retrieved.');
  }
}

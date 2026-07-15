import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { paginated, respond } from '../common/response';
import { CallsService } from './calls.service';
import { CallQueryDto, ConversationQueryDto } from './dto/calls.dto';

@ApiTags('Calls')
@ApiBearerAuth()
@Controller({ version: '1' })
export class CallsController {
  constructor(private readonly calls: CallsService) {}

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

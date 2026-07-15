import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@rooferslabs/shared';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { paginated, respond } from '../common/response';
import { KnowledgeService } from './knowledge.service';
import {
  CreateKnowledgeArticleDto,
  KnowledgeQueryDto,
  UpdateKnowledgeArticleDto,
} from './dto/knowledge.dto';

@ApiTags('Knowledge Base')
@ApiBearerAuth()
@Controller({ path: 'knowledge-articles', version: '1' })
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get()
  @ApiOperation({ summary: 'List knowledge articles' })
  async list(@CurrentCompanyId() companyId: string, @Query() query: KnowledgeQueryDto) {
    const { items, pagination } = await this.knowledge.list(companyId, query);
    return paginated(items, pagination, 'Knowledge articles retrieved.');
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a knowledge article' })
  async create(@CurrentCompanyId() companyId: string, @Body() dto: CreateKnowledgeArticleDto) {
    const article = await this.knowledge.create(companyId, dto);
    return respond(article, 'Knowledge article created.');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a knowledge article' })
  async get(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    const article = await this.knowledge.getById(companyId, id);
    return respond(article, 'Knowledge article retrieved.');
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a knowledge article' })
  async update(
    @CurrentCompanyId() companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeArticleDto,
  ) {
    const article = await this.knowledge.update(companyId, id, dto);
    return respond(article, 'Knowledge article updated.');
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete (archive) a knowledge article' })
  async remove(@CurrentCompanyId() companyId: string, @Param('id') id: string) {
    await this.knowledge.remove(companyId, id);
    return respond(null, 'Knowledge article deleted.');
  }

  @Post('reindex')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Regenerate embeddings for all articles' })
  async reindex(@CurrentCompanyId() companyId: string) {
    const result = await this.knowledge.reindexAll(companyId);
    return respond(result, 'Knowledge base reindexed.');
  }
}

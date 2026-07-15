import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { respond } from '../common/response';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@Controller({ path: 'search', version: '1' })
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Global search across customers, conversations, appointments' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query (min 2 characters).' })
  async global(@CurrentCompanyId() companyId: string, @Query('q') q = '') {
    const results = await this.search.search(companyId, q);
    return respond(results, 'Search results retrieved.');
  }
}

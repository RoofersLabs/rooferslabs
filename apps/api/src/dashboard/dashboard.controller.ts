import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCompanyId } from '../common/decorators/current-company.decorator';
import { respond } from '../common/response';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: "Get today's operational overview" })
  async overview(@CurrentCompanyId() companyId: string) {
    const overview = await this.dashboard.getOverview(companyId);
    return respond(overview, 'Dashboard overview retrieved.');
  }
}

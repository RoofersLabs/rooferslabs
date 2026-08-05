import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AllowNoCompany } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { paginated, respond } from '../common/response';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { AdminService } from './admin.service';
import {
  AdminAnalyticsQueryDto,
  AdminCompanyQueryDto,
  AdminSearchQueryDto,
  CreateCompanyNoteDto,
} from './dto/admin.dto';

/**
 * The internal admin portal's API. Cross-tenant by design and staff-only.
 *
 * `PlatformAdminGuard` is applied to the whole controller, not per route: a new
 * endpoint added here is protected because it is here, rather than because
 * somebody remembered a decorator. It admits the staff email allow-list in
 * `@rooferslabs/shared` and nothing else — never `role`, which is
 * `UserRole.OWNER` for every customer on the platform.
 *
 * Read-only over tenant data. The only writes are company notes, which are
 * admin-owned and unreachable from any customer endpoint.
 *
 * `@AllowNoCompany` is required, not a loosening. `TenantGuard` and
 * `SubscriptionGuard` are global and run *before* any controller guard, and both
 * demand a `companyId` — they exist to stop a half-onboarded tenant reaching
 * another tenant's data. Platform staff are not tenants: they belong to no
 * company and pay no subscription, so without this every admin request was
 * refused with "You must create or join a company" before `PlatformAdminGuard`
 * was ever consulted.
 *
 * Opting out of the *tenant* checks does not opt out of authorisation. The
 * guard below still runs, and still requires an allow-listed staff address. The
 * two answer different questions: which company is this, versus may this person
 * see every company.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@AllowNoCompany()
@UseGuards(PlatformAdminGuard)
@Controller({ path: 'admin', version: '1' })
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Platform KPIs, activity feed and most active companies' })
  async overview() {
    return respond(await this.admin.getOverview(), 'Platform overview retrieved.');
  }

  @Get('companies')
  @ApiOperation({ summary: 'List every company with today’s usage' })
  async companies(@Query() query: AdminCompanyQueryDto) {
    const { items, pagination } = await this.admin.listCompanies(query);
    return paginated(items, pagination, 'Companies retrieved.');
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'One company’s operational detail' })
  async company(@Param('id') id: string) {
    return respond(await this.admin.getCompany(id), 'Company retrieved.');
  }

  @Get('live-calls')
  @ApiOperation({ summary: 'Calls currently in progress across every tenant' })
  async liveCalls() {
    return respond(await this.admin.liveCalls(), 'Live calls retrieved.');
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Platform analytics over a 7- or 30-day window' })
  async analytics(@Query() query: AdminAnalyticsQueryDto) {
    return respond(await this.admin.getAnalytics(Number(query.days ?? 7)), 'Analytics retrieved.');
  }

  @Get('search')
  @ApiOperation({ summary: 'Search companies, customers, calls and appointments platform-wide' })
  async search(@Query() query: AdminSearchQueryDto) {
    return respond(await this.admin.search(query.q ?? ''), 'Search completed.');
  }

  @Get('companies/:id/notes')
  @ApiOperation({ summary: 'Internal notes on a company' })
  async notes(@Param('id') id: string) {
    return respond(await this.admin.listNotes(id), 'Notes retrieved.');
  }

  @Post('companies/:id/notes')
  @ApiOperation({ summary: 'Add an internal note' })
  async addNote(
    @Param('id') id: string,
    @Body() dto: CreateCompanyNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return respond(await this.admin.addNote(id, user.id, dto.body), 'Note added.');
  }

  @Delete('notes/:noteId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an internal note' })
  async deleteNote(@Param('noteId') noteId: string) {
    await this.admin.deleteNote(noteId);
    return respond(null, 'Note deleted.');
  }
}

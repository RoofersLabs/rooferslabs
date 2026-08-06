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
  PauseCompanyDto,
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
 * Read-only over tenant *business* data. The only writes are company notes,
 * which are admin-owned and unreachable from any customer endpoint, and the
 * three approval endpoints, which move `companies.status` — the founder's
 * decision about whether an account may run at all, and the one thing on this
 * platform that is nobody else's to make.
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
  @ApiOperation({ summary: 'List every company with today’s usage and lifecycle counts' })
  async companies(@Query() query: AdminCompanyQueryDto) {
    const { items, pagination, counts } = await this.admin.listCompanies(query);
    return paginated(items, pagination, 'Companies retrieved.', { counts });
  }

  @Get('companies/:id')
  @ApiOperation({ summary: 'One company’s operational detail and approval history' })
  async company(@Param('id') id: string) {
    return respond(await this.admin.getCompany(id), 'Company retrieved.');
  }

  /**
   * The three founder decisions.
   *
   * PATCH on a sub-resource rather than one endpoint taking a target status:
   * each is a distinct decision with its own precondition (only a pending
   * account can be approved, only an active one paused, only a paused one
   * resumed), and naming them separately means the precondition is part of the
   * route rather than a branch inside a handler.
   *
   * They are the only writes to tenant lifecycle state anywhere in the API, and
   * they are behind `PlatformAdminGuard` by sitting in this controller. A
   * customer calling them — with any token, from any client — is refused before
   * the handler is reached.
   */
  @Patch('companies/:id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a pending account — grants full access immediately' })
  async approve(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return respond(await this.admin.approve(id, user), 'Account approved.');
  }

  @Patch('companies/:id/pause')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause an active account — revokes access immediately' })
  async pause(
    @Param('id') id: string,
    @Body() dto: PauseCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return respond(await this.admin.pause(id, user, dto), 'Account paused.');
  }

  @Patch('companies/:id/resume')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused account — restores full access immediately' })
  async resume(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return respond(await this.admin.resume(id, user), 'Account resumed.');
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

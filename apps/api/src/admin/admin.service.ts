import { Injectable } from '@nestjs/common';
import { ApiErrorCode, ConversationOutcome, type PaginationMeta } from '@rooferslabs/shared';
import type { Prisma } from '@prisma/client';
import { NotFoundError } from '../common/exceptions/domain.exception';
import { buildPaginationMeta, normalizePagination } from '../common/utils/pagination.util';
import { AdminRepository } from './admin.repository';
import type { AdminCompanyQueryDto } from './dto/admin.dto';

/** Outcomes that count as the AI having handled the caller's need. */
const RESOLVED = new Set<string>([
  ConversationOutcome.APPOINTMENT_REQUESTED,
  ConversationOutcome.INFORMATION_PROVIDED,
  ConversationOutcome.EMERGENCY,
  ConversationOutcome.LEAD_CAPTURED,
]);

/**
 * Midnight today, platform-wide.
 *
 * The customer dashboard uses each company's own timezone, which is right for
 * them. The platform view cannot: with tenants in several zones there is no
 * single "today", so this uses one fixed reference (US Eastern, where the
 * business operates) and the portal says so rather than implying otherwise.
 */
function startOfPlatformDay(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const at = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const local = Date.UTC(
    at('year'),
    at('month') - 1,
    at('day'),
    at('hour'),
    at('minute'),
    at('second'),
  );
  const offset = local - now.getTime();
  return new Date(Date.UTC(at('year'), at('month') - 1, at('day')) - offset);
}

function rate(resolved: number, total: number): number {
  return total ? Math.round((resolved / total) * 100) : 0;
}

@Injectable()
export class AdminService {
  constructor(private readonly repo: AdminRepository) {}

  /** The dashboard landing payload: KPIs, activity feed, most active tenants. */
  async getOverview() {
    const dayStart = startOfPlatformDay();
    const [
      [
        totalCompanies,
        activeCompanies,
        callsToday,
        leadsToday,
        appointmentsToday,
        emergenciesToday,
        activeToday,
      ],
      outcomes,
      duration,
      activity,
    ] = await Promise.all([
      this.repo.platformCounts(dayStart),
      this.repo.outcomeCounts(dayStart),
      this.repo.averageDuration(dayStart),
      this.buildActivity(),
    ]);

    const handled = outcomes.reduce((sum, row) => sum + row._count._all, 0);
    const resolved = outcomes
      .filter((row) => row.outcome && RESOLVED.has(row.outcome))
      .reduce((sum, row) => sum + row._count._all, 0);

    const activeCompanyIds = activeToday
      .map((row) => row.companyId)
      .filter((id): id is string => Boolean(id));
    const mostActive = await this.mostActiveToday(activeCompanyIds, dayStart);

    return {
      metrics: {
        totalCompanies,
        activeCompanies,
        activeCompaniesToday: activeCompanyIds.length,
        callsToday,
        leadsToday,
        appointmentsToday,
        emergenciesToday,
        resolutionRate: rate(resolved, handled),
        averageCallSeconds: Math.round(duration._avg.durationSeconds ?? 0),
      },
      recentActivity: activity,
      activeCompanies: mostActive,
      /** Named so the UI can label the window honestly rather than say "today". */
      dayStartsAt: dayStart.toISOString(),
    };
  }

  /** Companies with today's usage attached, searchable and filterable. */
  async listCompanies(query: AdminCompanyQueryDto): Promise<{
    items: unknown[];
    pagination: PaginationMeta;
  }> {
    const { skip, take, page, limit } = normalizePagination(query.page, query.limit);
    const dayStart = startOfPlatformDay();

    const where: Prisma.CompanyWhereInput = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      const term = query.search.trim();
      where.AND = [
        {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const orderBy: Prisma.CompanyOrderByWithRelationInput =
      query.sort === 'name' ? { name: 'asc' } : { createdAt: 'desc' };

    const [companies, total] = await this.repo.listCompanies(where, orderBy, skip, take);
    const totals = await this.todayTotals(
      companies.map((c) => c.id),
      dayStart,
    );

    const items = companies.map((company) => {
      const owner = company.users[0];
      return {
        id: company.id,
        name: company.name,
        status: company.status,
        ownerName: owner
          ? [owner.firstName, owner.lastName].filter(Boolean).join(' ') || null
          : null,
        ownerEmail: owner?.email ?? company.email ?? null,
        lastActiveAt: owner?.lastActiveAt?.toISOString() ?? null,
        createdAt: company.createdAt.toISOString(),
        ...(totals.get(company.id) ?? { callsToday: 0, leadsToday: 0, appointmentsToday: 0 }),
      };
    });

    return { items, pagination: buildPaginationMeta(page, limit, total) };
  }

  /** One company's operational picture. */
  async getCompany(id: string) {
    const company = await this.repo.companyById(id);
    if (!company) {
      throw new NotFoundError('Company not found.', ApiErrorCode.COMPANY_NOT_FOUND);
    }

    const [
      [calls, conversations, appointments, emergencies, customers, duration],
      outcomes,
      recentCalls,
      recentCustomers,
      recentAppointments,
      notes,
    ] = await Promise.all([
      this.repo.companyUsage(id),
      this.repo.companyOutcomes(id),
      this.repo.recentConversations(id),
      this.repo.recentCustomers(id),
      this.repo.recentAppointments(id),
      this.repo.listNotes(id),
    ]);

    const handled = outcomes.reduce((sum, row) => sum + row._count._all, 0);
    const resolved = outcomes
      .filter((row) => row.outcome && RESOLVED.has(row.outcome))
      .reduce((sum, row) => sum + row._count._all, 0);
    const owner = company.users[0];

    return {
      company: {
        id: company.id,
        name: company.name,
        status: company.status,
        email: company.email,
        phone: company.phone,
        city: company.city,
        state: company.state,
        timezone: company.timezone,
        createdAt: company.createdAt.toISOString(),
        onboardedAt: company.onboardedAt?.toISOString() ?? null,
        receptionistEnabled: company.receptionistEnabled,
        phoneNumbers: company.phoneNumbers,
        ownerName: owner
          ? [owner.firstName, owner.lastName].filter(Boolean).join(' ') || null
          : null,
        ownerEmail: owner?.email ?? null,
        lastActiveAt: owner?.lastActiveAt?.toISOString() ?? null,
      },
      usage: {
        totalCalls: calls,
        totalLeads: conversations,
        totalAppointments: appointments,
        emergencyCalls: emergencies,
        totalCustomers: customers,
        resolutionRate: rate(resolved, handled),
        averageCallSeconds: Math.round(duration._avg.durationSeconds ?? 0),
      },
      recentCalls,
      recentCustomers,
      recentAppointments,
      notes,
    };
  }

  liveCalls() {
    return this.repo.liveCalls();
  }

  /** Platform analytics over a 7- or 30-day window. */
  async getAnalytics(days: number) {
    const window = days === 30 ? 30 : 7;
    const since = new Date(Date.now() - (window - 1) * 24 * 60 * 60 * 1000);

    const [series, [callTotals, outcomeTotals, appointmentTotals, emergencyTotals]] =
      await Promise.all([this.repo.dailySeries(since), this.repo.companyTotals(since)]);

    const [companies] = await this.repo.listCompanies({}, { name: 'asc' }, 0, 200);
    const byId = new Map(companies.map((c) => [c.id, c.name]));

    const rows = new Map<
      string,
      {
        companyId: string;
        companyName: string;
        calls: number;
        leads: number;
        appointments: number;
        emergencies: number;
        resolved: number;
        handled: number;
        averageCallSeconds: number;
      }
    >();
    const row = (companyId: string) => {
      let existing = rows.get(companyId);
      if (!existing) {
        existing = {
          companyId,
          companyName: byId.get(companyId) ?? 'Unknown company',
          calls: 0,
          leads: 0,
          appointments: 0,
          emergencies: 0,
          resolved: 0,
          handled: 0,
          averageCallSeconds: 0,
        };
        rows.set(companyId, existing);
      }
      return existing;
    };

    for (const r of callTotals) {
      const target = row(r.companyId);
      target.calls = r._count._all;
      target.averageCallSeconds = Math.round(r._avg.durationSeconds ?? 0);
    }
    for (const r of outcomeTotals) {
      const target = row(r.companyId);
      target.leads += r._count._all;
      target.handled += r._count._all;
      if (r.outcome && RESOLVED.has(r.outcome)) target.resolved += r._count._all;
    }
    for (const r of appointmentTotals) row(r.companyId).appointments = r._count._all;
    for (const r of emergencyTotals) row(r.companyId).emergencies = r._count._all;

    return {
      window,
      series: series.map((point) => ({
        day: point.day.toISOString(),
        calls: Number(point.calls),
        leads: Number(point.leads),
        appointments: Number(point.appointments),
      })),
      companies: [...rows.values()]
        .map(({ resolved, handled, ...rest }) => ({
          ...rest,
          resolutionRate: rate(resolved, handled),
        }))
        .sort((a, b) => b.calls - a.calls),
    };
  }

  async search(term: string) {
    const trimmed = term.trim();
    if (trimmed.length < 2) {
      return { companies: [], customers: [], conversations: [], appointments: [] };
    }
    const [companies, customers, conversations, appointments] = await this.repo.search(trimmed);
    return { companies, customers, conversations, appointments };
  }

  listNotes(companyId: string) {
    return this.repo.listNotes(companyId);
  }

  async addNote(companyId: string, authorId: string, body: string) {
    await this.getCompanyOrThrow(companyId);
    return this.repo.createNote(companyId, authorId, body.trim());
  }

  async deleteNote(id: string) {
    const { count } = await this.repo.deleteNote(id);
    if (!count) throw new NotFoundError('Note not found.');
  }

  // ---- internals ----------------------------------------------------------

  private async getCompanyOrThrow(id: string) {
    const company = await this.repo.companyById(id);
    if (!company) {
      throw new NotFoundError('Company not found.', ApiErrorCode.COMPANY_NOT_FOUND);
    }
    return company;
  }

  private async todayTotals(companyIds: string[], dayStart: Date) {
    const map = new Map<
      string,
      { callsToday: number; leadsToday: number; appointmentsToday: number }
    >();
    if (!companyIds.length) return map;

    const [calls, leads, appointments] = await this.repo.todayTotalsFor(companyIds, dayStart);
    const ensure = (id: string) => {
      let entry = map.get(id);
      if (!entry) {
        entry = { callsToday: 0, leadsToday: 0, appointmentsToday: 0 };
        map.set(id, entry);
      }
      return entry;
    };
    for (const r of calls) ensure(r.companyId).callsToday = r._count._all;
    for (const r of leads) ensure(r.companyId).leadsToday = r._count._all;
    for (const r of appointments) ensure(r.companyId).appointmentsToday = r._count._all;
    return map;
  }

  private async mostActiveToday(companyIds: string[], dayStart: Date) {
    if (!companyIds.length) return [];
    const [companies] = await this.repo.listCompanies(
      { id: { in: companyIds } },
      { name: 'asc' },
      0,
      10,
    );
    const totals = await this.todayTotals(companyIds, dayStart);
    return companies
      .map((company) => ({
        id: company.id,
        name: company.name,
        lastActiveAt: company.users[0]?.lastActiveAt?.toISOString() ?? null,
        ...(totals.get(company.id) ?? { callsToday: 0, leadsToday: 0, appointmentsToday: 0 }),
      }))
      .sort((a, b) => b.callsToday - a.callsToday);
  }

  /**
   * The activity feed, merged from the domain tables and sorted newest first.
   * There is no event log to read, and inventing one would mean storing a
   * second copy of facts these tables already hold.
   */
  private async buildActivity() {
    const take = 12;
    const [companies, conversations, appointments] = await this.repo.recentActivity(take);

    type Event = {
      id: string;
      kind: 'company_onboarded' | 'emergency' | 'lead' | 'appointment';
      title: string;
      description: string | null;
      companyId: string | null;
      companyName: string | null;
      createdAt: string;
    };

    const events: Event[] = [
      ...companies.map((c) => ({
        id: `company-${c.id}`,
        kind: 'company_onboarded' as const,
        title: 'New company onboarded',
        description: c.name,
        companyId: c.id,
        companyName: c.name,
        createdAt: c.createdAt.toISOString(),
      })),
      ...conversations.map((c) => ({
        id: `conversation-${c.id}`,
        kind: c.isEmergency ? ('emergency' as const) : ('lead' as const),
        title: c.isEmergency ? 'Emergency call detected' : 'Lead captured',
        description: c.summary,
        companyId: c.companyId,
        companyName: c.company?.name ?? null,
        createdAt: c.createdAt.toISOString(),
      })),
      ...appointments.map((a) => ({
        id: `appointment-${a.id}`,
        kind: 'appointment' as const,
        title: 'Appointment booked',
        description: a.serviceRequested,
        companyId: a.companyId,
        companyName: a.company?.name ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    ];

    return events.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, take);
  }
}

import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Every cross-tenant read the admin portal makes, in one place.
 *
 * This is the only repository in the codebase that is *not* scoped to a company
 * id. That is the whole point of it, and the reason it exists as its own file:
 * a query without a `companyId` filter is a bug anywhere else, so keeping them
 * together makes the exception auditable rather than scattered.
 *
 * Nothing here writes to tenant data. The portal observes; it does not operate
 * the customer's account for them. The single exception is `company_notes`,
 * which is admin-owned data no customer endpoint can reach.
 */
@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ---- Platform counters --------------------------------------------------

  /**
   * The dashboard's headline numbers, in one round trip.
   *
   * `$transaction` runs these on a single connection and a consistent snapshot,
   * so the numbers on the page cannot disagree with each other — "calls today"
   * being newer than "leads today" would make the ratio between them a lie.
   */
  platformCounts(dayStart: Date) {
    return this.prisma.$transaction([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { status: 'ACTIVE' } }),
      this.prisma.call.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.conversation.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.appointment.count({
        where: { deletedAt: null, createdAt: { gte: dayStart } },
      }),
      this.prisma.conversation.count({
        where: { isEmergency: true, createdAt: { gte: dayStart } },
      }),
      // Companies with at least one call today — "active" as in *using it*,
      // which is a different question from the ACTIVE lifecycle status above.
      this.prisma.call.findMany({
        where: { createdAt: { gte: dayStart } },
        distinct: ['companyId'],
        select: { companyId: true },
      }),
    ]);
  }

  /** Outcome mix across the platform today, for the resolution rate. */
  outcomeCounts(dayStart: Date) {
    return this.prisma.conversation.groupBy({
      by: ['outcome'],
      where: { createdAt: { gte: dayStart } },
      orderBy: { outcome: 'asc' },
      _count: { _all: true },
    });
  }

  /** Mean handled-call duration today, in seconds. */
  averageDuration(dayStart: Date) {
    return this.prisma.call.aggregate({
      where: { createdAt: { gte: dayStart }, durationSeconds: { gt: 0 } },
      _avg: { durationSeconds: true },
    });
  }

  // ---- Companies ----------------------------------------------------------

  listCompanies(
    where: Prisma.CompanyWhereInput,
    orderBy: Prisma.CompanyOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          users: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            take: 1,
            select: { email: true, firstName: true, lastName: true, lastActiveAt: true },
          },
        },
      }),
      this.prisma.company.count({ where }),
    ]);
  }

  /**
   * Today's call/lead/appointment counts for a set of companies.
   *
   * Three grouped queries rather than per-company counts: a platform with 500
   * tenants would otherwise issue 1500 round trips to render one table.
   */
  todayTotalsFor(companyIds: string[], dayStart: Date) {
    const scope = { companyId: { in: companyIds }, createdAt: { gte: dayStart } };
    // `Promise.all`, not `$transaction`: the wrapper widens these three differing
    // group-by shapes into a union that loses `_count`.
    return Promise.all([
      this.prisma.call.groupBy({
        by: ['companyId'],
        where: scope,
        orderBy: { companyId: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.conversation.groupBy({
        by: ['companyId'],
        where: scope,
        orderBy: { companyId: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['companyId'],
        where: { ...scope, deletedAt: null },
        orderBy: { companyId: 'asc' },
        _count: { _all: true },
      }),
    ]);
  }

  companyById(id: string) {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        users: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            lastActiveAt: true,
          },
        },
        phoneNumbers: { select: { phoneNumber: true, status: true } },
      },
    });
  }

  /** Lifetime usage for one company — the numbers its account manager needs. */
  companyUsage(companyId: string) {
    return this.prisma.$transaction([
      this.prisma.call.count({ where: { companyId } }),
      this.prisma.conversation.count({ where: { companyId } }),
      this.prisma.appointment.count({ where: { companyId, deletedAt: null } }),
      this.prisma.conversation.count({ where: { companyId, isEmergency: true } }),
      this.prisma.customer.count({ where: { companyId, deletedAt: null } }),
      this.prisma.call.aggregate({
        where: { companyId, durationSeconds: { gt: 0 } },
        _avg: { durationSeconds: true },
      }),
    ]);
  }

  companyOutcomes(companyId: string) {
    return this.prisma.conversation.groupBy({
      by: ['outcome'],
      where: { companyId },
      orderBy: { outcome: 'asc' },
      _count: { _all: true },
    });
  }

  recentConversations(companyId: string, take = 10) {
    return this.prisma.conversation.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        call: { select: { durationSeconds: true, fromNumber: true, createdAt: true } },
      },
    });
  }

  recentCustomers(companyId: string, take = 10) {
    return this.prisma.customer.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  recentAppointments(companyId: string, take = 10) {
    return this.prisma.appointment.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      include: { customer: { select: { id: true, fullName: true, phone: true } } },
    });
  }

  // ---- Platform activity feed --------------------------------------------

  /**
   * The feed is assembled from what already happened rather than from an event
   * log: there is no event table, and adding one would mean writing a second
   * copy of facts the domain tables already hold.
   */
  recentActivity(take: number) {
    return this.prisma.$transaction([
      this.prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: { id: true, name: true, createdAt: true },
      }),
      this.prisma.conversation.findMany({
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          outcome: true,
          isEmergency: true,
          summary: true,
          createdAt: true,
          companyId: true,
          company: { select: { name: true } },
        },
      }),
      this.prisma.appointment.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take,
        select: {
          id: true,
          serviceRequested: true,
          createdAt: true,
          companyId: true,
          company: { select: { name: true } },
        },
      }),
    ]);
  }

  // ---- Live calls ---------------------------------------------------------

  /** Calls that have not finished. Polled by the portal; no stream to keep open. */
  liveCalls() {
    return this.prisma.call.findMany({
      where: { status: { in: ['INCOMING', 'RINGING', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        fromNumber: true,
        status: true,
        startedAt: true,
        createdAt: true,
        companyId: true,
        company: { select: { name: true } },
        conversation: { select: { id: true, isEmergency: true } },
      },
    });
  }

  // ---- Analytics ----------------------------------------------------------

  /**
   * Daily counts over a window, grouped in the database rather than in Node.
   * Raw SQL because Prisma's `groupBy` cannot truncate a timestamp to a day.
   */
  dailySeries(since: Date) {
    return this.prisma.$queryRaw<
      { day: Date; calls: bigint; leads: bigint; appointments: bigint }[]
    >`
      SELECT d.day,
             COALESCE(c.n, 0) AS calls,
             COALESCE(v.n, 0) AS leads,
             COALESCE(a.n, 0) AS appointments
      FROM generate_series(date_trunc('day', ${since}::timestamp), date_trunc('day', now()), '1 day') AS d(day)
      LEFT JOIN (
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS n
        FROM calls WHERE "createdAt" >= ${since} GROUP BY 1
      ) c ON c.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS n
        FROM conversations WHERE "createdAt" >= ${since} GROUP BY 1
      ) v ON v.day = d.day
      LEFT JOIN (
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*)::bigint AS n
        FROM appointments WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL GROUP BY 1
      ) a ON a.day = d.day
      ORDER BY d.day ASC
    `;
  }

  /**
   * Per-company totals over a window, for the analytics table.
   *
   * `Promise.all` rather than `$transaction`: these four shapes differ, and the
   * transaction wrapper widens their result types into a union that loses
   * `_count`. Analytics is a trend view, so it does not need the single-snapshot
   * guarantee the dashboard counters do.
   */
  companyTotals(since: Date) {
    return Promise.all([
      this.prisma.call.groupBy({
        by: ['companyId'],
        where: { createdAt: { gte: since } },
        orderBy: { companyId: 'asc' },
        _count: { _all: true },
        _avg: { durationSeconds: true },
      }),
      this.prisma.conversation.groupBy({
        by: ['companyId', 'outcome'],
        where: { createdAt: { gte: since } },
        orderBy: { companyId: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.appointment.groupBy({
        by: ['companyId'],
        where: { createdAt: { gte: since }, deletedAt: null },
        orderBy: { companyId: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.conversation.groupBy({
        by: ['companyId'],
        where: { createdAt: { gte: since }, isEmergency: true },
        orderBy: { companyId: 'asc' },
        _count: { _all: true },
      }),
    ]);
  }

  // ---- Global search ------------------------------------------------------

  search(term: string) {
    const contains = { contains: term, mode: 'insensitive' as const };
    return this.prisma.$transaction([
      this.prisma.company.findMany({
        where: { OR: [{ name: contains }, { email: contains }, { phone: contains }] },
        take: 5,
        select: { id: true, name: true, status: true },
      }),
      this.prisma.customer.findMany({
        where: {
          deletedAt: null,
          OR: [{ fullName: contains }, { phone: contains }, { email: contains }],
        },
        take: 5,
        select: {
          id: true,
          fullName: true,
          phone: true,
          companyId: true,
          company: { select: { name: true } },
        },
      }),
      this.prisma.conversation.findMany({
        where: { OR: [{ summary: contains }, { call: { fromNumber: contains } }] },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          summary: true,
          createdAt: true,
          companyId: true,
          company: { select: { name: true } },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          deletedAt: null,
          OR: [{ serviceRequested: contains }, { propertyAddress: contains }],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          serviceRequested: true,
          status: true,
          companyId: true,
          company: { select: { name: true } },
        },
      }),
    ]);
  }

  // ---- Internal notes (the portal's only writes) --------------------------

  listNotes(companyId: string) {
    return this.prisma.companyNote.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  createNote(companyId: string, authorId: string, body: string) {
    return this.prisma.companyNote.create({ data: { companyId, authorId, body } });
  }

  deleteNote(id: string) {
    return this.prisma.companyNote.deleteMany({ where: { id } });
  }
}

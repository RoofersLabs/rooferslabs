import { Injectable, Logger } from '@nestjs/common';
import { ApiErrorCode, CompanyStatus } from '@rooferslabs/shared';
import {
  AccountPausedError,
  AccountPendingApprovalError,
  NotFoundError,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Which subsystem asked. Blocked work is logged with one of these, so "what did
 * this tenant stop being able to do, and when" is a single grep rather than an
 * archaeology exercise across a dozen log formats.
 *
 * A closed union rather than a free string: a new subsystem has to name itself
 * here, which is a one-line diff a reviewer sees, and it keeps the log
 * vocabulary from drifting into `telephony`, `Telephony` and `telephony-inbound`
 * meaning the same thing.
 */
export type TenantGatedService =
  | 'api.http'
  | 'telephony.inbound'
  | 'telephony.status-webhook'
  | 'telephony.recording-webhook'
  | 'telephony.media-stream'
  | 'telephony.live-call'
  | 'telephony.sms'
  | 'openai.responses'
  | 'openai.embeddings'
  | 'openai.realtime'
  | 'knowledge.retrieval'
  | 'calls.finalize'
  | 'notifications.create'
  | 'notifications.push';

/** What a gated subsystem learns about a tenant it may not work for. */
export interface TenantGateResult {
  allowed: boolean;
  /** Null only when the company row has gone. */
  status: CompanyStatus | null;
}

/**
 * The platform's single answer to "may we do work for this tenant right now?"
 *
 * Every runtime subsystem — the HTTP API, telephony, the OpenAI adapters, the
 * post-call pipeline, notifications — asks this service and nothing else. That
 * is the whole point of it existing: a rule enforced in fourteen places is
 * fourteen chances to enforce it slightly differently, and the one that drifts
 * is the one that keeps a paused tenant's receptionist answering calls.
 *
 * Two entry points, for two very different callers:
 *
 * - {@link assertActive} **throws**, and is for the HTTP boundary, where a
 *   refusal is a response the client must be able to branch on.
 * - {@link ensureActive} **returns a boolean and logs**, and is for everything
 *   that is not answering an HTTP request — a websocket, a webhook, a deferred
 *   pipeline, a scheduled pass. Those callers have nobody to return a status
 *   code to; what they need is to stop quietly and leave a trace.
 *
 * **The read is deliberately uncached, and that is the cache-invalidation
 * story.** `CompaniesService` caches the company profile in Redis for five
 * minutes, which is right for rendering a settings page and wrong for an
 * authorization decision. A founder clicking Pause has to stop a call that is
 * ringing *now*, not within five minutes — so this asks the database, on a
 * primary key, every time. There is no cache here to invalidate, no propagation
 * delay to reason about, and no window in which two API tasks disagree about
 * whether a tenant is switched on. The cost is one indexed lookup on paths that
 * already do far more than that.
 */
@Injectable()
export class AccountStatusService {
  private readonly logger = new Logger(AccountStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The tenant's current status, straight from the database. Null when the
   * company no longer exists.
   */
  async getStatus(companyId: string): Promise<CompanyStatus | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { status: true },
    });
    return company ? (company.status as CompanyStatus) : null;
  }

  /** Whether the tenant may be worked for. Never throws, never logs. */
  async isActive(companyId: string): Promise<boolean> {
    return (await this.getStatus(companyId)) === CompanyStatus.ACTIVE;
  }

  /**
   * The gate for every subsystem that is not answering an HTTP request.
   *
   * Returns false and writes one structured operational line when the tenant may
   * not be worked for. Callers stop; they do not throw, retry, or escalate — a
   * paused tenant is a settled fact, not a transient failure, and retrying it
   * would burn the infrastructure this gate exists to protect.
   *
   * It deliberately writes no audit record. `audit_logs` is the founder's
   * ledger of lifecycle decisions — approve, pause, resume — and filling it with
   * a row per blocked webhook would bury the handful of entries that matter
   * under thousands that do not.
   */
  async ensureActive(
    companyId: string,
    service: TenantGatedService,
    operation: string,
  ): Promise<TenantGateResult> {
    const status = await this.getStatus(companyId);
    if (status === CompanyStatus.ACTIVE) return { allowed: true, status };

    this.logBlocked(companyId, status, service, operation);
    return { allowed: false, status };
  }

  /**
   * One line per blocked operation, in one format.
   *
   * `tenant-gate` leads so the whole class of event is one grep across every
   * subsystem, and the fields are `key=value` so a log pipeline can index them
   * without a parser per service. The timestamp is explicit as well as being the
   * log line's own: these lines get copied into tickets, where the surrounding
   * metadata does not travel with them.
   *
   * Warn, not error: nothing is broken. The platform is doing exactly what it
   * was told to do, and a page at 3am because a paused tenant's number rang
   * would be the alert that trains everyone to ignore alerts.
   */
  private logBlocked(
    companyId: string,
    status: CompanyStatus | null,
    service: TenantGatedService,
    operation: string,
  ): void {
    this.logger.warn(
      `tenant-gate blocked service=${service} operation=${operation} ` +
        `tenant=${companyId} status=${status ?? 'MISSING'} ` +
        `reason=${reasonFor(status)} at=${new Date().toISOString()}`,
    );
  }

  /**
   * Refuse the request unless the tenant is approved and not paused.
   *
   * `alsoAdmitted` carries the statuses a particular route has declared it can
   * serve anyway — in practice `ONBOARDING`, for the setup wizard. ACTIVE is
   * never in that list because it does not need to be; the list only ever widens
   * the gate, never narrows it.
   *
   * ONBOARDING is refused with the pending message rather than a message of its
   * own. A tenant in setup has not been declined — it has not been *asked* yet
   * — so "awaiting approval" is true of it, and if it reaches a route that did
   * not opt in, that is the honest thing to say.
   */
  async assertActive(
    companyId: string,
    alsoAdmitted: readonly CompanyStatus[] = [],
  ): Promise<void> {
    const status = await this.getStatus(companyId);

    // The principal names a company that no longer exists. Refusing is the only
    // safe reading: there is no tenant to be scoped to.
    if (status === null) {
      throw new NotFoundError('Company not found.', ApiErrorCode.COMPANY_NOT_FOUND);
    }

    if (status === CompanyStatus.ACTIVE || alsoAdmitted.includes(status)) return;

    this.logBlocked(companyId, status, 'api.http', 'request');

    switch (status) {
      case CompanyStatus.PAUSED:
        throw new AccountPausedError();
      case CompanyStatus.ONBOARDING:
      case CompanyStatus.PENDING_APPROVAL:
        throw new AccountPendingApprovalError();
      default: {
        // `status` has narrowed to `never`, so a value added to CompanyStatus
        // without a decision here fails to compile. Until someone makes that
        // decision the runtime refuses, which is the right direction to fail.
        const unhandled: never = status;
        void unhandled;
        throw new AccountPendingApprovalError();
      }
    }
  }
}

/** The short machine-readable cause that goes in the log line. */
function reasonFor(status: CompanyStatus | null): string {
  switch (status) {
    case CompanyStatus.PAUSED:
      return 'account_paused';
    case CompanyStatus.PENDING_APPROVAL:
      return 'awaiting_founder_approval';
    case CompanyStatus.ONBOARDING:
      return 'setup_incomplete';
    case null:
      return 'company_not_found';
    default:
      return 'not_active';
  }
}

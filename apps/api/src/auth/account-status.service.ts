import { Injectable } from '@nestjs/common';
import { ApiErrorCode, CompanyStatus } from '@rooferslabs/shared';
import {
  AccountPausedError,
  AccountPendingApprovalError,
  NotFoundError,
} from '../common/exceptions/domain.exception';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Whether a tenant may use the platform right now. The API asks this question
 * here and nowhere else.
 *
 * The answer is `companies.status` and only `companies.status`. `approvedAt`,
 * `pausedAt` and the rest record how a tenant arrived at its status and are
 * never consulted — one column decides, so there is no combination of dates
 * that can disagree with it.
 *
 * **This read is deliberately uncached.** `CompaniesService` caches the company
 * in Redis for five minutes, which is right for a profile and wrong for an
 * authorization decision: the founder clicking Pause has to take effect on the
 * tenant's next request, not at some point over the following five minutes.
 * The cost is one primary-key lookup on a request that has already made several
 * — measurably nothing next to the Clerk verification above it.
 */
@Injectable()
export class AccountStatusService {
  constructor(private readonly prisma: PrismaService) {}

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
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { status: true },
    });

    // The principal names a company that no longer exists. Refusing is the only
    // safe reading: there is no tenant to be scoped to.
    if (!company) {
      throw new NotFoundError('Company not found.', ApiErrorCode.COMPANY_NOT_FOUND);
    }

    const status = company.status as CompanyStatus;
    if (status === CompanyStatus.ACTIVE || alsoAdmitted.includes(status)) return;

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

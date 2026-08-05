import { Injectable, Logger } from '@nestjs/common';
import { isPlatformAdminEmail } from '@rooferslabs/shared';
import { ForbiddenError } from '../common/exceptions/domain.exception';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { ClerkService } from './clerk.service';

/**
 * How long a confirmed identity is trusted before Clerk is asked again.
 *
 * The portal serves one person and issues several requests per page, so asking
 * Clerk on every one of them would spend a round trip to prove a fact that
 * changes about never. A minute is short enough that removing an address from
 * the allow-list — or from the Clerk account — takes effect while the operator
 * is still watching, and long enough that a page load costs one call.
 */
const CONFIRMATION_TTL_MS = 60_000;

/**
 * Whether someone is rooferslabs staff. The API asks this question here and
 * nowhere else.
 *
 * There is one rule, in `@rooferslabs/shared`, and one place that applies it, so
 * the guard on the admin API and the answer handed to the browser cannot
 * disagree — a portal that renders for someone the API then refuses is its own
 * kind of bug, and it is the kind that gets debugged as an outage.
 *
 * The answer comes from two independent sources, and both must agree.
 *
 * **The account record.** Its email came from Clerk when the account was
 * provisioned. Cheap, and enough to refuse everybody who is not staff without
 * touching the network — which is every caller except the founder.
 *
 * **Clerk itself, live.** The local copy is only a copy: it is written once at
 * provisioning and never refreshed, so an address changed in Clerk afterwards
 * would leave our record asserting something Clerk no longer agrees with.
 * Before granting anything, the account's *current* primary email is fetched
 * and checked again. That makes the identity provider the source of truth for
 * administrator status rather than a row in our database — and it means nothing
 * that can write to that database can grant itself the portal.
 *
 * Failure is closed in every direction: no principal, no email, an address that
 * is not on the list, or Clerk being unreachable all end in "not staff".
 */
@Injectable()
export class PlatformAdminService {
  private readonly logger = new Logger(PlatformAdminService.name);
  /** clerkUserId → when its confirmation expires. Staff only, so it stays tiny. */
  private readonly confirmed = new Map<string, number>();

  constructor(private readonly clerk: ClerkService) {}

  /**
   * Whether this principal may use the admin portal.
   *
   * Takes the principal rather than an email so callers cannot accidentally ask
   * about an address without an account behind it.
   */
  async isAdmin(user: AuthenticatedUser | undefined): Promise<boolean> {
    if (!isPlatformAdminEmail(user?.email)) return false;
    return this.confirmWithClerk(user!.clerkUserId);
  }

  /**
   * The same question, for callers that are guarding something.
   *
   * The refusal is deliberately the 403 any other forbidden resource returns:
   * it does not confirm that an admin surface exists.
   */
  async assertAdmin(user: AuthenticatedUser | undefined): Promise<void> {
    if (!(await this.isAdmin(user))) {
      throw new ForbiddenError('You do not have access to this resource.');
    }
  }

  /** Whether Clerk still reports an allow-listed primary email for this account. */
  private async confirmWithClerk(clerkUserId: string): Promise<boolean> {
    const until = this.confirmed.get(clerkUserId);
    if (until !== undefined && until > Date.now()) return true;

    try {
      const profile = await this.clerk.getProfile(clerkUserId);
      if (!isPlatformAdminEmail(profile.email)) {
        // The stored email says staff and Clerk disagrees: the address moved
        // after provisioning. Worth a line — it is the only way this surfaces.
        this.logger.warn(
          `Refused platform access for ${clerkUserId}: the local record is allow-listed but Clerk's primary email is not.`,
        );
        this.confirmed.delete(clerkUserId);
        return false;
      }
      this.confirmed.set(clerkUserId, Date.now() + CONFIRMATION_TTL_MS);
      return true;
    } catch (error) {
      // An error from Clerk is a refusal, not an exception to one: the portal
      // going dark during an identity-provider outage is the correct trade for
      // never opening it on a failed lookup.
      this.logger.error(
        `Refused platform access for ${clerkUserId}: could not confirm the account with Clerk.`,
        error as Error,
      );
      return false;
    }
  }
}

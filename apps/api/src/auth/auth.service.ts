import { Injectable } from '@nestjs/common';
import { PlatformRole, type CompanyStatus, type OnboardingStep } from '@rooferslabs/shared';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { BillingService, type SubscriptionSummary } from '../billing/services/billing.service';
import { AppConfigService } from '../config/app-config.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ClerkService } from './clerk.service';
import { PlatformAdminService } from './platform-admin.service';

export interface SessionCompanySummary {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  onboardingStep: OnboardingStep;
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface SessionResponse {
  user: AuthenticatedUser;
  company: SessionCompanySummary | null;
  /** Billing state, so the client can route to /billing without a second call. */
  subscription: SubscriptionSummary | null;
  /**
   * Whether billing is switched on platform-wide. The client's route guard uses
   * this to skip the payment step entirely, so the flag is enforced from one
   * place on both sides instead of being hardcoded per environment.
   */
  paymentsEnabled: boolean;
}

/**
 * Coordinates the authentication boundary: verify a Clerk token, then resolve
 * (and lazily provision) the platform user it maps to.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly clerk: ClerkService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
    private readonly config: AppConfigService,
    private readonly admins: PlatformAdminService,
  ) {}

  /** Build the bootstrap session payload for the authenticated user. */
  async getSession(user: AuthenticatedUser): Promise<SessionResponse> {
    const paymentsEnabled = this.config.payments.enabled;
    // The client's admin gate reads `platformRole` off this payload, so it is
    // the confirmed answer rather than the cheap one the principal carries:
    // whatever the browser is told here is exactly what the admin API will
    // honour a moment later. Costs a Clerk call only for staff — for everybody
    // else the allow-list settles it without leaving the process.
    const sessionUser = await this.withConfirmedPlatformRole(user);
    if (!sessionUser.companyId) {
      return { user: sessionUser, company: null, subscription: null, paymentsEnabled };
    }

    // Skipped entirely when payments are off: there is no subscription to
    // report, and reporting one would imply a wall that is not being enforced.
    const subscription = paymentsEnabled
      ? await this.billing.getSummary(sessionUser.companyId)
      : null;
    const company = await this.prisma.company.findUnique({
      where: { id: sessionUser.companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        onboardingStep: true,
        logoUrl: true,
        primaryColor: true,
      },
    });

    return {
      user: sessionUser,
      subscription,
      paymentsEnabled,
      company: company
        ? {
            id: company.id,
            name: company.name,
            slug: company.slug,
            status: company.status as CompanyStatus,
            onboardingStep: company.onboardingStep as OnboardingStep,
            logoUrl: company.logoUrl,
            primaryColor: company.primaryColor,
          }
        : null,
    };
  }

  /**
   * The principal with its platform role settled by the one authority.
   *
   * `toAuthenticatedUser` derives the field from the account's email, which is
   * right for every request that only needs to know whether to bother. The
   * session is different: the browser decides what to render from this value,
   * so it gets the answer that has been confirmed against Clerk — the same call
   * `PlatformAdminGuard` makes, sharing its cache.
   */
  private async withConfirmedPlatformRole(user: AuthenticatedUser): Promise<AuthenticatedUser> {
    if (user.platformRole !== PlatformRole.OWNER) return user;
    const confirmed = await this.admins.isAdmin(user);
    return confirmed ? user : { ...user, platformRole: PlatformRole.NONE };
  }

  /**
   * Resolve the authenticated principal for a bearer token. Provisions the
   * local user record on first sight by pulling the profile from Clerk.
   */
  async authenticate(token: string): Promise<AuthenticatedUser> {
    const { clerkUserId } = await this.clerk.verifySessionToken(token);

    const existing = await this.users.findByClerkId(clerkUserId);
    if (existing) {
      void this.users.touchActivity(existing.id);
      return this.users.toAuthenticatedUser(existing);
    }

    // First sight: pull profile from Clerk and provision the platform user.
    const profile = await this.clerk.getProfile(clerkUserId);
    const user = await this.users.provisionFromClerk({
      clerkUserId: profile.clerkUserId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: profile.avatarUrl,
    });
    return this.users.toAuthenticatedUser(user);
  }
}

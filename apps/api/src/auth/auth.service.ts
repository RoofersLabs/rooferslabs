import { Injectable } from '@nestjs/common';
import type { CompanyStatus, OnboardingStep } from '@rooferslabs/shared';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { ClerkService } from './clerk.service';

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
  ) {}

  /** Build the bootstrap session payload for the authenticated user. */
  async getSession(user: AuthenticatedUser): Promise<SessionResponse> {
    if (!user.companyId) {
      return { user, company: null };
    }

    const company = await this.prisma.company.findUnique({
      where: { id: user.companyId },
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
      user,
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

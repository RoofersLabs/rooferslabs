import { Injectable, Logger } from '@nestjs/common';
import { createClerkClient, verifyToken, type ClerkClient } from '@clerk/backend';
import { AppConfigService } from '../config/app-config.service';
import { ExternalServiceError, UnauthorizedError } from '../common/exceptions/domain.exception';

export interface VerifiedIdentity {
  clerkUserId: string;
}

export interface ClerkProfile {
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
}

/**
 * Adapter isolating the Clerk identity provider. The rest of the platform never
 * imports Clerk directly — it depends only on this service, satisfying
 * "business logic must never depend on Clerk".
 */
@Injectable()
export class ClerkService {
  private readonly logger = new Logger(ClerkService.name);
  private readonly client: ClerkClient;
  private readonly secretKey: string;
  private readonly jwtKey: string | undefined;

  constructor(private readonly config: AppConfigService) {
    this.secretKey = this.config.clerk.secretKey;
    this.jwtKey = this.config.clerk.jwtKey;
    this.client = createClerkClient({
      secretKey: this.secretKey,
      publishableKey: this.config.clerk.publishableKey,
    });
  }

  private assertConfigured(): void {
    if (!this.secretKey) {
      throw new UnauthorizedError(
        'Authentication is not configured on this server (missing CLERK_SECRET_KEY).',
      );
    }
  }

  /** Verify a Clerk-issued session/JWT and return the opaque user id. */
  async verifySessionToken(token: string): Promise<VerifiedIdentity> {
    this.assertConfigured();
    try {
      const claims = await verifyToken(token, {
        secretKey: this.secretKey,
        ...(this.jwtKey ? { jwtKey: this.jwtKey } : {}),
      });
      if (!claims.sub) throw new UnauthorizedError('Invalid session token.');
      return { clerkUserId: claims.sub };
    } catch (error) {
      this.logVerificationFailure(error);
      throw new UnauthorizedError('Your session is invalid or has expired.');
    }
  }

  /**
   * Separates the two kinds of verification failure, because they need opposite
   * treatment and used to be indistinguishable at `debug` — which production
   * (LOG_LEVEL=info) does not emit at all, so a total auth outage and a single
   * stale tab both looked like a bare 401 with no server-side trace.
   *
   * An expired or not-yet-valid token is routine: Clerk session tokens live ~60s
   * and the client refreshes them, so a few in flight across a refresh boundary
   * mean nothing. Anything about signatures or JWKS is the opposite — it does
   * not depend on the user, it fails identically for everyone, and it almost
   * always means CLERK_SECRET_KEY belongs to a different Clerk instance than the
   * publishable key the frontend bundle was built with.
   */
  private logVerificationFailure(error: unknown): void {
    const reason = (error as { reason?: string }).reason;
    const message = (error as Error).message;

    if (reason === 'token-expired' || reason === 'token-not-active-yet') {
      this.logger.debug(`Token rejected (${reason}).`);
      return;
    }

    const instance = this.secretKey.startsWith('sk_live_')
      ? 'live'
      : this.secretKey.startsWith('sk_test_')
        ? 'development'
        : 'unrecognized';

    this.logger.warn(
      `Token verification failed (reason=${reason ?? 'unknown'}): ${message}. ` +
        `This API verifies against Clerk's ${instance} instance — if every ` +
        `authenticated request is failing, check that the frontend bundle's ` +
        `VITE_CLERK_PUBLISHABLE_KEY names that same instance.`,
    );
  }

  /** Fetch a user's profile from Clerk (used only on first provisioning). */
  async getProfile(clerkUserId: string): Promise<ClerkProfile> {
    this.assertConfigured();
    try {
      const user = await this.client.users.getUser(clerkUserId);
      const primaryEmail =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        '';
      return {
        clerkUserId,
        email: primaryEmail,
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        avatarUrl: user.imageUrl ?? null,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch Clerk profile for ${clerkUserId}`, error as Error);
      throw new ExternalServiceError('Unable to load your account profile.');
    }
  }
}

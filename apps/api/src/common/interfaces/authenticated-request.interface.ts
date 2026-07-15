import type { Request } from 'express';
import type { UserRole } from '@rooferslabs/shared';

/**
 * The authenticated principal attached to every protected request after the
 * Clerk auth guard verifies the token and resolves the platform user. This is
 * our domain identity — it deliberately exposes nothing Clerk-specific beyond
 * the opaque `clerkUserId`, honoring "business logic must never depend on Clerk".
 */
export interface AuthenticatedUser {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  /** The tenant this user operates within. Null until a company is created. */
  companyId: string | null;
}

export interface AuthenticatedRequest extends Request {
  requestId: string;
  authUser?: AuthenticatedUser;
}

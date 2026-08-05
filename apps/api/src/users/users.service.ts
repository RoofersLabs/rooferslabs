import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import { PlatformRole, UserRole, isPlatformAdminEmail } from '@rooferslabs/shared';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-request.interface';
import { NotFoundError } from '../common/exceptions/domain.exception';
import { UsersRepository } from './users.repository';

export interface ProvisionUserInput {
  clerkUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
}

/** Business logic for platform users. */
@Injectable()
export class UsersService {
  constructor(private readonly repo: UsersRepository) {}

  /**
   * Resolve the platform user for a Clerk identity, creating it on first sight.
   * This is the bridge between Clerk (identity) and our tenant model — the only
   * place Clerk data crosses into the domain.
   */
  async provisionFromClerk(input: ProvisionUserInput): Promise<User> {
    const existing = await this.repo.findByClerkId(input.clerkUserId);
    if (existing) {
      // Keep profile fields fresh but never override role/company.
      if (
        existing.email !== input.email ||
        existing.firstName !== (input.firstName ?? null) ||
        existing.lastName !== (input.lastName ?? null)
      ) {
        return this.repo.update(existing.id, {
          email: input.email,
          firstName: input.firstName ?? null,
          lastName: input.lastName ?? null,
          avatarUrl: input.avatarUrl ?? null,
        });
      }
      return existing;
    }

    return this.repo.create({
      clerkUserId: input.clerkUserId,
      email: input.email,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      role: UserRole.OWNER,
    });
  }

  findByClerkId(clerkUserId: string): Promise<User | null> {
    return this.repo.findByClerkId(clerkUserId);
  }

  async getById(id: string): Promise<User> {
    const user = await this.repo.findById(id);
    if (!user) throw new NotFoundError('User not found.');
    return user;
  }

  listByCompany(companyId: string): Promise<User[]> {
    return this.repo.findManyByCompany(companyId);
  }

  async touchActivity(id: string): Promise<void> {
    await this.repo.updateLastActive(id).catch(() => undefined);
  }

  /**
   * Map a persisted user to the request-scoped authenticated principal.
   *
   * `platformRole` is derived from the account's email rather than read from
   * the column of the same name. The column is no longer the authority — see
   * `isPlatformAdminEmail` — and computing the field here means every consumer
   * of the principal (the session payload, the client's admin gate, the guard
   * on the admin API) is answering from the one rule, and a stray `OWNER` left
   * in a row grants nothing at all.
   */
  toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      clerkUserId: user.clerkUserId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role as UserRole,
      platformRole: isPlatformAdminEmail(user.email) ? PlatformRole.OWNER : PlatformRole.NONE,
      companyId: user.companyId,
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { isInternalUser } from '../config/launch.flag';
import type { CreateEarlyAccessRequestDto } from './dto/early-access.dto';

/** What the browser is told about the gate. Deliberately nothing else. */
export interface PublicLaunchConfig {
  mode: 'private' | 'public';
}

@Injectable()
export class LaunchService {
  private readonly logger = new Logger(LaunchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  /**
   * The launch state, served unauthenticated so the SPA can decide what to
   * render before anyone signs in.
   *
   * Returns the mode and nothing more. It must never carry the allowlist, its
   * size, or any hint of who is on it: this response is readable by the whole
   * internet, and "how many people can get in" is not the public's business.
   */
  getPublicConfig(): PublicLaunchConfig {
    return { mode: this.config.launch.mode };
  }

  /**
   * Whether this address may enter during the private beta.
   *
   * In `public` mode everyone is allowed, so the SPA needs no special case once
   * the gate lifts and this endpoint quietly becomes a constant `true`.
   *
   * Emits the "successful internal login" signal. It lives here rather than in
   * the guard because the guard fires on every request an internal user makes —
   * hundreds a session — whereas this is called once when the app decides to
   * let someone in, which is the event actually worth counting.
   */
  checkAccess(email: string | null | undefined): { allowed: boolean } {
    const { mode, internalUsers } = this.config.launch;
    if (mode === 'public') return { allowed: true };

    const allowed = isInternalUser(email, internalUsers);
    if (allowed) {
      this.logger.log({ event: 'launch.internal_login', email: email?.toLowerCase() ?? null });
    }
    return { allowed };
  }

  /**
   * Record an early-access request.
   *
   * Creates a lead and nothing else — no user, no company, no invitation, no
   * credential. Someone filling this in gains no access whatsoever; they are
   * added to the allowlist by hand, through configuration, or not at all.
   *
   * Attribution is read from request headers rather than accepted from the
   * body, so the form cannot be used to write arbitrary strings into fields the
   * operator will later read as fact.
   */
  async recordEarlyAccessRequest(
    dto: CreateEarlyAccessRequestDto,
    context: { referrer?: string; userAgent?: string },
  ): Promise<{ received: true }> {
    const email = dto.email.trim().toLowerCase();

    await this.prisma.earlyAccessRequest.create({
      data: {
        name: dto.name.trim(),
        company: dto.company.trim(),
        email,
        phone: dto.phone?.trim() || null,
        referrer: context.referrer?.slice(0, 500) ?? null,
        userAgent: context.userAgent?.slice(0, 500) ?? null,
      },
    });

    // Tracked: early-access requests.
    this.logger.log({ event: 'launch.early_access_requested', email, company: dto.company.trim() });

    // Always the same shape, whether or not this address has asked before.
    // Telling an anonymous caller "you already requested this" would turn the
    // form into an oracle for which addresses are in the database.
    return { received: true };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import type { PhoneNumber } from '@prisma/client';
import { PhoneNumberStatus } from '@rooferslabs/shared';
import { ConflictError } from '../common/exceptions/domain.exception';
import { AppConfigService } from '../config/app-config.service';
import { PhoneNumbersRepository } from './phone-numbers.repository';
import { TwilioService } from './twilio.service';

export interface ResolvedNumber {
  phoneNumberId: string;
  companyId: string;
}

@Injectable()
export class PhoneNumbersService {
  private readonly logger = new Logger(PhoneNumbersService.name);

  constructor(
    private readonly repo: PhoneNumbersRepository,
    private readonly config: AppConfigService,
    private readonly twilio: TwilioService,
  ) {}

  /**
   * Assign the platform's configured Twilio number (TWILIO_PHONE_NUMBER) to a
   * company — called automatically when onboarding completes, so no manual
   * database step is ever required before the AI can answer calls.
   *
   * Idempotent and safe: returns the company's existing number when one is
   * already assigned, does nothing when no number is configured, and never
   * steals a number that belongs to another company.
   */
  async autoAssignConfigured(companyId: string): Promise<PhoneNumber | null> {
    const existingForCompany = await this.repo.findActiveForCompany(companyId);
    if (existingForCompany) return existingForCompany;

    const configured = normalize(this.config.twilio.phoneNumber);
    if (!configured) {
      this.logger.warn(
        `Company ${companyId} completed onboarding but TWILIO_PHONE_NUMBER is not set — ` +
          `no AI phone number assigned. Set it (or assign one via the API) to receive calls.`,
      );
      return null;
    }

    const owner = await this.repo.findByNumber(configured);
    if (owner && owner.companyId !== companyId) {
      this.logger.warn(
        `Configured Twilio number ${configured} already belongs to company ${owner.companyId}; ` +
          `company ${companyId} needs its own number assigned via the API.`,
      );
      return null;
    }

    // Enrich with the Twilio SID/friendly name when the account owns the number.
    const meta = await this.twilio.lookupIncomingNumber(configured);
    const assigned = await this.assign(companyId, configured, {
      twilioSid: meta?.sid,
      friendlyName: meta?.friendlyName ?? 'RoofersLabs AI line',
    });
    this.logger.log(`Auto-assigned ${configured} to company ${companyId}.`);
    return assigned;
  }

  getForCompany(companyId: string): Promise<PhoneNumber | null> {
    return this.repo.findActiveForCompany(companyId);
  }

  /**
   * Resolve the tenant that owns a dialed Twilio number. Called by the inbound
   * webhook to route a call to the correct company.
   */
  async resolveByNumber(toNumber: string): Promise<ResolvedNumber | null> {
    const record = await this.repo.findByNumber(normalize(toNumber));
    if (!record || (record.status !== 'ASSIGNED' && record.status !== 'ACTIVE')) return null;
    return { phoneNumberId: record.id, companyId: record.companyId };
  }

  /**
   * Assign a provisioned Twilio number to a company. During the r1 echo early
   * access program numbers are provisioned in the Twilio console and assigned
   * here; automatic purchasing is a later enhancement.
   */
  async assign(
    companyId: string,
    phoneNumber: string,
    options: { twilioSid?: string; friendlyName?: string } = {},
  ): Promise<PhoneNumber> {
    const normalized = normalize(phoneNumber);
    const existing = await this.repo.findByNumber(normalized);
    if (existing && existing.companyId !== companyId) {
      throw new ConflictError('This phone number is already assigned to another company.');
    }
    if (existing) {
      return this.repo.update(existing.id, {
        status: PhoneNumberStatus.ACTIVE,
        twilioSid: options.twilioSid ?? existing.twilioSid,
        friendlyName: options.friendlyName ?? existing.friendlyName,
      });
    }
    return this.repo.create({
      company: { connect: { id: companyId } },
      phoneNumber: normalized,
      twilioSid: options.twilioSid ?? null,
      friendlyName: options.friendlyName ?? null,
      status: PhoneNumberStatus.ACTIVE,
    });
  }

  async markForwardingVerified(companyId: string): Promise<PhoneNumber | null> {
    const record = await this.repo.findActiveForCompany(companyId);
    if (!record) return null;
    return this.repo.update(record.id, { forwardingVerifiedAt: new Date() });
  }
}

/**
 * Normalize a phone number toward E.164 for stable lookups: strips formatting
 * characters and adds +1 to bare 10-digit US numbers. Twilio always sends
 * E.164, so this mainly guards operator-entered numbers at assignment time.
 */
function normalize(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;
  const digits = trimmed.replace(/[\s\-().]/g, '');
  if (/^\+\d{7,15}$/.test(digits)) return digits;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return trimmed;
}

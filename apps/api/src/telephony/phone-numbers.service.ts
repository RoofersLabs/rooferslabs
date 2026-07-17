import { Injectable, Logger } from '@nestjs/common';
import type { PhoneNumber } from '@prisma/client';
import { PhoneNumberStatus } from '@rooferslabs/shared';
import { ConflictError, ExternalServiceError } from '../common/exceptions/domain.exception';
import { PhoneNumbersRepository } from './phone-numbers.repository';
import { TwilioService } from './twilio.service';

export interface ResolvedNumber {
  phoneNumberId: string;
  companyId: string;
}

export interface ProvisionOptions {
  /** Company name, used for the number's friendly name in Twilio. */
  companyName?: string | null;
  /** The company's existing business number — its area code is preferred. */
  businessPhone?: string | null;
}

@Injectable()
export class PhoneNumbersService {
  private readonly logger = new Logger(PhoneNumbersService.name);

  constructor(
    private readonly repo: PhoneNumbersRepository,
    private readonly twilio: TwilioService,
  ) {}

  /**
   * Purchase a dedicated Twilio number for a company via the Twilio REST API —
   * called automatically when onboarding completes, and retryable through
   * POST /v1/telephony/phone-number/provision.
   *
   * Every company gets its own freshly purchased number (never shared). The
   * search prefers a local number in the company's own area code. The purchase
   * configures the Voice webhook and status callback in the same API call.
   *
   * Idempotent: returns the existing number when the company already has one.
   * Atomic: a purchase that cannot be persisted is released again, so no
   * partial records or orphaned numbers are left behind.
   */
  async provisionForCompany(
    companyId: string,
    options: ProvisionOptions = {},
  ): Promise<PhoneNumber> {
    const existing = await this.repo.findActiveForCompany(companyId);
    if (existing) return existing;

    if (!this.twilio.isConfigured) {
      throw new ExternalServiceError(
        'Telephony is not configured on this server (missing Twilio credentials).',
      );
    }

    // 1. Find an available local US number, preferring the company's area code.
    const areaCode = extractUsAreaCode(options.businessPhone);
    let available: string | null = null;
    try {
      if (areaCode) available = await this.twilio.searchAvailableLocalNumber(areaCode);
      available ??= await this.twilio.searchAvailableLocalNumber();
    } catch (error) {
      this.logger.error(`Twilio number search failed: ${(error as Error).message}`);
      throw new ExternalServiceError(
        'We could not reach Twilio to find a phone number. Please try again.',
      );
    }
    if (!available) {
      throw new ExternalServiceError(
        'No local US phone numbers are available right now. Please try again shortly.',
      );
    }

    // 2. Purchase it with the voice + status webhooks configured.
    const friendlyName = options.companyName
      ? `${options.companyName} — RoofersLabs AI line`
      : 'RoofersLabs AI line';
    let purchased: { sid: string; phoneNumber: string; friendlyName: string };
    try {
      purchased = await this.twilio.purchaseNumber({ phoneNumber: available, friendlyName });
    } catch (error) {
      this.logger.error(`Twilio number purchase failed: ${(error as Error).message}`);
      throw new ExternalServiceError(
        'Purchasing your AI phone number from Twilio failed. Please try again.',
      );
    }

    // 3. Persist — releasing the purchase again if anything goes wrong, so a
    //    failure never leaves an orphaned number or a partial record.
    try {
      // Guard against a concurrent provision having won in the meantime.
      const raced = await this.repo.findActiveForCompany(companyId);
      if (raced) {
        await this.twilio.releaseNumber(purchased.sid);
        return raced;
      }

      const record = await this.repo.create({
        company: { connect: { id: companyId } },
        phoneNumber: normalize(purchased.phoneNumber),
        twilioSid: purchased.sid,
        friendlyName: purchased.friendlyName,
        status: PhoneNumberStatus.ACTIVE,
      });
      this.logger.log(
        `Purchased ${purchased.phoneNumber} (${purchased.sid}) for company ${companyId}.`,
      );
      return record;
    } catch (error) {
      this.logger.error(
        `Persisting purchased number ${purchased.sid} failed; releasing it: ${(error as Error).message}`,
      );
      await this.twilio
        .releaseNumber(purchased.sid)
        .catch((releaseError: Error) =>
          this.logger.error(
            `Rollback release of ${purchased.sid} failed — release it manually in the Twilio console: ${releaseError.message}`,
          ),
        );
      throw new ExternalServiceError('Your AI phone number could not be saved. Please try again.');
    }
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

/** "+15125550100" → "512"; null for anything that isn't a US E.164 number. */
function extractUsAreaCode(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const match = normalize(phone).match(/^\+1(\d{3})\d{7}$/);
  return match?.[1] ?? null;
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

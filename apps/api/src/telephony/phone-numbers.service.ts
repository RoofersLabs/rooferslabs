import { Injectable, Logger } from '@nestjs/common';
import type { PhoneNumber } from '@prisma/client';
import { PhoneNumberStatus } from '@rooferslabs/shared';
import {
  BusinessRuleError,
  ConflictError,
  ExternalServiceError,
} from '../common/exceptions/domain.exception';
import { CallsRepository } from '../calls/calls.repository';
import { PhoneNumbersRepository } from './phone-numbers.repository';
import { TwilioService } from './twilio.service';

/** How recent a test call must be to count as forwarding evidence. */
const VERIFICATION_WINDOW_MS = 15 * 60 * 1000;

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
    private readonly calls: CallsRepository,
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
    this.logger.log(`[Provisioning] Starting company provisioning for ${companyId}`);

    const existing = await this.repo.findActiveForCompany(companyId);
    if (existing) {
      this.logger.log(`[Provisioning] Company already has ${existing.phoneNumber} — nothing to do`);
      return existing;
    }

    if (!this.twilio.isConfigured) {
      throw new ExternalServiceError(
        'Telephony is not configured on this server (missing Twilio credentials).',
      );
    }

    const friendlyName = options.companyName
      ? `${options.companyName} — RoofersLabs AI line`
      : 'RoofersLabs AI line';

    // 1. Adopt a number the Twilio account already owns but that no company is
    //    using — this heals a provision interrupted between purchase and
    //    persistence, and lets trial accounts (hard-capped at one number by
    //    Twilio, error 21404) serve their company. Adoption never reuses a
    //    number another company holds: candidates must be absent from the
    //    phone_numbers table or explicitly RELEASED. An adoption-scan failure
    //    aborts provisioning — purchase must never run while a reusable number
    //    might exist.
    const adopted = await this.adoptOwnedNumber(companyId, friendlyName);
    if (adopted) {
      this.logger.log(`[Provisioning] Provisioning completed successfully (adopted)`);
      return adopted;
    }
    this.logger.log('[Provisioning] No reusable numbers found');

    // 2. Find an available local US number, preferring the company's area code.
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

    // 3. Purchase it with the voice + status webhooks configured.
    this.logger.log(`[Provisioning] Purchasing new Twilio number ${available}`);
    let purchased: { sid: string; phoneNumber: string; friendlyName: string };
    try {
      purchased = await this.twilio.purchaseNumber({ phoneNumber: available, friendlyName });
    } catch (error) {
      this.logger.error(
        `Twilio number purchase failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
      // Surface Twilio's own reason (e.g. the trial-account number limit) —
      // a generic message hides exactly the detail the operator needs.
      throw new ExternalServiceError(
        `Purchasing your AI phone number from Twilio failed: ${(error as Error).message}`,
      );
    }

    // 4. Persist — releasing the purchase again if anything goes wrong, so a
    //    failure never leaves an orphaned number or a partial record.
    try {
      // Guard against a concurrent provision having won in the meantime.
      const raced = await this.repo.findActiveForCompany(companyId);
      if (raced) {
        await this.twilio.releaseNumber(purchased.sid);
        return raced;
      }

      this.logger.log('[Provisioning] Saving phone number to database');
      const record = await this.repo.create({
        company: { connect: { id: companyId } },
        phoneNumber: normalize(purchased.phoneNumber),
        twilioSid: purchased.sid,
        friendlyName: purchased.friendlyName,
        status: PhoneNumberStatus.ACTIVE,
      });
      this.logger.log(
        `[Provisioning] Provisioning completed successfully (purchased ${purchased.phoneNumber} / ${purchased.sid})`,
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

  /**
   * Adopt an account-owned Twilio number that no company is actively using:
   * point its webhooks at this API and assign it. Order of precedence per
   * candidate: reclaim a RELEASED record, adopt an orphan (no record at all),
   * and never touch a number another company holds. Returns null only when
   * every owned number is genuinely taken — any scan/configure/persist error
   * aborts provisioning entirely, so a purchase can never happen while a
   * reusable number might exist.
   */
  private async adoptOwnedNumber(
    companyId: string,
    friendlyName: string,
  ): Promise<PhoneNumber | null> {
    this.logger.log('[Provisioning] Fetching owned Twilio numbers');
    let owned: { sid: string; phoneNumber: string; friendlyName: string }[];
    try {
      owned = await this.twilio.listOwnedNumbers();
    } catch (error) {
      this.logger.error(
        `[Provisioning] Could not list owned Twilio numbers: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new ExternalServiceError(
        'We could not reach Twilio to check for a reusable phone number. Please try again.',
      );
    }
    this.logger.log(`[Provisioning] Found ${owned.length} owned numbers`);
    this.logger.log('[Provisioning] Searching reusable numbers');

    for (const candidate of owned) {
      const record = await this.repo.findByNumber(normalize(candidate.phoneNumber));
      if (record && record.status !== PhoneNumberStatus.RELEASED) {
        this.logger.log(
          `[Provisioning] Skipping ${candidate.phoneNumber} — assigned to company ${record.companyId} (${record.status})`,
        );
        continue;
      }

      this.logger.log(
        `[Provisioning] Reusing existing number ${candidate.phoneNumber} ` +
          `(${record ? 'reclaiming RELEASED record' : 'adopting orphaned number'})`,
      );
      this.logger.log('[Provisioning] Configuring webhooks');
      await this.twilio.configureNumberWebhooks(candidate.sid, friendlyName);

      this.logger.log('[Provisioning] Saving phone number to database');
      const saved = record
        ? await this.repo.update(record.id, {
            company: { connect: { id: companyId } },
            twilioSid: candidate.sid,
            friendlyName,
            status: PhoneNumberStatus.ACTIVE,
          })
        : await this.repo.create({
            company: { connect: { id: companyId } },
            phoneNumber: normalize(candidate.phoneNumber),
            twilioSid: candidate.sid,
            friendlyName,
            status: PhoneNumberStatus.ACTIVE,
          });
      return saved;
    }
    return null;
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

  /**
   * Verify that the customer's carrier forwarding actually delivers calls to
   * the AI number, using real evidence: a received call carrying Twilio's
   * ForwardedFrom, or any inbound call within the last few minutes (some
   * carriers strip ForwardedFrom). Idempotent once verified. When there is no
   * evidence yet, fails with instructions for placing a test call.
   */
  async verifyForwarding(companyId: string): Promise<PhoneNumber> {
    const record = await this.repo.findActiveForCompany(companyId);
    if (!record) {
      throw new BusinessRuleError('Get your AI phone number before verifying forwarding.');
    }
    if (record.forwardingVerifiedAt) return record;

    const since = new Date(Date.now() - VERIFICATION_WINDOW_MS);
    const evidence = await this.calls.findForwardingEvidence(companyId, since);
    if (!evidence) {
      throw new BusinessRuleError(
        'We haven’t received a call on your AI number yet. Turn on forwarding with your ' +
          'phone provider, call your business number from any phone, then verify again.',
      );
    }

    this.logger.log(
      `Forwarding verified for company ${companyId} via ${
        evidence.forwardedFrom
          ? `forwarded call from ${evidence.forwardedFrom}`
          : 'a recent inbound call'
      }.`,
    );
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

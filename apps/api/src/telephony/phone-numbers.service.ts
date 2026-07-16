import { Injectable } from '@nestjs/common';
import type { PhoneNumber } from '@prisma/client';
import { PhoneNumberStatus } from '@rooferslabs/shared';
import { ConflictError } from '../common/exceptions/domain.exception';
import { PhoneNumbersRepository } from './phone-numbers.repository';

export interface ResolvedNumber {
  phoneNumberId: string;
  companyId: string;
}

@Injectable()
export class PhoneNumbersService {
  constructor(private readonly repo: PhoneNumbersRepository) {}

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

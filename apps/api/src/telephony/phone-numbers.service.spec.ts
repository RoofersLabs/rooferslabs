import type { PhoneNumber } from '@prisma/client';
import { ExternalServiceError } from '../common/exceptions/domain.exception';
import { PhoneNumbersService } from './phone-numbers.service';
import type { PhoneNumbersRepository } from './phone-numbers.repository';
import type { TwilioService } from './twilio.service';

const COMPANY = 'company_1';
const PURCHASED = { sid: 'PN123', phoneNumber: '+15125552000', friendlyName: 'Acme — AI line' };

function makeRecord(overrides: Partial<PhoneNumber> = {}): PhoneNumber {
  return {
    id: 'pn_1',
    companyId: COMPANY,
    phoneNumber: PURCHASED.phoneNumber,
    twilioSid: PURCHASED.sid,
    friendlyName: PURCHASED.friendlyName,
    status: 'ACTIVE',
    forwardingVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PhoneNumber;
}

function makeService(
  overrides: {
    configured?: boolean;
    activeForCompany?: (PhoneNumber | null)[];
    search?: (string | null)[];
    purchase?: () => Promise<typeof PURCHASED>;
    createFails?: boolean;
  } = {},
) {
  const activeResults = overrides.activeForCompany ?? [null, null];
  const repo = {
    findActiveForCompany: jest.fn(),
    findByNumber: jest.fn().mockResolvedValue(null),
    create: overrides.createFails
      ? jest.fn().mockRejectedValue(new Error('db down'))
      : jest.fn().mockImplementation((data) => Promise.resolve(makeRecord(data))),
    update: jest.fn(),
  } as unknown as jest.Mocked<PhoneNumbersRepository>;
  for (const result of activeResults) {
    repo.findActiveForCompany.mockResolvedValueOnce(result);
  }

  const search = jest.fn();
  for (const result of overrides.search ?? [PURCHASED.phoneNumber]) {
    search.mockResolvedValueOnce(result);
  }

  const twilio = {
    isConfigured: overrides.configured ?? true,
    searchAvailableLocalNumber: search,
    purchaseNumber: jest.fn(overrides.purchase ?? (() => Promise.resolve(PURCHASED))),
    releaseNumber: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<TwilioService>;

  return { service: new PhoneNumbersService(repo, twilio), repo, twilio };
}

describe('provisionForCompany', () => {
  it('searches (preferring the business area code), purchases, and persists ACTIVE', async () => {
    const { service, repo, twilio } = makeService();

    const result = await service.provisionForCompany(COMPANY, {
      companyName: 'Acme Roofing',
      businessPhone: '+15125550100',
    });

    expect(twilio.searchAvailableLocalNumber).toHaveBeenCalledWith('512');
    expect(twilio.purchaseNumber).toHaveBeenCalledWith({
      phoneNumber: PURCHASED.phoneNumber,
      friendlyName: 'Acme Roofing — RoofersLabs AI line',
    });
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        company: { connect: { id: COMPANY } },
        phoneNumber: PURCHASED.phoneNumber,
        twilioSid: PURCHASED.sid,
        status: 'ACTIVE',
      }),
    );
    expect(result.status).toBe('ACTIVE');
  });

  it('falls back to a search without an area code when the preferred one is dry', async () => {
    const { service, twilio } = makeService({ search: [null, PURCHASED.phoneNumber] });

    await service.provisionForCompany(COMPANY, { businessPhone: '+15125550100' });

    expect(twilio.searchAvailableLocalNumber).toHaveBeenNthCalledWith(1, '512');
    expect(twilio.searchAvailableLocalNumber).toHaveBeenNthCalledWith(2);
  });

  it('is idempotent: returns the existing number without purchasing another', async () => {
    const existing = makeRecord();
    const { service, twilio } = makeService({ activeForCompany: [existing] });

    const result = await service.provisionForCompany(COMPANY);

    expect(result).toBe(existing);
    expect(twilio.purchaseNumber).not.toHaveBeenCalled();
  });

  it('releases the purchased number when persistence fails (clean rollback)', async () => {
    const { service, repo, twilio } = makeService({ createFails: true });

    await expect(service.provisionForCompany(COMPANY)).rejects.toThrow(ExternalServiceError);

    expect(repo.create).toHaveBeenCalled();
    expect(twilio.releaseNumber).toHaveBeenCalledWith(PURCHASED.sid);
  });

  it('releases the purchase when a concurrent provision already won', async () => {
    const raced = makeRecord({ id: 'pn_other' });
    const { service, repo, twilio } = makeService({ activeForCompany: [null, raced] });

    const result = await service.provisionForCompany(COMPANY);

    expect(result).toBe(raced);
    expect(twilio.releaseNumber).toHaveBeenCalledWith(PURCHASED.sid);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('throws a meaningful error when Twilio is not configured', async () => {
    const { service } = makeService({ configured: false });

    await expect(service.provisionForCompany(COMPANY)).rejects.toThrow(
      /Telephony is not configured/,
    );
  });

  it('throws a meaningful error when no numbers are available', async () => {
    const { service, twilio } = makeService({ search: [null, null] });

    await expect(service.provisionForCompany(COMPANY)).rejects.toThrow(/No local US phone numbers/);
    expect(twilio.purchaseNumber).not.toHaveBeenCalled();
  });

  it('throws a meaningful error when the purchase fails, without touching the database', async () => {
    const { service, repo } = makeService({
      purchase: () => Promise.reject(new Error('trial account cannot purchase')),
    });

    await expect(service.provisionForCompany(COMPANY)).rejects.toThrow(
      /Purchasing your AI phone number/,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });
});

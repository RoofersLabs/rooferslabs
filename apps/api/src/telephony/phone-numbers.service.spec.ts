import type { Call, PhoneNumber } from '@prisma/client';
import { BusinessRuleError, ExternalServiceError } from '../common/exceptions/domain.exception';
import { PhoneNumbersService } from './phone-numbers.service';
import type { PhoneNumbersRepository } from './phone-numbers.repository';
import type { CallsRepository } from '../calls/calls.repository';
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
    owned?: { sid: string; phoneNumber: string; friendlyName: string }[];
    ownedRecord?: PhoneNumber | null;
    search?: (string | null)[];
    purchase?: () => Promise<typeof PURCHASED>;
    createFails?: boolean;
    forwardingEvidence?: Partial<Call> | null;
  } = {},
) {
  const activeResults = overrides.activeForCompany ?? [null, null];
  const repo = {
    findActiveForCompany: jest.fn(),
    findByNumber: jest.fn().mockResolvedValue(overrides.ownedRecord ?? null),
    create: overrides.createFails
      ? jest.fn().mockRejectedValue(new Error('db down'))
      : jest.fn().mockImplementation((data) => Promise.resolve(makeRecord(data))),
    update: jest.fn().mockImplementation((_id, data) => Promise.resolve(makeRecord(data))),
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
    listOwnedNumbers: jest.fn().mockResolvedValue(overrides.owned ?? []),
    configureNumberWebhooks: jest.fn().mockResolvedValue(undefined),
    searchAvailableLocalNumber: search,
    purchaseNumber: jest.fn(overrides.purchase ?? (() => Promise.resolve(PURCHASED))),
    releaseNumber: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<TwilioService>;

  const calls = {
    findForwardingEvidence: jest.fn().mockResolvedValue(overrides.forwardingEvidence ?? null),
  } as unknown as jest.Mocked<CallsRepository>;

  return { service: new PhoneNumbersService(repo, twilio, calls), repo, twilio, calls };
}

const OWNED = { sid: 'PN_owned', phoneNumber: '+15125551111', friendlyName: 'Old name' };

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
      friendlyName: 'Acme Roofing — rooferslabs AI line',
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

  it('surfaces Twilio’s own reason when the purchase fails, without touching the database', async () => {
    const { service, repo } = makeService({
      purchase: () =>
        Promise.reject(new Error('Trial accounts are allowed only one Twilio number.')),
    });

    await expect(service.provisionForCompany(COMPANY)).rejects.toThrow(
      /Trial accounts are allowed only one Twilio number/,
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('trial account with one reusable (orphaned) number: adopts, never purchases', async () => {
    const { service, repo, twilio } = makeService({ owned: [OWNED] });

    const result = await service.provisionForCompany(COMPANY, { companyName: 'Acme Roofing' });

    expect(twilio.listOwnedNumbers).toHaveBeenCalled();
    expect(twilio.configureNumberWebhooks).toHaveBeenCalledWith(
      OWNED.sid,
      'Acme Roofing — rooferslabs AI line',
    );
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        company: { connect: { id: COMPANY } },
        phoneNumber: OWNED.phoneNumber,
        twilioSid: OWNED.sid,
        status: 'ACTIVE',
      }),
    );
    expect(twilio.searchAvailableLocalNumber).not.toHaveBeenCalled();
    expect(twilio.purchaseNumber).not.toHaveBeenCalled();
    expect(result.status).toBe('ACTIVE');
  });

  it('number already assigned to an ACTIVE company: skipped, purchase attempted', async () => {
    const { service, twilio } = makeService({
      owned: [OWNED],
      ownedRecord: makeRecord({ companyId: 'company_other', phoneNumber: OWNED.phoneNumber }),
    });

    await service.provisionForCompany(COMPANY);

    expect(twilio.configureNumberWebhooks).not.toHaveBeenCalled();
    expect(twilio.purchaseNumber).toHaveBeenCalled(); // no reusable number existed
  });

  it('trial account with a RELEASED number: reclaims it, never purchases', async () => {
    const released = makeRecord({
      id: 'pn_released',
      companyId: 'company_old',
      phoneNumber: OWNED.phoneNumber,
      status: 'RELEASED',
    });
    const { service, repo, twilio } = makeService({ owned: [OWNED], ownedRecord: released });

    await service.provisionForCompany(COMPANY);

    expect(repo.update).toHaveBeenCalledWith(
      'pn_released',
      expect.objectContaining({
        company: { connect: { id: COMPANY } },
        status: 'ACTIVE',
      }),
    );
    expect(twilio.purchaseNumber).not.toHaveBeenCalled();
  });

  it('fresh account with no owned numbers: proceeds to purchase', async () => {
    const { service, twilio } = makeService({ owned: [] });

    const result = await service.provisionForCompany(COMPANY);

    expect(twilio.listOwnedNumbers).toHaveBeenCalled();
    expect(twilio.purchaseNumber).toHaveBeenCalled();
    expect(result.status).toBe('ACTIVE');
  });

  it('aborts (never purchases) when the reusable-number scan fails', async () => {
    const { service, twilio } = makeService();
    (twilio.listOwnedNumbers as jest.Mock).mockRejectedValue(new Error('twilio down'));

    await expect(service.provisionForCompany(COMPANY)).rejects.toThrow(
      /could not reach Twilio to check for a reusable phone number/,
    );
    expect(twilio.purchaseNumber).not.toHaveBeenCalled();
  });
});

describe('verifyForwarding', () => {
  it('verifies when a forwarded call was received', async () => {
    const { service, repo } = makeService({
      activeForCompany: [makeRecord()],
      forwardingEvidence: { id: 'call_1', forwardedFrom: '+15125550100' },
    });

    await service.verifyForwarding(COMPANY);

    expect(repo.update).toHaveBeenCalledWith(
      'pn_1',
      expect.objectContaining({ forwardingVerifiedAt: expect.any(Date) }),
    );
  });

  it('verifies via a recent inbound call when the carrier strips ForwardedFrom', async () => {
    const { service, repo } = makeService({
      activeForCompany: [makeRecord()],
      forwardingEvidence: { id: 'call_1', forwardedFrom: null },
    });

    await service.verifyForwarding(COMPANY);

    expect(repo.update).toHaveBeenCalled();
  });

  it('fails with test-call instructions when no call has arrived', async () => {
    const { service, repo } = makeService({ activeForCompany: [makeRecord()] });

    await expect(service.verifyForwarding(COMPANY)).rejects.toThrow(/call your business number/i);
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('is idempotent once verified', async () => {
    const verified = makeRecord({ forwardingVerifiedAt: new Date() });
    const { service, repo, calls } = makeService({ activeForCompany: [verified] });

    const result = await service.verifyForwarding(COMPANY);

    expect(result).toBe(verified);
    expect(calls.findForwardingEvidence).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('requires a provisioned number first', async () => {
    const { service } = makeService();

    await expect(service.verifyForwarding(COMPANY)).rejects.toThrow(BusinessRuleError);
  });
});

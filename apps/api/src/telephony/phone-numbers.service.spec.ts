import type { PhoneNumber } from '@prisma/client';
import { PhoneNumbersService } from './phone-numbers.service';
import type { PhoneNumbersRepository } from './phone-numbers.repository';
import type { AppConfigService } from '../config/app-config.service';
import type { TwilioService } from './twilio.service';

const COMPANY = 'company_1';
const NUMBER = '+15125552000';

function makeRecord(overrides: Partial<PhoneNumber> = {}): PhoneNumber {
  return {
    id: 'pn_1',
    companyId: COMPANY,
    phoneNumber: NUMBER,
    twilioSid: null,
    friendlyName: null,
    status: 'ACTIVE',
    forwardingVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as PhoneNumber;
}

function makeService(options: {
  configuredNumber: string;
  activeForCompany?: PhoneNumber | null;
  byNumber?: PhoneNumber | null;
  lookup?: { sid: string; friendlyName: string } | null;
}) {
  const repo = {
    findActiveForCompany: jest.fn().mockResolvedValue(options.activeForCompany ?? null),
    findByNumber: jest.fn().mockResolvedValue(options.byNumber ?? null),
    create: jest.fn().mockImplementation((data) => Promise.resolve(makeRecord(data))),
    update: jest.fn().mockImplementation((_id, data) => Promise.resolve(makeRecord(data))),
  } as unknown as jest.Mocked<PhoneNumbersRepository>;

  const config = {
    twilio: { phoneNumber: options.configuredNumber },
  } as AppConfigService;

  const twilio = {
    lookupIncomingNumber: jest.fn().mockResolvedValue(options.lookup ?? null),
  } as unknown as jest.Mocked<TwilioService>;

  return { service: new PhoneNumbersService(repo, config, twilio), repo, twilio };
}

describe('autoAssignConfigured', () => {
  it('assigns the configured number with Twilio metadata on first onboarding', async () => {
    const { service, repo, twilio } = makeService({
      configuredNumber: NUMBER,
      lookup: { sid: 'PN123', friendlyName: 'Main line' },
    });

    const result = await service.autoAssignConfigured(COMPANY);

    expect(twilio.lookupIncomingNumber).toHaveBeenCalledWith(NUMBER);
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        company: { connect: { id: COMPANY } },
        phoneNumber: NUMBER,
        twilioSid: 'PN123',
        friendlyName: 'Main line',
        status: 'ACTIVE',
      }),
    );
    expect(result?.status).toBe('ACTIVE');
  });

  it('is idempotent: returns the existing number without creating a duplicate', async () => {
    const existing = makeRecord();
    const { service, repo } = makeService({
      configuredNumber: NUMBER,
      activeForCompany: existing,
    });

    const result = await service.autoAssignConfigured(COMPANY);

    expect(result).toBe(existing);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('does nothing when TWILIO_PHONE_NUMBER is not configured', async () => {
    const { service, repo } = makeService({ configuredNumber: '' });

    const result = await service.autoAssignConfigured(COMPANY);

    expect(result).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('never steals a number that belongs to another company', async () => {
    const { service, repo } = makeService({
      configuredNumber: NUMBER,
      byNumber: makeRecord({ companyId: 'company_other' }),
    });

    const result = await service.autoAssignConfigured(COMPANY);

    expect(result).toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('assigns without metadata when the Twilio lookup finds nothing', async () => {
    const { service, repo } = makeService({ configuredNumber: NUMBER, lookup: null });

    await service.autoAssignConfigured(COMPANY);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNumber: NUMBER,
        twilioSid: null,
        friendlyName: 'RoofersLabs AI line',
      }),
    );
  });

  it('normalizes the configured number before matching and assigning', async () => {
    const { service, repo } = makeService({ configuredNumber: '(512) 555-2000' });

    await service.autoAssignConfigured(COMPANY);

    expect(repo.findByNumber).toHaveBeenCalledWith(NUMBER);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ phoneNumber: NUMBER }));
  });
});

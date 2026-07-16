import { TwilioService } from './twilio.service';
import type { AppConfigService } from '../config/app-config.service';

function makeService(options: { authToken?: string; isProduction?: boolean } = {}): TwilioService {
  const config = {
    isProduction: options.isProduction ?? false,
    twilio: {
      accountSid: 'ACtest',
      authToken: options.authToken ?? 'test-auth-token',
      mediaStreamUrl: 'wss://api.example.com/v1/telephony/media-stream',
    },
  } as AppConfigService;
  return new TwilioService(config);
}

describe('stream token signing', () => {
  it('round-trips a valid token', () => {
    const service = makeService();
    const token = service.signStreamToken('call_1', 'company_1');
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(service.verifyStreamToken(token, 'call_1', 'company_1')).toBe(true);
  });

  it('rejects a token for a different call or company', () => {
    const service = makeService();
    const token = service.signStreamToken('call_1', 'company_1');
    expect(service.verifyStreamToken(token, 'call_2', 'company_1')).toBe(false);
    expect(service.verifyStreamToken(token, 'call_1', 'company_2')).toBe(false);
  });

  it('rejects missing or malformed tokens', () => {
    const service = makeService();
    expect(service.verifyStreamToken(undefined, 'call_1', 'company_1')).toBe(false);
    expect(service.verifyStreamToken('', 'call_1', 'company_1')).toBe(false);
    expect(service.verifyStreamToken('not-hex', 'call_1', 'company_1')).toBe(false);
  });

  it('fails closed in production without an auth token', () => {
    const service = makeService({ authToken: '', isProduction: true });
    expect(service.verifyStreamToken('anything', 'call_1', 'company_1')).toBe(false);
  });

  it('allows development flows without an auth token', () => {
    const service = makeService({ authToken: '', isProduction: false });
    expect(service.verifyStreamToken(undefined, 'call_1', 'company_1')).toBe(true);
  });
});

describe('TwiML builders', () => {
  it('embeds callId, companyId, and the signed token in stream TwiML', () => {
    const service = makeService();
    const twiml = service.buildStreamTwiml({
      wssUrl: 'wss://api.example.com/v1/telephony/media-stream',
      callId: 'call_1',
      companyId: 'company_1',
    });
    expect(twiml).toContain('call_1');
    expect(twiml).toContain('company_1');
    expect(twiml).toContain(service.signStreamToken('call_1', 'company_1'));
    expect(twiml).toContain('<Connect>');
  });

  it('builds a polite rejection', () => {
    const twiml = makeService().buildRejectTwiml('We are closed.');
    expect(twiml).toContain('We are closed.');
    expect(twiml).toContain('<Hangup/>');
  });
});

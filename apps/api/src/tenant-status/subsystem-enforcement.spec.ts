import webpush from 'web-push';
import { CompanyStatus } from '@rooferslabs/shared';
import { OpenAiService } from '../ai/openai.service';
import { RagService } from '../ai/rag.service';
import { CallProcessingService } from '../calls/call-processing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PushService } from '../notifications/push.service';
import { TelephonyController } from '../telephony/telephony.controller';
import type { AccountStatusService } from './account-status.service';

/**
 * Every runtime subsystem, asked the same question: does a paused tenant get
 * work done for it?
 *
 * One file rather than a case buried in each subsystem's own spec, because the
 * property being protected is a platform property. A reviewer adding a new
 * subsystem should be able to read this list and see immediately whether theirs
 * belongs on it — and a regression in any single one of them fails here, next to
 * all its siblings, instead of in isolation where it reads as a local quirk.
 */

/** A gate that refuses everything, and records what it was asked. */
function refusingGate(status = CompanyStatus.PAUSED) {
  const ensureActive = jest.fn().mockResolvedValue({ allowed: false, status });
  return { ensureActive } as unknown as AccountStatusService & {
    ensureActive: jest.Mock;
  };
}

/** A gate that admits everything. */
function admittingGate() {
  const ensureActive = jest.fn().mockResolvedValue({ allowed: true, status: CompanyStatus.ACTIVE });
  return { ensureActive } as unknown as AccountStatusService & { ensureActive: jest.Mock };
}

type Args<T extends abstract new (...a: never) => unknown> = ConstructorParameters<T>;

describe('OpenAI adapters', () => {
  const config = {
    openai: { apiKey: 'sk-test', embeddingModel: 'm', responsesModel: 'm' },
  } as unknown as Args<typeof OpenAiService>[0];

  it('spends no tokens on embeddings for a paused tenant', async () => {
    const gate = refusingGate();
    const service = new OpenAiService(config, gate);
    await expect(service.embed('co-1', ['some text'])).resolves.toEqual([]);
    expect(gate.ensureActive).toHaveBeenCalledWith('co-1', 'openai.embeddings', expect.any(String));
  });

  it('spends no tokens on the Responses API for a paused tenant', async () => {
    const gate = refusingGate();
    const service = new OpenAiService(config, gate);
    const result = await service.createStructuredResponse('co-1', {
      instructions: 'x',
      input: 'y',
      schemaName: 's',
      schema: {},
    });
    expect(result).toBeNull();
    expect(gate.ensureActive).toHaveBeenCalledWith('co-1', 'openai.responses', expect.any(String));
  });

  it('checks the tenant before it ever builds a client request', async () => {
    // The gate has to come first or the refusal saves nothing: an adapter that
    // called OpenAI and discarded the answer would still be billed for it.
    const gate = refusingGate();
    // No API key at all: if the gate did not short-circuit, `require()` would
    // throw rather than returning empty.
    const unconfigured = { openai: { apiKey: '' } } as unknown as Args<typeof OpenAiService>[0];
    const service = new OpenAiService(unconfigured, gate);
    await expect(service.embed('co-1', ['text'])).resolves.toEqual([]);
  });
});

describe('knowledge retrieval', () => {
  it('returns nothing for a paused tenant, including the keyword fallback', async () => {
    // The fallback path never touches OpenAI, so the adapter's own gate does not
    // cover it. Without this check a paused tenant's articles stayed searchable.
    const gate = refusingGate();
    const prisma = {
      knowledgeChunk: { findMany: jest.fn() },
      knowledgeArticle: { findMany: jest.fn() },
    } as unknown as Args<typeof RagService>[0];
    const openai = { isEnabled: false, embed: jest.fn() } as unknown as Args<typeof RagService>[1];

    const redis = { get: jest.fn(), set: jest.fn() } as unknown as Args<typeof RagService>[3];
    const rag = new RagService(prisma, openai, gate, redis);
    await expect(rag.retrieve('co-1', 'roof leak')).resolves.toEqual([]);
    expect(prisma.knowledgeChunk.findMany).not.toHaveBeenCalled();
    expect(openai.embed).not.toHaveBeenCalled();
  });
});

describe('the post-call pipeline (deferred work)', () => {
  /**
   * The closest thing this platform has to a queued job: authorised when the
   * call was answered, executed when it ended. A pause lands in that gap.
   */
  function pipelineFor(gate: AccountStatusService) {
    const prisma = {
      call: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'call-1',
          companyId: 'co-1',
          fromNumber: '+15125551234',
          conversation: null,
        }),
      },
    } as unknown as Args<typeof CallProcessingService>[0];
    const receptionist = {
      analyzeConversation: jest.fn().mockResolvedValue({}),
    } as unknown as Args<typeof CallProcessingService>[1];
    const customers = {
      upsertFromCall: jest.fn(),
    } as unknown as Args<typeof CallProcessingService>[2];
    const notifications = { create: jest.fn() } as unknown as Args<typeof CallProcessingService>[3];
    const twilio = { isSmsEnabled: false } as unknown as Args<typeof CallProcessingService>[4];

    const service = new CallProcessingService(
      prisma,
      receptionist,
      customers,
      notifications,
      twilio,
      gate,
    );
    return { service, receptionist, customers, notifications };
  }

  it('discards work whose tenant was paused after the call was answered', async () => {
    const { service, receptionist, customers, notifications } = pipelineFor(refusingGate());

    await expect(
      service.finalizeCall('call-1', { transcript: [], signals: {} as never }),
    ).resolves.toBeUndefined();

    // Nothing downstream ran: no AI spend, no customer record, no notification.
    expect(receptionist.analyzeConversation).not.toHaveBeenCalled();
    expect(customers.upsertFromCall).not.toHaveBeenCalled();
    expect(notifications.create).not.toHaveBeenCalled();
  });

  it('returns quietly rather than throwing, so nothing retries it', async () => {
    // A paused tenant is a settled fact. Throwing would invite a retry loop
    // against a condition that will not change on its own.
    const { service } = pipelineFor(refusingGate());
    await expect(
      service.finalizeCall('call-1', { transcript: [], signals: {} as never }),
    ).resolves.not.toThrow();
  });

  it('still runs the pipeline for an active tenant', async () => {
    const { service, receptionist } = pipelineFor(admittingGate());
    await service
      .finalizeCall('call-1', { transcript: [], signals: {} as never })
      .catch(() => undefined); // downstream doubles are thin; the call is what matters
    expect(receptionist.analyzeConversation).toHaveBeenCalled();
  });
});

describe('notifications', () => {
  it('creates nothing and pushes nothing for a paused tenant', async () => {
    const gate = refusingGate();
    const repo = { create: jest.fn() } as unknown as Args<typeof NotificationsService>[0];
    const push = { sendToCompany: jest.fn() } as unknown as Args<typeof NotificationsService>[1];

    const service = new NotificationsService(repo, push, gate);
    await expect(
      service.create({ companyId: 'co-1', type: 'SYSTEM' as never, title: 't', message: 'm' }),
    ).resolves.toBeNull();
    expect(repo.create).not.toHaveBeenCalled();
    expect(push.sendToCompany).not.toHaveBeenCalled();
  });

  it('gates web push in its own right, not only through the notification path', async () => {
    const gate = refusingGate();
    const prisma = {
      pushSubscription: { findMany: jest.fn() },
    } as unknown as Args<typeof PushService>[0];
    // A real key pair, so push is genuinely *enabled*. With placeholder keys the
    // service disables itself and this case would pass without the gate ever
    // being consulted — proving nothing.
    const keys = webpush.generateVAPIDKeys();
    const config = {
      push: {
        vapidPublicKey: keys.publicKey,
        vapidPrivateKey: keys.privateKey,
        vapidSubject: 'mailto:ops@rooferslabs.com',
      },
    } as unknown as Args<typeof PushService>[1];

    const push = new PushService(prisma, config, gate);
    await push.sendToCompany('co-1', { title: 't', message: 'm' });
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });
});

describe('telephony', () => {
  const twiml = '<Response><Say>unavailable</Say><Hangup/></Response>';

  function controllerFor(gate: AccountStatusService, call: unknown = null) {
    const config = {
      api: { publicUrl: 'https://api.example.com' },
      twilio: { mediaStreamUrl: 'wss://example/stream' },
    } as unknown as Args<typeof TelephonyController>[0];
    const twilio = {
      validateSignature: jest.fn().mockReturnValue(true),
      buildRejectTwiml: jest.fn().mockReturnValue(twiml),
      buildStreamTwiml: jest.fn().mockReturnValue('<Response><Connect/></Response>'),
    } as unknown as Args<typeof TelephonyController>[1];
    const phoneNumbers = {
      resolveByNumber: jest.fn().mockResolvedValue({ companyId: 'co-1', phoneNumberId: 'pn-1' }),
    } as unknown as Args<typeof TelephonyController>[2];
    const callProcessing = {
      createInboundCall: jest.fn().mockResolvedValue({ id: 'call-1' }),
      handleStatusCallback: jest.fn(),
    } as unknown as Args<typeof TelephonyController>[3];
    const companies = {
      getById: jest.fn().mockResolvedValue({ receptionistEnabled: true }),
    } as unknown as Args<typeof TelephonyController>[4];
    const calls = {
      findByTwilioSid: jest.fn().mockResolvedValue(call),
      update: jest.fn(),
    } as unknown as Args<typeof TelephonyController>[5];

    const controller = new TelephonyController(
      config,
      twilio,
      phoneNumbers,
      callProcessing,
      companies,
      calls,
      gate,
    );
    return { controller, twilio, callProcessing, companies, calls };
  }

  /** An express `res` double recording what the controller sent. */
  function response() {
    const res = {
      statusCode: 0,
      body: '',
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      type() {
        return this;
      },
      send(body?: string) {
        this.body = body ?? '';
        return this;
      },
    };
    return res as typeof res & Parameters<TelephonyController['incoming']>[0];
  }

  it('refuses an inbound call for a paused tenant with polite TwiML', async () => {
    const gate = refusingGate();
    const { controller } = controllerFor(gate);
    const res = response();

    await controller.incoming(res, 'sig', { To: '+15125550100', CallSid: 'CA1' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(twiml);
    expect(gate.ensureActive).toHaveBeenCalledWith('co-1', 'telephony.inbound', expect.any(String));
  });

  it('spends nothing on a refused call — no Call row, no media stream', async () => {
    // The whole point of gating at the webhook: this is the last moment before
    // the platform starts paying for the call.
    const { controller, callProcessing, twilio } = controllerFor(refusingGate());
    await controller.incoming(response(), 'sig', { To: '+15125550100', CallSid: 'CA1' });

    expect(callProcessing.createInboundCall).not.toHaveBeenCalled();
    expect(twilio.buildStreamTwiml).not.toHaveBeenCalled();
  });

  it('checks the tenant before the owner’s receptionist switch', async () => {
    // A paused tenant's own configuration must not decide which refusal the
    // caller hears.
    const { controller, companies } = controllerFor(refusingGate());
    await controller.incoming(response(), 'sig', { To: '+15125550100', CallSid: 'CA1' });
    expect(companies.getById).not.toHaveBeenCalled();
  });

  it('connects an active tenant’s call as before', async () => {
    const { controller, callProcessing, twilio } = controllerFor(admittingGate());
    const res = response();
    await controller.incoming(res, 'sig', { To: '+15125550100', CallSid: 'CA1' });

    expect(callProcessing.createInboundCall).toHaveBeenCalled();
    expect(twilio.buildStreamTwiml).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('ignores a status webhook for a paused tenant but still answers Twilio', async () => {
    const { controller, callProcessing } = controllerFor(refusingGate(), {
      id: 'call-1',
      companyId: 'co-1',
    });
    const res = response();

    await controller.status(res, 'sig', { CallSid: 'CA1', CallStatus: 'completed' });

    expect(callProcessing.handleStatusCallback).not.toHaveBeenCalled();
    // 204, not an error: Twilio is told we received it, so it does not retry a
    // delivery that will never be accepted.
    expect(res.statusCode).toBe(204);
  });

  it('ignores a recording webhook for a paused tenant', async () => {
    const { controller, calls } = controllerFor(refusingGate(), {
      id: 'call-1',
      companyId: 'co-1',
    });
    const res = response();

    await controller.recordingStatus(res, 'sig', {
      CallSid: 'CA1',
      RecordingSid: 'RE1',
      RecordingUrl: 'https://example/r.mp3',
    });

    expect(calls.update).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(204);
  });

  it('still attaches a recording for an active tenant', async () => {
    const { controller, calls } = controllerFor(admittingGate(), {
      id: 'call-1',
      companyId: 'co-1',
    });
    await controller.recordingStatus(response(), 'sig', { CallSid: 'CA1', RecordingSid: 'RE1' });
    expect(calls.update).toHaveBeenCalled();
  });
});

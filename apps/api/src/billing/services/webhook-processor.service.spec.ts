import { WebhookEventStatus } from '@prisma/client';
import {
  PaymentProvider,
  SubscriptionStatus,
  SubscriptionPlan,
  InvoiceStatus,
  BillingInterval,
} from '@rooferslabs/shared';
import { WebhookProcessorService } from './webhook-processor.service';
import type { BillingService } from './billing.service';
import type { BillingProvider } from '../interfaces/billing-provider.interface';
import type {
  ClaimOutcome,
  WebhookEventRepository,
} from '../repositories/webhook-event.repository';
import type { ProviderWebhookEvent } from '../types/billing.types';

const EVENT_ID = 'evt_01hq';

function makeEvent(overrides: Partial<ProviderWebhookEvent> = {}): ProviderWebhookEvent {
  return {
    provider: PaymentProvider.PADDLE,
    id: EVENT_ID,
    type: 'subscription.activated',
    occurredAt: new Date('2026-07-29T10:00:00.000Z'),
    subscription: {
      provider: PaymentProvider.PADDLE,
      providerCustomerId: 'ctm_1',
      providerSubscriptionId: 'sub_1',
      providerPriceId: 'pri_1',
      companyId: 'company_1',
      status: SubscriptionStatus.ACTIVE,
      plan: SubscriptionPlan.STARTER,
      interval: BillingInterval.MONTH,
      currentPeriodEnd: new Date('2026-08-29T10:00:00.000Z'),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      trialEndsAt: null,
    },
    invoice: null,
    ignored: false,
    ...overrides,
  };
}

function makeProcessor(
  options: { event?: ProviderWebhookEvent; claim?: ClaimOutcome; verifyError?: Error } = {},
) {
  const provider = {
    provider: PaymentProvider.PADDLE,
    verifyAndParseWebhook: options.verifyError
      ? jest.fn().mockRejectedValue(options.verifyError)
      : jest.fn().mockResolvedValue(options.event ?? makeEvent()),
  } as unknown as jest.Mocked<BillingProvider>;

  const billing = {
    applySubscription: jest.fn().mockResolvedValue(undefined),
    applyInvoice: jest.fn().mockResolvedValue(undefined),
    refreshSubscription: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<BillingService>;

  const ledger = {
    claim: jest.fn().mockResolvedValue(options.claim ?? { claimed: true }),
    markProcessed: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<WebhookEventRepository>;

  return {
    processor: new WebhookProcessorService(provider, billing, ledger),
    provider,
    billing,
    ledger,
  };
}

const request = { rawBody: Buffer.from('{"x":1}'), headers: { 'paddle-signature': 'ts=1;h1=abc' } };

describe('WebhookProcessorService — authenticity', () => {
  it('never touches the domain when verification fails', async () => {
    // The whole security model: nothing downstream sees unverified bytes.
    const { processor, billing, ledger } = makeProcessor({
      verifyError: new Error('Invalid signature'),
    });
    await expect(processor.handle(request)).rejects.toThrow('Invalid signature');
    expect(ledger.claim).not.toHaveBeenCalled();
    expect(billing.applySubscription).not.toHaveBeenCalled();
  });
});

describe('WebhookProcessorService — idempotency', () => {
  it('applies a first-time event', async () => {
    const { processor, billing, ledger } = makeProcessor();
    const outcome = await processor.handle(request);

    expect(outcome).toEqual({ ok: true, duplicate: false, eventType: 'subscription.activated' });
    expect(billing.applySubscription).toHaveBeenCalledTimes(1);
    expect(ledger.markProcessed).toHaveBeenCalledWith(
      PaymentProvider.PADDLE,
      EVENT_ID,
      WebhookEventStatus.PROCESSED,
    );
  });

  it('skips the work for a redelivered event but still acknowledges it', async () => {
    // Providers retry after a timeout. Doing the work twice would duplicate an
    // invoice or re-provision a phone number; answering non-2xx would make the
    // provider retry a delivery that was already handled.
    const { processor, billing } = makeProcessor({
      claim: { claimed: false, reason: 'duplicate' },
    });
    const outcome = await processor.handle(request);

    expect(outcome).toEqual({ ok: true, duplicate: true, eventType: 'subscription.activated' });
    expect(billing.applySubscription).not.toHaveBeenCalled();
  });

  it('reprocesses an event whose previous attempt failed', async () => {
    // A failure must not become a permanent loss of a subscription change.
    const { processor, billing } = makeProcessor({
      claim: { claimed: false, reason: 'retry', attempts: 2 },
    });
    await processor.handle(request);
    expect(billing.applySubscription).toHaveBeenCalledTimes(1);
  });

  it('claims on the provider event id, which is the dedupe key', async () => {
    const { processor, ledger } = makeProcessor();
    await processor.handle(request);
    expect(ledger.claim).toHaveBeenCalledWith({
      provider: PaymentProvider.PADDLE,
      providerEventId: EVENT_ID,
      eventType: 'subscription.activated',
      occurredAt: new Date('2026-07-29T10:00:00.000Z'),
    });
  });
});

describe('WebhookProcessorService — failure handling', () => {
  it('records the failure and rethrows so the provider retries', async () => {
    const { processor, billing, ledger } = makeProcessor();
    billing.applySubscription.mockRejectedValue(new Error('database is down'));

    await expect(processor.handle(request)).rejects.toThrow('database is down');
    expect(ledger.markFailed).toHaveBeenCalledWith(
      PaymentProvider.PADDLE,
      EVENT_ID,
      'database is down',
    );
    expect(ledger.markProcessed).not.toHaveBeenCalled();
  });
});

describe('WebhookProcessorService — event routing', () => {
  it('acknowledges an unrecognized event as IGNORED rather than failing it', async () => {
    // Answering 5xx would make the provider redeliver it forever.
    const { processor, ledger } = makeProcessor({
      event: makeEvent({ ignored: true, subscription: null, type: 'report.created' }),
    });
    const outcome = await processor.handle(request);

    expect(outcome.ok).toBe(true);
    expect(ledger.markProcessed).toHaveBeenCalledWith(
      PaymentProvider.PADDLE,
      EVENT_ID,
      WebhookEventStatus.IGNORED,
    );
  });

  it('re-reads live state when the event only names a subscription', async () => {
    // A NONE status means "pointer, not payload" — storing it would overwrite
    // real state with a placeholder.
    const { processor, billing } = makeProcessor({
      event: makeEvent({
        subscription: { ...makeEvent().subscription!, status: SubscriptionStatus.NONE },
      }),
    });
    await processor.handle(request);

    expect(billing.refreshSubscription).toHaveBeenCalledWith('sub_1');
    expect(billing.applySubscription).not.toHaveBeenCalled();
  });

  it('syncs an invoice and refreshes the subscription it belongs to', async () => {
    // A payment event can arrive before the subscription event, so activation
    // must not wait on a delivery that may be reordered.
    const { processor, billing } = makeProcessor({
      event: makeEvent({
        type: 'transaction.completed',
        subscription: null,
        invoice: {
          provider: PaymentProvider.PADDLE,
          providerInvoiceId: 'txn_1',
          providerCustomerId: 'ctm_1',
          providerSubscriptionId: 'sub_1',
          number: 'INV-001',
          status: InvoiceStatus.PAID,
          currency: 'USD',
          amountDue: 29900,
          amountPaid: 29900,
          issuedAt: new Date(),
          paidAt: new Date(),
          invoiceUrl: null,
        },
      }),
    });
    await processor.handle(request);

    expect(billing.applyInvoice).toHaveBeenCalledTimes(1);
    expect(billing.refreshSubscription).toHaveBeenCalledWith('sub_1');
  });
});

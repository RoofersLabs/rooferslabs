import { Logger } from '@nestjs/common';
import { ApiErrorCode, CompanyStatus } from '@rooferslabs/shared';
import type { PrismaService } from '../prisma/prisma.service';
import { AccountStatusService } from './account-status.service';

/**
 * The platform-wide tenant gate, proven at the service that owns it.
 *
 * These cases are about the *policy* — which statuses may work, what a blocked
 * caller is told, what gets logged, and how quickly a status change is seen.
 * The per-subsystem wiring is asserted in each subsystem's own spec; what would
 * be untestable is the thing this file pins down: that there is one policy, and
 * it does not vary by who is asking.
 */

/** A Prisma double whose answer can change between calls, like the real one. */
function prismaReturning(...statuses: (CompanyStatus | null)[]) {
  const queue = [...statuses];
  const findUnique = jest.fn().mockImplementation(() => {
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return Promise.resolve(next === null || next === undefined ? null : { status: next });
  });
  return { prisma: { company: { findUnique } } as unknown as PrismaService, findUnique };
}

function serviceFor(...statuses: (CompanyStatus | null)[]) {
  const { prisma, findUnique } = prismaReturning(...statuses);
  const service = new AccountStatusService(prisma);
  const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  return { service, findUnique, warn };
}

afterEach(() => jest.restoreAllMocks());

describe('the gate policy', () => {
  it('admits an ACTIVE tenant', async () => {
    const { service } = serviceFor(CompanyStatus.ACTIVE);
    await expect(service.ensureActive('co-1', 'telephony.inbound', 'answer-call')).resolves.toEqual(
      { allowed: true, status: CompanyStatus.ACTIVE },
    );
  });

  it.each([CompanyStatus.PENDING_APPROVAL, CompanyStatus.PAUSED, CompanyStatus.ONBOARDING])(
    'refuses a %s tenant',
    async (status) => {
      const { service } = serviceFor(status);
      const gate = await service.ensureActive('co-1', 'telephony.inbound', 'answer-call');
      expect(gate).toEqual({ allowed: false, status });
    },
  );

  it('refuses a tenant whose company has gone', async () => {
    const { service } = serviceFor(null);
    const gate = await service.ensureActive('co-1', 'openai.responses', 'analyse');
    expect(gate).toEqual({ allowed: false, status: null });
  });

  it('gives every subsystem the same answer for the same tenant', async () => {
    // The whole reason this service exists. If telephony and the workers could
    // disagree, a paused tenant would keep taking calls while its dashboard was
    // dark — which is the failure the centralisation is meant to make
    // impossible.
    const { service } = serviceFor(CompanyStatus.PAUSED);
    const services = [
      'telephony.inbound',
      'telephony.media-stream',
      'openai.responses',
      'openai.embeddings',
      'knowledge.retrieval',
      'calls.finalize',
      'notifications.create',
      'notifications.push',
    ] as const;
    for (const name of services) {
      const gate = await service.ensureActive('co-1', name, 'op');
      expect(gate.allowed).toBe(false);
    }
  });
});

describe('immediate propagation', () => {
  it('reads the database on every call, so a status change needs no invalidation', async () => {
    // This is the cache-invalidation story: there is no cache. A founder pausing
    // an account is seen by the very next check, on every task, with no
    // publish, no TTL, and no window in which two instances disagree.
    const { service, findUnique } = serviceFor(CompanyStatus.ACTIVE, CompanyStatus.PAUSED);

    await expect(service.isActive('co-1')).resolves.toBe(true);
    await expect(service.isActive('co-1')).resolves.toBe(false);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it('sees a resume just as immediately as a pause', async () => {
    const { service } = serviceFor(CompanyStatus.PAUSED, CompanyStatus.ACTIVE);
    await expect(service.isActive('co-1')).resolves.toBe(false);
    await expect(service.isActive('co-1')).resolves.toBe(true);
  });

  it('asks for nothing but the status column', async () => {
    // A gate that selected the whole company row would make every call on every
    // subsystem drag the tenant's JSON business hours across the wire.
    const { service, findUnique } = serviceFor(CompanyStatus.ACTIVE);
    await service.isActive('co-1');
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'co-1' },
      select: { status: true },
    });
  });
});

describe('operational logging', () => {
  it('writes one structured line naming tenant, status, service and reason', async () => {
    const { service, warn } = serviceFor(CompanyStatus.PAUSED);
    await service.ensureActive('co-42', 'telephony.inbound', 'answer-call');

    expect(warn).toHaveBeenCalledTimes(1);
    const line = warn.mock.calls[0]?.[0] as string;
    expect(line).toContain('tenant-gate blocked');
    expect(line).toContain('service=telephony.inbound');
    expect(line).toContain('operation=answer-call');
    expect(line).toContain('tenant=co-42');
    expect(line).toContain('status=PAUSED');
    expect(line).toContain('reason=account_paused');
    expect(line).toMatch(/at=\d{4}-\d{2}-\d{2}T/);
  });

  it('distinguishes the reasons a tenant can be refused', async () => {
    const cases: [CompanyStatus | null, string][] = [
      [CompanyStatus.PAUSED, 'account_paused'],
      [CompanyStatus.PENDING_APPROVAL, 'awaiting_founder_approval'],
      [CompanyStatus.ONBOARDING, 'setup_incomplete'],
      [null, 'company_not_found'],
    ];
    for (const [status, reason] of cases) {
      const { service, warn } = serviceFor(status);
      await service.ensureActive('co-1', 'calls.finalize', 'finalize-call');
      expect(warn.mock.calls[0]?.[0] as string).toContain(`reason=${reason}`);
      jest.restoreAllMocks();
    }
  });

  it('says nothing when the tenant is allowed', async () => {
    // A line per permitted operation would bury the blocked ones, which are the
    // only ones anybody is looking for.
    const { service, warn } = serviceFor(CompanyStatus.ACTIVE);
    await service.ensureActive('co-1', 'telephony.inbound', 'answer-call');
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs at warn, not error — a paused tenant is not a fault', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const { service, warn } = serviceFor(CompanyStatus.PAUSED);
    await service.ensureActive('co-1', 'telephony.inbound', 'answer-call');
    expect(warn).toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

describe('the HTTP boundary', () => {
  it('throws a branchable code rather than returning a verdict', async () => {
    const { service } = serviceFor(CompanyStatus.PAUSED);
    await expect(service.assertActive('co-1')).rejects.toMatchObject({
      code: ApiErrorCode.ACCOUNT_PAUSED,
    });
  });

  it('logs the refusal the same way every other subsystem does', async () => {
    const { service, warn } = serviceFor(CompanyStatus.PENDING_APPROVAL);
    await expect(service.assertActive('co-1')).rejects.toThrow();
    expect(warn.mock.calls[0]?.[0] as string).toContain('service=api.http');
  });

  it('does not log a refusal a route explicitly opted into', async () => {
    // The setup wizard admitting ONBOARDING is normal operation, not a block.
    const { service, warn } = serviceFor(CompanyStatus.ONBOARDING);
    await expect(service.assertActive('co-1', [CompanyStatus.ONBOARDING])).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });
});

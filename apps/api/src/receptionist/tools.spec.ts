import type { AiConfiguration } from '@prisma/client';
import { buildRealtimeTools, CONVERSATION_OUTPUT_SCHEMA, TOOL } from './tools';

function makeConfig(overrides: Partial<AiConfiguration> = {}): AiConfiguration {
  return {
    detectEmergencies: true,
    requestAppointments: true,
    transferToHuman: false,
    transferPhone: null,
    ...overrides,
  } as AiConfiguration;
}

describe('buildRealtimeTools', () => {
  it('always includes knowledge lookup and customer capture', () => {
    const names = buildRealtimeTools(null).map((t) => t.name);
    expect(names).toContain(TOOL.LOOKUP_KNOWLEDGE);
    expect(names).toContain(TOOL.CAPTURE_CUSTOMER_INFO);
  });

  it('honours behaviour toggles', () => {
    const names = buildRealtimeTools(
      makeConfig({ detectEmergencies: false, requestAppointments: false }),
    ).map((t) => t.name);
    expect(names).not.toContain(TOOL.FLAG_EMERGENCY);
    expect(names).not.toContain(TOOL.REQUEST_APPOINTMENT);
  });

  it('only offers human transfer when a transfer phone is configured', () => {
    const withoutPhone = buildRealtimeTools(makeConfig({ transferToHuman: true }));
    expect(withoutPhone.map((t) => t.name)).not.toContain(TOOL.TRANSFER_TO_HUMAN);

    const withPhone = buildRealtimeTools(
      makeConfig({ transferToHuman: true, transferPhone: '+15125550100' }),
    );
    expect(withPhone.map((t) => t.name)).toContain(TOOL.TRANSFER_TO_HUMAN);
  });
});

describe('CONVERSATION_OUTPUT_SCHEMA', () => {
  /** OpenAI strict mode requires every property to be listed in `required`
   *  and `additionalProperties: false` at every level. */
  function assertStrict(schema: Record<string, unknown>, path = 'root'): void {
    if (schema.type !== 'object' || !schema.properties) return;
    expect(schema.additionalProperties).toBe(false);
    const properties = Object.keys(schema.properties as Record<string, unknown>);
    expect((schema.required as string[]).sort()).toEqual(properties.sort());
    for (const [key, child] of Object.entries(schema.properties as Record<string, unknown>)) {
      assertStrict(child as Record<string, unknown>, `${path}.${key}`);
    }
  }

  it('satisfies OpenAI strict-mode structural requirements', () => {
    assertStrict(CONVERSATION_OUTPUT_SCHEMA);
  });
});

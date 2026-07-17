import { buildGreeting, buildReceptionistInstructions } from './prompt.builder';
import type { CompanyWithRelations } from '../companies/companies.repository';

function makeCompany(overrides: Partial<CompanyWithRelations> = {}): CompanyWithRelations {
  return {
    name: 'Summit Roofing Co.',
    roofingServices: ['Roof Replacement', 'Roof Repair'],
    serviceAreas: ['Austin, TX'],
    businessHours: [
      { day: 'monday', open: '08:00', close: '18:00', closed: false },
      { day: 'sunday', open: '00:00', close: '00:00', closed: true },
    ],
    emergencyServiceEnabled: true,
    emergencyInstructions: null,
    aiConfiguration: {
      assistantName: 'Riley',
      persona: 'warm and efficient',
      greeting: 'Thanks for calling Summit Roofing!',
      voice: 'alloy',
      customInstructions: null,
      captureLeads: true,
      detectEmergencies: true,
      requestAppointments: true,
      transferToHuman: false,
      transferPhone: null,
    },
    ...overrides,
  } as unknown as CompanyWithRelations;
}

describe('buildReceptionistInstructions', () => {
  it('grounds the prompt in company configuration', () => {
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('Riley');
    expect(prompt).toContain('Summit Roofing Co.');
    expect(prompt).toContain('Roof Replacement, Roof Repair');
    expect(prompt).toContain('Austin, TX');
    expect(prompt).toContain('Monday 08:00–18:00');
    expect(prompt).toContain('offers emergency roofing service');
  });

  it('forbids invented business facts and requires the knowledge tool', () => {
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('NEVER invent prices');
    expect(prompt).toContain('lookup_knowledge');
  });

  it('omits emergency/appointment tooling when disabled', () => {
    const company = makeCompany();
    company.aiConfiguration!.detectEmergencies = false;
    company.aiConfiguration!.requestAppointments = false;
    const prompt = buildReceptionistInstructions(company);
    expect(prompt).not.toContain('flag_emergency');
    expect(prompt).not.toContain('request_appointment');
  });

  it('appends custom company instructions when provided', () => {
    const company = makeCompany();
    company.aiConfiguration!.customInstructions = 'Always mention the 10-year warranty.';
    expect(buildReceptionistInstructions(company)).toContain(
      'Always mention the 10-year warranty.',
    );
  });

  it('falls back to sensible defaults with no AI configuration', () => {
    const prompt = buildReceptionistInstructions(
      makeCompany({
        aiConfiguration: null,
        businessHours: null,
        roofingServices: [],
        serviceAreas: [],
      }),
    );
    expect(prompt).toContain('residential and commercial roofing services');
    expect(prompt).toContain('standard business hours');
  });
});

describe('conversation quality instructions', () => {
  it('covers confirmation, closing loop, and the hang-up tool', () => {
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('digit by digit');
    expect(prompt).toContain('Is that correct?');
    expect(prompt).toContain('anything else I can help you with today');
    expect(prompt).toContain('end_call');
    expect(prompt).toContain('answer it fully first');
  });

  it('keeps empathy-first emergency guidance even when the emergency tool is off', () => {
    const company = makeCompany();
    company.aiConfiguration!.detectEmergencies = false;
    const prompt = buildReceptionistInstructions(company);
    expect(prompt).toContain('respond with empathy first');
    expect(prompt).not.toContain('flag_emergency');
  });
});

describe('buildGreeting', () => {
  it('uses the configured greeting', () => {
    expect(buildGreeting(makeCompany())).toBe('Thanks for calling Summit Roofing!');
  });

  it('falls back to a branded default with the assistant name', () => {
    const company = makeCompany();
    company.aiConfiguration!.greeting = '';
    const greeting = buildGreeting(company);
    expect(greeting).toContain('Summit Roofing Co.');
    expect(greeting).toContain('This is Riley.');
  });

  it('falls back to a company-branded default without configuration', () => {
    const greeting = buildGreeting(makeCompany({ aiConfiguration: null }));
    expect(greeting).toContain('Summit Roofing Co.');
  });
});

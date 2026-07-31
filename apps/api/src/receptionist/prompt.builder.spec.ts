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

describe('conversion behaviour', () => {
  it('closes assumptively rather than asking permission to schedule', () => {
    // "Would you like to schedule?" is a yes/no question, and on the phone it
    // invites the no. Assuming the visit is the single biggest booking lever.
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('Assume the visit rather than requesting it');
    expect(prompt).toContain('Narrow the choice');
  });

  it('caps objection handling at one gentle re-ask', () => {
    // Pushing twice loses the lead and the reputation; a captured number is
    // worth more than a pressured yes.
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('ONE gentle second attempt');
    expect(prompt).toContain("I'm just looking");
    expect(prompt).toContain('getting a few quotes');
  });

  it('drops every booking instruction when appointments are disabled', () => {
    const company = makeCompany();
    company.aiConfiguration!.requestAppointments = false;
    const prompt = buildReceptionistInstructions(company);
    expect(prompt).not.toContain('request_appointment');
    expect(prompt).not.toContain('Assume the visit rather than requesting it');
    expect(prompt).toContain('set expectations for the follow-up');
  });
});

describe('safety rails', () => {
  it('refuses diagnosis, insurance advice, and competitor comparison', () => {
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('Never diagnose what is wrong with a roof over the phone');
    expect(prompt).toContain('Never give insurance or legal advice');
    expect(prompt).toContain('Never criticize or compare against another roofing company');
  });

  it('permits a next step without promising an arrival time', () => {
    // The old prompt only prohibited, which left no safe way to close at all.
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('never promise a specific arrival time');
    expect(prompt).toContain('the office will confirm the exact window');
  });
});

describe('call handling edge cases', () => {
  it('handles calls that are not leads', () => {
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('Wrong number or an accidental call');
    expect(prompt).toContain('answering machine');
    expect(prompt).toContain('robocalls');
  });

  it('recovers from mishearing and silence instead of looping', () => {
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('Never ask the same question the same way twice');
    expect(prompt).toContain('two failed attempts');
    expect(prompt).toContain('Are you still there?');
  });

  it('calibrates tone to the caller rather than using one register', () => {
    const prompt = buildReceptionistInstructions(makeCompany());
    expect(prompt).toContain('Panicked');
    expect(prompt).toContain('Angry');
    expect(prompt).toContain('Elderly or hard of hearing');
    // Examples must be labelled as shapes, or the model recites them verbatim
    // on every call — which is what made the old emergency line robotic.
    expect(prompt).toContain('never repeat it verbatim across calls');
  });

  it('offers a human when it is failing, not only when asked', () => {
    const company = makeCompany();
    company.aiConfiguration!.transferToHuman = true;
    company.aiConfiguration!.transferPhone = '+15125550100';
    const prompt = buildReceptionistInstructions(company);
    expect(prompt).toContain('when you have failed twice to understand something that matters');
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

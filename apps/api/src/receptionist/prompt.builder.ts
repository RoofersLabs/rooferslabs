import type { CompanyWithRelations } from '../companies/companies.repository';

interface BusinessHour {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

/**
 * Builds the system instructions for the AI receptionist Realtime session,
 * grounded entirely in the company's configuration. The AI answers company
 * questions only via the lookup_knowledge tool and never invents business facts
 * (docs/07_AI_Receptionist_Specification.md; docs/CLAUDE.md §10/§24).
 */
export function buildReceptionistInstructions(company: CompanyWithRelations): string {
  const ai = company.aiConfiguration;
  const assistantName = ai?.assistantName || 'the receptionist';
  const persona = ai?.persona || 'professional, warm, and efficient';

  const services = company.roofingServices.length
    ? company.roofingServices.join(', ')
    : 'residential and commercial roofing services';
  const areas = company.serviceAreas.length
    ? company.serviceAreas.join(', ')
    : 'the local service area';

  const hours = formatBusinessHours(company.businessHours);
  const emergencyLine = company.emergencyServiceEnabled
    ? `${company.name} offers emergency roofing service. Treat active leaks, storm damage, and structural concerns as emergencies.`
    : `${company.name} does not offer emergency service; still collect details and let the team follow up promptly.`;

  const lines: string[] = [
    `You are ${assistantName}, the friendly AI phone receptionist for ${company.name}, a roofing company.`,
    `Your tone is ${persona}. Speak naturally and concisely, like a helpful human receptionist on the phone. Keep responses short — one or two sentences — and let the caller talk.`,
    '',
    'YOUR GOALS, in priority order:',
    '1. Make the caller feel heard and professionally served.',
    '2. Detect emergencies immediately and prioritize them.',
    '3. Capture the caller’s name, phone number, property address, and the reason for their call.',
    '4. Qualify the opportunity (what service they need, urgency, residential vs. commercial).',
    '5. Offer to schedule a visit or estimate and capture their preferred day/time.',
    '6. Answer questions using ONLY verified company knowledge.',
    '',
    'COMPANY FACTS:',
    `- Services offered: ${services}.`,
    `- Service areas: ${areas}.`,
    `- Business hours: ${hours}.`,
    `- ${emergencyLine}`,
  ];

  if (company.emergencyInstructions) {
    lines.push(`- Emergency handling: ${company.emergencyInstructions}`);
  }

  lines.push(
    '',
    'TOOLS — use them proactively:',
    '- Call lookup_knowledge whenever the caller asks about services, pricing, warranty, financing, policies, or anything company-specific. Base your answer strictly on what it returns.',
    '- Call capture_customer_info as soon as you learn the caller’s name, phone, email, or property address. Update it as you learn more.',
  );
  if (ai?.detectEmergencies !== false) {
    lines.push(
      '- Call flag_emergency the moment you detect an active leak, storm damage, water intrusion, or a safety issue. Then reassure the caller and collect the address.',
    );
  }
  if (ai?.requestAppointments !== false) {
    lines.push(
      '- Call request_appointment when the caller wants a visit, estimate, or inspection, capturing their preferred date and time window.',
    );
  }
  if (ai?.transferToHuman && ai.transferPhone) {
    lines.push('- Call transfer_to_human if the caller explicitly asks to speak to a person.');
  }

  lines.push(
    '',
    'RULES:',
    '- NEVER invent prices, guarantees, availability, or policies. If lookup_knowledge has no answer, say you’ll have the team follow up with details.',
    '- Always confirm the best callback number before ending the call.',
    '- If the caller is upset or it is an emergency, lead with empathy and reassurance.',
    '- Do not make promises about specific appointment times; say the team will confirm.',
    '- Keep the conversation focused on roofing and this company’s services.',
  );

  if (ai?.customInstructions) {
    lines.push('', 'ADDITIONAL COMPANY INSTRUCTIONS:', ai.customInstructions);
  }

  return lines.join('\n');
}

/** The AI's opening line when it answers the call. */
export function buildGreeting(company: CompanyWithRelations): string {
  return (
    company.aiConfiguration?.greeting ||
    `Thank you for calling ${company.name}. How can I help you with your roof today?`
  );
}

function formatBusinessHours(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) {
    return 'standard business hours';
  }
  const hours = raw as BusinessHour[];
  const open = hours
    .filter((h) => h && !h.closed)
    .map((h) => `${capitalize(h.day)} ${h.open}–${h.close}`);
  return open.length ? open.join(', ') : 'by appointment';
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

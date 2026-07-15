/**
 * Database seed — creates a fully-onboarded demo roofing company with realistic
 * data so the dashboard, call history, and knowledge base are populated for
 * local development and early-access demos.
 *
 * Idempotent: safe to run repeatedly (keyed on the company slug).
 *
 *   npm run prisma:seed --workspace @rooferslabs/api
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_SLUG = 'summit-roofing-co';

async function main(): Promise<void> {
  console.log('🌱 Seeding RoofersLabs demo data…');

  const company = await prisma.company.upsert({
    where: { slug: DEMO_SLUG },
    update: {},
    create: {
      name: 'Summit Roofing Co.',
      slug: DEMO_SLUG,
      status: 'ACTIVE',
      onboardingStep: 'COMPLETE',
      onboardedAt: new Date(),
      email: 'office@summitroofing.example',
      phone: '+15125550100',
      website: 'https://summitroofing.example',
      addressLine1: '4200 Industrial Blvd',
      city: 'Austin',
      state: 'TX',
      postalCode: '78744',
      timezone: 'America/Chicago',
      serviceAreas: ['Austin, TX', 'Round Rock, TX', 'Cedar Park, TX', '78744', '78701'],
      roofingServices: [
        'Roof Replacement',
        'Roof Repair',
        'Storm & Hail Damage',
        'Roof Inspection',
        'Gutter Installation',
      ],
      businessHours: [
        { day: 'monday', open: '07:00', close: '18:00', closed: false },
        { day: 'tuesday', open: '07:00', close: '18:00', closed: false },
        { day: 'wednesday', open: '07:00', close: '18:00', closed: false },
        { day: 'thursday', open: '07:00', close: '18:00', closed: false },
        { day: 'friday', open: '07:00', close: '18:00', closed: false },
        { day: 'saturday', open: '08:00', close: '14:00', closed: false },
        { day: 'sunday', open: '00:00', close: '00:00', closed: true },
      ],
      emergencyServiceEnabled: true,
      emergencyPhone: '+15125550111',
      emergencyInstructions:
        'Active leaks, storm damage, and structural concerns are emergencies. Collect the address and route to the on-call crew immediately.',
      primaryColor: '#1E40AF',
    },
  });

  await prisma.aiConfiguration.upsert({
    where: { companyId: company.id },
    update: {},
    create: {
      companyId: company.id,
      voice: 'alloy',
      assistantName: 'Riley from Summit Roofing',
      greeting:
        'Thanks for calling Summit Roofing! This is Riley. How can I help you with your roof today?',
      persona: 'professional, warm, reassuring, and efficient',
      captureLeads: true,
      detectEmergencies: true,
      requestAppointments: true,
    },
  });

  await prisma.phoneNumber.upsert({
    where: { phoneNumber: '+15125559000' },
    update: {},
    create: {
      companyId: company.id,
      phoneNumber: '+15125559000',
      friendlyName: 'Summit Roofing AI Line',
      status: 'ACTIVE',
      forwardingVerifiedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { clerkUserId: 'seed_owner_placeholder' },
    update: { companyId: company.id },
    create: {
      clerkUserId: 'seed_owner_placeholder',
      companyId: company.id,
      email: 'owner@summitroofing.example',
      firstName: 'Dana',
      lastName: 'Summit',
      role: 'OWNER',
    },
  });

  // Knowledge base — clear and reseed for the demo company only.
  await prisma.knowledgeArticle.deleteMany({ where: { companyId: company.id } });
  const articles = [
    {
      title: 'Free Roof Inspections',
      category: 'SERVICES' as const,
      content:
        'Summit Roofing offers free, no-obligation roof inspections for both residential and commercial properties. An inspection typically takes 30–45 minutes and includes a full report with photos.',
      keywords: ['inspection', 'free', 'estimate', 'quote'],
    },
    {
      title: 'Storm & Hail Damage / Insurance Claims',
      category: 'FAQ' as const,
      content:
        'We work directly with all major insurance carriers on storm and hail damage claims. We can meet the adjuster on-site and document damage. Most claims are approved within 2–3 weeks.',
      keywords: ['storm', 'hail', 'insurance', 'claim', 'damage'],
    },
    {
      title: 'Workmanship Warranty',
      category: 'WARRANTY' as const,
      content:
        'All Summit Roofing installations include a 10-year workmanship warranty in addition to the manufacturer material warranty (up to 50 years on premium shingles).',
      keywords: ['warranty', 'guarantee', 'workmanship'],
    },
    {
      title: 'Financing Options',
      category: 'FINANCING' as const,
      content:
        'Flexible financing is available with approved credit, including 0% APR for 12 months and low monthly payment plans. Financing can be discussed during your free estimate.',
      keywords: ['financing', 'payment', 'apr', 'monthly'],
    },
    {
      title: 'Emergency Roofing Service',
      category: 'EMERGENCY' as const,
      content:
        'For active leaks or storm damage, Summit Roofing provides emergency tarping and temporary repairs, often same-day. Emergency calls are prioritized and routed to the on-call crew.',
      keywords: ['emergency', 'leak', 'urgent', 'tarp'],
    },
  ];
  for (const article of articles) {
    await prisma.knowledgeArticle.create({
      data: { companyId: company.id, status: 'PUBLISHED', ...article },
    });
  }

  // Customers
  await prisma.customer.deleteMany({ where: { companyId: company.id } });
  const maria = await prisma.customer.create({
    data: {
      companyId: company.id,
      fullName: 'Maria Gonzalez',
      phone: '+15125552211',
      email: 'maria.g@example.com',
      propertyAddress: '812 Oak Meadow Dr, Austin, TX 78745',
      propertyType: 'RESIDENTIAL',
      status: 'ACTIVE',
    },
  });
  const james = await prisma.customer.create({
    data: {
      companyId: company.id,
      fullName: 'James Patel',
      phone: '+15125553344',
      propertyAddress: '55 Commerce Park, Round Rock, TX 78664',
      propertyType: 'COMMERCIAL',
      status: 'NEW',
    },
  });

  // Calls + conversations
  await prisma.call.deleteMany({ where: { companyId: company.id } });
  const now = Date.now();

  const call1 = await prisma.call.create({
    data: {
      companyId: company.id,
      customerId: maria.id,
      direction: 'INBOUND',
      fromNumber: maria.phone,
      toNumber: '+15125559000',
      status: 'COMPLETED',
      startedAt: new Date(now - 1000 * 60 * 60 * 3),
      answeredAt: new Date(now - 1000 * 60 * 60 * 3 + 2000),
      endedAt: new Date(now - 1000 * 60 * 60 * 3 + 1000 * 214),
      durationSeconds: 214,
    },
  });
  const conv1 = await prisma.conversation.create({
    data: {
      companyId: company.id,
      callId: call1.id,
      customerId: maria.id,
      status: 'COMPLETED',
      outcome: 'APPOINTMENT_REQUESTED',
      intent: 'NEW_ESTIMATE',
      leadQuality: 'HOT',
      urgency: 'MEDIUM',
      summary:
        'Maria Gonzalez called about visible shingle damage after last week’s storm and requested a free estimate. She is available weekday afternoons and wants to explore insurance options.',
      keyPoints: [
        'Storm-related shingle damage on a single-family home',
        'Requested a free estimate',
        'Interested in filing an insurance claim',
        'Prefers weekday afternoon appointments',
      ],
      transcript: [
        { role: 'assistant', text: 'Thanks for calling Summit Roofing! This is Riley. How can I help you with your roof today?', offsetMs: 0 },
        { role: 'customer', text: 'Hi, we had a storm last week and I think some shingles came off. Can someone take a look?', offsetMs: 5200 },
        { role: 'assistant', text: 'Absolutely, I’m sorry to hear about the storm damage. We offer free inspections — could I get the property address?', offsetMs: 9800 },
        { role: 'customer', text: 'Sure, it’s 812 Oak Meadow Drive in Austin.', offsetMs: 14000 },
      ],
    },
  });
  await prisma.appointment.create({
    data: {
      companyId: company.id,
      customerId: maria.id,
      conversationId: conv1.id,
      serviceRequested: 'Free roof inspection & estimate (storm damage)',
      propertyAddress: '812 Oak Meadow Dr, Austin, TX 78745',
      preferredDate: new Date(now + 1000 * 60 * 60 * 48),
      preferredTimeWindow: 'afternoon',
      status: 'REQUESTED',
      priority: 'HIGH',
    },
  });

  const call2 = await prisma.call.create({
    data: {
      companyId: company.id,
      customerId: james.id,
      direction: 'INBOUND',
      fromNumber: james.phone,
      toNumber: '+15125559000',
      status: 'COMPLETED',
      startedAt: new Date(now - 1000 * 60 * 40),
      answeredAt: new Date(now - 1000 * 60 * 40 + 1800),
      endedAt: new Date(now - 1000 * 60 * 40 + 1000 * 96),
      durationSeconds: 96,
    },
  });
  await prisma.conversation.create({
    data: {
      companyId: company.id,
      callId: call2.id,
      customerId: james.id,
      status: 'COMPLETED',
      outcome: 'EMERGENCY',
      intent: 'EMERGENCY_REPAIR',
      leadQuality: 'HOT',
      urgency: 'EMERGENCY',
      isEmergency: true,
      summary:
        'James Patel reported an active roof leak at a commercial property in Round Rock during business hours. Flagged as an emergency and routed to the on-call crew.',
      keyPoints: ['Active leak at a commercial building', 'Water entering the interior', 'Emergency dispatch requested'],
      transcript: [
        { role: 'assistant', text: 'Thanks for calling Summit Roofing! This is Riley. How can I help you with your roof today?', offsetMs: 0 },
        { role: 'customer', text: 'We have water pouring into our warehouse right now, we need someone immediately.', offsetMs: 4200 },
        { role: 'assistant', text: 'That sounds like an emergency — let’s get a crew out right away. What’s the address?', offsetMs: 8100 },
      ],
    },
  });

  // Notifications
  await prisma.notification.deleteMany({ where: { companyId: company.id } });
  await prisma.notification.createMany({
    data: [
      {
        companyId: company.id,
        type: 'EMERGENCY',
        priority: 'CRITICAL',
        title: 'Emergency call — active leak',
        message: 'James Patel reported an active roof leak at a commercial property in Round Rock.',
        relatedEntity: { type: 'call', id: call2.id },
      },
      {
        companyId: company.id,
        type: 'APPOINTMENT_REQUEST',
        priority: 'HIGH',
        title: 'New appointment request',
        message: 'Maria Gonzalez requested a free storm-damage inspection.',
        relatedEntity: { type: 'conversation', id: conv1.id },
      },
      {
        companyId: company.id,
        type: 'NEW_LEAD',
        priority: 'NORMAL',
        status: 'READ',
        readAt: new Date(),
        title: 'New lead captured',
        message: 'A new lead was captured from an inbound call.',
        relatedEntity: { type: 'customer', id: maria.id },
      },
    ],
  });

  console.log(`✅ Seed complete for "${company.name}" (${company.id})`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });

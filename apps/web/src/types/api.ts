/**
 * Frontend-facing entity types. These mirror the backend Prisma models as
 * serialized over the API (dates arrive as ISO strings). Enums and the response
 * envelope come from @rooferslabs/shared — the single source of truth.
 */
import type {
  AppointmentPriority,
  AppointmentStatus,
  CallDirection,
  CallStatus,
  CompanyStatus,
  ConversationIntent,
  ConversationOutcome,
  ConversationStatus,
  CustomerStatus,
  KnowledgeCategory,
  KnowledgeStatus,
  LeadQuality,
  NotificationPriority,
  NotificationStatus,
  NotificationType,
  OnboardingStep,
  PhoneNumberStatus,
  PropertyType,
  TranscriptEntry,
  UrgencyLevel,
  UserRole,
} from '@rooferslabs/shared';

export interface BusinessHour {
  day: string;
  open: string;
  close: string;
  closed: boolean;
}

export interface SessionUser {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  companyId: string | null;
}

export interface SessionCompany {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  onboardingStep: OnboardingStep;
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface Session {
  user: SessionUser;
  company: SessionCompany | null;
}

export interface AiConfiguration {
  id: string;
  companyId: string;
  voice: string;
  assistantName: string;
  greeting: string;
  persona: string;
  customInstructions: string | null;
  captureLeads: boolean;
  detectEmergencies: boolean;
  requestAppointments: boolean;
  transferToHuman: boolean;
  transferPhone: string | null;
}

/** Control-center payload from GET /v1/telephony/receptionist/status. */
export interface ReceptionistStatus {
  enabled: boolean;
  businessPhone: string | null;
  carrier: string | null;
  aiPhoneNumber: string | null;
  forwardingVerifiedAt: string | null;
  forwardingVerified: boolean;
}

export interface PhoneNumberSummary {
  id: string;
  phoneNumber: string;
  status: PhoneNumberStatus | string;
  forwardingVerifiedAt: string | null;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  status: CompanyStatus;
  onboardingStep: OnboardingStep;
  onboardedAt: string | null;
  email: string | null;
  phone: string | null;
  phoneCarrier: string | null;
  receptionistEnabled: boolean;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  timezone: string;
  serviceAreas: string[];
  roofingServices: string[];
  businessHours: BusinessHour[] | null;
  emergencyServiceEnabled: boolean;
  emergencyPhone: string | null;
  emergencyInstructions: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  aiConfiguration: AiConfiguration | null;
  phoneNumbers: PhoneNumberSummary[];
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  companyId: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  propertyAddress: string | null;
  propertyType: PropertyType;
  status: CustomerStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRef {
  id: string;
  fullName: string | null;
  phone: string | null;
}

export interface ConversationSummaryRef {
  id: string;
  outcome: ConversationOutcome | null;
  intent: ConversationIntent | null;
  leadQuality: LeadQuality | null;
  urgency: UrgencyLevel | null;
  isEmergency: boolean;
  summary: string | null;
}

export interface Call {
  id: string;
  companyId: string;
  twilioCallSid: string | null;
  direction: CallDirection;
  fromNumber: string | null;
  toNumber: string | null;
  status: CallStatus;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null;
  recordingSid: string | null;
  recordingStatus: string | null;
  recordingDuration: number | null;
  customer: CustomerRef | null;
  conversation: ConversationSummaryRef | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  callId: string;
  status: ConversationStatus;
  outcome: ConversationOutcome | null;
  intent: ConversationIntent | null;
  leadQuality: LeadQuality | null;
  urgency: UrgencyLevel | null;
  isEmergency: boolean;
  transcript: TranscriptEntry[] | null;
  summary: string | null;
  keyPoints: string[];
  customer: (CustomerRef & Partial<Customer>) | null;
  call: {
    id: string;
    durationSeconds: number | null;
    fromNumber: string | null;
    createdAt: string;
    recordingUrl?: string | null;
    recordingSid?: string | null;
    recordingStatus?: string | null;
    recordingDuration?: number | null;
  } | null;
  appointment?: Appointment | null;
  createdAt: string;
}

export interface Appointment {
  id: string;
  companyId: string;
  customerId: string | null;
  conversationId: string | null;
  serviceRequested: string | null;
  propertyAddress: string | null;
  preferredDate: string | null;
  preferredTimeWindow: string | null;
  status: AppointmentStatus;
  priority: AppointmentPriority;
  notes: string | null;
  customer?: CustomerRef | null;
  createdAt: string;
}

export interface KnowledgeArticle {
  id: string;
  companyId: string;
  title: string;
  content: string;
  category: KnowledgeCategory;
  keywords: string[];
  status: KnowledgeStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  companyId: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  relatedEntity: { type: string; id: string } | null;
  readAt: string | null;
  createdAt: string;
}

export interface DashboardOverview {
  metrics: {
    todaysCalls: number;
    todaysLeads: number;
    todaysEmergencies: number;
    weeklyCalls: number;
    pendingAppointments: number;
    totalCustomers: number;
    unreadNotifications: number;
  };
  recentConversations: Conversation[];
  upcomingAppointments: Appointment[];
}

export interface GlobalSearchResults {
  customers: Pick<Customer, 'id' | 'fullName' | 'phone' | 'email' | 'status'>[];
  conversations: {
    id: string;
    summary: string | null;
    outcome: ConversationOutcome | null;
    isEmergency: boolean;
    createdAt: string;
    customer: { fullName: string | null } | null;
  }[];
  appointments: Pick<
    Appointment,
    'id' | 'serviceRequested' | 'status' | 'priority' | 'preferredDate'
  >[];
  knowledgeArticles: Pick<KnowledgeArticle, 'id' | 'title' | 'category'>[];
}

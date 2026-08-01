/**
 * Platform-wide enumerations.
 *
 * These values are the single source of truth shared between the backend and
 * frontend. They are mirrored exactly by the Prisma schema enums; any change
 * here must be reflected in `apps/api/prisma/schema.prisma`.
 */

/** Role of a user within a company (tenant). */
export enum UserRole {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
}

/**
 * Authority over the rooferslabs platform itself, held by staff — deliberately
 * separate from `UserRole`, which is authority *inside* one roofing company.
 *
 * Every customer is a `UserRole.OWNER` (it is the default assigned at signup),
 * so gating the internal admin portal on that role would hand it to the entire
 * customer base. This enum exists so the two authorities can never be confused,
 * and it defaults to NONE so access fails closed.
 */
export enum PlatformRole {
  /** No access to the admin portal. The default for every account. */
  NONE = 'NONE',
  /** rooferslabs staff owner: full read access across every tenant. */
  OWNER = 'OWNER',
}

/** Lifecycle status of a company (tenant). */
export enum CompanyStatus {
  ONBOARDING = 'ONBOARDING',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/** Discrete steps of the guided onboarding wizard. */
export enum OnboardingStep {
  COMPANY = 'COMPANY',
  BUSINESS = 'BUSINESS',
  AI = 'AI',
  KNOWLEDGE = 'KNOWLEDGE',
  COMPLETE = 'COMPLETE',
}

/** Direction of a phone call. The MVP handles inbound calls only. */
export enum CallDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

/** Lifecycle status of a call. */
export enum CallStatus {
  INCOMING = 'INCOMING',
  RINGING = 'RINGING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  NO_ANSWER = 'NO_ANSWER',
  MISSED = 'MISSED',
}

/** Lifecycle status of an AI conversation attached to a call. */
export enum ConversationStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  ABANDONED = 'ABANDONED',
  FAILED = 'FAILED',
}

/** Business outcome derived from a conversation. */
export enum ConversationOutcome {
  LEAD_CAPTURED = 'LEAD_CAPTURED',
  APPOINTMENT_REQUESTED = 'APPOINTMENT_REQUESTED',
  EMERGENCY = 'EMERGENCY',
  INFORMATION_PROVIDED = 'INFORMATION_PROVIDED',
  NO_ACTION = 'NO_ACTION',
  SPAM = 'SPAM',
}

/** Detected customer intent for a conversation. */
export enum ConversationIntent {
  NEW_ESTIMATE = 'NEW_ESTIMATE',
  EMERGENCY_REPAIR = 'EMERGENCY_REPAIR',
  REPAIR = 'REPAIR',
  INSPECTION = 'INSPECTION',
  WARRANTY = 'WARRANTY',
  FOLLOW_UP = 'FOLLOW_UP',
  GENERAL_QUESTION = 'GENERAL_QUESTION',
  BILLING = 'BILLING',
  OTHER = 'OTHER',
}

/** How urgent a captured lead / conversation is. */
export enum UrgencyLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  EMERGENCY = 'EMERGENCY',
}

/** Qualification tier assigned to a lead. */
export enum LeadQuality {
  UNQUALIFIED = 'UNQUALIFIED',
  COLD = 'COLD',
  WARM = 'WARM',
  HOT = 'HOT',
}

/** Status of a customer record within a company. */
export enum CustomerStatus {
  NEW = 'NEW',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

/** Type of property a customer owns. */
export enum PropertyType {
  RESIDENTIAL = 'RESIDENTIAL',
  COMMERCIAL = 'COMMERCIAL',
  UNKNOWN = 'UNKNOWN',
}

/** Lifecycle status of an appointment request. */
export enum AppointmentStatus {
  REQUESTED = 'REQUESTED',
  CONFIRMED = 'CONFIRMED',
  RESCHEDULED = 'RESCHEDULED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

/** Priority of an appointment request. */
export enum AppointmentPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  EMERGENCY = 'EMERGENCY',
}

/** Category of a knowledge base article. */
export enum KnowledgeCategory {
  BUSINESS_INFO = 'BUSINESS_INFO',
  SERVICES = 'SERVICES',
  FAQ = 'FAQ',
  POLICIES = 'POLICIES',
  WARRANTY = 'WARRANTY',
  PRICING = 'PRICING',
  FINANCING = 'FINANCING',
  EMERGENCY = 'EMERGENCY',
  SERVICE_AREAS = 'SERVICE_AREAS',
}

/** Publication status of a knowledge base article. */
export enum KnowledgeStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

/** Type of a notification event. */
export enum NotificationType {
  NEW_CALL = 'NEW_CALL',
  NEW_LEAD = 'NEW_LEAD',
  APPOINTMENT_REQUEST = 'APPOINTMENT_REQUEST',
  EMERGENCY = 'EMERGENCY',
  CALL_SUMMARY = 'CALL_SUMMARY',
  SYSTEM = 'SYSTEM',
  ACCOUNT = 'ACCOUNT',
}

/** Priority of a notification. */
export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

/** Delivery channel for a notification. */
export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

/** Read/delivery status of a notification. */
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

/** Provisioning / assignment status of a Twilio phone number. */
export enum PhoneNumberStatus {
  PROVISIONED = 'PROVISIONED',
  ASSIGNED = 'ASSIGNED',
  ACTIVE = 'ACTIVE',
  RELEASED = 'RELEASED',
}

/** AI receptionist voice presets exposed by the OpenAI Realtime API. */
export enum AiVoice {
  ALLOY = 'alloy',
  ASH = 'ash',
  BALLAD = 'ballad',
  CORAL = 'coral',
  ECHO = 'echo',
  /** Newer gpt-realtime voice; the fleet default (OPENAI_REALTIME_VOICE). */
  MARIN = 'marin',
  SAGE = 'sage',
  SHIMMER = 'shimmer',
  VERSE = 'verse',
}

/**
 * The payment processor a billing record belongs to.
 *
 * Persisted alongside every provider-issued identifier so a row is always
 * self-describing: `providerCustomerId` is meaningless without knowing which
 * system minted it. Exactly one provider is active at a time (the API's
 * PAYMENT_PROVIDER), but historical rows from a previous one stay readable.
 */
export enum PaymentProvider {
  PAYPAL = 'PAYPAL',
  STRIPE = 'STRIPE',
}

/**
 * How often a subscription renews.
 *
 * Only {@link BillingInterval.MONTH} is offered today. `YEAR` is modelled from
 * the start so adding annual plans is a price-configuration change rather than
 * a schema migration.
 */
export enum BillingInterval {
  MONTH = 'MONTH',
  YEAR = 'YEAR',
}

/**
 * Billing status of a company's subscription.
 *
 * A provider-neutral superset: every processor's subscription states map onto
 * these, plus `NONE` for a tenant that has never started checkout. Only
 * `ACTIVE` and `TRIALING` grant access (see {@link ACTIVE_SUBSCRIPTION_STATUSES}).
 *
 * Some members are unreachable under some providers — PayPal has no notion of
 * `INCOMPLETE` or `UNPAID`, for instance. That is deliberate: the enum is the
 * union of what any provider can report, so switching providers never needs a
 * data migration.
 */
export enum SubscriptionStatus {
  NONE = 'NONE',
  INCOMPLETE = 'INCOMPLETE',
  INCOMPLETE_EXPIRED = 'INCOMPLETE_EXPIRED',
  TRIALING = 'TRIALING',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  UNPAID = 'UNPAID',
  PAUSED = 'PAUSED',
}

/** Subscription statuses that entitle a tenant to use the application. */
export const ACTIVE_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

/** Self-serve subscription plans available at checkout. */
export enum SubscriptionPlan {
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
}

/**
 * Lifecycle of a synchronized invoice.
 *
 * Mirrors the provider's billing document so the tenant can see its payment
 * history without a round-trip to the provider on every page load.
 */
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PAID = 'PAID',
  VOID = 'VOID',
  UNCOLLECTIBLE = 'UNCOLLECTIBLE',
}

/**
 * Standard API response contract.
 *
 * Every rooferslabs API response — success or error — follows one of these two
 * shapes, so clients can consume any endpoint without bespoke parsing.
 */

/** Pagination metadata attached to any paginated collection response. */
export interface PaginationMeta {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Arbitrary, endpoint-specific metadata (never business data). */
export type ResponseMetadata = Record<string, unknown>;

/** Successful API response envelope. */
export interface ApiSuccessResponse<TData = unknown> {
  success: true;
  message: string;
  data: TData;
  metadata?: ResponseMetadata;
  pagination?: PaginationMeta;
  timestamp: string;
  requestId: string;
}

/** A single field-level validation error. */
export interface ApiValidationError {
  field: string;
  message: string;
}

/** Error payload embedded in a failed API response. */
export interface ApiErrorPayload {
  code: string;
  message: string;
  validationErrors?: ApiValidationError[];
}

/** Failed API response envelope. */
export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
  timestamp: string;
  requestId: string;
}

/** Union of both response shapes. */
export type ApiResponse<TData = unknown> = ApiSuccessResponse<TData> | ApiErrorResponse;

/** Stable, machine-readable error codes returned by the API. */
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  TENANT_ISOLATION_VIOLATION = 'TENANT_ISOLATION_VIOLATION',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  ONBOARDING_INCOMPLETE = 'ONBOARDING_INCOMPLETE',
  /** No active subscription — the client must send the user to billing. */
  SUBSCRIPTION_REQUIRED = 'SUBSCRIPTION_REQUIRED',
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  /**
   * Billing is switched off platform-wide (PAYMENTS_ENABLED=false), so the
   * billing surface is unavailable. Distinct from SUBSCRIPTION_REQUIRED: that
   * one means "go and pay", this one means "paying is not possible right now"
   * — and access is not restricted while it applies.
   */
  PAYMENTS_DISABLED = 'PAYMENTS_DISABLED',
  /**
   * The billing operation was addressed to a provider that is not the active
   * one (the API's PAYMENT_PROVIDER). Distinct from PAYMENTS_DISABLED: billing
   * as a whole is on, but this particular processor is dormant.
   */
  BILLING_PROVIDER_DISABLED = 'BILLING_PROVIDER_DISABLED',
  /** The active billing provider is missing the credentials it needs to run. */
  BILLING_PROVIDER_UNCONFIGURED = 'BILLING_PROVIDER_UNCONFIGURED',
  COMPANY_NOT_FOUND = 'COMPANY_NOT_FOUND',
  CUSTOMER_NOT_FOUND = 'CUSTOMER_NOT_FOUND',
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  APPOINTMENT_NOT_FOUND = 'APPOINTMENT_NOT_FOUND',
  KNOWLEDGE_ARTICLE_NOT_FOUND = 'KNOWLEDGE_ARTICLE_NOT_FOUND',
}

/** Standard sort directions. */
export type SortDirection = 'asc' | 'desc';

/** Common query parameters supported by collection endpoints. */
export interface CollectionQuery {
  page?: number;
  limit?: number;
  sort?: string;
  search?: string;
}

/** Default and maximum page sizes enforced across collection endpoints. */
export const PAGINATION_DEFAULTS = {
  page: 1,
  limit: 25,
  maxLimit: 100,
} as const;

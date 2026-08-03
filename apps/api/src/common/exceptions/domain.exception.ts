import { HttpException, HttpStatus } from '@nestjs/common';
import { ApiErrorCode } from '@rooferslabs/shared';

/**
 * Base class for business-rule failures. Unlike raw HttpExceptions, a
 * DomainException carries a stable {@link ApiErrorCode} that the client can
 * branch on, and never leaks internal detail. Services throw these; the global
 * exception filter renders them into the standard error envelope.
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    status: HttpStatus,
  ) {
    super(message, status);
  }
}

export class NotFoundError extends DomainException {
  constructor(
    message = 'The requested resource could not be found.',
    code = ApiErrorCode.NOT_FOUND,
  ) {
    super(code, message, HttpStatus.NOT_FOUND);
  }
}

export class ConflictError extends DomainException {
  constructor(
    message = 'The request conflicts with the current state.',
    code = ApiErrorCode.CONFLICT,
  ) {
    super(code, message, HttpStatus.CONFLICT);
  }
}

export class ForbiddenError extends DomainException {
  constructor(message = 'You do not have permission to perform this action.') {
    super(ApiErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }
}

export class UnauthorizedError extends DomainException {
  constructor(message = 'Authentication is required.') {
    super(ApiErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }
}

export class BusinessRuleError extends DomainException {
  constructor(message: string, code = ApiErrorCode.BUSINESS_RULE_VIOLATION) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

export class OnboardingIncompleteError extends DomainException {
  constructor(message = 'Company onboarding must be completed first.') {
    super(ApiErrorCode.ONBOARDING_INCOMPLETE, message, HttpStatus.FORBIDDEN);
  }
}

export class ExternalServiceError extends DomainException {
  constructor(message = 'An upstream service is currently unavailable.') {
    super(ApiErrorCode.EXTERNAL_SERVICE_ERROR, message, HttpStatus.BAD_GATEWAY);
  }
}

/**
 * Billing is switched off platform-wide (PAYMENTS_ENABLED=false).
 *
 * 503 rather than 402: nothing the caller does can satisfy this, and unlike
 * SUBSCRIPTION_REQUIRED it carries no loss of access — the payment wall is open
 * while it applies, so a client must not treat it as "go and pay".
 */
export class PaymentsDisabledError extends DomainException {
  constructor(message = 'Payments are temporarily unavailable. Please try again later.') {
    super(ApiErrorCode.PAYMENTS_DISABLED, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/**
 * A dormant billing provider was asked to do work.
 *
 * Only one provider is active at a time (PAYMENT_PROVIDER). The inactive one
 * stays fully implemented and compile-checked, but every entry point into it
 * raises this rather than opening a connection — so a stale route, a redelivered
 * webhook, or a mistaken injection cannot quietly transact against the wrong
 * processor. 503 because the condition is server-side and the caller cannot fix
 * it by changing the request.
 */
export class BillingProviderDisabledError extends DomainException {
  constructor(provider: string) {
    super(
      ApiErrorCode.BILLING_PROVIDER_DISABLED,
      `The ${provider} billing provider is disabled. Set PAYMENT_PROVIDER=${provider.toLowerCase()} to enable it.`,
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/**
 * The active billing provider is missing credentials it cannot run without.
 *
 * Deliberately separate from {@link BillingProviderDisabledError}: this one is
 * an operator mistake (keys absent) rather than a deliberate configuration, and
 * production boot already refuses it — so seeing this at runtime means a
 * non-production environment, where the message should say exactly what to set.
 */
export class BillingProviderUnconfiguredError extends DomainException {
  constructor(message: string) {
    super(ApiErrorCode.BILLING_PROVIDER_UNCONFIGURED, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

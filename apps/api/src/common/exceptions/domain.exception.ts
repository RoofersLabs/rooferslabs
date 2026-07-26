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

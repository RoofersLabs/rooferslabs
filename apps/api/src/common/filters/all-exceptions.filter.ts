import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ApiErrorCode, type ApiErrorResponse, type ApiValidationError } from '@rooferslabs/shared';
import { DomainException } from '../exceptions/domain.exception';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Translates every thrown error into the standard error envelope
 * (docs/09_API_Standards.md §14). Internal details and stack traces are never
 * exposed; unexpected errors are logged and returned as a generic 500.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<AuthenticatedRequest>();
    const requestId = request.requestId ?? 'unknown';

    // A handler that responds via @Res() (Twilio webhooks) may have already
    // sent; attempting a second response would raise ERR_HTTP_HEADERS_SENT.
    if (response.headersSent) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} threw after the response was sent`,
        exception instanceof Error ? exception.stack : String(exception),
      );
      return;
    }

    const { status, code, message, validationErrors } = this.resolve(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${requestId}] ${request.method} ${request.url} → ${status} ${code}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(
        `[${requestId}] ${request.method} ${request.url} → ${status} ${code}: ${message}`,
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        ...(validationErrors ? { validationErrors } : {}),
      },
      timestamp: new Date().toISOString(),
      requestId,
    };

    response.setHeader('x-request-id', requestId);
    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    code: string;
    message: string;
    validationErrors?: ApiValidationError[];
  } {
    if (exception instanceof DomainException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: ApiErrorCode.RATE_LIMITED,
        message: 'Too many requests. Please slow down and try again shortly.',
      };
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.fromPrismaError(exception);
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ApiErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred. Please try again.',
    };
  }

  private fromHttpException(exception: HttpException): {
    status: number;
    code: string;
    message: string;
    validationErrors?: ApiValidationError[];
  } {
    const status = exception.getStatus();
    const res = exception.getResponse();

    // Validation errors produced by our ValidationPipe exceptionFactory.
    if (typeof res === 'object' && res !== null && 'validationErrors' in res) {
      const payload = res as { message?: string; validationErrors?: ApiValidationError[] };
      return {
        status,
        code: ApiErrorCode.VALIDATION_ERROR,
        message: payload.message ?? 'Validation failed.',
        validationErrors: payload.validationErrors,
      };
    }

    const message =
      typeof res === 'string'
        ? res
        : ((res as { message?: string | string[] })?.message ?? exception.message);

    const codeByStatus: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: ApiErrorCode.VALIDATION_ERROR,
      [HttpStatus.UNAUTHORIZED]: ApiErrorCode.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ApiErrorCode.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ApiErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: ApiErrorCode.CONFLICT,
      [HttpStatus.TOO_MANY_REQUESTS]: ApiErrorCode.RATE_LIMITED,
    };

    return {
      status,
      code: codeByStatus[status] ?? ApiErrorCode.INTERNAL_ERROR,
      message: Array.isArray(message) ? message.join(', ') : message,
    };
  }

  private fromPrismaError(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
  } {
    switch (exception.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: ApiErrorCode.CONFLICT,
          message: 'A record with these details already exists.',
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: ApiErrorCode.NOT_FOUND,
          message: 'The requested resource could not be found.',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ApiErrorCode.INTERNAL_ERROR,
          message: 'A database error occurred. Please try again.',
        };
    }
  }
}

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { map, Observable } from 'rxjs';
import type { ApiSuccessResponse } from '@rooferslabs/shared';
import { ApiPayload } from '../response';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Wraps every successful controller return value in the standard success
 * envelope. Controllers return raw data or an
 * {@link ApiPayload}; clients always receive the same shape.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiSuccessResponse<T>> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const response = http.getResponse<Response>();

    return next.handle().pipe(
      map((payload) => {
        // Webhook handlers (Twilio TwiML/status) respond via @Res() directly;
        // touching headers after that would raise ERR_HTTP_HEADERS_SENT.
        if (response.headersSent) {
          return payload as ApiSuccessResponse<T>;
        }

        const isEnvelope = payload instanceof ApiPayload;
        const data = (isEnvelope ? payload.data : payload) as T;

        const body: ApiSuccessResponse<T> = {
          success: true,
          message: isEnvelope ? payload.message : 'OK',
          data: (data ?? null) as T,
          timestamp: new Date().toISOString(),
          requestId: request.requestId,
        };

        if (isEnvelope && payload.metadata) body.metadata = payload.metadata;
        if (isEnvelope && payload.pagination) body.pagination = payload.pagination;

        // Reflect the correlation id back to the caller.
        response.setHeader('x-request-id', request.requestId);
        return body;
      }),
    );
  }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { REQUEST_ID_HEADER } from '../constants';
import type { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

/**
 * Assigns a correlation id to every request (reusing an inbound
 * `x-request-id` header when present). The id flows into logs and both the
 * success and error response envelopes.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    const inbound = req.headers[REQUEST_ID_HEADER];
    req.requestId = (Array.isArray(inbound) ? inbound[0] : inbound) || `req_${randomUUID()}`;
    next();
  }
}

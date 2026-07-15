import type { PaginationMeta, ResponseMetadata } from '@rooferslabs/shared';

/**
 * Optional envelope a controller may return to attach a custom message,
 * metadata, or pagination. When a controller returns a raw value instead, the
 * response interceptor wraps it with a default message. This keeps controllers
 * thin while producing the standard response contract (docs/09_API_Standards §13).
 */
export class ApiPayload<T> {
  constructor(
    public readonly data: T,
    public readonly message: string = 'OK',
    public readonly metadata?: ResponseMetadata,
    public readonly pagination?: PaginationMeta,
  ) {}
}

/** Wrap a value with an optional success message. */
export function respond<T>(data: T, message = 'OK', metadata?: ResponseMetadata): ApiPayload<T> {
  return new ApiPayload(data, message, metadata);
}

/** Wrap a paginated collection with its pagination metadata. */
export function paginated<T>(
  items: T[],
  pagination: PaginationMeta,
  message = 'OK',
  metadata?: ResponseMetadata,
): ApiPayload<T[]> {
  return new ApiPayload(items, message, metadata, pagination);
}

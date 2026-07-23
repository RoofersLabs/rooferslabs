import type { ApiErrorResponse, ApiSuccessResponse, PaginationMeta } from '@rooferslabs/shared';
import { config } from '@/config';

/** Error thrown for any non-success API response, carrying the stable code. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly validationErrors?: { field: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Generous client-side cap so a hung request never hangs the UI forever. */
const REQUEST_TIMEOUT_MS = 30_000;

/** Where a tenant without an active subscription is sent to pay. */
const BILLING_ROUTE = '/payment';

/**
 * The backend answers 402 SUBSCRIPTION_REQUIRED for every gated endpoint once a
 * subscription lapses. A tab that was open when that happened would otherwise
 * sit on a dead screen, so send it to billing — guarded against a redirect loop
 * on the billing routes themselves.
 */
function redirectToBilling(): void {
  const { pathname } = window.location;
  if (pathname === BILLING_ROUTE || pathname === '/billing') return;
  window.location.assign(BILLING_ROUTE);
}

type TokenGetter = () => Promise<string | null>;

let getToken: TokenGetter = async () => null;

/** Wire the Clerk session-token getter into the API client (set once at boot). */
export function setTokenGetter(getter: TokenGetter): void {
  getToken = getter;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
  metadata?: Record<string, unknown>;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

/**
 * Envelope-aware fetch wrapper. Every backend response follows the standard
 * contract from @rooferslabs/shared; this unwraps `data` on success and throws
 * a typed {@link ApiError} on failure.
 */
async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiSuccessResponse<T>> {
  const url = new URL(`${config.apiBaseUrl}/v1${path}`, window.location.origin);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }

  const token = await getToken();
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new ApiError('TIMEOUT', 'The request timed out. Please try again.', 0);
    }
    throw new ApiError(
      'NETWORK_ERROR',
      navigator.onLine
        ? 'Unable to reach the server. Please try again.'
        : 'You appear to be offline. Check your connection and try again.',
      0,
    );
  }

  let payload: ApiSuccessResponse<T> | ApiErrorResponse;
  try {
    payload = (await response.json()) as ApiSuccessResponse<T> | ApiErrorResponse;
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'The server returned an unexpected response.',
      response.status,
    );
  }

  if (!payload.success) {
    const err = payload.error;
    if (response.status === 402) redirectToBilling();
    throw new ApiError(err.code, err.message, response.status, err.validationErrors);
  }
  return payload;
}

export const api = {
  async get<T>(path: string, query?: RequestOptions['query']): Promise<T> {
    return (await request<T>(path, { query })).data;
  },

  /** GET a paginated collection, preserving pagination + metadata. */
  async getPaginated<T>(
    path: string,
    query?: RequestOptions['query'],
  ): Promise<PaginatedResult<T>> {
    const res = await request<T[]>(path, { query });
    return {
      items: res.data,
      pagination:
        res.pagination ??
        ({
          page: 1,
          limit: res.data.length,
          totalRecords: res.data.length,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        } satisfies PaginationMeta),
      metadata: res.metadata,
    };
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    return (await request<T>(path, { method: 'POST', body })).data;
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    return (await request<T>(path, { method: 'PATCH', body })).data;
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    return (await request<T>(path, { method: 'PUT', body })).data;
  },

  async delete<T>(path: string): Promise<T> {
    return (await request<T>(path, { method: 'DELETE' })).data;
  },

  /** GET binary content (e.g. call recordings) with the same auth handling. */
  async getBlob(path: string): Promise<Blob> {
    const token = await getToken();
    const response = await fetch(`${config.apiBaseUrl}/v1${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new ApiError('NOT_FOUND', 'The file could not be loaded.', response.status);
    }
    return response.blob();
  },
};

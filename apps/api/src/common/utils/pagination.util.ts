import { PAGINATION_DEFAULTS, type PaginationMeta, type SortDirection } from '@rooferslabs/shared';

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

/** Clamp page/limit into safe bounds and compute the Prisma skip/take. */
export function normalizePagination(page?: number, limit?: number): NormalizedPagination {
  const safePage = Math.max(1, Math.trunc(page ?? PAGINATION_DEFAULTS.page));
  const safeLimit = Math.min(
    PAGINATION_DEFAULTS.maxLimit,
    Math.max(1, Math.trunc(limit ?? PAGINATION_DEFAULTS.limit)),
  );
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit, take: safeLimit };
}

/** Build the standard pagination metadata block. */
export function buildPaginationMeta(
  page: number,
  limit: number,
  totalRecords: number,
): PaginationMeta {
  const totalPages = limit > 0 ? Math.ceil(totalRecords / limit) : 0;
  return {
    page,
    limit,
    totalRecords,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

/**
 * Parse a `field:direction` sort expression into a Prisma orderBy object,
 * validating the field against an allow-list to prevent injection.
 */
export function parseSort<T extends string>(
  sort: string | undefined,
  allowedFields: readonly T[],
  fallback: { field: T; direction: SortDirection },
): Record<string, SortDirection> {
  if (!sort) return { [fallback.field]: fallback.direction };

  const [rawField, rawDir] = sort.split(':');
  const field = (rawField ?? '').trim() as T;
  const direction: SortDirection = rawDir?.trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

  if (!allowedFields.includes(field)) {
    return { [fallback.field]: fallback.direction };
  }
  return { [field]: direction };
}

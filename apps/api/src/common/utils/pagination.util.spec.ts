import { buildPaginationMeta, normalizePagination, parseSort } from './pagination.util';

describe('normalizePagination', () => {
  it('applies defaults when nothing is provided', () => {
    const result = normalizePagination();
    expect(result.page).toBe(1);
    expect(result.skip).toBe(0);
    expect(result.take).toBe(result.limit);
  });

  it('clamps page and limit into safe bounds', () => {
    expect(normalizePagination(-5, 10_000)).toMatchObject({ page: 1, limit: 100 });
    expect(normalizePagination(0, 0)).toMatchObject({ page: 1, limit: 1 });
  });

  it('computes skip from page and limit', () => {
    expect(normalizePagination(3, 20)).toMatchObject({ skip: 40, take: 20 });
  });
});

describe('buildPaginationMeta', () => {
  it('reports next/previous page availability', () => {
    expect(buildPaginationMeta(1, 10, 25)).toMatchObject({
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(buildPaginationMeta(3, 10, 25)).toMatchObject({
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it('handles empty result sets', () => {
    expect(buildPaginationMeta(1, 10, 0)).toMatchObject({
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});

describe('parseSort', () => {
  const allowed = ['createdAt', 'title'] as const;
  const fallback = { field: 'createdAt', direction: 'desc' } as const;

  it('parses a valid field:direction expression', () => {
    expect(parseSort('title:asc', allowed, fallback)).toEqual({ title: 'asc' });
  });

  it('defaults direction to desc', () => {
    expect(parseSort('title', allowed, fallback)).toEqual({ title: 'desc' });
  });

  it('rejects fields outside the allow-list (injection guard)', () => {
    expect(parseSort('password:asc', allowed, fallback)).toEqual({ createdAt: 'desc' });
    expect(parseSort(undefined, allowed, fallback)).toEqual({ createdAt: 'desc' });
  });
});

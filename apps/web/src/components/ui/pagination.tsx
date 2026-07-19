import type { PaginationMeta } from '@rooferslabs/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

export function Pagination({
  pagination,
  onPageChange,
}: {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  if (pagination.totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between border-t border-line-subtle px-4 py-3"
    >
      <p className="text-small text-ink-faint">
        Page <span className="font-num text-ink-muted">{pagination.page}</span> of{' '}
        <span className="font-num text-ink-muted">{pagination.totalPages}</span> ·{' '}
        <span className="font-num text-ink-muted">{pagination.totalRecords}</span> total
      </p>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!pagination.hasPreviousPage}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!pagination.hasNextPage}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

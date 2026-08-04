import type { PaginationMeta } from '@rooferslabs/shared';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * List/table footer. Shares the surrounding surface's 24px gutter so its rule
 * lines up with the rows above it rather than insetting by a different amount.
 */
export function Pagination({
  pagination,
  onPageChange,
  className,
}: {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  /** Escape hatch for the one caller that owns its own container edge. */
  className?: string;
}) {
  if (pagination.totalPages <= 1) return null;
  return (
    <nav
      aria-label="Pagination"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle px-6 py-4',
        className,
      )}
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
          <ChevronLeftIcon className="h-4 w-4" aria-hidden />
          Previous
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!pagination.hasNextPage}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next
          <ChevronRightIcon className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

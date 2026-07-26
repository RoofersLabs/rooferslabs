import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Standard dashboard surface: a titled card with an optional "view all" link in
 * the header. 16px radius, hairline border, calm shadow. The body is supplied
 * by the caller so the same shell wraps lists, tiles and timelines alike.
 */
export function SectionCard({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  action?: { label: string; to: string };
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface shadow-card transition-shadow duration-base ease-standard hover:shadow-card-hover',
        className,
      )}
    >
      <header className="flex items-center justify-between gap-4 px-6 pt-5 pb-4">
        <h2 className="text-h5 text-ink">{title}</h2>
        {action && (
          <Link
            to={action.to}
            className="focus-ring inline-flex items-center gap-1 rounded text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
          >
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </header>
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * A titled dashboard panel with an optional "view all" link in its header.
 *
 * The surface itself is the shared `Card` — this component adds the header
 * affordance and tightens the radius for the dashboard's denser grid, leaving
 * the border and elevation shared with every feature page's table shell. The
 * body is supplied by the caller so one shell wraps lists, tiles and timelines
 * alike.
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
  // No radius of its own: `Card` carries `--radius-panel`, which every
  // structural container in the product now shares. `overflow-hidden` stays —
  // it is what clips the table and list rows to the panel's corners.
  return (
    <Card as="section" aria-label={title} className={cn('overflow-hidden', className)}>
      <CardHeader className="items-center">
        <CardTitle as="h2">{title}</CardTitle>
        {action && (
          <Link
            to={action.to}
            className="focus-ring inline-flex shrink-0 items-center gap-1 rounded-focus text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
          >
            {action.label}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        )}
      </CardHeader>
      <div className={cn('flex-1', bodyClassName)}>{children}</div>
    </Card>
  );
}

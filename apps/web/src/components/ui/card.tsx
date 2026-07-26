import { cn } from '@/lib/utils';

/**
 * The canonical surface of the authenticated product.
 *
 * Radius, border, background and elevation are fixed here and nowhere else, so
 * a page-level table shell, a settings form and a dashboard widget read as the
 * same object. Elevation is deliberately static: only a card that is itself a
 * link or button lifts on hover (`.card-interactive` in styles/index.css),
 * which keeps the shadow from pulsing as the pointer crosses table rows.
 *
 * Sections own their padding and the card adds no gap of its own, so a header
 * followed by content produces exactly the spacing those two declare — never a
 * third, invisible gap between them.
 */
/** Elements a card may render as, so a panel can still be a landmark or a form. */
type CardElement = 'div' | 'section' | 'article' | 'form';

function Card({
  className,
  as = 'div',
  ...props
}: React.ComponentProps<'div'> & { as?: CardElement }) {
  const Tag = as as React.ElementType;
  return (
    <Tag
      data-slot="card"
      className={cn(
        'flex flex-col rounded-xl border border-line-subtle bg-surface shadow-card',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Titled card header, matching the dashboard's section header exactly: 24px
 * gutters, a little more room above the title than below it, and no divider of
 * its own — the body draws the hairline when its content needs separating.
 */
function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex items-start justify-between gap-4 px-6 pt-5 pb-4', className)}
      {...props}
    />
  );
}

function CardTitle({
  className,
  as = 'div',
  ...props
}: React.ComponentProps<'div'> & { as?: 'div' | 'h2' | 'h3' }) {
  const Tag = as as React.ElementType;
  return <Tag data-slot="card-title" className={cn('text-h5 text-ink', className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('mt-0.5 text-small text-ink-muted', className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('flex shrink-0 items-center gap-2', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-6 py-5', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center justify-end gap-3 border-t border-line-subtle bg-surface-2 px-6 py-4',
        className,
      )}
      {...props}
    />
  );
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent };

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Device frames for product shots. Ported from Launch UI's Mockup /
 * MockupFrame, rebuilt on the marketing tokens.
 *
 * These render the product in real DOM rather than wrapping a screenshot: it
 * stays sharp at any density, themes with the page, costs no image payload,
 * and can't go stale when the dashboard changes.
 */

/** Desktop browser chrome. */
export function BrowserFrame({
  children,
  className,
  url = 'app.rooferslabs.com',
}: {
  children: ReactNode;
  className?: string;
  url?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-mkt-line bg-mkt-surface shadow-mkt-mockup',
        className,
      )}
    >
      <div className="flex items-center gap-2 border-b border-mkt-line-subtle bg-mkt-bg-subtle px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-mkt-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-mkt-line-strong" />
          <span className="h-2.5 w-2.5 rounded-full bg-mkt-line-strong" />
        </div>
        <div className="mx-auto flex items-center gap-1.5 rounded-md bg-mkt-surface px-3 py-1 text-[0.6875rem] text-mkt-ink-faint">
          <LockIcon />
          {url}
        </div>
      </div>
      {children}
    </div>
  );
}

/** Phone frame for the conversation demo. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full max-w-[19rem] rounded-[2.25rem] border border-mkt-line bg-mkt-surface p-2.5 shadow-mkt-mockup',
        className,
      )}
    >
      <div className="relative overflow-hidden rounded-[1.75rem] bg-mkt-bg">
        <div
          className="absolute left-1/2 top-2 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-mkt-ink/90"
          aria-hidden
        />
        {children}
      </div>
    </div>
  );
}

/**
 * Wrapper that lifts a mockup off the page with a glow and an optional float.
 * The float is decorative, so it is disabled under prefers-reduced-motion by
 * the `mkt-animate-float` rule in marketing.css.
 */
export function MockupFrame({
  children,
  className,
  float = false,
}: {
  children: ReactNode;
  className?: string;
  float?: boolean;
}) {
  return (
    <div className={cn('relative', className)}>
      <div
        aria-hidden
        className="mkt-animate-glow pointer-events-none absolute -inset-x-8 -bottom-6 top-8 rounded-[100%] blur-[70px]"
        style={{
          background: 'radial-gradient(ellipse at center, var(--mkt-glow-blue) 0%, transparent 66%)',
          opacity: 'var(--mkt-glow-strength)',
        }}
      />
      <div className={cn('relative', float && 'mkt-animate-float')}>{children}</div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" strokeWidth="2.5" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" strokeWidth="2.5" />
    </svg>
  );
}

import { cn } from '@/lib/utils';

/**
 * The rooferslabs identity. This file is the only place the mark's geometry
 * exists in the application — marketing, the dashboard, the auth pages and the
 * admin portal all render these, so the logo can never drift between surfaces.
 *
 * The paths are traced from the approved artwork and must not be edited:
 * proportions, angles and the aspect ratio are the identity. The mark is drawn
 * in `currentColor` so one set of coordinates serves the navy-on-light product
 * and the white-on-black marketing canvas without a second copy.
 */

/** Natural dimensions of the mark, and therefore its immutable aspect ratio. */
const VIEW_BOX = '0 0 933 343';

/** The roof plane, and the smaller face to its right. */
const PLANE = 'M373 0H817L447 343H0Z';
const FACE = 'M555 343L750 159L933 343Z';

/**
 * The mark on its own — sidebars in their collapsed state, favicons rendered in
 * the app, loading screens, anywhere the wordmark would not fit.
 *
 * Sizing is by height (`h-4`, `h-6`); width follows from the viewBox, which is
 * what keeps the mark from ever being stretched.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={VIEW_BOX}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={cn('h-4 w-auto shrink-0', className)}
    >
      <path d={PLANE} />
      <path d={FACE} />
    </svg>
  );
}

type LogoSize = 'sm' | 'md' | 'lg';

/**
 * Mark plus wordmark, always in that order and always one colour.
 *
 * The name is lowercase in every context — it is set as a literal here rather
 * than passed in, so no caller can capitalise it. Weight steps down as the
 * lockup grows: 600 keeps small sizes from going spindly, 500 keeps large ones
 * from shouting.
 */
const SIZES: Record<LogoSize, { mark: string; word: string }> = {
  sm: { mark: 'h-[11px]', word: 'text-[15px] font-semibold tracking-[-0.02em]' },
  md: { mark: 'h-[13px]', word: 'text-[17px] font-semibold tracking-[-0.02em]' },
  lg: { mark: 'h-[18px]', word: 'text-[23px] font-medium tracking-[-0.015em]' },
};

const GAPS: Record<LogoSize, string> = {
  sm: 'gap-2',
  md: 'gap-2.5',
  lg: 'gap-3',
};

export function Logo({ size = 'md', className }: { size?: LogoSize; className?: string }) {
  return (
    <span className={cn('inline-flex items-center', GAPS[size], className)}>
      <LogoMark className={SIZES[size].mark} />
      <span className={SIZES[size].word}>rooferslabs</span>
    </span>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Reveal } from './Reveal';

/**
 * Where the section's ambient blue wash is centred. `none` is for the two
 * sections that already own a `<Glow>` behind their panel — a second light
 * source in the same box just muddies the first.
 */
type GlowPlacement = 'top' | 'left' | 'right' | 'center' | 'bottom' | 'none';

/**
 * Vertical rhythm for the whole page. Every section uses this, so spacing is
 * changed in one place rather than drifting per-section.
 *
 * Ported from Launch UI's `Section`, whose Tailwind v4 `line-b` utility relies
 * on `@utility` and doesn't compile here — the hairline is a plain border.
 */
export function Section({
  children,
  className,
  id,
  tone = 'base',
  bordered = false,
  glow = 'top',
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  /** `subtle` is the alternating band used to separate adjacent sections. */
  tone?: 'base' | 'subtle';
  bordered?: boolean;
  /**
   * Ambient lighting, on by default so a new section is lit without opting in.
   * Placements alternate down the page; see `.mkt-ambient` in marketing.css.
   */
  glow?: GlowPlacement;
}) {
  return (
    <section
      id={id}
      className={cn(
        // Two things are load-bearing here.
        //
        // `overflow-x-clip`, not `overflow-hidden`: glows and mockup halos are
        // deliberately wider than the viewport (120vw, negative insets) and
        // would otherwise push the page sideways on mobile. Clip rather than
        // hidden because clip doesn't create a scroll container, so any
        // `position: sticky` descendant keeps working.
        //
        // The vertical padding is deliberately generous. On a dark page
        // whitespace is the main thing separating one idea from the next: the
        // tonal step between bands is only a few points of luminance and can't
        // do that work on its own.
        'relative overflow-x-clip px-5 py-24 sm:px-6 sm:py-28 lg:py-36',
        tone === 'subtle' && 'bg-mkt-bg-subtle',
        bordered && 'border-t border-mkt-line-subtle',
        glow !== 'none' && ['mkt-ambient', `mkt-ambient-${glow}`],
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Consistent max-width + centring for section content. */
export function Container({
  children,
  className,
  size = 'default',
}: {
  children: ReactNode;
  className?: string;
  size?: 'default' | 'narrow' | 'wide';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        size === 'narrow' && 'max-w-3xl',
        size === 'default' && 'max-w-6xl',
        size === 'wide' && 'max-w-7xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Eyebrow + headline + optional lede. Centred by default; `align="left"` is
 * used by the sections that pair copy with a visual.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = 'center',
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: 'center' | 'left';
  className?: string;
}) {
  return (
    <Reveal
      className={cn('flex flex-col', align === 'center' && 'items-center text-center', className)}
    >
      {eyebrow && (
        // Wider tracking and a smaller size than the old step: an eyebrow's job
        // is to label the section quietly, so it reads as a caption rather than
        // as a second, competing headline.
        <span className="mb-5 text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-mkt-accent">
          {eyebrow}
        </span>
      )}
      <h2 className="max-w-3xl text-balance text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.032em] text-mkt-ink sm:text-4xl lg:text-[2.625rem]">
        {title}
      </h2>
      {lede && (
        <p
          className={cn(
            // Narrower measure than the headline. A lede set as wide as a
            // display heading runs past a comfortable line length and stops
            // being scannable.
            'mt-5 max-w-xl text-pretty text-[1.0625rem] leading-[1.65] text-mkt-ink-muted',
            align === 'center' && 'mx-auto',
          )}
        >
          {lede}
        </p>
      )}
    </Reveal>
  );
}

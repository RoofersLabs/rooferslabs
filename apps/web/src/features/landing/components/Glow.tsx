import { cn } from '@/lib/utils';

type Placement = 'top' | 'center' | 'bottom' | 'above';

/**
 * The ambient radial lighting behind heroes and mockups.
 *
 * Launch UI's `Glow` is Tailwind v4; this is the v3 equivalent driven by the
 * marketing glow tokens, so light and dark are lit independently rather than
 * one being a dimmed copy of the other.
 *
 * Always `aria-hidden` and never interactive — it is lighting, not content.
 */
export function Glow({
  placement = 'top',
  className,
  animate = true,
}: {
  placement?: Placement;
  className?: string;
  animate?: boolean;
}) {
  const position: Record<Placement, string> = {
    top: 'top-0 -translate-y-1/3',
    center: 'top-1/2 -translate-y-1/2',
    bottom: 'bottom-0 translate-y-1/3',
    above: '-top-24',
  };

  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 z-0 overflow-visible',
        position[placement],
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto h-[26rem] w-[min(64rem,120vw)] rounded-[100%] blur-[86px]',
          animate && 'mkt-animate-glow',
        )}
        style={{
          background:
            'radial-gradient(ellipse at center, var(--mkt-glow-blue) 0%, transparent 62%)',
          opacity: 'var(--mkt-glow-strength)',
        }}
      />
      <div
        className={cn(
          'absolute inset-x-0 top-10 mx-auto h-[20rem] w-[min(42rem,90vw)] rounded-[100%] blur-[76px]',
          animate && 'mkt-animate-glow',
        )}
        style={{
          background:
            'radial-gradient(ellipse at center, var(--mkt-glow-indigo) 0%, transparent 64%)',
          opacity: 'var(--mkt-glow-strength)',
          animationDelay: '-6s',
        }}
      />
    </div>
  );
}

/**
 * Hero lighting. Two flat layers, no animation, no blur radius to composite:
 *
 *   1. a single cool radial falling from above the fold, and
 *   2. a vignette that darkens the outer corners.
 *
 * Together they seat the headline in the middle of the frame without ever
 * becoming the subject. Both are tokens, so light and dark are lit
 * independently while the markup stays identical.
 *
 * It bleeds one navbar-height (80px) above its container so the lighting
 * passes behind the transparent bar. Stopped at the section edge, the gradient
 * would draw a visible seam along the navbar's bottom.
 */
export function HeroAtmosphere({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute -top-20 bottom-0 left-0 right-0 z-0', className)}
    >
      <div className="absolute inset-0 bg-mkt-hero" />
      <div className="absolute inset-0 bg-mkt-vignette" />
    </div>
  );
}

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

/** Full-bleed hero atmosphere: the layered radial wash from the token file. */
export function HeroAtmosphere({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 z-0 bg-mkt-hero', className)}
    />
  );
}

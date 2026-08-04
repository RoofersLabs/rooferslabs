import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Tinted fill + matching icon hue, drawn from the shared semantic tokens. */
const tones = {
  brand: 'bg-accent-subtle text-accent',
  emergency: 'bg-emergency-subtle text-emergency',
  success: 'bg-success-subtle text-success',
  warning: 'bg-warning-subtle text-warning',
  info: 'bg-info-subtle text-info',
  neutral: 'bg-surface-3 text-ink-muted',
} as const;

/**
 * Four tile sizes, each pairing a box with the icon size that reads correctly
 * inside it. Sizing the box and the glyph together is the point: hand-written
 * pairs are how one list ended up with 20px icons in 36px tiles and another
 * with 16px icons in 40px tiles.
 */
const sizes = {
  sm: { box: 'h-8 w-8', icon: 'h-4 w-4' },
  md: { box: 'h-10 w-10', icon: 'h-5 w-5' },
  lg: { box: 'h-12 w-12', icon: 'h-6 w-6' },
  xl: { box: 'h-14 w-14', icon: 'h-6 w-6' },
} as const;

const shapes = {
  circle: 'rounded-full',
  square: 'rounded-panel',
} as const;

export type IconTileTone = keyof typeof tones;

/**
 * The standard leading icon of a list row, a card header, or an empty state.
 *
 * Used everywhere an icon sits in a tinted container, so the tile size, radius
 * and icon size can only ever come in the combinations defined above.
 */
export function IconTile({
  icon: Icon,
  tone = 'brand',
  size = 'md',
  shape = 'circle',
  className,
}: {
  icon: LucideIcon;
  tone?: IconTileTone;
  size?: keyof typeof sizes;
  shape?: keyof typeof shapes;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center',
        sizes[size].box,
        shapes[shape],
        tones[tone],
        className,
      )}
    >
      <Icon className={sizes[size].icon} aria-hidden />
    </span>
  );
}

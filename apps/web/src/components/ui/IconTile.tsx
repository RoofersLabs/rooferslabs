import { cn } from '@/lib/utils';
import { ICON_SIZE, type IconComponent } from '@/components/ui/icon';

/**
 * Icon hue, drawn from the shared semantic tokens.
 *
 * Colour only. These used to be `bg-*-subtle text-*` pairs, so every leading
 * icon in the product sat on a tinted 32–56px tile. That treatment made a list
 * of calls read as a list of illustrations: the fills were the loudest thing on
 * the row, they competed with the status colours beside them, and six of them
 * down a table turned the page into a colour chart. The hue carries the same
 * meaning on its own, and the row is quieter for it.
 */
const tones = {
  brand: 'text-accent',
  emergency: 'text-emergency',
  success: 'text-success',
  warning: 'text-warning',
  info: 'text-info',
  neutral: 'text-ink-faint',
} as const;

/**
 * The glyph sizes, named by role rather than by tile.
 *
 * `sm`…`xl` stay as the public names because nineteen call sites use them and
 * their *relative* order is still what those pages mean; what changed is that
 * each now resolves to a role in ICON_SIZE instead of to a box-plus-glyph pair.
 * One scale for the whole product is what stops a 20px glyph appearing in one
 * list and a 16px one in the next.
 */
const sizes = {
  sm: ICON_SIZE.status,
  md: ICON_SIZE.nav,
  lg: ICON_SIZE.metric,
  xl: ICON_SIZE.empty,
} as const;

export type IconTileTone = keyof typeof tones;

/**
 * The standard leading icon of a list row, a card header, or an empty state.
 *
 * Despite the name this no longer draws a tile — it is the one place the
 * product's icon size and colour are decided, which is why the name and the
 * call sites stayed put rather than churning nineteen files to rename it.
 *
 * `shrink-0` matters more than it looks: these sit beside truncating text in
 * flex rows, and without it the glyph is what compresses.
 */
export function IconTile({
  icon: Icon,
  tone = 'brand',
  size = 'md',
  className,
}: {
  icon: IconComponent;
  tone?: IconTileTone;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return <Icon className={cn('shrink-0', sizes[size], tones[tone], className)} aria-hidden />;
}

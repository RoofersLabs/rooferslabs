import type { ComponentProps, ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

/**
 * The shape of every icon in the product.
 *
 * Heroicons ships each glyph as a forwardRef component over `<svg>`, so this is
 * that signature rather than anything of our own. It exists as one exported name
 * so the eight components that take an icon as a prop — `IconTile`, `Alert`,
 * `EmptyState`, `BottomNav`, the analytics tiles, the insight rows — depend on
 * the *idea* of an icon rather than on the library that draws it. Swapping
 * libraries again would be one edit here plus the imports, not a type change in
 * every consumer.
 *
 * `title`/`titleId` are Heroicons' own accessibility props: passing `title` makes
 * the glyph an announced image, omitting it leaves it decorative. Decorative is
 * the default everywhere in this product, which is why call sites pass
 * `aria-hidden` instead.
 */
export type IconComponent = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, 'ref'> & {
    title?: string;
    titleId?: string;
  } & RefAttributes<SVGSVGElement>
>;

/** Props an icon accepts, for the rare call site that needs to name them. */
export type IconProps = ComponentProps<IconComponent>;

/**
 * The product's icon sizes, in one place.
 *
 * Heroicons' 24px outline artwork is drawn on a 24px grid with a 1.5px stroke,
 * so it stays optically even at any of these; what matters is that a given role
 * is always the same size, which is what these names buy. Sizes below 20px use
 * the same 24px artwork scaled down rather than the 16px/20px solid sets, so the
 * stroke weight never changes mid-interface.
 */
export const ICON_SIZE = {
  /** Inline status glyphs beside text — 16px. */
  status: 'h-4 w-4',
  /** Buttons, inputs, table row actions — 18px. */
  action: 'h-[18px] w-[18px]',
  /** Sidebar, tab bar, primary navigation — 20px. */
  nav: 'h-5 w-5',
  /** Dashboard metric tiles and card headers — 24px. */
  metric: 'h-6 w-6',
  /** Empty and error states, the one place an icon leads — 32px. */
  empty: 'h-8 w-8',
} as const;

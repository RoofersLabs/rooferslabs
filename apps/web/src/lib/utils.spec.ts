import { cn, __FONT_SIZES_FOR_TEST } from './utils';

/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * Regression cover for a defect that reached production: every primary button
 * in the application rendered near-black text on blue.
 *
 * The cause was not in any button. `tailwind-merge` only knows Tailwind's own
 * font sizes, and its `text-color` group matches anything left over — so this
 * theme's `text-body-lg` (a size) and `text-ink-on-brand` (a color) were put in
 * one conflict group, and whichever came last deleted the other. `cn` now
 * declares the theme's sizes, which is what keeps the two apart.
 */
describe('cn', () => {
  describe('a custom font size and a custom text color must coexist', () => {
    it.each([
      ['size then color', 'text-body-lg text-ink-on-brand'],
      ['color then size', 'text-ink-on-brand text-body-lg'],
    ])('%s', (_label, classes) => {
      const out = cn(classes);
      expect(out).toContain('text-ink-on-brand');
      expect(out).toContain('text-body-lg');
    });

    // The exact shape of `buttonClass`: the size string is appended after the
    // variant string, which is what made the colour the casualty.
    it('keeps the variant colour when the size is merged in afterwards', () => {
      const out = cn(
        'rounded-xl font-semibold',
        'bg-accent text-ink-on-brand shadow-button',
        'h-12 gap-2 px-5 text-body-lg',
      );
      expect(out).toContain('text-ink-on-brand');
      expect(out).toContain('text-body-lg');
    });

    // Badge and StatusLabel merge in the other order, so they lost their size.
    it('keeps the base size when a tone colour is merged in afterwards', () => {
      const out = cn('rounded-full text-caption font-medium', 'bg-emergency-subtle text-emergency');
      expect(out).toContain('text-caption');
      expect(out).toContain('text-emergency');
    });
  });

  describe('genuine conflicts still collapse', () => {
    it('keeps only the last of two colours', () => {
      expect(cn('text-ink-muted', 'text-accent')).toBe('text-accent');
    });

    it('keeps only the last of two sizes', () => {
      expect(cn('text-small', 'text-body-lg')).toBe('text-body-lg');
    });

    it('still lets a caller override padding and radius', () => {
      expect(cn('rounded-xl p-6', 'rounded-full p-4')).toBe('rounded-full p-4');
    });
  });

  it('every theme font size is declared, so none can be mistaken for a colour', () => {
    // Reading the real config is the point: adding a size to the theme without
    // adding it here would reintroduce the original defect for that size alone.
    const config = require('../../tailwind.config.js') as {
      default: { theme: { extend: { fontSize: Record<string, unknown> } } };
    };
    const themeSizes = Object.keys(config.default.theme.extend.fontSize);

    expect([...__FONT_SIZES_FOR_TEST].sort()).toEqual(themeSizes.sort());
  });
});

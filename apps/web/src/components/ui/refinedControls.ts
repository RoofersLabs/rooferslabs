/**
 * Opt-in class sets for pages that were refined ahead of the rest of the app.
 *
 * These exist for a reason that has now largely gone away. They used to carry
 * radii — `REFINED_CARD` sharpened the shared `Card` and `REFINED_FIELD`
 * softened search inputs — because only some pages had been through a design
 * pass and the rest had to keep the appearance they shipped with.
 *
 * The geometry passes removed that split entirely. The product's structural
 * radius is now 0px for every container and every field (see the radius block
 * in styles/tokens.css), so a page naming a radius here would be opting *out*
 * of the product's own geometry — the opposite of what this file is for. The
 * radii are therefore empty rather than deleted, so the call sites that
 * reference them keep working and keep documenting which pages were refined
 * first.
 */

/** Content surfaces. Geometry comes from `Card`, which is square. */
export const REFINED_CARD = '';

/** Search fields and dropdowns. Geometry comes from `Input`, which is square. */
export const REFINED_FIELD = '';

/**
 * Page-level CTAs. Tighter tracking is the only thing this changes — weight,
 * size and colour are left alone, and contrast is untouched (already 10.3:1,
 * white on --brand-700, in the light theme).
 *
 * It used to carry a radius as well, to match the fields these CTAs sit beside.
 * That is gone: `Button` is a pill everywhere, so naming a radius here would
 * only be this handful of pages quietly opting out of the product's button
 * shape.
 */
export const REFINED_BUTTON = 'tracking-tight';

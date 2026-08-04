/**
 * Opt-in class sets for pages that were refined ahead of the rest of the app.
 *
 * These exist for a reason that has now largely gone away. They used to carry
 * radii — `REFINED_CARD` sharpened the shared `Card` and `REFINED_FIELD`
 * softened search inputs — because only some pages had been through a design
 * pass and the rest had to keep the appearance they shipped with.
 *
 * The global geometry pass removed that split: `Card`, `Input`, `SearchInput`
 * and every structural container now name the semantic radii in
 * styles/tokens.css (`--radius-panel`, `--radius-field`), so a page opting into
 * a radius here would be opting *out* of the product's own geometry — the
 * opposite of what this file is for. The radii are therefore empty rather than
 * deleted, so the call sites that reference them keep working and keep
 * documenting which pages were refined first.
 */

/** Content surfaces. Now inherited from `Card` — see `--radius-panel`. */
export const REFINED_CARD = '';

/** Search fields and dropdowns. Now inherited from `Input` — see `--radius-field`. */
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

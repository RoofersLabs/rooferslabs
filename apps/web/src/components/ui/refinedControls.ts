/**
 * Opt-in class sets for the pages refined to match the dashboard.
 *
 * Customers, Appointments, Knowledge Base and Notifications each apply these
 * explicitly. Nothing here is a default: `Card`, `Button`, `SearchInput` and
 * `Select` are untouched, so Calls, Settings, Billing, onboarding and every
 * modal keep exactly the appearance they have today.
 *
 * Radii come from the product scale in styles/tokens.css — `md` is 12px, `xl`
 * is 16px — and are appended after each component's own class string, where
 * twMerge drops the base radius in favour of these.
 */

/** Content surfaces: 16px → 12px, matching the dashboard's sharper panels. */
export const REFINED_CARD = 'rounded-md';

/**
 * Search fields and dropdowns: 12px → 16px, matching the dashboard header's
 * search. Height, padding, border and focus ring are untouched.
 */
export const REFINED_FIELD = 'rounded-xl';

/**
 * Page-level CTAs. The radius matches the fields they sit beside, and the
 * tighter tracking is the only typographic change — weight, size and colour are
 * left alone. Contrast is already 10.3:1 (white on --brand-700) in the light
 * theme, so nothing here touches colour.
 */
export const REFINED_BUTTON = 'rounded-xl tracking-tight';

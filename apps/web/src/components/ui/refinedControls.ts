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
 * Page-level CTAs. Tighter tracking is now the only thing this changes —
 * weight, size and colour are left alone, and contrast is untouched (already
 * 10.3:1, white on --brand-700, in the light theme).
 *
 * It used to carry `rounded-xl` as well, to match the fields these CTAs sit
 * beside. That is gone: `Button` is a pill everywhere now, so naming a radius
 * here would only be this handful of pages quietly opting out of the product's
 * button shape — which is the opposite of what this file is for.
 */
export const REFINED_BUTTON = 'tracking-tight';

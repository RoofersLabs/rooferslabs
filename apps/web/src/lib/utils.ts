import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * Every font size in the theme, by name.
 *
 * MUST stay in sync with `theme.extend.fontSize` in tailwind.config.js —
 * `utils.spec.ts` compares the two and fails if they drift, because a size
 * missing from this list silently becomes a *color* again (see below).
 */
const FONT_SIZES = [
  'display',
  'hero',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'body-lg',
  'body',
  'small',
  'caption',
  'label',
  'button',
  'metric',
  'table-header',
  'table-cell',
  'form-label',
  'form-input',
] as const;

/**
 * `tailwind-merge`, taught this theme's `text-*` scale.
 *
 * Out of the box tailwind-merge only recognises Tailwind's own font sizes
 * (`text-sm`, `text-lg`, …). Its `text-color` group matches *any* remaining
 * value, so a custom size like `text-body-lg` and a custom color like
 * `text-ink-on-brand` were indistinguishable — both landed in one conflict
 * group, and the last one written won.
 *
 * That silently deleted a class on every component that sets a size and a
 * color from different places. In `Button` the size is appended after the
 * variant, so `text-body-lg` erased `text-ink-on-brand` and the button fell
 * back to inherited near-black text on blue. In `Badge` and `StatusLabel` the
 * order is reversed, so the tone erased `text-caption` and they rendered at
 * whatever size they inherited.
 *
 * Declaring the sizes here makes the two groups distinguishable, so a size and
 * a color no longer collide anywhere. This is the fix for all of it — the
 * components themselves need no override, and must not be given one.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...FONT_SIZES] }],
    },
  },
});

/**
 * Merge Tailwind class names with conflict resolution.
 *
 * `tailwind-merge` matters for the shadcn primitives in components/ui: they all
 * accept a `className` that must be able to override the variant classes baked
 * into the component, which plain concatenation cannot do.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Exported for the drift test only. */
export const __FONT_SIZES_FOR_TEST = FONT_SIZES;

/** "(512) 555-9000" for +1 E.164 numbers; pass-through otherwise. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const match = phone.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
}

/** "3m 34s" from a duration in seconds. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** "Jul 16, 2:40 PM" style timestamps. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, h:mm a');
}

/** "Jul 16, 2026" style dates. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, yyyy');
}

/** 24-hour "07:00"/"18:00" → "7:00 AM – 6:00 PM". */
export function formatTimeRange(open: string, close: string): string {
  const to12Hour = (time: string): string => {
    const [rawHours, rawMinutes] = time.split(':');
    const hours = Number(rawHours);
    const minutes = Number(rawMinutes);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return time;
    const suffix = hours < 12 ? 'AM' : 'PM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
  };
  return `${to12Hour(open)} – ${to12Hour(close)}`;
}

/** "5 minutes ago" relative timestamps. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '—';
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

/** "EMERGENCY_REPAIR" → "Emergency repair". */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

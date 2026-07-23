import { format } from 'date-fns';

/**
 * Joins conditional class names. Deliberately not `clsx` + `tailwind-merge`:
 * nothing here relies on later utilities overriding earlier ones, so a
 * dependency-free filter is the whole requirement.
 */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** "Jul 16, 2026" style dates. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return format(new Date(iso), 'MMM d, yyyy');
}

/** "EMERGENCY_REPAIR" → "Emergency repair". */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

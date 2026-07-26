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

/** "EMERGENCY_REPAIR" → "Emergency repair". */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return '—';
  const lower = value.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

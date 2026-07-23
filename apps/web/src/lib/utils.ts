import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

/** Merge Tailwind class names with conflict resolution. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
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

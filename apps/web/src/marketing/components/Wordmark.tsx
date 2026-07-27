import { cn } from '@/lib/utils';

/**
 * The RoofersLabs mark: the roofline from the product favicon, redrawn as a
 * currentColor glyph so it inherits whatever surface it sits on, paired with
 * the wordmark. Deliberately monochrome — the brand blue is spent on actions,
 * not on the logo.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="h-[22px] w-[22px] shrink-0"
        fill="currentColor"
      >
        <path d="M32 14 L54 36 L46 36 L46 50 L18 50 L18 36 L10 36 Z" />
        <rect x="40" y="18" width="6" height="10" />
      </svg>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">RoofersLabs</span>
    </span>
  );
}

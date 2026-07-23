import type { SVGProps } from 'react';

/**
 * Hand-rolled icon set.
 *
 * A dependency-free set of three glyphs beats pulling in an icon library: no
 * extra bytes on the critical path, and one consistent stroke weight and corner
 * radius across everything.
 *
 * All icons inherit `currentColor` and are marked decorative — each one on the
 * page sits beside a real text label. The console draws its own sidebar glyphs
 * (`product/dashboard/Chrome.tsx`) at a smaller stroke weight, because 14px
 * icons scaled down from a 24px grid look muddy.
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width={20}
      height={20}
      {...props}
    >
      {children}
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9.5 12 15.5 18 9.5" />
    </Icon>
  );
}

/**
 * The wordmark's glyph: two roof planes meeting at a ridge, with the accent
 * reserved for the leading edge.
 */
export function Logomark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      width={22}
      height={22}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3.2 22 11.4l-1.9 2.3L12 7.1 3.9 13.7 2 11.4Z" fill="currentColor" />
      <path d="M12 11.2 19 17v3.8h-4.6V17H9.6v3.8H5V17Z" fill="#2563EB" />
    </svg>
  );
}

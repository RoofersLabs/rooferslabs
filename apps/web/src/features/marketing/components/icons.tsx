import type { SVGProps } from 'react';

/**
 * Hand-rolled icon set.
 *
 * A dependency-free set of nine glyphs beats pulling in an icon library for a
 * single page: no extra bytes on the critical path, and one consistent stroke
 * weight and corner radius across everything.
 *
 * All icons inherit `currentColor` and are marked decorative — every one on the
 * page sits beside a real text label.
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

export function PhoneIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 4.5h3.2l1.6 4-2 1.2a11.5 11.5 0 0 0 5 5l1.2-2 4 1.6v3.2a1.5 1.5 0 0 1-1.6 1.5C10.2 18.6 5.4 13.8 4.6 6.1A1.5 1.5 0 0 1 4.5 4.5Z" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
    </Icon>
  );
}

export function LeadIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15.5 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="8.75" cy="7" r="3.5" />
      <path d="M18.5 6.5v6M21.5 9.5h-6" />
    </Icon>
  );
}

export function UrgentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10.6 3.9 2.5 18a1.6 1.6 0 0 0 1.4 2.4h16.2A1.6 1.6 0 0 0 21.5 18L13.4 3.9a1.6 1.6 0 0 0-2.8 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </Icon>
  );
}

export function KnowledgeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 5.5A2 2 0 0 1 5.5 3.5H10a2.5 2.5 0 0 1 2 1 2.5 2.5 0 0 1 2-1h4.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14a2.5 2.5 0 0 0-2 1 2.5 2.5 0 0 0-2-1H5.5a2 2 0 0 1-2-2Z" />
      <path d="M12 7.5v11" />
    </Icon>
  );
}

export function AnalyticsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 20.5h17" />
      <path d="M6.5 20.5v-6M11 20.5V7M15.5 20.5v-9M20 20.5V4.5" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Icon>
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

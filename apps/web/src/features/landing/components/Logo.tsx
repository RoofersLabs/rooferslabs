/**
 * RoofersLabs mark — a roof pitch over a signal arc, drawn rather than shipped
 * as an asset so it inherits the marketing gradient and needs no image request.
 */
export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-lg bg-mkt-cta ${className}`}
      style={{ boxShadow: 'var(--mkt-inner-highlight)' }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-[60%] w-[60%]" fill="none" aria-hidden>
        <path
          d="M3 11.5 12 4l9 7.5"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-mkt-accent-ink"
        />
        <path
          d="M8.5 15.5a4.5 4.5 0 0 1 7 0"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          className="text-mkt-accent-ink/70"
        />
        <circle cx="12" cy="19" r="1.3" fill="currentColor" className="text-mkt-accent-ink" />
      </svg>
    </span>
  );
}

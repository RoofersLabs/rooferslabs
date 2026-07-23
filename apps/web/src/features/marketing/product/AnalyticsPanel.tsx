import { CALL_VOLUME } from './data';

const TILES = [
  { label: 'Calls answered', value: '393', delta: '100%' },
  { label: 'Booked', value: '164', delta: '+18% WoW' },
  { label: 'Avg. answer time', value: '1.2s', delta: 'First ring' },
];

/**
 * Weekly call volume plus the three numbers an owner actually checks.
 *
 * The chart is plain divs with a scale transform — an SVG charting library
 * would be ten times the bytes for seven bars, and transforms keep the growth
 * animation on the compositor.
 */
export function AnalyticsPanel() {
  const peak = Math.max(...CALL_VOLUME.map((bar) => bar.value));

  return (
    <div className="h-[24.5rem] overflow-y-auto p-4 sm:p-5">
      <dl className="grid grid-cols-3 gap-3">
        {TILES.map((tile, index) => (
          <div
            key={tile.label}
            className="rounded-lg border border-subtle bg-white/[0.02] p-3"
            style={{
              animation: `panel-row 420ms var(--ease-out) ${index * 55}ms both`,
            }}
          >
            <dt className="text-xs text-ink-tertiary">{tile.label}</dt>
            <dd className="mt-1.5 text-2xl font-medium tabular-nums tracking-tight">
              {tile.value}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-quaternary">{tile.delta}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h4 className="text-sm font-medium">Calls per day</h4>
          <span className="font-mono text-xs text-ink-quaternary">Last 7 days</span>
        </div>

        <div className="flex h-40 items-end gap-2 sm:gap-3">
          {CALL_VOLUME.map((bar, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <span className="font-mono text-[0.6875rem] tabular-nums text-ink-quaternary">
                {bar.value}
              </span>
              <div
                className="w-full origin-bottom rounded-t-sm bg-accent/80"
                style={{
                  height: `${(bar.value / peak) * 100}%`,
                  animation: `bar-grow 700ms var(--ease-out) ${140 + index * 55}ms both`,
                }}
                aria-hidden="true"
              />
              <span className="font-mono text-[0.6875rem] text-ink-tertiary">{bar.label}</span>
            </div>
          ))}
        </div>

        {/* The visual chart is decorative; this is what a screen reader gets. */}
        <p className="sr-only">
          Calls per day over the last seven days:{' '}
          {CALL_VOLUME.map((bar) => `${bar.label} ${bar.value}`).join(', ')}.
        </p>
      </div>
    </div>
  );
}

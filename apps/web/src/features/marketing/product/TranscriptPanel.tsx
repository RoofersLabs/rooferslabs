import { cn } from '@/lib/utils';
import { TRANSCRIPT } from './data';

/**
 * Full call transcript with the model's reasoning exposed under each AI turn.
 *
 * Showing the reasoning is the point of this panel. Roofing owners are being
 * asked to hand their phone line to software; "here is exactly what it decided
 * and why" does more for trust than any adjective.
 */
export function TranscriptPanel() {
  return (
    <div className="h-[24.5rem] overflow-y-auto p-4 sm:p-5">
      <ol className="space-y-4">
        {TRANSCRIPT.map((turn, index) => (
          <li
            key={turn.id}
            className={cn('flex', turn.speaker === 'ai' ? 'justify-start' : 'justify-end')}
            style={{
              animation: `panel-row 440ms var(--ease-out) ${index * 50}ms both`,
            }}
          >
            <div className={cn('max-w-[82%]', turn.speaker === 'caller' && 'text-right')}>
              <p className="mb-1 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-quaternary">
                {turn.speaker === 'ai' ? 'Receptionist' : 'Caller'}
              </p>
              <p
                className={cn(
                  'inline-block rounded-lg px-3 py-2 text-left text-sm leading-relaxed',
                  turn.speaker === 'ai'
                    ? 'bg-white/[0.05] text-ink'
                    : 'border border-subtle text-ink-secondary',
                )}
              >
                {turn.text}
              </p>

              {turn.reasoning && (
                <p className="mt-2 flex items-start gap-2 text-left text-xs leading-relaxed text-ink-tertiary">
                  <span
                    className="mt-[0.4rem] h-px w-4 shrink-0 bg-accent/60"
                    aria-hidden="true"
                  />
                  {turn.reasoning}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

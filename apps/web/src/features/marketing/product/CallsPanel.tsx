import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CALLS, OUTCOME_LABEL, type CallOutcome } from './data';

/**
 * The call log, with working filters.
 *
 * The filters are real state rather than decoration: someone evaluating this
 * product should be able to poke at the thing on the page and have it respond,
 * which is worth far more than a screenshot of the same table.
 */

const FILTERS: { id: 'all' | CallOutcome; label: string }[] = [
  { id: 'all', label: 'All calls' },
  { id: 'booked', label: 'Booked' },
  { id: 'transferred', label: 'Transferred' },
  { id: 'qualified', label: 'Qualified' },
];

const OUTCOME_STYLE: Record<CallOutcome, string> = {
  booked: 'border-accent/30 bg-accent/10 text-accent',
  transferred: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
  qualified: 'border-subtle bg-white/[0.04] text-ink-secondary',
};

export function CallsPanel() {
  const [filter, setFilter] = useState<'all' | CallOutcome>('all');
  const rows = filter === 'all' ? CALLS : CALLS.filter((call) => call.outcome === filter);

  return (
    <div>
      {/* Scrolls sideways rather than wrapping: a filter row that becomes two
          rows on a phone changes the panel's height and pushes the table. */}
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto border-b border-subtle px-4 py-3 sm:px-5">
        {FILTERS.map((option) => {
          const selected = filter === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setFilter(option.id)}
              className={cn(
                'pressable shrink-0 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-medium',
                selected
                  ? 'border-strong bg-white/[0.08] text-ink'
                  : 'border-transparent text-ink-tertiary hover:bg-white/[0.04] hover:text-ink-secondary',
              )}
            >
              {option.label}
            </button>
          );
        })}
        <span className="ml-auto hidden shrink-0 pl-3 font-mono text-xs text-ink-quaternary sm:inline">
          {rows.length} of {CALLS.length}
        </span>
      </div>

      {/* Fixed height: filtering must not resize the showcase and shove the
          rest of the page around. */}
      <div className="h-[21rem] overflow-y-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Recent calls handled by the AI receptionist</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Caller</th>
              <th scope="col">Job</th>
              <th scope="col">Outcome</th>
              <th scope="col">Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((call, index) => (
              <tr
                key={call.id}
                className="border-b border-subtle/60 last:border-0"
                style={{
                  animation: `panel-row 420ms var(--ease-out) ${index * 45}ms both`,
                }}
              >
                <td className="px-4 py-3 sm:px-5">
                  <p className="whitespace-nowrap font-medium">{call.caller}</p>
                  <p className="whitespace-nowrap font-mono text-xs text-ink-tertiary">
                    {call.phone}
                  </p>
                </td>
                <td className="hidden px-3 py-3 text-ink-secondary sm:table-cell">
                  <p>{call.job}</p>
                  <p className="text-xs text-ink-tertiary">{call.location}</p>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={cn(
                      'inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium',
                      OUTCOME_STYLE[call.outcome],
                    )}
                  >
                    {OUTCOME_LABEL[call.outcome]}
                  </span>
                </td>
                {/* Timestamps are the first thing to go on a phone: at 390px
                    they wrap to three lines and shove the caller's name into
                    two, which is a worse trade than losing the clock. */}
                <td className="hidden px-4 py-3 text-right font-mono text-xs text-ink-tertiary sm:table-cell sm:px-5">
                  <span className="block">{call.time}</span>
                  <span className="block text-ink-quaternary">{call.duration}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

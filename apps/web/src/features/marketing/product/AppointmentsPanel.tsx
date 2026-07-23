import { cn } from '@/lib/utils';
import { APPOINTMENTS } from './data';

/** Two-day schedule board. Urgent work is the only thing allowed to use colour. */
export function AppointmentsPanel() {
  const days = ['Today', 'Tomorrow'] as const;

  return (
    <div className="h-[24.5rem] overflow-y-auto p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {days.map((day, column) => (
          <div key={day}>
            <div className="mb-3 flex items-baseline justify-between">
              <h4 className="text-sm font-medium">{day}</h4>
              <span className="font-mono text-xs text-ink-quaternary">
                {APPOINTMENTS.filter((item) => item.day === day).length} jobs
              </span>
            </div>

            <ul className="space-y-2.5">
              {APPOINTMENTS.filter((item) => item.day === day).map((item, index) => (
                <li
                  key={item.id}
                  className={cn(
                    'rounded-lg border border-subtle bg-white/[0.02] p-3',
                    'transition-[border-color,background-color] duration-200 ease-out hover:border-strong hover:bg-white/[0.045]',
                  )}
                  style={{
                    animation: `panel-row 460ms var(--ease-out) ${(column * 2 + index) * 55}ms both`,
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{item.customer}</p>
                    <span className="shrink-0 font-mono text-xs text-ink-tertiary">
                      {item.window}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-secondary">{item.job}</p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="rounded border border-subtle px-1.5 py-0.5 text-[0.6875rem] text-ink-tertiary">
                      {item.crew}
                    </span>
                    {item.urgent && (
                      <span className="rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[0.6875rem] font-medium text-accent">
                        Urgent
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

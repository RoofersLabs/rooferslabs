import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { VIEWPORT, transition } from '../../motion';
import { Num, Panel } from '../chrome';
import { appointments, bookedDays, timeline } from '../data';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** A fixed 31-day month whose first day falls on a Wednesday. */
const FIRST_WEEKDAY = 3;
const DAYS_IN_MONTH = 31;

/**
 * Booking calendar. Days carrying work are marked with up to three dots, so
 * the week's load is legible before any day is opened — and the mark is a
 * shape, not a colour, which keeps it readable without colour vision.
 */
export function CalendarPanel({
  selectedDay,
  onSelectDay,
  className,
}: {
  selectedDay: number;
  onSelectDay?: (day: number) => void;
  className?: string;
}) {
  const cells = [
    ...Array.from({ length: FIRST_WEEKDAY }, () => null),
    ...Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1),
  ];

  return (
    <Panel
      title="March 2026"
      action={
        <span className="text-[11px] text-white/45">
          <Num>{Object.values(bookedDays).reduce((a, b) => a + b, 0)}</Num> booked
        </span>
      }
      className={className}
      bodyClassName="p-3"
    >
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day, i) => (
          <div
            key={`${day}-${i}`}
            aria-hidden="true"
            className="pb-1 text-center text-[10px] font-medium uppercase tracking-[0.06em] text-white/35"
          >
            {day}
          </div>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <div key={`pad-${i}`} />;
          const count = bookedDays[day] ?? 0;
          const selected = day === selectedDay;

          const inner = (
            <>
              <Num className="text-[12px] leading-none">{day}</Num>
              <span className="mt-1 flex h-1 items-center gap-[3px]">
                {Array.from({ length: Math.min(count, 3) }, (_, d) => (
                  <span
                    key={d}
                    className={cn(
                      'h-1 w-1 rounded-full',
                      selected ? 'bg-white/80' : 'bg-mk-accent-fg/70',
                    )}
                  />
                ))}
              </span>
            </>
          );

          const shape = cn(
            'relative flex aspect-square w-full flex-col items-center justify-center rounded-md',
            'transition-colors duration-200 ease-smooth',
            selected ? 'text-white' : 'text-white/60',
          );

          if (!onSelectDay) {
            return (
              <div key={day} className={cn(shape, selected && 'bg-white/[0.08]')}>
                {inner}
              </div>
            );
          }

          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-pressed={selected}
              aria-label={`March ${day}${count ? `, ${count} appointments` : ', no appointments'}`}
              className={cn(
                shape,
                'hover:bg-white/[0.05]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring',
              )}
            >
              {selected && (
                <motion.span
                  layoutId="calendar-selected-day"
                  className="absolute inset-0 rounded-md bg-white/[0.09]"
                  transition={transition.base}
                />
              )}
              <span className="relative flex flex-col items-center">{inner}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/** The schedule that comes out the other side of the calls. */
export function AppointmentsPanel({ className }: { className?: string }) {
  return (
    <Panel title="Appointments" className={className} bodyClassName="overflow-y-auto p-1.5">
      <ul className="flex flex-col">
        {appointments.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors duration-200 ease-smooth hover:bg-white/[0.04]"
          >
            <div className="flex w-[52px] shrink-0 flex-col items-center rounded-md border border-mk-line bg-white/[0.03] py-1.5">
              <span className="text-[10px] uppercase tracking-[0.06em] text-white/45">
                {item.day}
              </span>
              <Num className="mt-0.5 text-[11.5px] font-medium text-white">{item.time}</Num>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">{item.name}</p>
              <p className="truncate text-[12px] text-white/70">{item.service}</p>
            </div>
            <span className="hidden shrink-0 text-[11px] text-white/45 sm:block">{item.crew}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/**
 * Customer timeline. The connecting rail draws downward as the panel enters,
 * so the sequence is read as a sequence rather than five stacked rows.
 */
export function CustomerTimelinePanel({ className }: { className?: string }) {
  const reduced = useReducedMotion();

  return (
    <Panel title="Customer timeline" className={className} bodyClassName="overflow-y-auto p-4">
      <ol className="relative flex flex-col">
        <motion.span
          aria-hidden="true"
          className="absolute left-[3.5px] top-1 w-px bg-mk-line-strong"
          initial={{ height: reduced ? '100%' : 0 }}
          whileInView={{ height: '100%' }}
          viewport={VIEWPORT}
          transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
        />

        {timeline.map((event, i) => (
          <motion.li
            key={event.id}
            className="relative pb-4 pl-5 last:pb-0"
            initial={{ opacity: 0, x: reduced ? 0 : -6 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={VIEWPORT}
            transition={{ ...transition.slow, delay: reduced ? 0 : 0.15 + i * 0.12 }}
          >
            <span
              className={cn(
                'absolute left-0 top-[5px] h-2 w-2 rounded-full ring-4 ring-[#050506]',
                i === timeline.length - 1 ? 'bg-mk-accent-fg' : 'bg-white/30',
              )}
              aria-hidden="true"
            />
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[12.5px] font-medium text-white">{event.label}</p>
              <Num className="shrink-0 text-[11px] text-white/45">{event.time}</Num>
            </div>
            <p className="mt-0.5 text-[12px] leading-[1.5] text-white/70">{event.detail}</p>
          </motion.li>
        ))}
      </ol>
    </Panel>
  );
}

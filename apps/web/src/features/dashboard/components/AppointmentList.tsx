import { CalendarClock } from 'lucide-react';
import type { Appointment } from '@/types/api';
import { formatDate, humanizeEnum } from '@/lib/utils';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { EnumStatusLabel } from './StatusLabel';
import { SectionCard } from './SectionCard';

/** A compact, timeline-style list of upcoming appointment requests. */
export function AppointmentList({
  appointments,
  isLoading,
  className,
}: {
  appointments: Appointment[] | undefined;
  isLoading: boolean;
  className?: string;
}) {
  return (
    <SectionCard
      title="Upcoming appointments"
      action={{ label: 'View calendar', to: '/appointments' }}
      className={className}
    >
      {isLoading ? (
        <ListSkeleton rows={4} />
      ) : !appointments?.length ? (
        <EmptyState
          icon={CalendarClock}
          title="No appointment requests"
          description="When callers request estimates or inspections, they’ll show up here."
        />
      ) : (
        <ol className="border-t border-line-subtle px-6 py-5">
          {appointments.map((appointment, index) => {
            const isLast = index === appointments.length - 1;
            return (
              <li key={appointment.id} className="relative flex gap-4 pb-6 last:pb-0">
                {/* Timeline rail */}
                <span className="flex flex-col items-center">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-accent bg-surface" />
                  {!isLast && <span className="mt-1 w-px flex-1 bg-line-subtle" aria-hidden />}
                </span>

                <div className="min-w-0 flex-1 -mt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-body font-medium text-ink">
                      {appointment.customer?.fullName ?? 'Customer'}
                    </span>
                    <EnumStatusLabel value={appointment.priority} />
                  </div>
                  <p className="mt-0.5 truncate text-small text-ink-muted">
                    {appointment.serviceRequested ?? 'Service visit'}
                  </p>
                  <p className="font-num mt-1 text-caption text-ink-faint">
                    {appointment.preferredDate
                      ? formatDate(appointment.preferredDate)
                      : humanizeEnum(appointment.status)}
                    {appointment.preferredTimeWindow ? ` · ${appointment.preferredTimeWindow}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionCard>
  );
}

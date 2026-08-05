import { useState } from 'react';
import { cn, humanizeEnum } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { Select } from '@/components/ui/input';
import { EnumStatusText } from '@/components/ui/StatusText';
import { Pagination } from '@/components/ui/pagination';
import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { appointments } from '../data';
import { Reveal, StaggerList, StaggerRow } from '../animation';
import { PreviewPageHeader } from '../chrome';
import { usePhone } from '../formFactor';

const STATUSES = ['REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'];

/**
 * The Appointments page, matching `features/appointments/AppointmentsPage`.
 *
 * The status dropdown on each row is live: changing it moves the row's status
 * the way it does in the product, which is the difference between a screenshot
 * of a control and a control. The showcase changes one of them the same way a
 * visitor would — through the same `onChange`, not around it.
 */
export function AppointmentsView({ driven }: { driven?: Record<string, string> }) {
  const phone = usePhone();
  const [own, setOwn] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('');

  const statusOf = (id: string, fallback: string) => own[id] ?? driven?.[id] ?? fallback;
  const visible = filter
    ? appointments.filter((appointment) => statusOf(appointment.id, appointment.status) === filter)
    : appointments;

  return (
    <div>
      <Reveal as="header">
        <PreviewPageHeader
          title="Appointments"
          description="Visit and estimate requests captured by your AI receptionist."
          actions={
            <Select
              className="w-44"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {humanizeEnum(status)}
                </option>
              ))}
            </Select>
          }
        />
      </Reveal>

      <Reveal index={1}>
        <Card className="overflow-hidden">
          {!visible.length ? (
            <p className="px-6 py-10 text-center text-body text-ink-muted">
              No appointments with that status.
            </p>
          ) : (
            <StaggerList className="divide-y divide-line-subtle">
              {visible.map((appointment) => (
                <StaggerRow
                  key={appointment.id}
                  className={cn(
                    'flex gap-4 px-6 py-4 transition-colors duration-fast hover:bg-surface-2',
                    phone ? 'flex-col' : 'flex-row items-center',
                  )}
                >
                  {!phone && <IconTile icon={CalendarDaysIcon} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-medium text-ink">{appointment.name}</span>
                      <EnumStatusText value={appointment.priority} />
                      <span className="text-caption font-medium text-accent">View call</span>
                    </div>
                    <p className="mt-0.5 text-small text-ink-muted">{appointment.service}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-caption text-ink-faint">
                      <span className="font-num">
                        {appointment.when} · {appointment.window}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPinIcon className="h-4 w-4" aria-hidden />
                        {appointment.address}
                      </span>
                      <span>Requested {appointment.requested}</span>
                    </p>
                  </div>
                  <div className={cn('shrink-0', !phone && 'w-44')}>
                    <Select
                      value={statusOf(appointment.id, appointment.status)}
                      onChange={(event) =>
                        setOwn((prev) => ({ ...prev, [appointment.id]: event.target.value }))
                      }
                      data-demo-target={`appt:${appointment.id}`}
                      aria-label={`Status for ${appointment.name}`}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {humanizeEnum(status)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </StaggerRow>
              ))}
            </StaggerList>
          )}

          <Pagination
            pagination={{
              page: 1,
              limit: 20,
              totalRecords: 88,
              totalPages: 5,
              hasNextPage: true,
              hasPreviousPage: false,
            }}
            onPageChange={() => undefined}
          />
        </Card>
      </Reveal>
    </div>
  );
}

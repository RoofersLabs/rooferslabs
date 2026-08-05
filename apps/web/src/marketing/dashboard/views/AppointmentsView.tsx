import { useState } from 'react';
import { humanizeEnum } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { Select } from '@/components/ui/input';
import { EnumStatusText } from '@/components/ui/StatusText';
import { Pagination } from '@/components/ui/pagination';
import { CalendarDaysIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { appointments } from '../data';
import { Reveal, StaggerList, StaggerRow } from '../animation';
import { PreviewPageHeader } from '../chrome';

const STATUSES = ['REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED'];

/**
 * The Appointments page, matching `features/appointments/AppointmentsPage`.
 *
 * The status dropdown on each row is live: changing it moves the row's status
 * the way it does in the product, which is the difference between a screenshot
 * of a control and a control.
 */
export function AppointmentsView() {
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(appointments.map((appointment) => [appointment.id, appointment.status])),
  );
  const [filter, setFilter] = useState('');

  const visible = filter
    ? appointments.filter((appointment) => statuses[appointment.id] === filter)
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
                  className="flex flex-col gap-4 px-6 py-4 transition-colors duration-fast hover:bg-surface-2 sm:flex-row sm:items-center"
                >
                  <IconTile icon={CalendarDaysIcon} className="hidden sm:flex" />
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
                  <div className="shrink-0 sm:w-44">
                    <Select
                      value={statuses[appointment.id] ?? appointment.status}
                      onChange={(event) =>
                        setStatuses((prev) => ({ ...prev, [appointment.id]: event.target.value }))
                      }
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

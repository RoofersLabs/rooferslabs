import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, MapPin } from 'lucide-react';
import { AppointmentStatus } from '@rooferslabs/shared';
import { useAppointments, useUpdateAppointment } from '@/hooks/queries';
import { cn, formatDateTime, humanizeEnum, timeAgo } from '@/lib/utils';
import { EnumStatusText } from '@/components/ui/StatusText';
import { REFINED_CARD, REFINED_FIELD } from '@/components/ui/refinedControls';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { Select } from '@/components/ui/input';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/pagination';

const STATUS_FILTERS = ['', ...Object.values(AppointmentStatus)] as const;

export function AppointmentsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const appointments = useAppointments({ page, status: status || undefined });
  const update = useUpdateAppointment();

  return (
    <div>
      <PageHeader
        title="Appointments"
        description="Visit and estimate requests captured by your AI receptionist."
        actions={
          <Select
            className={cn('w-48', REFINED_FIELD)}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value ? humanizeEnum(value) : 'All statuses'}
              </option>
            ))}
          </Select>
        }
      />

      <Card className={cn('overflow-hidden', REFINED_CARD)}>
        {appointments.isLoading ? (
          <ListSkeleton />
        ) : appointments.isError ? (
          <ErrorState
            title="Couldn’t load appointments"
            message={(appointments.error as Error).message}
            onRetry={() => void appointments.refetch()}
          />
        ) : !appointments.data?.items.length ? (
          <EmptyState
            icon={CalendarClock}
            title="No appointments"
            description="When callers request inspections or estimates, they’ll appear here for you to confirm."
          />
        ) : (
          <>
            <ul className="divide-y divide-line-subtle">
              {appointments.data.items.map((appointment) => (
                <li
                  key={appointment.id}
                  className="flex flex-col gap-4 px-6 py-4 transition-colors duration-fast hover:bg-surface-2 sm:flex-row sm:items-center"
                >
                  <IconTile icon={CalendarClock} className="hidden sm:flex" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-medium text-ink">
                        {appointment.customer?.fullName ?? 'Customer'}
                      </span>
                      <EnumStatusText value={appointment.priority} />
                      {appointment.conversationId && (
                        <Link
                          to={`/conversations/${appointment.conversationId}`}
                          className="focus-ring rounded text-caption font-medium text-accent hover:underline"
                        >
                          View call
                        </Link>
                      )}
                    </div>
                    <p className="mt-0.5 text-small text-ink-muted">
                      {appointment.serviceRequested ?? 'Service visit'}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-caption text-ink-faint">
                      <span>
                        {appointment.preferredDate
                          ? formatDateTime(appointment.preferredDate)
                          : 'Any date'}
                        {appointment.preferredTimeWindow && ` · ${appointment.preferredTimeWindow}`}
                      </span>
                      {appointment.propertyAddress && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" aria-hidden />
                          {appointment.propertyAddress}
                        </span>
                      )}
                      <span>Requested {timeAgo(appointment.createdAt)}</span>
                    </p>
                  </div>
                  <div className="shrink-0 sm:w-44">
                    <Select
                      className={REFINED_FIELD}
                      value={appointment.status}
                      onChange={(e) =>
                        update.mutate({
                          id: appointment.id,
                          status: e.target.value as AppointmentStatus,
                        })
                      }
                      aria-label={`Status for ${appointment.customer?.fullName ?? 'appointment'}`}
                    >
                      {Object.values(AppointmentStatus).map((value) => (
                        <option key={value} value={value}>
                          {humanizeEnum(value)}
                        </option>
                      ))}
                    </Select>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination pagination={appointments.data.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

import { Link, useParams } from 'react-router-dom';
import { useAdminCompany } from '@/hooks/queries';
import { formatDateTime, formatDuration, formatPhone, humanizeEnum, timeAgo } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { EnumStatusText } from '@/components/ui/StatusText';
import { IconTile } from '@/components/ui/IconTile';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ADMIN_ROUTES } from './routes';
import { ArrowLeftIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';

/**
 * One tenant at a glance: who they are, and how much the AI has done for them.
 *
 * Read-only, and deliberately short. The call log, customer list, appointments
 * and staff notes that used to sit below were a second copy of screens the
 * customer app already owns; what this page is for is deciding whether an
 * account is healthy, which the two panels answer on their own.
 */
export function AdminCompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useAdminCompany(id);

  if (detail.isLoading) {
    return (
      <Card>
        <LoadingBlock label="Loading company…" />
      </Card>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <Card>
        {detail.isError ? (
          <ErrorState
            title="Couldn’t load this company"
            message={(detail.error as Error).message}
            onRetry={() => void detail.refetch()}
          />
        ) : (
          <EmptyState
            icon={BuildingOffice2Icon}
            title="Company not found"
            description="It may have been removed."
          />
        )}
      </Card>
    );
  }

  const { company, usage } = detail.data;

  return (
    <div>
      <Link
        to={ADMIN_ROUTES.companies}
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-focus text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
      >
        <ArrowLeftIcon className="h-4 w-4" aria-hidden />
        Back to companies
      </Link>

      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <IconTile icon={BuildingOffice2Icon} tone="brand" size="lg" />
            {company.name}
            <EnumStatusText value={company.status} />
          </span>
        }
        description={
          <span className="text-body text-ink-muted">
            {company.ownerEmail ?? '—'}
            {company.city && ` · ${company.city}, ${company.state ?? ''}`}
          </span>
        }
      />

      {/* Two panels, side by side on a wide screen and stacked on a narrow
          one. With the operational sections gone there is nothing below them,
          so the page ends here rather than trailing empty space. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-line-subtle">
              <DetailRow label="Owner" value={company.ownerName ?? '—'} />
              <DetailRow label="Email" value={company.ownerEmail ?? company.email} />
              <DetailRow label="Phone" value={formatPhone(company.phone)} />
              <DetailRow
                label="AI number"
                value={
                  company.phoneNumbers[0]?.phoneNumber
                    ? formatPhone(company.phoneNumbers[0].phoneNumber)
                    : '—'
                }
              />
              <DetailRow
                label="Subscription"
                value={
                  company.subscription
                    ? `${humanizeEnum(company.subscription.status)}${company.subscription.plan ? ` · ${humanizeEnum(company.subscription.plan)}` : ''}`
                    : 'None'
                }
              />
              <DetailRow
                label="Receptionist"
                value={company.receptionistEnabled ? 'Enabled' : 'Disabled'}
              />
              <DetailRow label="Timezone" value={company.timezone} />
              <DetailRow label="Signed up" value={formatDateTime(company.createdAt)} />
              <DetailRow
                label="Last active"
                value={company.lastActiveAt ? timeAgo(company.lastActiveAt) : '—'}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-line-subtle">
              <DetailRow label="Total calls" value={String(usage.totalCalls)} />
              <DetailRow label="Total leads" value={String(usage.totalLeads)} />
              <DetailRow label="Appointments" value={String(usage.totalAppointments)} />
              <DetailRow label="Emergency calls" value={String(usage.emergencyCalls)} />
              <DetailRow label="Customers" value={String(usage.totalCustomers)} />
              <DetailRow label="Resolution rate" value={`${usage.resolutionRate}%`} />
              <DetailRow
                label="Avg. call length"
                value={formatDuration(usage.averageCallSeconds)}
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

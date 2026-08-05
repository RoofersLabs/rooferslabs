import { formatPhone, humanizeEnum } from '@/lib/utils';
import { buttonClass } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { IconTile } from '@/components/ui/IconTile';
import { EnumStatusText, StatusText } from '@/components/ui/StatusText';
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  PhoneIcon,
  ShieldExclamationIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { appointments, calls, customers } from '../data';
import { Reveal } from '../animation';
import { PreviewPageHeader } from '../chrome';

/**
 * A customer profile, matching `features/customers/CustomerDetailPage`: back
 * link, page header, then stacked cards — who they are, what the receptionist
 * has done for them, and what is booked next.
 *
 * Single column at every size, as the product has it. This is the page that
 * answers the question the Calls list raises: a call is an event, and this is
 * the record the event was filed against.
 */
export function CustomerDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const customer = customers.find((record) => record.id === id);
  if (!customer) return null;

  const history = customer.history
    .map((callId) => calls.find((call) => call.id === callId))
    .filter((call): call is (typeof calls)[number] => Boolean(call));
  const booked = appointments.find((appointment) => appointment.id === customer.appointmentId);

  return (
    <div>
      <Reveal>
        <button
          type="button"
          onClick={onBack}
          data-demo-target="customer:back"
          className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-focus text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
        >
          <ArrowLeftIcon className="h-4 w-4" aria-hidden />
          Back to customers
        </button>

        <PreviewPageHeader
          title={
            <span className="flex flex-wrap items-center gap-3">
              <IconTile icon={UserIcon} tone="brand" size="lg" />
              {customer.name}
              <EnumStatusText value={customer.status} />
              {customer.favorite && (
                <StatusText tone="brand" className="inline-flex items-center gap-1">
                  <StarIcon className="h-4 w-4 fill-accent" aria-hidden />
                  Favorite
                </StatusText>
              )}
            </span>
          }
          description={
            <span className="text-ink-muted">
              <span className="font-num">{formatPhone(customer.phone)}</span>
              {` · ${customer.address}`}
            </span>
          }
        />
      </Reveal>

      <div className="space-y-4">
        <Reveal index={1}>
          <Card>
            <CardHeader>
              <CardTitle>Customer information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-line-subtle">
                <DetailRow label="Full name" value={customer.name} />
                <DetailRow label="Phone" value={formatPhone(customer.phone)} />
                <DetailRow label="Email" value={customer.email} />
                <DetailRow label="Property address" value={customer.address} />
                <DetailRow label="Property type" value={humanizeEnum(customer.propertyType)} />
                <DetailRow label="Roof" value={customer.roofAge} />
                <DetailRow label="Lead source" value={customer.leadSource} />
                <DetailRow label="Customer since" value={customer.since} />
                <DetailRow label="Last contact" value={history[0]?.at ?? '—'} />
              </dl>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={2}>
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <ul className="divide-y divide-line-subtle border-t border-line-subtle">
              {history.map((call) => (
                <li key={call.id} className="flex items-start gap-3 px-6 py-4">
                  <IconTile
                    icon={call.isEmergency ? ShieldExclamationIcon : PhoneIcon}
                    tone={call.isEmergency ? 'emergency' : 'brand'}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-medium text-ink">
                        {humanizeEnum(call.outcome)}
                      </span>
                      <EnumStatusText value={call.intent} />
                    </div>
                    <p className="font-num mt-0.5 text-caption text-ink-faint">
                      {call.at} · {call.duration}
                    </p>
                    <p className="mt-1 line-clamp-2 text-small text-ink-muted">{call.summary}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>

        <Reveal index={3}>
          <Card>
            <CardHeader>
              <CardTitle>Appointments</CardTitle>
            </CardHeader>
            {booked ? (
              <ul className="divide-y divide-line-subtle border-t border-line-subtle">
                <li className="flex items-start gap-3 px-6 py-4">
                  <IconTile icon={CalendarDaysIcon} tone="brand" size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-ink">
                      {booked.service}
                    </span>
                    <span className="font-num mt-0.5 block text-small text-ink-muted">
                      {booked.when} · {booked.window}
                    </span>
                    <span className="mt-0.5 block text-caption text-ink-faint">
                      {booked.address}
                    </span>
                  </div>
                  <EnumStatusText value={booked.status} className="shrink-0 text-right" />
                </li>
              </ul>
            ) : (
              <CardContent>
                <p className="text-small text-ink-muted">No appointments for this customer.</p>
              </CardContent>
            )}
          </Card>
        </Reveal>

        <Reveal index={4}>
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent>
              <span className={buttonClass('primary', 'lg', 'w-full')}>
                <PhoneIcon className="h-4 w-4" aria-hidden />
                Call customer
              </span>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

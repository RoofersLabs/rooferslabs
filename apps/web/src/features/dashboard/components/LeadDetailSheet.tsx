import { Link } from 'react-router-dom';
import { ArrowRight, Phone } from 'lucide-react';
import { ROUTES } from '@/auth/stages';
import { cn, formatDateTime, formatDuration, formatPhone, humanizeEnum } from '@/lib/utils';
import { DetailRow } from '@/components/ui/DetailRow';
import { buttonClass } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type { PriorityLead } from '../insights';
// The dashboard's own flat status text, not the shared badge: this sheet is
// opened from a dashboard card and closes back onto it, so the priority and
// outcome must read exactly as they do on the card behind it.
import { EnumStatusLabel, StatusLabel } from './StatusLabel';

/** Same mapping the card uses, so the priority reads identically in both places. */
const TONES = {
  Emergency: 'danger',
  High: 'warning',
  Medium: 'brand',
} as const;

/**
 * Everything known about one lead, without leaving the dashboard.
 *
 * A bottom sheet rather than a route: the reader is part-way through a deck of
 * leads, and sending them to a page means losing their place in it and paying a
 * navigation to come back. The panel stops at 85dvh so a strip of the dashboard
 * stays visible behind it, which is what keeps "I am still on the dashboard"
 * true rather than merely implied. The full transcript is a link at the bottom,
 * for when the reader does want the whole call.
 *
 * Every value comes from the conversation the dashboard already fetched — this
 * opens no request and holds no state of its own. Two fields the product does
 * not have are deliberately absent rather than stubbed: there is no lead source
 * (a lead is, by definition, an inbound call to the AI number) and no assigned
 * representative (the data model has no rep to assign). Inventing a "—" for
 * either would advertise a feature that does not exist.
 */
export function LeadDetailSheet({
  lead,
  open,
  onOpenChange,
}: {
  /** Held while the sheet animates closed, so the panel does not empty mid-flight. */
  lead: PriorityLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">{lead && <LeadDetail lead={lead} />}</SheetContent>
    </Sheet>
  );
}

function LeadDetail({ lead }: { lead: PriorityLead }) {
  const { source } = lead;
  const call = source.call;
  const appointment = source.appointment;

  return (
    <>
      {/* `pr-14` clears the close button the sheet draws in the corner; without
          it a long name runs underneath it. */}
      <SheetHeader className="gap-2 pr-14">
        <SheetTitle className="text-h4 text-ink">{lead.name}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusLabel tone={TONES[lead.priority]}>{lead.priority}</StatusLabel>
            {source.outcome && <EnumStatusLabel value={source.outcome} />}
            <span className="text-caption text-ink-faint">
              {formatDateTime(call?.createdAt ?? source.createdAt)}
            </span>
          </div>
        </SheetDescription>
      </SheetHeader>

      {/* The scrolling region. `min-h-0` is what makes it scroll rather than
          push the panel past its own max height — a flex child's default
          `min-height: auto` refuses to shrink below its content. The sticky
          footer below therefore stays reachable however long the notes run. */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-2">
        <Section title="Contact">
          <DetailRow label="Name" value={lead.name} />
          <DetailRow label="Phone" value={lead.phone ? formatPhone(lead.phone) : null} />
          <DetailRow label="Property" value={lead.address} wrap />
        </Section>

        <Section title="Lead">
          <DetailRow label="Priority" value={lead.priority} />
          <DetailRow label="Status" value={humanizeEnum(source.status)} />
          <DetailRow label="Outcome" value={humanizeEnum(source.outcome)} />
          <DetailRow label="Intent" value={humanizeEnum(source.intent)} />
          <DetailRow label="Lead quality" value={humanizeEnum(source.leadQuality)} />
          <DetailRow label="Urgency" value={humanizeEnum(source.urgency)} />
        </Section>

        <Section title="Last contact">
          <DetailRow label="Called" value={formatDateTime(call?.createdAt ?? source.createdAt)} />
          <DetailRow label="Duration" value={formatDuration(call?.durationSeconds)} />
          <DetailRow label="From" value={call?.fromNumber ? formatPhone(call.fromNumber) : null} />
        </Section>

        {/* The nearest thing the product has to a scheduled follow-up: what the
            caller asked for on the call. Omitted rather than shown empty when
            no visit was requested — an "Appointment" heading over three dashes
            reads as a booking that failed. */}
        {appointment && (
          <Section title="Follow-up requested">
            <DetailRow label="Service" value={appointment.serviceRequested} />
            <DetailRow
              label="Preferred"
              value={preferredWhen(appointment.preferredDate, appointment.preferredTimeWindow)}
            />
            <DetailRow label="Status" value={humanizeEnum(appointment.status)} />
            {appointment.notes && <DetailRow label="Notes" value={appointment.notes} wrap />}
          </Section>
        )}

        {lead.summary && (
          <Section title="Call summary">
            <p className="py-2.5 text-small text-ink-muted">{lead.summary}</p>
          </Section>
        )}

        {/* The AI's own notes from the call — the closest thing to what a
            receptionist would have written on a pad. */}
        {source.keyPoints.length > 0 && (
          <Section title="Notes">
            <ul className="space-y-2 py-2.5">
              {source.keyPoints.map((point, i) => (
                <li key={i} className="flex gap-2.5 text-small text-ink-muted">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
                  {point}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Link
          to={`${ROUTES.conversations}/${lead.id}`}
          className="focus-ring mt-2 mb-4 inline-flex items-center gap-1 rounded-xs text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
        >
          Open the full call
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {/* Pinned outside the scroll area: the reason the sheet was opened is to
          decide whether to ring this person, and that decision should not
          require scrolling back. `pb-[env(...)]` keeps it clear of the iOS home
          indicator, which otherwise sits on top of the button. */}
      <div className="border-t border-line-subtle px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {lead.phone ? (
          <a href={`tel:${lead.phone}`} className={buttonClass('primary', 'lg', 'w-full')}>
            <Phone className="h-4 w-4" aria-hidden />
            Call Homeowner
          </a>
        ) : (
          <p className="text-center text-small text-ink-faint">
            No callback number was captured on this call.
          </p>
        )}
      </div>
    </>
  );
}

/**
 * One titled group of rows.
 *
 * `<dl>` with the same hairline divider the conversation page uses, so a reader
 * who opens both sees one component rather than two that resemble each other.
 */
function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('py-2', className)}>
      <h3 className="text-caption font-semibold uppercase tracking-wide text-ink-faint">{title}</h3>
      <dl className="divide-y divide-line-subtle">{children}</dl>
    </section>
  );
}

/** "Tue 4 Feb, 09:00 · Morning", with either half allowed to be missing. */
function preferredWhen(date: string | null, window: string | null): string | null {
  const when = date ? formatDateTime(date) : null;
  if (when && window) return `${when} · ${window}`;
  return when ?? window;
}

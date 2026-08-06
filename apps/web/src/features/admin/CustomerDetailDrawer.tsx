import { useState } from 'react';
import { CompanyStatus } from '@rooferslabs/shared';
import { useAdminCompany, useCompanyApproval, type ApprovalAction } from '@/hooks/queries';
import { formatDateTime, formatPhone, timeAgo } from '@/lib/utils';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DetailRow } from '@/components/ui/DetailRow';
import { Textarea } from '@/components/ui/input';
import { ErrorState } from '@/components/ui/ErrorState';
import { LoadingBlock } from '@/components/ui/spinner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { STATUS_PRESENTATION, presentationFor } from './approvalStatus';

/** A titled block inside the drawer. Three of them, all the same shape. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-6 py-4">
      <h3 className="mb-1 text-caption font-semibold uppercase tracking-wide text-ink-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * One founder decision, rendered as the transition it was.
 *
 * "Pending → Active" rather than "approved", because the transition is the fact
 * that was recorded and it stays readable if an action is ever renamed. The
 * arrow is what makes a history skimmable: the eye follows the second column
 * down and sees the account's whole path without reading a word.
 */
function HistoryEntry({
  event,
}: {
  event: {
    id: string;
    previousStatus: CompanyStatus | null;
    newStatus: CompanyStatus | null;
    reason: string | null;
    actorEmail: string | null;
    actorName: string | null;
    createdAt: string;
  };
}) {
  const from = event.previousStatus ? presentationFor(event.previousStatus).label : '—';
  const to = event.newStatus ? presentationFor(event.newStatus).label : '—';
  return (
    <li className="py-2.5 text-small">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-ink">
          {from} <span className="text-ink-faint">→</span> {to}
        </span>
        <span className="shrink-0 text-caption text-ink-faint">{timeAgo(event.createdAt)}</span>
      </div>
      <p className="mt-0.5 text-caption text-ink-muted">
        {event.actorName || event.actorEmail || 'System'}
        {' · '}
        {formatDateTime(event.createdAt)}
      </p>
      {event.reason && <p className="mt-1 text-caption italic text-ink-muted">“{event.reason}”</p>}
    </li>
  );
}

/**
 * Everything the founder needs to decide about one account, in a side panel.
 *
 * A drawer rather than a page because the decision is made *from the queue*:
 * open, read, accept, next. Navigating away and back for each one would lose the
 * founder's place in the list and the filter they were working through.
 *
 * The action buttons are derived from the account's own status, so the panel can
 * only ever offer the transition that is actually available. That is a
 * convenience, not the rule — the API refuses the other two whatever is clicked.
 */
export function CustomerDetailDrawer({
  companyId,
  onClose,
}: {
  companyId: string | null;
  onClose: () => void;
}) {
  const detail = useAdminCompany(companyId ?? undefined);
  const data = detail.data;

  return (
    <Sheet open={Boolean(companyId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {detail.isLoading || !data ? (
          <>
            <SheetHeader>
              <SheetTitle>Customer</SheetTitle>
              <SheetDescription>Loading account details…</SheetDescription>
            </SheetHeader>
            {detail.isError ? (
              <ErrorState
                title="Couldn’t load this customer"
                message={(detail.error as Error).message}
                onRetry={() => void detail.refetch()}
              />
            ) : (
              <LoadingBlock label="Loading customer…" />
            )}
          </>
        ) : (
          // Keyed by the account, so the pause note and any failed-mutation
          // error belong to the account on screen and cannot survive into the
          // next one. React resets the state for us — an effect that cleared it
          // by hand would be a cascading render doing the same job worse.
          <DrawerBody key={data.company.id} data={data} onClose={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/**
 * The loaded panel: everything about one account, and the decision available on
 * it. Split out so its per-account state resets by remounting.
 */
function DrawerBody({
  data,
  onClose,
}: {
  data: NonNullable<ReturnType<typeof useAdminCompany>['data']>;
  onClose: () => void;
}) {
  const approval = useCompanyApproval();
  const [reason, setReason] = useState('');

  const company = data.company;
  const presentation = presentationFor(company.status);

  const act = (action: ApprovalAction) => {
    approval.mutate(
      {
        id: company.id,
        action,
        reason: action === 'pause' ? reason.trim() || undefined : undefined,
      },
      // Closing on success returns the founder to the queue with the row already
      // repainted by the optimistic update — the next decision is one click away.
      { onSuccess: onClose },
    );
  };

  return (
    <>
      <SheetHeader className="border-b border-line-subtle">
        <SheetTitle>{company.name}</SheetTitle>
        <SheetDescription>{company.ownerEmail ?? company.email ?? '—'}</SheetDescription>
        <Badge tone={presentation.tone} className="mt-2">
          {presentation.label}
        </Badge>
      </SheetHeader>

      <div className="divide-y divide-line-subtle">
        <Section title="Company">
          <dl className="divide-y divide-line-subtle">
            <DetailRow label="Company" value={company.name} />
            <DetailRow
              label="Location"
              value={[company.city, company.state].filter(Boolean).join(', ') || null}
            />
            <DetailRow label="Timezone" value={company.timezone} />
            {/* The organization id, because a support conversation about
                      this account starts by quoting it. */}
            <DetailRow label="Organization ID" value={company.id} wrap />
          </dl>
        </Section>

        <Section title="Owner">
          <dl className="divide-y divide-line-subtle">
            <DetailRow label="Name" value={company.ownerName} />
            <DetailRow label="Email" value={company.ownerEmail ?? company.email} />
            <DetailRow label="Phone" value={formatPhone(company.phone)} />
            <DetailRow
              label="Last active"
              value={company.lastActiveAt ? timeAgo(company.lastActiveAt) : null}
            />
          </dl>
        </Section>

        <Section title="Lifecycle">
          <dl className="divide-y divide-line-subtle">
            <DetailRow label="Signed up" value={formatDateTime(company.createdAt)} />
            <DetailRow
              label="Setup finished"
              value={company.onboardedAt ? formatDateTime(company.onboardedAt) : null}
            />
            <DetailRow
              label="Approved"
              value={company.approvedAt ? formatDateTime(company.approvedAt) : null}
            />
            <DetailRow
              label="Paused"
              value={company.pausedAt ? formatDateTime(company.pausedAt) : null}
            />
            <DetailRow label="Pause reason" value={company.pauseReason} wrap />
          </dl>
        </Section>

        <Section title="Activity">
          <dl className="divide-y divide-line-subtle">
            <DetailRow label="Calls" value={String(data.usage.totalCalls)} />
            <DetailRow label="Leads" value={String(data.usage.totalLeads)} />
            <DetailRow label="Appointments" value={String(data.usage.totalAppointments)} />
            <DetailRow label="Customers" value={String(data.usage.totalCustomers)} />
          </dl>
        </Section>

        <Section title="Audit history">
          {data.approvalHistory.length ? (
            <ul className="divide-y divide-line-subtle">
              {data.approvalHistory.map((event) => (
                <HistoryEntry key={event.id} event={event} />
              ))}
            </ul>
          ) : (
            <p className="py-2 text-small text-ink-muted">
              No lifecycle changes yet. Accepting or pausing this account will record one here.
            </p>
          )}
        </Section>
      </div>

      <SheetFooter className="border-t border-line-subtle">
        {approval.isError && <Alert tone="danger">{(approval.error as Error).message}</Alert>}

        {/* The note is only offered where it means something. A reason for
                  approving or resuming has nowhere to live — the column exists to
                  explain a pause. */}
        {company.status === CompanyStatus.ACTIVE && (
          <Textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Reason for pausing (optional, internal only)"
            aria-label="Reason for pausing"
          />
        )}

        <div className="flex gap-3">
          {presentation.action && (
            <Button
              className="flex-1"
              variant={presentation.action === 'pause' ? 'destructive' : ('primary' as const)}
              loading={approval.isPending}
              onClick={() => act(presentation.action as ApprovalAction)}
            >
              {presentation.actionLabel}
            </Button>
          )}
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Close
          </Button>
        </div>

        {!presentation.action && (
          <p className="text-caption text-ink-faint">
            This account is still completing setup. It will appear as{' '}
            {STATUS_PRESENTATION.PENDING_APPROVAL.label} once the wizard is finished.
          </p>
        )}
      </SheetFooter>
    </>
  );
}

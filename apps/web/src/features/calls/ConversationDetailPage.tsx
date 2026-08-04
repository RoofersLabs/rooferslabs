import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  User,
  ShieldAlert,
  Sparkles,
  CalendarClock,
  PhoneCall,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { useConversation } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import { cn, formatDateTime, formatDuration, formatPhone, humanizeEnum } from '@/lib/utils';
import { StatusText, EnumStatusText } from '@/components/ui/StatusText';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { IconTile } from '@/components/ui/IconTile';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RecordingDownload } from '@/components/RecordingDownload';
import { ROUTES } from '@/auth/stages';

/**
 * Two views, not three. Summary carries everything needed to act on the call —
 * what happened, the extracted facts, the appointment — and Transcript holds
 * the raw conversation for the times that is not enough. A third tab only made
 * the reader click to assemble a picture they needed all of anyway.
 */
const TABS = [
  { key: 'summary', label: 'Summary', icon: Sparkles },
  { key: 'transcript', label: 'Transcript', icon: MessageSquare },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const conversation = useConversation(id);
  // Local state, not the URL: switching tabs is a reading preference, not a
  // place — and keeping it out of the router means no navigation, no remount
  // of the page, and the loaded conversation stays in place.
  const [tab, setTab] = useState<TabKey>('summary');

  if (conversation.isLoading) {
    return (
      <Card>
        <LoadingBlock label="Loading conversation…" />
      </Card>
    );
  }
  if (conversation.isError) {
    const notFound = conversation.error instanceof ApiError && conversation.error.status === 404;
    return (
      <Card>
        {notFound ? (
          <EmptyState
            icon={PhoneCall}
            title="Conversation not found"
            description="It may have been removed or you may not have access to it."
          />
        ) : (
          <ErrorState
            title="Couldn’t load this conversation"
            message={(conversation.error as Error).message}
            onRetry={() => void conversation.refetch()}
          />
        )}
      </Card>
    );
  }
  if (!conversation.data) {
    return (
      <Card>
        <EmptyState
          icon={PhoneCall}
          title="Conversation not found"
          description="It may have been removed or you may not have access to it."
        />
      </Card>
    );
  }

  const data = conversation.data;
  const call = data.call;

  return (
    <div>
      <Link
        to={ROUTES.calls}
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-focus text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to calls
      </Link>

      {/* The title block is the shared PageHeader, so a conversation reads as
          a page of this product rather than a detail view of its own. */}
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            <IconTile
              icon={data.isEmergency ? ShieldAlert : Phone}
              tone={data.isEmergency ? 'emergency' : 'brand'}
              size="lg"
            />
            {data.customer?.fullName ?? formatPhone(call?.fromNumber)}
            {/* Flat colored text, via the shared `StatusText` that Customers,
                Appointments and Knowledge already use — no fill, no border, no
                pill. The status gives context; it should not outweigh the name
                it sits beside. */}
            <EnumStatusText value={data.outcome} />
            {data.isEmergency && (
              <StatusText tone="danger" className="inline-flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" aria-hidden />
                Emergency
              </StatusText>
            )}
          </span>
        }
        description={
          <span className="font-num text-body text-ink-muted">
            {formatDateTime(call?.createdAt)} · {formatDuration(call?.durationSeconds)} ·{' '}
            {formatPhone(call?.fromNumber)}
          </span>
        }
      />

      {/* Tabs, not a stack: opening a call now answers "what happened" on the
          first screen, and the transcript is one deliberate click away rather
          than the largest thing on the page. */}
      <div role="tablist" aria-label="Call sections" className="flex gap-1 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`call-tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls={`call-panel-${item.key}`}
            onClick={() => setTab(item.key)}
            // The same recipe the Settings tabs use, so this reads as one
            // pattern across the product rather than a second kind of tab.
            className={cn(
              'focus-ring flex h-10 shrink-0 items-center gap-2.5 px-3.5 text-body font-medium transition-colors duration-fast',
              tab === item.key
                ? 'bg-accent-subtle text-accent'
                : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`call-panel-${tab}`}
        aria-labelledby={`call-tab-${tab}`}
        className="mt-6"
      >
        {/* One tab now carries the whole overview: what happened, the facts
            pulled out of the call, and the appointment it produced. Splitting
            those across tabs made the reader click to assemble a picture they
            needed all of anyway. */}
        {tab === 'summary' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-small leading-6 text-ink">
                  {data.summary ?? 'No summary available.'}
                </p>
                {data.keyPoints.length > 0 && (
                  <ul className="mt-3 list-inside list-disc space-y-1 text-small text-ink-muted">
                    {data.keyPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Call details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="divide-y divide-line-subtle">
                  <DetailRow label="Intent" value={humanizeEnum(data.intent)} />
                  <DetailRow label="Lead quality" value={humanizeEnum(data.leadQuality)} />
                  <DetailRow label="Urgency" value={humanizeEnum(data.urgency)} />
                  <DetailRow label="Customer" value={data.customer?.fullName ?? '—'} />
                  <DetailRow label="Phone" value={formatPhone(data.customer?.phone)} />
                  <DetailRow
                    label="Address"
                    value={
                      (data.customer && 'propertyAddress' in data.customer
                        ? (data.customer.propertyAddress as string | null)
                        : null) ?? '—'
                    }
                  />
                </dl>
                {call?.recordingStatus === 'completed' && <RecordingDownload callId={call.id} />}
              </CardContent>
            </Card>

            {data.appointment && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-accent" aria-hidden />
                    Appointment request
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-line-subtle">
                    <DetailRow label="Service" value={data.appointment.serviceRequested ?? '—'} />
                    <DetailRow
                      label="Preferred"
                      value={`${data.appointment.preferredDate ? formatDateTime(data.appointment.preferredDate) : 'Any day'}${data.appointment.preferredTimeWindow ? ` · ${data.appointment.preferredTimeWindow}` : ''}`}
                    />
                    <DetailRow label="Status" value={humanizeEnum(data.appointment.status)} />
                  </dl>
                  <Link
                    to={ROUTES.appointments}
                    className="focus-ring mt-4 inline-flex items-center gap-1 rounded-focus text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
                  >
                    Manage in Appointments
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Mounted only while selected, so the bubbles are not built — or even
            in the document — until someone asks for them. The markup below is
            unchanged from the previous layout. */}
        {tab === 'transcript' && (
          <Card>
            <CardHeader>
              <CardTitle>Transcript</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[32rem] space-y-4 overflow-y-auto border-t border-line-subtle">
              {!data.transcript?.length ? (
                <p className="py-8 text-center text-small text-ink-muted">
                  No transcript was captured for this call.
                </p>
              ) : (
                data.transcript.map((entry, index) => (
                  <div
                    key={index}
                    className={
                      entry.role === 'assistant'
                        ? 'flex items-start gap-3'
                        : 'flex flex-row-reverse items-start gap-3'
                    }
                  >
                    <IconTile
                      icon={entry.role === 'assistant' ? Bot : User}
                      tone={entry.role === 'assistant' ? 'brand' : 'neutral'}
                      size="sm"
                    />
                    <div
                      className={
                        entry.role === 'assistant'
                          ? 'max-w-[80%] bg-accent-subtle px-4 py-2.5'
                          : 'max-w-[80%] bg-surface-3 px-4 py-2.5'
                      }
                    >
                      <p className="text-caption font-semibold uppercase tracking-wide text-ink-faint">
                        {entry.role === 'assistant' ? 'AI receptionist' : 'Caller'}
                      </p>
                      <p className="mt-0.5 text-small text-ink">{entry.text}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

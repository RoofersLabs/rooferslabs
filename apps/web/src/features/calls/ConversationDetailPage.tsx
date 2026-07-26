import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  User,
  ShieldAlert,
  Sparkles,
  CalendarClock,
  PhoneCall,
  Phone,
} from 'lucide-react';
import { useConversation } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import { formatDateTime, formatDuration, formatPhone, humanizeEnum } from '@/lib/utils';
import { Badge, EnumBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingBlock } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RecordingPlayer } from '@/components/RecordingPlayer';
import { ROUTES } from '@/auth/stages';

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const conversation = useConversation(id);

  if (conversation.isLoading) return <LoadingBlock label="Loading conversation…" />;
  if (conversation.isError) {
    const notFound = conversation.error instanceof ApiError && conversation.error.status === 404;
    if (notFound) {
      return (
        <EmptyState
          icon={PhoneCall}
          title="Conversation not found"
          description="It may have been removed or you may not have access to it."
        />
      );
    }
    return (
      <ErrorState
        title="Couldn’t load this conversation"
        message={(conversation.error as Error).message}
        onRetry={() => void conversation.refetch()}
      />
    );
  }
  if (!conversation.data) {
    return (
      <EmptyState
        icon={PhoneCall}
        title="Conversation not found"
        description="It may have been removed or you may not have access to it."
      />
    );
  }

  const data = conversation.data;
  const call = data.call;

  return (
    <div>
      <Link
        to={ROUTES.calls}
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-small font-medium text-accent hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to calls
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span
          className={
            data.isEmergency
              ? 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emergency-subtle'
              : 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-subtle'
          }
        >
          {data.isEmergency ? (
            <ShieldAlert className="h-6 w-6 text-emergency" aria-hidden />
          ) : (
            <Phone className="h-6 w-6 text-accent" aria-hidden />
          )}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h4 text-ink">
              {data.customer?.fullName ?? formatPhone(call?.fromNumber)}
            </h1>
            <EnumBadge value={data.outcome} />
            {data.isEmergency && (
              <Badge tone="danger">
                <ShieldAlert className="mr-1 h-3 w-3" aria-hidden />
                Emergency
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-small text-ink-muted">
            {formatDateTime(call?.createdAt)} · {formatDuration(call?.durationSeconds)} ·{' '}
            {formatPhone(call?.fromNumber)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[32rem] space-y-4 overflow-y-auto py-5">
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
                  <span
                    className={
                      entry.role === 'assistant'
                        ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle'
                        : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3'
                    }
                  >
                    {entry.role === 'assistant' ? (
                      <Bot className="h-4 w-4 text-accent" aria-hidden />
                    ) : (
                      <User className="h-4 w-4 text-ink-muted" aria-hidden />
                    )}
                  </span>
                  <div
                    className={
                      entry.role === 'assistant'
                        ? 'max-w-[80%] rounded-2xl rounded-tl-sm bg-accent-subtle px-4 py-2.5'
                        : 'max-w-[80%] rounded-2xl rounded-tr-sm bg-surface-3 px-4 py-2.5'
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

        {/* Sidebar: summary + extracted info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden />
                AI summary
              </CardTitle>
            </CardHeader>
            <CardContent className="py-5">
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
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="py-5">
              <dl className="space-y-2.5 text-small">
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
              {call?.recordingStatus === 'completed' && <RecordingPlayer callId={call.id} />}
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
              <CardContent className="py-5">
                <dl className="space-y-2.5 text-small">
                  <DetailRow label="Service" value={data.appointment.serviceRequested ?? '—'} />
                  <DetailRow
                    label="Preferred"
                    value={`${data.appointment.preferredDate ? formatDateTime(data.appointment.preferredDate) : 'Any day'}${data.appointment.preferredTimeWindow ? ` · ${data.appointment.preferredTimeWindow}` : ''}`}
                  />
                  <DetailRow label="Status" value={humanizeEnum(data.appointment.status)} />
                </dl>
                <Link
                  to={ROUTES.appointments}
                  className="focus-ring mt-3 inline-block rounded text-caption font-medium text-accent hover:underline"
                >
                  Manage in Appointments →
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-caption text-ink-muted">{label}</dt>
      <dd className="truncate text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

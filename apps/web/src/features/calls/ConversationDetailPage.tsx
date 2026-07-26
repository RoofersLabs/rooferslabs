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
} from 'lucide-react';
import { useConversation } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import { formatDateTime, formatDuration, formatPhone, humanizeEnum } from '@/lib/utils';
import { Badge, EnumBadge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { IconTile } from '@/components/ui/IconTile';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { RecordingPlayer } from '@/components/RecordingPlayer';
import { ROUTES } from '@/auth/stages';

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const conversation = useConversation(id);

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
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-xs text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
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
            <EnumBadge value={data.outcome} />
            {data.isEmergency && (
              <Badge tone="danger">
                <ShieldAlert className="h-3 w-3" aria-hidden />
                Emergency
              </Badge>
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
              <CardTitle>Details</CardTitle>
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
                  className="focus-ring mt-4 inline-flex items-center gap-1 rounded-xs text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
                >
                  Manage in Appointments
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

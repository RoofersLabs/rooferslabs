import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bot,
  User,
  ShieldAlert,
  Sparkles,
  CalendarClock,
  PhoneCall,
} from 'lucide-react';
import { useConversation } from '@/hooks/queries';
import { formatDateTime, formatDuration, formatPhone, humanizeEnum } from '@/lib/utils';
import { Badge, EnumBadge } from '@/components/ui/Badge';
import { LoadingBlock } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

export function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const conversation = useConversation(id);

  if (conversation.isLoading) return <LoadingBlock label="Loading conversation…" />;
  if (conversation.isError || !conversation.data) {
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
        to="/calls"
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to calls
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-slate-900">
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Transcript */}
        <section className="card lg:col-span-2" aria-label="Transcript">
          <header className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Transcript</h2>
            <p className="text-xs text-slate-500">
              {formatDateTime(call?.createdAt)} · {formatDuration(call?.durationSeconds)} ·{' '}
              {formatPhone(call?.fromNumber)}
            </p>
          </header>
          <div className="max-h-[32rem] space-y-4 overflow-y-auto p-5">
            {!data.transcript?.length ? (
              <p className="py-8 text-center text-sm text-slate-500">
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
                        ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100'
                        : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200'
                    }
                  >
                    {entry.role === 'assistant' ? (
                      <Bot className="h-4 w-4 text-brand-700" aria-hidden />
                    ) : (
                      <User className="h-4 w-4 text-slate-600" aria-hidden />
                    )}
                  </span>
                  <div
                    className={
                      entry.role === 'assistant'
                        ? 'max-w-[80%] rounded-2xl rounded-tl-sm bg-brand-50 px-4 py-2.5'
                        : 'max-w-[80%] rounded-2xl rounded-tr-sm bg-slate-100 px-4 py-2.5'
                    }
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {entry.role === 'assistant' ? 'AI receptionist' : 'Caller'}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-800">{entry.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Sidebar: summary + extracted info */}
        <div className="space-y-6">
          <section className="card p-5" aria-label="AI summary">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-brand-600" aria-hidden />
              AI summary
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              {data.summary ?? 'No summary available.'}
            </p>
            {data.keyPoints.length > 0 && (
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-slate-600">
                {data.keyPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5" aria-label="Details">
            <h2 className="text-sm font-semibold text-slate-900">Details</h2>
            <dl className="mt-3 space-y-2.5 text-sm">
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
            {call?.recordingUrl && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-medium text-slate-500">Recording</p>
                <audio controls src={call.recordingUrl} className="w-full" />
              </div>
            )}
          </section>

          {data.appointment && (
            <section className="card p-5" aria-label="Appointment request">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CalendarClock className="h-4 w-4 text-brand-600" aria-hidden />
                Appointment request
              </h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                <DetailRow label="Service" value={data.appointment.serviceRequested ?? '—'} />
                <DetailRow
                  label="Preferred"
                  value={`${data.appointment.preferredDate ? formatDateTime(data.appointment.preferredDate) : 'Any day'}${data.appointment.preferredTimeWindow ? ` · ${data.appointment.preferredTimeWindow}` : ''}`}
                />
                <DetailRow label="Status" value={humanizeEnum(data.appointment.status)} />
              </dl>
              <Link
                to="/appointments"
                className="focus-ring mt-3 inline-block rounded text-xs font-medium text-brand-700 hover:underline"
              >
                Manage in Appointments →
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="truncate text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

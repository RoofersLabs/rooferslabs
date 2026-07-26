import { Link } from 'react-router-dom';
import { Phone, ShieldAlert, Play } from 'lucide-react';
import type { Conversation } from '@/types/api';
import { formatDuration, formatPhone, humanizeEnum, timeAgo } from '@/lib/utils';
import { EnumBadge } from '@/components/ui/badge';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SectionCard } from './SectionCard';

/**
 * The primary dashboard surface: a readable log of the most recent answered
 * calls. Each row links to the full conversation (transcript + recording).
 */
export function RecentCalls({
  conversations,
  isLoading,
  className,
}: {
  conversations: Conversation[] | undefined;
  isLoading: boolean;
  className?: string;
}) {
  return (
    <SectionCard
      title="Recent calls"
      action={{ label: 'View all calls', to: '/calls' }}
      className={className}
    >
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : !conversations?.length ? (
        <EmptyState
          icon={Phone}
          title="No calls yet"
          description="Once your number is forwarded, every answered call will appear here."
        />
      ) : (
        <ul className="divide-y divide-line-subtle border-t border-line-subtle">
          {conversations.map((conversation) => {
            const name =
              conversation.customer?.fullName ?? formatPhone(conversation.call?.fromNumber);
            const callType = conversation.intent
              ? humanizeEnum(conversation.intent)
              : 'General call';
            return (
              <li key={conversation.id}>
                <Link
                  to={`/conversations/${conversation.id}`}
                  className="group focus-ring flex items-center gap-4 px-6 py-4 transition-colors duration-fast hover:bg-surface-2"
                >
                  <span
                    className={
                      conversation.isEmergency
                        ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emergency-subtle'
                        : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-subtle'
                    }
                  >
                    {conversation.isEmergency ? (
                      <ShieldAlert className="h-5 w-5 text-emergency" aria-hidden />
                    ) : (
                      <Phone className="h-5 w-5 text-accent" aria-hidden />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-body font-medium text-ink">{name}</span>
                      <EnumBadge value={conversation.outcome} />
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-small text-ink-muted">
                      <span className="truncate">{callType}</span>
                      {conversation.customer?.fullName && conversation.call?.fromNumber && (
                        <>
                          <span aria-hidden className="text-ink-faint">
                            ·
                          </span>
                          <span className="font-num truncate">
                            {formatPhone(conversation.call.fromNumber)}
                          </span>
                        </>
                      )}
                    </span>
                  </span>

                  <span className="hidden shrink-0 flex-col items-end text-right sm:flex">
                    <span className="text-small text-ink-muted">
                      {timeAgo(conversation.createdAt)}
                    </span>
                    <span className="font-num mt-0.5 text-caption text-ink-faint">
                      {formatDuration(conversation.call?.durationSeconds)}
                    </span>
                  </span>

                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-subtle text-ink-muted transition-colors duration-fast group-hover:border-accent-border group-hover:text-accent"
                    aria-hidden
                  >
                    <Play className="h-4 w-4" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

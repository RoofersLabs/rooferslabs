import { Link } from 'react-router-dom';
import type { Conversation } from '@/types/api';
import { formatDuration, formatPhone, humanizeEnum, timeAgo } from '@/lib/utils';
import { IconTile } from '@/components/ui/IconTile';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { EnumStatusLabel } from './StatusLabel';
import { SectionCard } from './SectionCard';
import { PhoneIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';

/**
 * The primary dashboard surface: a readable log of the most recent answered
 * calls. Each row links to the full conversation (transcript + recording).
 *
 * The row carries no play control. Playback belongs to the conversation page,
 * which is one tap away and is where the transcript sits beside it; a second
 * entry point on every row only competed with the row's own link.
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
          icon={PhoneIcon}
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
                  className="focus-ring flex items-center gap-4 px-6 py-4 transition-colors duration-fast hover:bg-surface-2"
                >
                  <IconTile
                    icon={conversation.isEmergency ? ShieldExclamationIcon : PhoneIcon}
                    tone={conversation.isEmergency ? 'emergency' : 'brand'}
                  />

                  {/* `min-w-0` is what lets the two lines below actually
                      truncate: a flex item defaults to `min-width: auto`, so
                      without it the column refuses to shrink past its text and
                      pushes the right-hand column off the row instead. */}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-medium text-ink">{name}</span>
                    <span className="mt-0.5 block truncate text-small text-ink-muted">
                      {callType}
                      {conversation.customer?.fullName && conversation.call?.fromNumber && (
                        <>
                          <span aria-hidden className="text-ink-faint">
                            {' · '}
                          </span>
                          <span className="font-num">
                            {formatPhone(conversation.call.fromNumber)}
                          </span>
                        </>
                      )}
                    </span>
                  </span>

                  {/* Fixed width, so a long status can never widen this column
                      and shove the name — the reason the old row sheared apart.
                      Every row therefore breaks at the same x position. All
                      three lines always render (`—` when a value is missing),
                      which is what keeps row heights identical. */}
                  <span className="flex w-28 shrink-0 flex-col items-end text-right sm:w-36">
                    <EnumStatusLabel value={conversation.outcome} className="max-w-full truncate" />
                    <span className="mt-1 text-small text-ink-muted">
                      {timeAgo(conversation.createdAt)}
                    </span>
                    <span className="font-num mt-0.5 text-caption text-ink-faint">
                      {formatDuration(conversation.call?.durationSeconds)}
                    </span>
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

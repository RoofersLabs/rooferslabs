import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellRing,
  CheckCheck,
  ShieldAlert,
  CalendarClock,
  Flame,
  Phone,
  Check,
  Undo2,
} from 'lucide-react';
import { NotificationType } from '@rooferslabs/shared';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useNotifications,
} from '@/hooks/queries';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { Notification } from '@/types/api';
import { cn, timeAgo } from '@/lib/utils';
import { REFINED_BUTTON, REFINED_CARD } from '@/components/ui/refinedControls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/pagination';

/**
 * Push opt-in/out for this browser. Hidden when the browser lacks Push support
 * or the server has no VAPID keys; shows guidance when permission is blocked.
 */
function PushNotificationsCard() {
  const { status, busy, subscribe, unsubscribe } = usePushNotifications();

  if (status === 'unsupported' || status === 'loading') return null;

  return (
    // One row on a desktop, two on a phone — never the ragged three the
    // wrapping copy used to produce. `sm:items-center` keeps the icon, the text
    // and the button on one optical line once they fit.
    <Card className={cn('mb-6 gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4', REFINED_CARD)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <IconTile icon={BellRing} size="sm" />
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">
            {status === 'subscribed' ? 'Push notifications are on' : 'Enable push notifications'}
          </p>
          {status === 'denied' ? (
            <p className="mt-0.5 text-small text-ink-muted">
              Blocked for this site — enable them in your browser settings, then reload.
            </p>
          ) : status === 'subscribed' ? (
            <p className="mt-0.5 text-small text-ink-muted">
              This device gets alerts even when the app is closed.
            </p>
          ) : (
            // The three alert types on one line rather than stacked bullets:
            // same information, a third of the height, and no orphaned words.
            <ul className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-small text-ink-muted">
              <li>Emergency calls</li>
              <li aria-hidden>·</li>
              <li>New leads</li>
              <li aria-hidden>·</li>
              <li>Appointment requests</li>
            </ul>
          )}
        </div>
      </div>
      {status !== 'denied' && (
        <Button
          className={cn(REFINED_BUTTON, 'shrink-0')}
          size="sm"
          variant={status === 'subscribed' ? 'secondary' : 'primary'}
          loading={busy}
          onClick={() => void (status === 'subscribed' ? unsubscribe() : subscribe())}
        >
          {status === 'subscribed' ? 'Turn off' : 'Enable notifications'}
        </Button>
      )}
    </Card>
  );
}

const typeIcon: Record<string, typeof Bell> = {
  [NotificationType.EMERGENCY]: ShieldAlert,
  [NotificationType.APPOINTMENT_REQUEST]: CalendarClock,
  [NotificationType.NEW_LEAD]: Flame,
  [NotificationType.NEW_CALL]: Phone,
  [NotificationType.CALL_SUMMARY]: Phone,
};

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const notifications = useNotifications({ page });
  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const markAll = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const unreadCount = (notifications.data?.metadata?.unreadCount as number | undefined) ?? 0;

  const open = (notification: Notification) => {
    if (notification.status === 'UNREAD') markRead.mutate(notification.id);
    const related = notification.relatedEntity;
    if (related?.type === 'conversation') navigate(`/conversations/${related.id}`);
    else if (related?.type === 'call') navigate('/calls');
    else if (related?.type === 'customer') navigate('/customers');
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Emergencies, new leads, and appointment requests as they happen."
        actions={
          unreadCount > 0 ? (
            <Button
              className={REFINED_BUTTON}
              variant="secondary"
              loading={markAll.isPending}
              onClick={() => markAll.mutate()}
            >
              <CheckCheck className="h-4 w-4" aria-hidden />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      <PushNotificationsCard />

      <Card className={cn('overflow-hidden', REFINED_CARD)}>
        {notifications.isLoading ? (
          <ListSkeleton />
        ) : notifications.isError ? (
          <ErrorState
            title="Couldn’t load notifications"
            message={(notifications.error as Error).message}
            onRetry={() => void notifications.refetch()}
          />
        ) : !notifications.data?.items.length ? (
          <EmptyState
            icon={Bell}
            title="You’re all caught up"
            description="Notifications about calls, leads, and emergencies will appear here."
          />
        ) : (
          <>
            <ul className="divide-y divide-line-subtle">
              {notifications.data.items.map((notification) => {
                const Icon = typeIcon[notification.type] ?? Bell;
                const unread = notification.status === 'UNREAD';
                const critical = notification.priority === 'CRITICAL';
                return (
                  <li
                    key={notification.id}
                    // The unread rail is drawn inside the 24px gutter, so the
                    // row's content keeps the same left edge as every other
                    // list in the product whether it is read or unread.
                    className={cn(
                      'group flex items-center border-l-2 pr-3 transition-colors duration-fast hover:bg-surface-2',
                      unread ? 'border-accent bg-accent-subtle/40' : 'border-transparent',
                    )}
                  >
                    <button
                      onClick={() => open(notification)}
                      className="focus-ring flex min-w-0 flex-1 items-start gap-4 py-4 pl-[22px] pr-3 text-left"
                    >
                      <IconTile icon={Icon} size="sm" tone={critical ? 'emergency' : 'neutral'} />
                      <span className="min-w-0 flex-1">
                        {/* Weight carries the state as well as the rail does,
                            and unlike colour it survives a sunlit screen. */}
                        <span
                          className={cn(
                            'block text-body text-ink',
                            unread ? 'font-semibold' : 'font-medium',
                          )}
                        >
                          {notification.title}
                        </span>
                        <span className="mt-0.5 block text-small text-ink-muted">
                          {notification.message}
                        </span>
                        <span className="mt-0.5 block text-caption text-ink-faint">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </span>
                    </button>

                    {/* A sibling of the row button, not a child — a button
                        cannot nest inside a button, and the row is one. */}
                    <button
                      onClick={() =>
                        unread
                          ? markRead.mutate(notification.id)
                          : markUnread.mutate(notification.id)
                      }
                      title={unread ? 'Mark as read' : 'Mark as unread'}
                      aria-label={`Mark “${notification.title}” as ${unread ? 'read' : 'unread'}`}
                      className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-faint transition-colors duration-fast hover:bg-surface-3 hover:text-ink"
                    >
                      {unread ? (
                        <Check className="h-4 w-4" aria-hidden />
                      ) : (
                        <Undo2 className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pagination pagination={notifications.data.pagination} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}

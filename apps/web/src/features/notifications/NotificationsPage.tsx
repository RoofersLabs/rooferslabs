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
  ChevronRight,
} from 'lucide-react';
import { NotificationType } from '@rooferslabs/shared';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
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
    <Card className={cn('mb-6 flex-row flex-wrap items-center gap-4 px-6 py-5', REFINED_CARD)}>
      <IconTile icon={BellRing} />
      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold text-ink">
          {status === 'subscribed'
            ? 'Push notifications are on'
            : 'Get notified the moment a lead calls'}
        </p>
        <p className="text-small text-ink-muted">
          {status === 'denied'
            ? 'Notifications are blocked for this site — enable them in your browser settings, then reload.'
            : status === 'subscribed'
              ? 'This device receives emergency and lead alerts, even when the app is closed.'
              : 'Emergencies, new leads, and appointment requests — delivered to this device even when the app is closed.'}
        </p>
      </div>
      {status !== 'denied' && (
        <Button
          className={REFINED_BUTTON}
          variant={status === 'subscribed' ? 'secondary' : 'primary'}
          loading={busy}
          onClick={() => void (status === 'subscribed' ? unsubscribe() : subscribe())}
        >
          {status === 'subscribed' ? 'Turn off on this device' : 'Enable push notifications'}
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
                  <li key={notification.id}>
                    <button
                      onClick={() => open(notification)}
                      className={cn(
                        // The unread rail is drawn inside the 24px gutter, so
                        // the row's content stays on the same left edge as
                        // every other list in the product whether it is read
                        // or unread.
                        'group focus-ring flex w-full items-start gap-4 border-l-2 py-4 pl-[22px] pr-6 text-left transition-colors duration-fast hover:bg-surface-2',
                        unread ? 'border-accent bg-accent-subtle/40' : 'border-transparent',
                      )}
                    >
                      <IconTile icon={Icon} size="sm" tone={critical ? 'emergency' : 'neutral'} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-body text-ink',
                              unread ? 'font-semibold' : 'font-medium',
                            )}
                          >
                            {notification.title}
                          </span>
                          {unread && (
                            <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-small text-ink-muted">
                          {notification.message}
                        </span>
                        <span className="mt-0.5 block text-caption text-ink-faint">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </span>
                      <ChevronRight
                        className="mt-1 h-4 w-4 shrink-0 self-center text-ink-faint opacity-0 transition-opacity duration-fast group-hover:opacity-100"
                        aria-hidden
                      />
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

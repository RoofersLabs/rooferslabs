import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, CheckCheck, ShieldAlert, CalendarClock, Flame, Phone } from 'lucide-react';
import { NotificationType } from '@rooferslabs/shared';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/queries';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { Notification } from '@/types/api';
import { cn, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';

/**
 * Push opt-in/out for this browser. Hidden when the browser lacks Push support
 * or the server has no VAPID keys; shows guidance when permission is blocked.
 */
function PushNotificationsCard() {
  const { status, busy, subscribe, unsubscribe } = usePushNotifications();

  if (status === 'unsupported' || status === 'loading') return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-line-subtle bg-surface px-5 py-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50">
        <BellRing className="h-5 w-5 text-brand-700" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">
          {status === 'subscribed'
            ? 'Push notifications are on'
            : 'Get notified the moment a lead calls'}
        </p>
        <p className="text-xs text-ink-muted">
          {status === 'denied'
            ? 'Notifications are blocked for this site — enable them in your browser settings, then reload.'
            : status === 'subscribed'
              ? 'This device receives emergency and lead alerts, even when the app is closed.'
              : 'Emergencies, new leads, and appointment requests — delivered to this device even when the app is closed.'}
        </p>
      </div>
      {status !== 'denied' && (
        <Button
          variant={status === 'subscribed' ? 'secondary' : 'primary'}
          size="sm"
          loading={busy}
          onClick={() => void (status === 'subscribed' ? unsubscribe() : subscribe())}
        >
          {status === 'subscribed' ? 'Turn off on this device' : 'Enable push notifications'}
        </Button>
      )}
    </div>
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
              variant="secondary"
              size="sm"
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

      <div className="card overflow-hidden">
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
                        'focus-ring flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-surface-2',
                        unread && 'bg-brand-50/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          critical ? 'bg-emergency-subtle' : 'bg-surface-3',
                        )}
                      >
                        <Icon
                          className={cn('h-4 w-4', critical ? 'text-emergency' : 'text-ink-muted')}
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm text-ink',
                              unread ? 'font-semibold' : 'font-medium',
                            )}
                          >
                            {notification.title}
                          </span>
                          {unread && (
                            <span
                              className="h-2 w-2 rounded-full bg-brand-600"
                              aria-label="Unread"
                            />
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-muted">
                          {notification.message}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-ink-faint">
                          {timeAgo(notification.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <Pagination pagination={notifications.data.pagination} onPageChange={setPage} />
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ShieldAlert, CalendarClock, Flame, Phone } from 'lucide-react';
import { NotificationType } from '@rooferslabs/shared';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '@/hooks/queries';
import type { Notification } from '@/types/api';
import { cn, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { LoadingBlock } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';

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

      <div className="card overflow-hidden">
        {notifications.isLoading ? (
          <LoadingBlock />
        ) : !notifications.data?.items.length ? (
          <EmptyState
            icon={Bell}
            title="You’re all caught up"
            description="Notifications about calls, leads, and emergencies will appear here."
          />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {notifications.data.items.map((notification) => {
                const Icon = typeIcon[notification.type] ?? Bell;
                const unread = notification.status === 'UNREAD';
                const critical = notification.priority === 'CRITICAL';
                return (
                  <li key={notification.id}>
                    <button
                      onClick={() => open(notification)}
                      className={cn(
                        'focus-ring flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50',
                        unread && 'bg-brand-50/40',
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          critical ? 'bg-red-100' : 'bg-slate-100',
                        )}
                      >
                        <Icon
                          className={cn('h-4 w-4', critical ? 'text-red-600' : 'text-slate-500')}
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm text-slate-900',
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
                        <span className="mt-0.5 block text-sm text-slate-600">
                          {notification.message}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">
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

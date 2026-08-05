import { cn } from '@/lib/utils';
import { REFINED_BUTTON } from '@/components/ui/refinedControls';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { Pagination } from '@/components/ui/pagination';
import type { IconComponent } from '@/components/ui/icon';
import {
  ArrowUturnLeftIcon,
  BellAlertIcon,
  BellIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  FireIcon,
  PhoneIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { notifications } from '../data';
import { Reveal, StaggerList, StaggerRow } from '../animation';
import { PreviewPageHeader } from '../chrome';

const TYPE_ICON: Record<string, IconComponent> = {
  EMERGENCY: ShieldExclamationIcon,
  APPOINTMENT_REQUEST: CalendarDaysIcon,
  NEW_LEAD: FireIcon,
  NEW_CALL: PhoneIcon,
  CALL_SUMMARY: PhoneIcon,
};

/**
 * The Notifications page, matching `features/notifications/NotificationsPage`:
 * the push opt-in card, then the feed with its unread rail down the left.
 *
 * Read state lives in the showcase rather than here, so marking a row read —
 * or marking them all — also empties the sidebar badge and the header bell, the
 * way it does in the product.
 */
export function NotificationsView({
  isUnread,
  onToggle,
  onMarkAllRead,
}: {
  isUnread: (id: string) => boolean;
  onToggle: (id: string) => void;
  onMarkAllRead: () => void;
}) {
  const unreadCount = notifications.filter((item) => isUnread(item.id)).length;

  return (
    <div>
      <Reveal as="header">
        <PreviewPageHeader
          title="Notifications"
          description="Emergencies, new leads, and appointment requests as they happen."
          actions={
            unreadCount > 0 ? (
              <Button
                className={REFINED_BUTTON}
                variant="secondary"
                size="sm"
                onClick={onMarkAllRead}
              >
                <CheckCircleIcon aria-hidden />
                Mark all read
              </Button>
            ) : undefined
          }
        />
      </Reveal>

      <Reveal index={1}>
        <Card className="mb-4 gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <IconTile icon={BellAlertIcon} size="sm" />
            <div className="min-w-0">
              <p className="text-body font-semibold text-ink">Push notifications are on</p>
              <p className="mt-0.5 text-small text-ink-muted">
                This device gets alerts even when the app is closed.
              </p>
            </div>
          </div>
          <Button className={cn(REFINED_BUTTON, 'shrink-0')} size="sm" variant="secondary">
            Turn off
          </Button>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card className="overflow-hidden">
          <StaggerList className="divide-y divide-line-subtle">
            {notifications.map((item) => {
              const Icon = TYPE_ICON[item.type] ?? BellIcon;
              const unread = isUnread(item.id);
              return (
                <StaggerRow
                  key={item.id}
                  className={cn(
                    'group flex items-center border-l-2 pr-3 transition-colors duration-fast hover:bg-surface-2',
                    unread ? 'border-accent bg-accent-subtle/40' : 'border-transparent',
                  )}
                >
                  <span className="flex min-w-0 flex-1 items-start gap-4 py-4 pl-[22px] pr-3 text-left">
                    <IconTile
                      icon={Icon}
                      size="sm"
                      tone={item.critical ? 'emergency' : 'neutral'}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block text-body text-ink',
                          unread ? 'font-semibold' : 'font-medium',
                        )}
                      >
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-small text-ink-muted">{item.message}</span>
                      <span className="mt-0.5 block text-caption text-ink-faint">{item.ago}</span>
                    </span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    title={unread ? 'Mark as read' : 'Mark as unread'}
                    aria-label={`Mark “${item.title}” as ${unread ? 'read' : 'unread'}`}
                    className="focus-ring relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors duration-fast hover:bg-surface-3 hover:text-ink"
                  >
                    {unread ? (
                      <CheckIcon className="h-4 w-4" aria-hidden />
                    ) : (
                      <ArrowUturnLeftIcon className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </StaggerRow>
              );
            })}
          </StaggerList>

          <Pagination
            pagination={{
              page: 1,
              limit: 20,
              totalRecords: 236,
              totalPages: 12,
              hasNextPage: true,
              hasPreviousPage: false,
            }}
            onPageChange={() => undefined}
          />
        </Card>
      </Reveal>
    </div>
  );
}

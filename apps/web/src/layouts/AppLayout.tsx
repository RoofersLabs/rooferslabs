import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  Phone,
  Users,
  CalendarClock,
  BookOpen,
  Bell,
  Settings,
  HardHat,
  CreditCard,
} from 'lucide-react';
import { useAccess } from '@/auth/AccessProvider';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/auth/stages';
import { useUnreadCount } from '@/hooks/queries';
import { GlobalSearch } from '@/components/GlobalSearch';
import { InstallPwaButton } from '@/components/InstallPwaButton';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

/**
 * Sidebar destinations, read from ROUTES rather than written as literals so the
 * nav can never point somewhere the route table does not serve.
 */
const NAVIGATION = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { to: ROUTES.calls, label: 'Calls', icon: Phone },
  { to: ROUTES.customers, label: 'Customers', icon: Users },
  { to: ROUTES.appointments, label: 'Appointments', icon: CalendarClock },
  { to: ROUTES.knowledge, label: 'Knowledge Base', icon: BookOpen },
  { to: ROUTES.notifications, label: 'Notifications', icon: Bell },
  { to: ROUTES.settings, label: 'Settings', icon: Settings },
];

/** Main application shell: sidebar navigation + header (docs/05 §22–23). */
export function AppLayout() {
  const { company, paymentsEnabled } = useAccess();
  const unread = useUnreadCount();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const unreadCount = unread.data?.unreadCount ?? 0;

  /**
   * Routes that render the softer chrome.
   *
   * The header and sidebar are one persistent shell shared by every
   * authenticated page, so these radii are scoped per route rather than applied
   * to the shared controls. Calls, Settings and Billing keep the chrome exactly
   * as it is today; the corners animate as the user crosses between the two
   * groups, because the elements themselves persist across that navigation.
   *
   * That trade-off was chosen deliberately, but the list is now five of the
   * eight authenticated routes. Past the halfway mark the scoping costs more
   * than it saves: styling the controls once and deleting this list would give
   * every page the same chrome and remove the animation entirely.
   */
  const softChrome = [
    ROUTES.dashboard,
    ROUTES.customers,
    ROUTES.appointments,
    ROUTES.knowledge,
    ROUTES.notifications,
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  /**
   * Guard against horizontal page overflow.
   *
   * `SidebarInset` is a flex item carrying `w-full`, and its default
   * `min-width: auto` resolves to `min(width suggestion, min-content)`. The
   * width suggestion is the full viewport, so whenever a page's min-content
   * reaches that figure the inset stops compressing and sits at viewport width
   * *beside* the 256px sidebar — a document 256px too wide. `min-w-0` removes
   * that floor.
   *
   * It takes wide content to trigger: measured at 1440px, Calls overflowed by
   * 256px only with a long summary under the old `truncate` (nowrap ⇒ enormous
   * min-content), and Customers' table overflowed by 22px at 1280px. Pages
   * whose content fits — the dashboard, Settings — never overflowed, and adding
   * `min-w-0` leaves them byte-identical, since their min-content is already
   * below the space available.
   *
   * Applied per route rather than in `components/ui/sidebar.tsx` to stay inside
   * the scope each pass was given, though a single `min-w-0` there would retire
   * this list for good.
   */
  const guardOverflow = [
    ROUTES.calls,
    ROUTES.customers,
    ROUTES.appointments,
    ROUTES.knowledge,
    ROUTES.notifications,
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  // Billing is appended rather than shown-and-broken: with payments disabled the
  // route guard turns the link away and the API answers 503.
  const navigation = paymentsEnabled
    ? [...NAVIGATION, { to: ROUTES.billing, label: 'Billing', icon: CreditCard }]
    : NAVIGATION;

  return (
    <SidebarProvider className="bg-base">
      <Sidebar collapsible="offcanvas" className="border-line-subtle">
        <SidebarHeader className="h-16 flex-row items-center gap-2.5 px-5 py-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-ink-on-brand shadow-button">
            <HardHat className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-body font-bold text-ink">RoofersLabs</p>
            {company && <p className="truncate text-caption text-ink-faint">{company.name}</p>}
          </div>
        </SidebarHeader>
        <SidebarContent className="gap-1 px-3 py-4">
          <SidebarMenu>
            {navigation.map((item) => {
              const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`);
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    size="lg"
                    className={cn(
                      'text-body font-medium text-ink-muted data-[active=true]:bg-accent-subtle data-[active=true]:text-accent data-[active=true]:hover:bg-accent-subtle data-[active=true]:hover:text-accent hover:bg-surface-3 hover:text-ink',
                      // One radius covers both the active fill and the hover
                      // fill — they are the same element, not two layers.
                      softChrome && 'rounded-xl',
                    )}
                  >
                    <NavLink to={item.to}>
                      <item.icon className="h-5 w-5 shrink-0" aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      {item.to === ROUTES.notifications && unreadCount > 0 && (
                        <span className="font-num ml-auto rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-ink-on-brand">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <SidebarInset className={cn('bg-base', guardOverflow && 'min-w-0')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line-subtle bg-[color-mix(in_oklab,var(--surface-1)_88%,transparent)] px-4 backdrop-blur sm:px-6">
          <SidebarTrigger className="text-ink-muted hover:bg-surface-3 hover:text-ink lg:hidden" />

          <GlobalSearch inputClassName={cn(softChrome && 'rounded-xl')} />

          <div className="ml-auto flex items-center gap-1.5">
            {/* `tracking-tight` is the only typographic change; the secondary
                variant already puts the label at `text-ink`, the highest
                contrast token on this surface, so nothing is recoloured. */}
            <InstallPwaButton className={cn(softChrome && 'rounded-full tracking-tight')} />
            <Button
              variant="ghost"
              size="icon"
              // `size="icon"` is already a 40px square with its contents
              // centered, so `rounded-full` alone makes the ghost hover fill a
              // true circle. The 150ms `transition-all` comes from the button.
              className={cn('relative', softChrome && 'rounded-full')}
              onClick={() => navigate(ROUTES.notifications)}
              aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
            >
              <Bell className="h-5 w-5" aria-hidden />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emergency ring-2 ring-surface" />
              )}
            </Button>
            <UserButton />
          </div>
        </header>

        {/* 32px page gutter matches the vertical rhythm the pages themselves
            use between sections, so the shell never feels tighter than its
            contents. */}
        <main className="mx-auto w-full max-w-dashboard px-4 py-8 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

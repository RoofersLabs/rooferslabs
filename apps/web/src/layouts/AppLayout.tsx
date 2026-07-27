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
                    className="text-body font-medium text-ink-muted data-[active=true]:bg-accent-subtle data-[active=true]:text-accent data-[active=true]:hover:bg-accent-subtle data-[active=true]:hover:text-accent hover:bg-surface-3 hover:text-ink"
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

      <SidebarInset className="bg-base">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line-subtle bg-[color-mix(in_oklab,var(--surface-1)_88%,transparent)] px-4 backdrop-blur sm:px-6">
          <SidebarTrigger className="text-ink-muted hover:bg-surface-3 hover:text-ink lg:hidden" />

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-1.5">
            <InstallPwaButton />
            <Button
              variant="ghost"
              size="icon"
              className="relative"
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

import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  Phone,
  Users,
  CalendarClock,
  BookOpen,
  Bell,
  Home,
  Settings,
  CreditCard,
} from 'lucide-react';
import { useAccess } from '@/auth/AccessProvider';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/auth/stages';
import { useUnreadCount } from '@/hooks/queries';
import { GlobalSearch } from '@/components/GlobalSearch';
import { InstallPwaButton } from '@/components/InstallPwaButton';
import { LogoMark } from '@/components/Brand';
import { BottomNav, type BottomNavItem } from '@/components/BottomNav';
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

/**
 * The four destinations the handheld tab bar carries, in the order they appear
 * there: where the day starts (Home), the work itself (Calls), what is waiting
 * (Notifications), and the one place an owner changes how the receptionist
 * behaves (Settings).
 *
 * Everything omitted — Customers, Appointments, Knowledge Base, Billing — is
 * still one tap away in the sidebar behind the header trigger. The bar is a
 * shortcut to four things; it takes nothing away from the drawer.
 *
 * The dashboard is captioned "Home" here rather than "Dashboard": on a tab bar
 * the first icon is the way back to the start, and that is the shape a handheld
 * user already reads it as.
 */
const BOTTOM_NAV: BottomNavItem[] = [
  { to: ROUTES.dashboard, label: 'Home', icon: Home },
  { to: ROUTES.calls, label: 'Calls', icon: Phone },
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
          <LogoMark className="h-[13px] text-brand-950" />
          <div className="min-w-0">
            <p className="truncate text-body font-semibold tracking-[-0.02em] text-ink">
              rooferslabs
            </p>
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
                      // fill — they are the same element, not two layers. The
                      // value itself is `--radius-nav`, carried by the base
                      // component, so every sidebar surface shares it and this
                      // row no longer opts out with a radius of its own.
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
        {/* The header owns the top safe area. With `viewport-fit=cover` the
            document runs under the status bar and the notch, so an installed
            PWA would otherwise set the search field and the avatar beneath the
            clock. Padding by the inset — rather than offsetting the whole
            header — keeps the blurred bar running to the physical top edge,
            which is what makes the status bar read as part of the app. On
            hardware that reserves nothing the inset is zero and the row alone
            sets the 64px height. */}
        <header className="gutter-safe-x sticky top-0 z-20 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-3 border-b border-line-subtle bg-[color-mix(in_oklab,var(--surface-1)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur">
          <SidebarTrigger className="text-ink-muted hover:bg-surface-3 hover:text-ink lg:hidden" />

          {/* One header for the whole authenticated app: these radii are no
              longer scoped per route, so the search field and the controls
              beside it are pixel-identical on every page and nothing animates
              as the user moves between them. No page overrides them. */}
          {/* Below `sm` the header carries the drawer trigger, the install
              button, the bell and the avatar, which leaves the elastic search
              about 145px — enough to render "Search c" and then clip mid-word.
              Hiding the placeholder rather than shortening it leaves the
              magnifier alone in the field, which is what both mobile platforms
              do and what the control already looks like once focused. The
              accessible name is on `aria-label`, so nothing is lost to a screen
              reader; only the visual hint is dropped, and only where it could
              not be read anyway. */}
          {/* The field takes the product's square geometry like every other
              input. It carried `rounded-full` when it was the one control in a
              row of pills; in a square interface that pill was the only
              non-button curve above the fold, and it read as an oversight
              rather than as a choice.

              Below `sm` the header carries the drawer trigger, the install
              button, the bell and the avatar, which leaves the elastic search
              about 145px — enough to render "Search c" and then clip mid-word.
              Hiding the placeholder rather than shortening it leaves the
              magnifier alone in the field, which is what both mobile platforms
              do. The accessible name is on `aria-label`, so nothing is lost to
              a screen reader; only the visual hint is dropped, and only where
              it could not be read anyway. */}
          <GlobalSearch inputClassName="placeholder:text-transparent sm:placeholder:text-ink-faint" />

          {/* `shrink-0`: these controls have a fixed size and the search does
              not, so the row must give its space back from the search rather
              than squeezing the buttons — which `whitespace-nowrap` would not
              allow anyway, leaving the header to overflow instead. */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            {/* `tracking-tight` is the only typographic change; the secondary
                variant already puts the label at `text-ink`, the highest
                contrast token on this surface, so nothing is recoloured. */}
            <InstallPwaButton className="rounded-full tracking-tight" />
            <Button
              variant="ghost"
              size="icon"
              // `size="icon"` is already a 40px square with its contents
              // centered, so `rounded-full` alone makes the ghost hover fill a
              // true circle. The 150ms `transition-all` comes from the button.
              className="relative rounded-full"
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

        {/* 24px page gutter matches the vertical rhythm the pages themselves
            use between sections, so the shell never feels tighter than its
            contents. It was 32px, which read as a margin around the product
            rather than as part of it — the density pass took the shell and the
            sections down together so the ratio between them is unchanged.

            Below `lg` the gutter also has to clear the tab bar, which is fixed
            and therefore out of flow: 1.5rem of gutter + the bar's 4rem row +
            whatever the device reserves for its home indicator. Without it the
            last row of every page sits under the bar. */}
        <main className="gutter-safe-page mx-auto w-full max-w-dashboard py-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-6">
          <Outlet />
        </main>

        <BottomNav items={BOTTOM_NAV} />
      </SidebarInset>
    </SidebarProvider>
  );
}

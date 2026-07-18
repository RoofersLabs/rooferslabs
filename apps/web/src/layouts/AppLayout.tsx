import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import {
  LayoutDashboard,
  Phone,
  Users,
  CalendarClock,
  BookOpen,
  Bell,
  Settings,
  Menu,
  X,
  HardHat,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionStore } from '@/state/session.store';
import { useUnreadCount } from '@/hooks/queries';
import { GlobalSearch } from '@/components/GlobalSearch';
import { InstallPwaButton } from '@/components/InstallPwaButton';

const navigation = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/calls', label: 'Calls', icon: Phone },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/appointments', label: 'Appointments', icon: CalendarClock },
  { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/** Main application shell: sidebar navigation + header (docs/05 §22–23). */
export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const company = useSessionStore((s) => s.company);
  const unread = useUnreadCount();
  const navigate = useNavigate();
  const unreadCount = unread.data?.unreadCount ?? 0;

  const sidebar = (
    <nav className="flex h-full flex-col" aria-label="Main navigation">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-ink-on-brand shadow-button">
          <HardHat className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-body font-bold text-ink">RoofersLabs</p>
          {company && <p className="truncate text-caption text-ink-faint">{company.name}</p>}
        </div>
      </div>
      <div className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-body font-medium transition-colors duration-fast ease-standard',
                isActive
                  ? 'bg-accent-subtle text-accent'
                  : 'text-ink-muted hover:bg-surface-3 hover:text-ink',
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.to === '/notifications' && unreadCount > 0 && (
              <span className="font-num rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-ink-on-brand">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-base">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line-subtle bg-surface lg:block">
        {sidebar}
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 animate-scale-in bg-surface shadow-dialog">
            <button
              onClick={() => setMobileOpen(false)}
              className="focus-ring absolute right-3 top-4 rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line-subtle bg-surface/90 px-4 backdrop-blur sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="focus-ring rounded-md p-2 text-ink-muted transition-colors hover:bg-surface-3 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <GlobalSearch />

          <div className="ml-auto flex items-center gap-2">
            <InstallPwaButton />
            <button
              onClick={() => navigate('/notifications')}
              className="focus-ring relative rounded-md p-2 text-ink-muted transition-colors hover:bg-surface-3"
              aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emergency ring-2 ring-surface" />
              )}
            </button>
            <UserButton />
          </div>
        </header>

        <main className="mx-auto max-w-dashboard px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

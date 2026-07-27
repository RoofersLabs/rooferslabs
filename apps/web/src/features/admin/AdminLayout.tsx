import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  PhoneCall,
  BarChart3,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADMIN_ROUTES } from './routes';

const NAV = [
  { to: ADMIN_ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: ADMIN_ROUTES.companies, label: 'Companies', icon: Building2, end: false },
  { to: ADMIN_ROUTES.liveCalls, label: 'Live calls', icon: PhoneCall, end: true },
  { to: ADMIN_ROUTES.analytics, label: 'Analytics', icon: BarChart3, end: true },
  { to: ADMIN_ROUTES.settings, label: 'Settings', icon: Settings2, end: true },
] as const;

/**
 * The internal portal's shell.
 *
 * It sits inside the customer app's `AppLayout`, so the header, sidebar, search
 * and avatar are literally the same components — nothing about the chrome is
 * reimplemented here. What this adds is a second row of navigation for the
 * portal's own sections and a standing marker that the data below is
 * platform-wide rather than one tenant's.
 *
 * The tab styling is the Settings recipe, unchanged, so the product has one
 * kind of tab rather than a third.
 */
export function AdminLayout() {
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle pb-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h1 className="text-h5 text-ink">RoofersLabs Admin</h1>
            <p className="text-caption text-ink-faint">Internal · every company on the platform</p>
          </div>
        </div>

        <nav aria-label="Admin sections" className="flex gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'focus-ring flex h-10 shrink-0 items-center gap-2.5 rounded-md px-3.5 text-body font-medium transition-colors duration-fast',
                  isActive
                    ? 'bg-accent-subtle text-accent'
                    : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                )
              }
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <Outlet />
    </div>
  );
}

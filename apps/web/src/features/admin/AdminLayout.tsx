import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
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
 * Standalone rather than nested in the customer `AppLayout`. That layout's
 * sidebar and search belong to one tenant — Calls, Customers, Settings for
 * *your* company — and none of it means anything on a platform-wide surface.
 * Rendering it here would also have flashed customer navigation on the way in,
 * which is exactly what this hostname exists to avoid.
 *
 * It is a deliberately thinner shell, not a second copy of one: the container
 * width, gutters and tab styling are the same tokens and the same recipes the
 * customer app uses, so the two read as one product.
 */
export function AdminLayout() {
  return (
    <div className="mx-auto w-full max-w-dashboard px-4 py-8 sm:px-6 lg:px-8">
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

        {/* Sign-out lives here because there is no customer header to carry a
            UserButton on this surface. */}
        <div className="flex items-center gap-2">
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
          <UserButton
            appearance={{ elements: { avatarBox: 'h-8 w-8' } }}
            afterSignOutUrl={ADMIN_ROUTES.root}
          />
        </div>
      </div>

      <Outlet />
    </div>
  );
}

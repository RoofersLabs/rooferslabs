import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { USER_BUTTON_APPEARANCE } from '@/lib/clerk-appearance';
import { cn } from '@/lib/utils';
import { ADMIN_ROUTES } from './routes';
import {
  AdjustmentsHorizontalIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

/**
 * `end` on every tab, Companies included.
 *
 * Companies is mounted at `/admin`, the portal's root, so without `end` its
 * NavLink matches every path beneath it — the tab lit up on Analytics, on
 * Settings, and on a company's own detail page, which is a level down rather
 * than the list. The comment here has always said `end`; the value did not,
 * and adding a second tab is what made the disagreement visible.
 */
const NAV = [
  { to: ADMIN_ROUTES.companies, label: 'Companies', icon: BuildingOffice2Icon, end: true },
  // Second, not last: it is the only tab that carries work, and the founder
  // opens it every day. `end` because it has no children to stay lit for.
  { to: ADMIN_ROUTES.approvals, label: 'Customer approvals', icon: UserGroupIcon, end: true },
  { to: ADMIN_ROUTES.analytics, label: 'Analytics', icon: ChartBarIcon, end: true },
  { to: ADMIN_ROUTES.settings, label: 'Settings', icon: AdjustmentsHorizontalIcon, end: true },
] as const;

/**
 * The internal portal's shell.
 *
 * Standalone rather than nested in the customer `AppLayout`. That layout's
 * sidebar and search belong to one tenant — Calls, Customers, Settings for
 * *your* company — and none of it means anything on a platform-wide surface.
 *
 * The header carries no product name. One person uses this, on a hostname that
 * already says what it is; a title bar would be decoration that costs vertical
 * space on every page. Navigation starts immediately, the avatar closes the row.
 */
export function AdminLayout() {
  return (
    <div className="mx-auto w-full max-w-dashboard px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between gap-4 border-b border-line-subtle pb-3">
        <nav aria-label="Admin sections" className="-ml-1.5 flex min-w-0 gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'focus-ring flex h-9 shrink-0 items-center gap-2 px-3 text-small font-medium transition-colors duration-fast',
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

        {/* Sign-out lives here because there is no customer header on this
            surface to carry a UserButton. */}
        <UserButton appearance={USER_BUTTON_APPEARANCE} afterSignOutUrl={ADMIN_ROUTES.root} />
      </header>

      <Outlet />
    </div>
  );
}

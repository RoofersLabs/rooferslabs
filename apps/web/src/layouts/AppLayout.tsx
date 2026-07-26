import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useAccess } from '@/auth/AccessProvider';
import { ROUTES } from '@/auth/stages';

/** Temporary application shell: a plain header and the routed page. */
export function AppLayout() {
  const { company, paymentsEnabled } = useAccess();

  // Billing is omitted rather than shown-and-broken while payments are off: the
  // route guard would turn the link away and the API would answer 503.
  const navigation = [
    { to: ROUTES.dashboard, label: 'Dashboard' },
    { to: ROUTES.settings, label: 'Settings' },
    ...(paymentsEnabled ? [{ to: ROUTES.billing, label: 'Billing' }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
          <span className="font-bold">RoofersLabs</span>
          <nav className="flex gap-4 text-sm">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'font-medium underline' : 'text-gray-600 hover:text-gray-900'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {company && <span className="text-sm text-gray-600">{company.name}</span>}
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

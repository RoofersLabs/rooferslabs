import { NavLink, Outlet } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { useSessionStore } from '@/state/session.store';

const navigation = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/settings', label: 'Settings' },
  { to: '/billing', label: 'Billing' },
];

/** Temporary application shell: a plain header and the routed page. */
export function AppLayout() {
  const company = useSessionStore((s) => s.company);

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

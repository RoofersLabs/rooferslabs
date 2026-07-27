import { Navigate, Outlet } from 'react-router-dom';
import { PlatformRole } from '@rooferslabs/shared';
import { useAccess } from '@/auth/AccessProvider';
import { FullScreenSpinner } from '@/components/ui/spinner';
import { ROUTES } from '@/auth/stages';

/**
 * Keeps the portal out of a customer's way. It is **not** the security
 * boundary — `PlatformAdminGuard` on the API is, and it runs on every request
 * regardless of what any browser believes.
 *
 * What this does buy: a customer who guesses the URL lands back on their own
 * dashboard instead of an empty shell firing eight requests that all 403.
 *
 * It checks `platformRole`, never `role`. Every customer is a `UserRole.OWNER`,
 * so that field could never gate this.
 */
export function AdminGuard() {
  const access = useAccess();

  if (access.isLoading) return <FullScreenSpinner label="Loading…" />;

  if (access.user?.platformRole !== PlatformRole.OWNER) {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <Outlet />;
}

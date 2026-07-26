import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ReceptionistStatus } from '@/types/api';
import { ROUTES } from '@/auth/stages';

function greetingFor(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Page greeting + at-a-glance receptionist status chips. */
export function DashboardHeader({
  firstName,
  receptionist,
}: {
  firstName?: string | null;
  receptionist: ReceptionistStatus | undefined;
}) {
  const name = firstName?.trim();
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-h2 text-ink">
          {greetingFor()}
          {name ? `, ${name}` : ''}!
        </h1>
        <p className="mt-1.5 text-body-lg text-ink-muted">
          Here’s what’s happening with your business today.
        </p>
      </div>

      {receptionist && (
        <div className="flex flex-wrap gap-2">
          <StatusChip
            good={receptionist.enabled}
            goodLabel="AI receptionist active"
            badLabel="AI receptionist disabled"
          />
          <StatusChip
            good={receptionist.forwardingVerified}
            goodLabel="Forwarding verified"
            badLabel="Forwarding required"
          />
        </div>
      )}
    </div>
  );
}

/** Compact receptionist/forwarding status chip linking to Phone Setup. */
function StatusChip({
  good,
  goodLabel,
  badLabel,
}: {
  good: boolean;
  goodLabel: string;
  badLabel: string;
}) {
  return (
    <Link
      to={`${ROUTES.settings}/phone`}
      className={cn(
        'focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-caption font-medium transition-colors duration-fast',
        good
          ? 'border-success-border bg-success-subtle text-success'
          : 'border-warning-border bg-warning-subtle text-warning',
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', good ? 'bg-success' : 'bg-warning')}
        aria-hidden
      />
      {good ? goodLabel : badLabel}
    </Link>
  );
}

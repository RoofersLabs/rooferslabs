import { ROUTES } from '@/auth/stages';
import { StandaloneLayout } from '@/layouts/StandaloneLayout';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconTile } from '@/components/ui/IconTile';
import { MapIcon } from '@heroicons/react/24/outline';

export function NotFoundPage() {
  return (
    <StandaloneLayout brandLinksHome>
      <Card className="items-center px-8 py-14 text-center">
        <IconTile icon={MapIcon} size="xl" />
        <h1 className="mt-5 text-h3 text-ink">Page not found</h1>
        <p className="mt-1.5 max-w-sm text-body leading-6 text-ink-muted">
          The page you were looking for doesn’t exist, or it may have moved.
        </p>
        <ButtonLink className="mt-6" to={ROUTES.dashboard}>
          Go to your dashboard
        </ButtonLink>
      </Card>
    </StandaloneLayout>
  );
}

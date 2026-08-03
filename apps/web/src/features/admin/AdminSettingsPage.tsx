import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react';
import { api } from '@/lib/api-client';
import { config } from '@/config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { LoadingBlock } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/ErrorState';

interface Readiness {
  status: 'ready' | 'degraded';
  checks: { database: boolean; cache: boolean };
}

function Health({ label, ok }: { label: string; ok: boolean | null }) {
  const Icon = ok === null ? MinusCircle : ok ? CheckCircle2 : XCircle;
  const tone = ok === null ? 'text-ink-faint' : ok ? 'text-success' : 'text-emergency';
  return (
    <div className="flex items-center justify-between gap-6 py-2.5 text-small">
      <span className="text-ink-muted">{label}</span>
      <span className={`flex items-center gap-1.5 font-medium ${tone}`}>
        <Icon className="h-4 w-4" aria-hidden />
        {ok === null ? 'Not reported' : ok ? 'Healthy' : 'Unreachable'}
      </span>
    </div>
  );
}

/**
 * Environment and dependency status.
 *
 * Only the database and cache are actually probed — that is what
 * `/health/ready` measures today. The third-party integrations are listed as
 * configured/not configured rather than "healthy", because nothing here has
 * pinged them: reporting an unverified green light is worse than reporting
 * nothing.
 */
export function AdminSettingsPage() {
  const readiness = useQuery({
    queryKey: ['admin', 'readiness'],
    queryFn: () => api.get<Readiness>('/health/ready'),
    refetchInterval: 30_000,
    retry: false,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="divide-y divide-line-subtle">
            <DetailRow label="Application" value="rooferslabs Admin" />
            <DetailRow label="Version" value={__APP_VERSION__} />
            <DetailRow label="Mode" value={import.meta.env.MODE} />
            <DetailRow label="API base URL" value={config.apiBaseUrl || 'same origin'} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System health</CardTitle>
        </CardHeader>
        <CardContent>
          {readiness.isLoading ? (
            <LoadingBlock label="Checking dependencies…" />
          ) : readiness.isError ? (
            <ErrorState
              title="The API is not answering its readiness probe"
              message={(readiness.error as Error).message}
              onRetry={() => void readiness.refetch()}
            />
          ) : (
            <>
              <Health label="Database (PostgreSQL)" ok={readiness.data?.checks.database ?? null} />
              <Health label="Cache (Redis)" ok={readiness.data?.checks.cache ?? null} />
              {/* Not probed by /health/ready — shown as configuration state so
                  nobody reads an unverified tick as a live check. */}
              <Health label="OpenAI" ok={null} />
              <Health label="Twilio" ok={null} />
              <p className="mt-3 border-t border-line-subtle pt-3 text-caption text-ink-faint">
                Database and cache are probed live. The two integrations above are not yet covered
                by the readiness endpoint and are reported as unknown rather than assumed healthy.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

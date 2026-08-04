import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { useAdminAnalytics } from '@/hooks/queries';
import { cn, formatDuration } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ADMIN_ROUTES } from './routes';

type Series = { day: string; calls: number; leads: number; appointments: number };

/**
 * A bar chart drawn with the layout engine rather than a charting library.
 *
 * Three stacked series over at most thirty points does not justify shipping a
 * chart runtime, and a div's height is a value the design tokens already own —
 * so this reads in the same colours as everything else and adds nothing to the
 * bundle.
 */
function TrendChart({ series }: { series: Series[] }) {
  const peak = Math.max(1, ...series.map((d) => d.calls));

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-[32rem] items-end gap-1" style={{ height: '11rem' }}>
        {series.map((point) => {
          const day = new Date(point.day);
          return (
            <div key={point.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                <span
                  className="w-1/3 bg-accent"
                  style={{ height: `${(point.calls / peak) * 100}%` }}
                  title={`${point.calls} calls`}
                />
                <span
                  className="w-1/3 bg-success"
                  style={{ height: `${(point.leads / peak) * 100}%` }}
                  title={`${point.leads} leads`}
                />
                <span
                  className="w-1/3 bg-warning"
                  style={{ height: `${(point.appointments / peak) * 100}%` }}
                  title={`${point.appointments} appointments`}
                />
              </div>
              <span className="font-num shrink-0 text-caption text-ink-faint">
                {day.getUTCDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminAnalyticsPage() {
  const [days, setDays] = useState(7);
  const analytics = useAdminAnalytics(days);

  return (
    <div className="space-y-6">
      <Card as="section">
        <CardHeader className="items-center">
          <CardTitle as="h2">Platform trend</CardTitle>
          <div className="flex gap-1">
            {[7, 30].map((window) => (
              <Button
                key={window}
                size="sm"
                variant={days === window ? 'primary' : 'ghost'}
                onClick={() => setDays(window)}
              >
                {window} days
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="border-t border-line-subtle">
          {analytics.isLoading ? (
            <ListSkeleton rows={3} />
          ) : analytics.isError ? (
            <ErrorState
              title="Couldn’t load analytics"
              message={(analytics.error as Error).message}
              onRetry={() => void analytics.refetch()}
            />
          ) : (
            <>
              <TrendChart series={analytics.data?.series ?? []} />
              <div className="mt-4 flex flex-wrap gap-4 text-caption text-ink-muted">
                {[
                  ['bg-accent', 'Calls'],
                  ['bg-success', 'Leads'],
                  ['bg-warning', 'Appointments'],
                ].map(([swatch, label]) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2', swatch)} aria-hidden />
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card as="section" className="overflow-hidden">
        <CardHeader>
          <CardTitle as="h2">By company</CardTitle>
        </CardHeader>
        {analytics.isLoading ? (
          <ListSkeleton />
        ) : !analytics.data?.companies.length ? (
          <EmptyState
            icon={BarChart3}
            title="No activity in this window"
            description="Try the 30-day view."
          />
        ) : (
          <div className="overflow-x-auto border-t border-line-subtle">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Company</TableHead>
                  <TableHead>Calls</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Appts</TableHead>
                  <TableHead>Emergencies</TableHead>
                  <TableHead>Resolution</TableHead>
                  <TableHead>Avg. length</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.data.companies.map((row) => (
                  <TableRow key={row.companyId}>
                    <TableCell className="font-medium">
                      <Link
                        to={ADMIN_ROUTES.company(row.companyId)}
                        className="focus-ring rounded-focus text-accent transition-colors duration-fast hover:text-accent-hover"
                      >
                        {row.companyName}
                      </Link>
                    </TableCell>
                    <TableCell className="font-num">{row.calls}</TableCell>
                    <TableCell className="font-num">{row.leads}</TableCell>
                    <TableCell className="font-num">{row.appointments}</TableCell>
                    <TableCell className="font-num">{row.emergencies}</TableCell>
                    <TableCell className="font-num">{row.resolutionRate}%</TableCell>
                    <TableCell className="font-num">
                      {formatDuration(row.averageCallSeconds)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

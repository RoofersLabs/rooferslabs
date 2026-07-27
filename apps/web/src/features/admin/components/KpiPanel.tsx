import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { IconTile, type IconTileTone } from '@/components/ui/IconTile';
import { Skeleton } from '@/components/ui/skeleton';

export interface Kpi {
  icon: LucideIcon;
  label: string;
  value: string | number | undefined;
  tone: IconTileTone;
  hint?: string;
}

/**
 * The portal's headline numbers.
 *
 * Deliberately the customer dashboard's analytics panel, rebuilt with the same
 * parts rather than imported: that component's four metrics are baked into it,
 * and the portal shows eight. The visual grammar — one card, hairline dividers,
 * icon tile above a large figure — is identical, so the two pages read as the
 * same product without either owning the other's data shape.
 */
export function KpiPanel({ items }: { items: Kpi[] }) {
  return (
    <Card as="section" aria-label="Platform metrics" className="overflow-hidden rounded-md">
      <div className="grid auto-rows-fr grid-cols-2 gap-px bg-line-subtle lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col gap-4 bg-surface p-5 sm:p-6">
            <IconTile icon={item.icon} tone={item.tone} shape="square" />
            <div>
              {item.value === undefined ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <span className="font-num block text-h2 leading-none text-ink">{item.value}</span>
              )}
              <span className="mt-2 block text-small font-medium text-ink-muted">{item.label}</span>
              {item.hint && (
                <span className="mt-1 block text-caption text-ink-faint">{item.hint}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

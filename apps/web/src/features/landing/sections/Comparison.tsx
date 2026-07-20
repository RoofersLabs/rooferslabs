import { Check, Minus } from 'lucide-react';
import { Container, Section, SectionHeading } from '../components/Section';
import { Reveal } from '../components/Reveal';
import { cn } from '@/lib/utils';

/** A cell is either a literal value ("$299") or a yes/no rendered as an icon. */
type Row = { label: string; traditional: string | boolean; rooferslabs: string | boolean };

const ROWS: Row[] = [
  { label: 'Answers nights, weekends and holidays', traditional: false, rooferslabs: true },
  { label: 'Never on another line', traditional: false, rooferslabs: true },
  { label: 'Monthly cost', traditional: '$3,200 – $4,500', rooferslabs: 'From $299' },
  { label: 'Time to hire and train', traditional: '3 – 6 weeks', rooferslabs: 'About 20 minutes' },
  { label: 'Knows roofing terminology on day one', traditional: false, rooferslabs: true },
  { label: 'Books directly into your calendar', traditional: true, rooferslabs: true },
  { label: 'Logs every call to your CRM automatically', traditional: false, rooferslabs: true },
  { label: 'Calls out sick / takes vacation', traditional: 'Yes', rooferslabs: 'Never' },
  { label: 'Handles a storm-day call spike', traditional: false, rooferslabs: true },
];

export function Comparison() {
  return (
    <Section>
      <Container size="narrow">
        <SectionHeading
          eyebrow="Comparison"
          title="What a full-time receptionist costs you."
          lede="A good office hire is worth having. This is simply what the maths looks like next to one."
        />

        <Reveal className="mt-14">
          <div className="overflow-x-auto rounded-2xl border border-mkt-line-subtle bg-mkt-surface shadow-mkt-sm">
            <table className="w-full min-w-[34rem] border-collapse text-left">
              <caption className="sr-only">
                Feature and cost comparison between a traditional receptionist and RoofersLabs
              </caption>
              <thead>
                <tr className="border-b border-mkt-line-subtle">
                  <th scope="col" className="px-5 py-4 text-[0.8125rem] font-medium text-mkt-ink-faint">
                    &nbsp;
                  </th>
                  <th
                    scope="col"
                    className="px-5 py-4 text-[0.8125rem] font-medium text-mkt-ink-muted"
                  >
                    Traditional receptionist
                  </th>
                  <th
                    scope="col"
                    className="bg-mkt-accent-soft px-5 py-4 text-[0.8125rem] font-semibold text-mkt-accent"
                  >
                    RoofersLabs
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((r, i) => (
                  <tr
                    key={r.label}
                    className={cn(i !== ROWS.length - 1 && 'border-b border-mkt-line-subtle')}
                  >
                    <th
                      scope="row"
                      className="px-5 py-3.5 text-[0.875rem] font-normal text-mkt-ink-body"
                    >
                      {r.label}
                    </th>
                    <td className="px-5 py-3.5 text-[0.875rem] text-mkt-ink-muted">
                      <Cell value={r.traditional} />
                    </td>
                    <td className="bg-mkt-accent-soft px-5 py-3.5 text-[0.875rem] font-medium text-mkt-ink">
                      <Cell value={r.rooferslabs} positive />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

function Cell({ value, positive = false }: { value: string | boolean; positive?: boolean }) {
  if (value === true) {
    return (
      <>
        <Check
          className={cn('h-4 w-4', positive ? 'text-mkt-success' : 'text-mkt-ink-muted')}
          aria-hidden
        />
        <span className="sr-only">Yes</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="h-4 w-4 text-mkt-ink-faint" aria-hidden />
        <span className="sr-only">No</span>
      </>
    );
  }
  return <span className="tabular-nums">{value}</span>;
}

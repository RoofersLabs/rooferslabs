import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Eyebrow, Section, Shell } from '../components/primitives';
import { Reveal } from '../components/Reveal';
import { CallsPanel } from '../product/CallsPanel';
import { AppointmentsPanel } from '../product/AppointmentsPanel';
import { TranscriptPanel } from '../product/TranscriptPanel';
import { AnalyticsPanel } from '../product/AnalyticsPanel';
import { KnowledgePanel } from '../product/KnowledgePanel';

const TABS = [
  { id: 'calls', label: 'Calls', Panel: CallsPanel },
  { id: 'appointments', label: 'Appointments', Panel: AppointmentsPanel },
  { id: 'transcript', label: 'Transcript', Panel: TranscriptPanel },
  { id: 'analytics', label: 'Analytics', Panel: AnalyticsPanel },
  { id: 'knowledge', label: 'Knowledge', Panel: KnowledgePanel },
] as const;

/**
 * The centrepiece: the actual product, running on the page.
 *
 * Five real panels behind a real tab list — filters filter, keyboard navigation
 * works, and the content is rendered from typed fixtures rather than pasted
 * from a screenshot. Panels are keyed by tab so switching replays their row
 * stagger; every panel is a fixed height so switching never moves the page.
 */
export function Showcase() {
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const tab = tabRefs.current[active];
    const list = listRef.current;
    if (!tab || !list) return;
    setIndicator({
      left: tab.offsetLeft - list.scrollLeft,
      width: tab.offsetWidth,
    });
  }, [active]);

  // Layout effect so the indicator is never painted at a stale position.
  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  /** Roving arrow-key navigation, as expected of a real tab list. */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (active + delta + TABS.length) % TABS.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  // `TABS` is a non-empty const tuple, so index 0 is always present; the
  // fallback exists purely to satisfy `noUncheckedIndexedAccess`.
  const activeTab = TABS[active] ?? TABS[0];
  const ActivePanel = activeTab.Panel;

  return (
    <Section id="showcase">
      <Shell>
        <div className="max-w-3xl">
          <Reveal variant="fade">
            <Eyebrow>The product</Eyebrow>
          </Reveal>
          <Reveal variant="up" index={1}>
            <h2 className="mt-5 text-headline font-medium">
              Not a screenshot.
              <br className="hidden sm:block" />{' '}
              <span className="text-ink-tertiary">The real thing, on this page.</span>
            </h2>
          </Reveal>
          <Reveal variant="up" index={2}>
            <p className="mt-6 max-w-prose text-lead text-ink-secondary">
              Every call, appointment and decision your receptionist makes, in one place. Click
              through it.
            </p>
          </Reveal>
        </div>

        {/* A mask reveal — the whole console wipes up into view, distinct from
            the fade-ups used by the section above. */}
        <Reveal variant="mask" className="mt-14">
          <div className="overflow-hidden rounded-2xl border border-subtle bg-surface-raised shadow-[0_32px_120px_-48px_rgba(0,0,0,1)]">
            <div className="relative border-b border-subtle">
              <div
                ref={listRef}
                role="tablist"
                aria-label="Product areas"
                onKeyDown={onKeyDown}
                className="no-scrollbar relative flex overflow-x-auto px-2"
              >
                {/* Absolutely positioned, childless, and the only thing that
                    moves — so animating its width costs nothing measurable. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 h-px bg-accent transition-[transform,width] duration-300 ease-out"
                  style={{
                    width: `${indicator.width}px`,
                    transform: `translate3d(${indicator.left}px, 0, 0)`,
                  }}
                />
                {TABS.map((tab, index) => {
                  const selected = index === active;
                  return (
                    <button
                      key={tab.id}
                      ref={(node) => {
                        tabRefs.current[index] = node;
                      }}
                      role="tab"
                      id={`showcase-tab-${tab.id}`}
                      aria-selected={selected}
                      aria-controls={`showcase-panel-${tab.id}`}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setActive(index)}
                      className={cn(
                        'whitespace-nowrap px-4 py-3.5 text-sm font-medium transition-colors duration-200 ease-out',
                        selected ? 'text-ink' : 'text-ink-tertiary hover:text-ink-secondary',
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              key={activeTab.id}
              role="tabpanel"
              id={`showcase-panel-${activeTab.id}`}
              aria-labelledby={`showcase-tab-${activeTab.id}`}
              tabIndex={0}
            >
              <ActivePanel />
            </div>
          </div>
        </Reveal>
      </Shell>
    </Section>
  );
}

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn, formatPhone, humanizeEnum } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { FilterBar } from '@/components/ui/FilterBar';
import { IconTile } from '@/components/ui/IconTile';
import { SearchInput } from '@/components/ui/SearchInput';
import { EnumStatusText, StatusText } from '@/components/ui/StatusText';
import { Pagination } from '@/components/ui/pagination';
import { ChevronRightIcon, PhoneIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline';
import { calls, incomingCall } from '../data';
import { Reveal, StaggerList, StaggerRow } from '../animation';
import { PreviewPageHeader } from '../chrome';
import { usePhone } from '../formFactor';

/**
 * The Calls page, matching `features/calls/CallsPage`: one card holding the
 * filter bar, the call log and the pagination footer.
 *
 * The search filters the fixtures for real — it is two lines of `filter`, and a
 * preview whose search box does nothing is the fastest way to tell a visitor
 * they are looking at a picture.
 */

/** The five states one conversation passes through, as the log shows them. */
export type LivePhase = 'ringing' | 'answered' | 'talking' | 'captured' | 'logged';

const PHASE_LABEL: Record<LivePhase, string> = {
  ringing: 'Incoming call',
  answered: 'AI receptionist answering',
  talking: 'In progress',
  captured: 'Lead captured',
  logged: 'Completed',
};

/** What the receptionist has established so far, revealed as it establishes it. */
const PHASE_SUMMARY: Record<LivePhase, string> = {
  ringing: 'Worthington, OH · unknown number',
  answered: '“Thanks for calling Summit Roofing, this is Riley…”',
  talking: 'Caller reports water staining spreading across an upstairs ceiling.',
  captured: incomingCall.summary,
  logged: incomingCall.summary,
};

function clock(seconds: number): string {
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export function CallsView({
  live,
  liveSeconds = 0,
}: {
  /** The conversation being handled right now, driven by the showcase timeline. */
  live?: LivePhase | null;
  liveSeconds?: number;
}) {
  const reduced = useReducedMotion();
  const phone = usePhone();
  const [search, setSearch] = useState('');
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? calls.filter((call) =>
        `${call.name} ${call.phone} ${call.city} ${call.summary}`.toLowerCase().includes(needle),
      )
    : calls;

  const ringing = live === 'ringing';
  const settled = live === 'captured' || live === 'logged';

  return (
    <div>
      <Reveal as="header">
        <PreviewPageHeader
          title="Calls"
          description="Every inbound call answered by your AI receptionist."
        />
      </Reveal>

      <Reveal index={1}>
        <Card className="overflow-hidden">
          <FilterBar>
            <SearchInput
              className="sm:max-w-sm sm:flex-1"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by caller or number…"
              aria-label="Search calls"
            />
          </FilterBar>

          {/* The call happening now. It opens the log by growing into it rather
              than appearing on top of it, so the rows below are pushed down the
              way a new record pushes them down — and when the conversation
              ends the row simply stops being live. It is the same row
              throughout; nothing is swapped underneath the visitor. */}
          <AnimatePresence initial={false}>
            {live && !needle && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.34, ease: [0, 0, 0.2, 1] }}
                className="overflow-hidden"
              >
                <div
                  className={cn(
                    'flex border-b border-line-subtle',
                    phone ? 'items-start gap-3 px-4 py-4' : 'items-center gap-4 px-6 py-4',
                    'transition-colors duration-slow ease-standard',
                    settled ? 'bg-surface' : 'bg-accent-subtle/60',
                  )}
                >
                  <span className="relative flex shrink-0">
                    <IconTile
                      icon={settled ? ShieldExclamationIcon : PhoneIcon}
                      tone={settled ? 'emergency' : 'brand'}
                    />
                    {ringing && (
                      <span
                        aria-hidden
                        className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-accent motion-safe:animate-ping"
                      />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 truncate text-body font-medium text-ink">
                        {incomingCall.name}
                      </span>
                      {settled ? (
                        <>
                          <EnumStatusText value={incomingCall.outcome} />
                          <StatusText tone="brand">
                            {humanizeEnum('APPOINTMENT_REQUESTED')}
                          </StatusText>
                        </>
                      ) : (
                        <StatusText tone="info">{PHASE_LABEL[live]}</StatusText>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 break-words text-small text-ink-muted">
                      {PHASE_SUMMARY[live]}
                    </p>
                    {phone && (
                      <p className="font-num mt-2 flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-faint">
                        <span>{formatPhone(incomingCall.phone)}</span>
                        <span>{ringing ? 'Ringing' : clock(liveSeconds)}</span>
                        <span>{live === 'logged' ? incomingCall.at : PHASE_LABEL[live]}</span>
                      </p>
                    )}
                  </div>

                  {!phone && (
                    <>
                      <div className="shrink-0 text-right">
                        <p className="font-num text-small text-ink-muted">
                          {ringing ? '—' : clock(liveSeconds)}
                        </p>
                        <p className="mt-0.5 text-caption text-ink-faint">
                          {live === 'logged' ? incomingCall.at : PHASE_LABEL[live]}
                        </p>
                      </div>
                      <ChevronRightIcon className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!visible.length ? (
            <p className="px-6 py-10 text-center text-body text-ink-muted">
              No calls match “{search.trim()}”.
            </p>
          ) : (
            <StaggerList className="divide-y divide-line-subtle">
              {visible.map((call) => (
                <StaggerRow key={call.id}>
                  <div
                    className={cn(
                      'group flex transition-colors duration-fast hover:bg-surface-2',
                      phone ? 'items-start gap-3 px-4 py-4' : 'items-center gap-4 px-6 py-4',
                    )}
                  >
                    <IconTile
                      icon={call.isEmergency ? ShieldExclamationIcon : PhoneIcon}
                      tone={call.isEmergency ? 'emergency' : 'brand'}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="min-w-0 truncate text-body font-medium text-ink">
                          {call.name}
                        </span>
                        <EnumStatusText value={call.outcome} />
                        {/* The product renders a second Emergency label beside
                            the outcome, for the case where a call is flagged as
                            an emergency but resolved to something else. Here the
                            emergency fixture's outcome *is* `EMERGENCY`, so
                            printing both put the word on the row twice. */}
                        {call.isEmergency && call.outcome !== 'EMERGENCY' && (
                          <StatusText tone="danger">Emergency</StatusText>
                        )}
                      </div>
                      <p className="mt-0.5 line-clamp-2 break-words text-small text-ink-muted">
                        {call.summary}
                      </p>
                      {phone && (
                        <p className="font-num mt-2 flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-faint">
                          <span>{formatPhone(call.phone)}</span>
                          <span>{call.duration}</span>
                          <span>{call.at}</span>
                        </p>
                      )}
                    </div>
                    {/* Two lines, as the product has them. A third carrying the
                        phone number was the widest thing in this column and, at
                        342px, it took the width the caller's name needed —
                        "Dana Whitfield" truncated to "Dana W…" so a number
                        already shown on the Customers page could be repeated
                        here. */}
                    {!phone && (
                      <>
                        <div className="shrink-0 text-right">
                          <p className="font-num text-small text-ink-muted">{call.duration}</p>
                          <p className="mt-0.5 text-caption text-ink-faint">{call.at}</p>
                        </div>
                        <ChevronRightIcon
                          className="h-4 w-4 shrink-0 text-ink-faint opacity-0 transition-opacity duration-fast group-hover:opacity-100"
                          aria-hidden
                        />
                      </>
                    )}
                  </div>
                </StaggerRow>
              ))}
            </StaggerList>
          )}

          <Pagination
            pagination={{
              page: 1,
              limit: 20,
              totalRecords: live ? 1285 : 1284,
              totalPages: 65,
              hasNextPage: true,
              hasPreviousPage: false,
            }}
            onPageChange={() => undefined}
          />
        </Card>
      </Reveal>
    </div>
  );
}

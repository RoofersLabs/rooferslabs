import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { CONVERSATION } from './data';
import { ENTER, ROW } from './config';
import { Panel } from './Chrome';

/**
 * The waveform.
 *
 * Twelve bars on staggered CSS keyframes rather than a canvas or a JS loop:
 * this needs to keep moving at 60fps while React is mounting the rest of the
 * page, and a CSS animation runs off the main thread where a
 * requestAnimationFrame loop does not. It stops the moment the call resolves —
 * a waveform that keeps dancing after "call complete" is a lie about state.
 */
function Waveform({ live }: { live: boolean }) {
  return (
    <div className="flex h-4 items-center gap-[2px]" aria-hidden="true">
      {[0.55, 1, 0.4, 0.8, 0.6, 1, 0.45, 0.85, 0.5, 0.7].map((scale, index) => (
        <span
          key={index}
          className={cn(
            'w-[2px] origin-center rounded-full transition-[background-color,opacity] duration-300 ease-out',
            live ? 'bg-accent opacity-100' : 'bg-ink-quaternary opacity-50',
          )}
          style={{
            height: `${Math.round(scale * 16)}px`,
            // Delay lives inside the shorthand — pairing `animation` with a
            // separate `animationDelay` makes React warn on every rerender.
            animation: live
              ? `waveform ${760 + index * 60}ms ease-in-out ${index * 50}ms infinite`
              : undefined,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Lead qualification, shown resolving in real time.
 *
 * The transition from "Qualifying" to "Qualified" is the single most important
 * micro-interaction on the page: it is the product doing the judgement a human
 * receptionist would otherwise have to do.
 */
function LeadStatus({ qualified }: { qualified: boolean }) {
  return (
    <div className="flex items-center gap-2 border-t border-subtle px-3 py-2">
      <span className="text-[0.625rem] text-ink-quaternary">Lead</span>

      {/* Both states occupy the same grid cell, so the pill never changes width
          and nothing beside it shifts as the label swaps. */}
      <span className="grid">
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={qualified ? 'yes' : 'no'}
            initial={{ opacity: 0, filter: 'blur(3px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.12 } }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className={cn(
              'col-start-1 row-start-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[0.625rem] font-medium',
              qualified
                ? 'border-accent/30 bg-accent/10 text-accent'
                : 'border-subtle bg-white/[0.04] text-ink-tertiary',
            )}
          >
            {qualified ? 'Qualified · insurance eligible' : 'Qualifying…'}
          </motion.span>
        </AnimatePresence>
      </span>

      <span className="ml-auto shrink-0 font-mono text-[0.625rem] text-ink-quaternary">
        02:14
      </span>
    </div>
  );
}

/**
 * The centrepiece panel: an AI call in progress, transcribed as it happens.
 *
 * Every turn is rendered from the start and only its opacity and offset
 * animate, so the panel's height is fixed by construction — lines arriving can
 * never push the panels beneath them.
 */
export function LiveCallPanel({ step, qualified }: { step: number; qualified: boolean }) {
  const live = step < CONVERSATION.length;

  return (
    <Panel
      title="Live call"
      action={
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            {live && (
              <span
                className="absolute inset-0 rounded-full bg-accent"
                style={{ animation: 'pulse-ring 1.8s var(--ease-out) infinite' }}
              />
            )}
            <span
              className={cn(
                'relative h-1.5 w-1.5 rounded-full transition-colors duration-300 ease-out',
                live ? 'bg-accent' : 'bg-emerald-400',
              )}
            />
          </span>
          <span className="text-[0.625rem] text-ink-tertiary">
            {live ? 'In progress' : 'Resolved'}
          </span>
        </span>
      }
      className="min-h-0"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2.5 border-b border-subtle px-3 py-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-subtle bg-white/[0.04] text-[0.5625rem] font-medium text-ink-secondary">
            MB
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.6875rem] font-medium">Marcus Bell</p>
            <p className="truncate font-mono text-[0.5625rem] text-ink-quaternary">
              (216) 555-0148 · Parma, OH
            </p>
          </div>
          <div className="ml-auto">
            <Waveform live={live} />
          </div>
        </div>

        {/* Bottom-anchored. When the transcript outgrows the panel the OLDEST
            turns clip off the top, which is how a live transcript behaves —
            top-anchoring would clip the newest line, the one that matters. */}
        <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5 overflow-hidden px-3 py-2.5">
          {CONVERSATION.map((turn, index) => (
            <motion.div
              key={turn.id}
              variants={ROW}
              initial="hidden"
              animate={step > index ? 'shown' : 'hidden'}
              transition={ENTER}
              className={cn('flex', turn.from === 'ai' ? 'justify-start' : 'justify-end')}
            >
              <p
                className={cn(
                  'max-w-[86%] rounded-md px-2 py-1.5 text-[0.6875rem] leading-snug',
                  turn.from === 'ai'
                    ? 'bg-white/[0.055] text-ink'
                    : 'border border-subtle text-ink-secondary',
                )}
              >
                {turn.text}
              </p>
            </motion.div>
          ))}
        </div>

        <LeadStatus qualified={qualified} />
      </div>
    </Panel>
  );
}

import { useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Container } from '../components/Container';
import { Reveal } from '../components/Reveal';

// The six capabilities that carry the pitch, in the order a call flows through
// them. Trimmed from eight so each column gets the width its heading and detail
// need to breathe.
const CAPABILITIES = [
  {
    label: 'Answer',
    title: 'Answers every call',
    detail: "Picks up in your company's name, even after hours, weekends, and storm nights.",
  },
  {
    label: 'Qualify',
    title: 'Qualifies homeowners',
    detail: 'Captures job type, address, urgency, roof age, and service-area fit consistently.',
  },
  {
    label: 'Book',
    title: 'Books appointments',
    detail: 'Offers real calendar openings and holds the slot before the caller hangs up.',
  },
  {
    label: 'Detect',
    title: 'Detects emergencies',
    detail: 'Identifies active leaks and storm damage so urgent calls never wait in the queue.',
  },
  {
    label: 'Route',
    title: 'Transfers urgent calls',
    detail: 'Escalates the calls that need a person, with context already attached.',
  },
  {
    label: 'Sync',
    title: 'Syncs with CRM',
    detail: 'Sends summaries, recordings, contact details, and lead status where your team works.',
  },
] as const;

const BAR_COUNT = 256;
const BAR_INDEXES = Array.from({ length: BAR_COUNT }, (_, index) => index);
const IDLE_OPACITY = 0.08;
const ACTIVE_OPACITY = 0.14;
// Tuned so the hovered column peaks just under the ceiling — a full, clean bell
// rather than a clipped plateau of spikes.
const ACTIVE_GAIN = 0.92;
const PEAK_CEILING = 1.06;

function restScale(index: number) {
  return 0.16 + Math.sin(index * 0.71) * 0.04 + Math.sin(index * 0.17) * 0.03;
}

export function CapabilitiesTimeline() {
  const reduced = useReducedMotion();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const frameRef = useRef(0);
  const animateRef = useRef<() => void>(() => undefined);
  const targetRef = useRef({ x: 0, intensity: 0 });
  const currentRef = useRef({ x: 0, intensity: 0 });

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const paint = (time = 0) => {
      const width = Math.max(1, surface.clientWidth);
      // One column-width of standard deviation, so the bell peaks over the
      // hovered column and eases cleanly into its immediate neighbours.
      const sigma = Math.max(160, width / (CAPABILITIES.length * 0.9));
      const target = targetRef.current;
      const current = currentRef.current;

      current.x += (target.x - current.x) * 0.12;
      current.intensity += (target.intensity - current.intensity) * 0.11;

      barRefs.current.forEach((bar, index) => {
        if (!bar) return;

        const position = ((index + 0.5) / BAR_COUNT) * width;
        const distance = position - current.x;
        const falloff = Math.exp(-(distance * distance) / (2 * sigma * sigma));
        // A gentle, slow shimmer only — enough to read as a live signal without
        // fracturing the envelope into random spikes.
        const voice = 0.95 + Math.sin(index * 0.35 + time * 0.0026) * 0.05;
        const height = Math.min(
          PEAK_CEILING,
          restScale(index) + falloff * current.intensity * ACTIVE_GAIN * voice,
        );
        const opacity = IDLE_OPACITY + falloff * current.intensity * ACTIVE_OPACITY;

        bar.style.transform = `translateZ(0) scaleY(${height.toFixed(3)})`;
        bar.style.opacity = opacity.toFixed(3);
      });

      if (Math.abs(current.intensity - target.intensity) > 0.002 || target.intensity > 0.002) {
        frameRef.current = window.requestAnimationFrame(paint);
      } else {
        frameRef.current = 0;
      }
    };

    animateRef.current = () => {
      if (reduced || frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(paint);
    };

    const resizeObserver = new ResizeObserver(() => {
      if (frameRef.current) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
      }
      paint();
    });
    resizeObserver.observe(surface);
    paint();

    return () => {
      resizeObserver.disconnect();
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      animateRef.current = () => undefined;
    };
  }, [reduced]);

  const animateAt = (clientX: number, intensity = 1) => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), surface.clientWidth);
    if (!frameRef.current && currentRef.current.intensity < 0.002) currentRef.current.x = x;

    targetRef.current.x = x;
    targetRef.current.intensity = intensity;

    if (reduced) return;
    animateRef.current();
  };

  const activateColumn = (index: number) => {
    const surface = surfaceRef.current;
    if (!surface) return;

    animateAt(
      surface.getBoundingClientRect().left +
        ((index + 0.5) / CAPABILITIES.length) * surface.clientWidth,
    );
  };

  const reset = () => {
    targetRef.current.intensity = 0;
    animateRef.current();
  };

  return (
    <section id="capabilities" className="scroll-mt-24 py-[72px] sm:py-32">
      <Container>
        <Reveal>
          <div className="max-w-[760px]">
            <h2 className="text-balance text-[clamp(1.85rem,4.8vw,4rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
              <span className="block text-white">Calls answered</span>
              <span className="block text-white/70">Leads captured</span>
            </h2>
            <p className="mt-6 max-w-[52ch] text-[15px] leading-[1.65] text-mk-secondary sm:text-[17px]">
              RoofersLabs turns calls into booked work, emergency context, and clean follow-up
              records without adding another person to the phones.
            </p>
            <a
              href="#capability-list"
              className="mt-8 inline-flex text-[13.5px] font-medium text-white/80 transition-colors duration-200 ease-smooth hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black"
            >
              View capabilities&nbsp;&rarr;
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.08} className="mt-14 sm:mt-16">
          <div
            role="region"
            aria-label="RoofersLabs capabilities"
            tabIndex={0}
            className="-mx-6 overflow-x-auto overscroll-x-contain px-6 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-accent-ring focus-visible:ring-offset-4 focus-visible:ring-offset-black sm:-mx-8 sm:px-8 lg:mx-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            <div
              id="capability-list"
              ref={surfaceRef}
              onPointerMove={(event) =>
                animateAt(event.clientX, event.pointerType === 'touch' ? 0.9 : 1)
              }
              onPointerDown={(event) => animateAt(event.clientX, 1)}
              onPointerLeave={reset}
              onPointerCancel={reset}
              onBlur={reset}
              className="min-w-[1140px] lg:min-w-0"
            >
              {/* The waveform is the section's interactive header: a full-width
                  audio signal that peaks over whichever column is hovered. */}
              <div
                aria-hidden="true"
                className="grid h-32 grid-cols-[repeat(256,minmax(0,1fr))] items-end overflow-hidden border-b border-mk-line py-5 sm:h-36"
              >
                {BAR_INDEXES.map((index) => (
                  <span
                    key={index}
                    ref={(element) => {
                      barRefs.current[index] = element;
                    }}
                    className="block h-full w-px origin-bottom justify-self-center bg-white opacity-[0.08] will-change-transform"
                    style={{ transform: `translateZ(0) scaleY(${restScale(index).toFixed(3)})` }}
                  />
                ))}
              </div>

              <div className="mt-12 grid grid-cols-[repeat(6,minmax(0,1fr))] border-y border-mk-line sm:mt-16">
                {CAPABILITIES.map((item, index) => (
                  <article
                    key={item.title}
                    onPointerEnter={() => activateColumn(index)}
                    className="flex min-h-[288px] flex-col border-r border-mk-line px-8 py-11 outline-none last:border-r-0 xl:px-9 xl:py-12"
                  >
                    <p className="font-num text-[11px] font-medium uppercase tracking-[0.09em] text-mk-muted">
                      {item.label}
                    </p>
                    <h3 className="mt-9 min-h-[2.5em] text-[22px] font-semibold leading-[1.15] tracking-[-0.025em] text-white sm:text-[23px]">
                      {item.title}
                    </h3>
                    <p className="mt-4 text-[14.5px] leading-[1.65] text-mk-secondary">
                      {item.detail}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

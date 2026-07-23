import { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Container } from '../components/Container';
import { ProductShowcase } from '../dashboard/ProductShowcase';
import { EASE_SMOOTH } from '../motion';

type AudioLayer = {
  gap: number;
  width: number;
  opacity: number;
  center: number;
  pathAmplitude: number;
  secondaryAmplitude: number;
  wavelength: number;
  secondaryWavelength: number;
  drift: number;
  travel: number;
  phase: number;
  baseHeight: number;
  voiceHeight: number;
  voiceRate: number;
  clusterRate: number;
};

const AUDIO_LAYERS: AudioLayer[] = [
  {
    gap: 5.2,
    width: 1,
    opacity: 0.06,
    center: 0.32,
    pathAmplitude: 0.075,
    secondaryAmplitude: 0.018,
    wavelength: 360,
    secondaryWavelength: 137,
    drift: 0.28,
    travel: 19,
    phase: 0.7,
    baseHeight: 7,
    voiceHeight: 46,
    voiceRate: 1.25,
    clusterRate: 0.62,
  },
  {
    gap: 4.6,
    width: 1.15,
    opacity: 0.085,
    center: 0.45,
    pathAmplitude: 0.06,
    secondaryAmplitude: 0.026,
    wavelength: 285,
    secondaryWavelength: 172,
    drift: -0.34,
    travel: 25,
    phase: 2.6,
    baseHeight: 9,
    voiceHeight: 58,
    voiceRate: 1.55,
    clusterRate: 0.78,
  },
  {
    gap: 5.8,
    width: 1,
    opacity: 0.05,
    center: 0.58,
    pathAmplitude: 0.085,
    secondaryAmplitude: 0.016,
    wavelength: 430,
    secondaryWavelength: 221,
    drift: 0.2,
    travel: 14,
    phase: 4.1,
    baseHeight: 6,
    voiceHeight: 38,
    voiceRate: 1.05,
    clusterRate: 0.54,
  },
  {
    gap: 6.4,
    width: 0.9,
    opacity: 0.04,
    center: 0.71,
    pathAmplitude: 0.045,
    secondaryAmplitude: 0.022,
    wavelength: 520,
    secondaryWavelength: 188,
    drift: -0.18,
    travel: 11,
    phase: 5.4,
    baseHeight: 5,
    voiceHeight: 30,
    voiceRate: 0.9,
    clusterRate: 0.46,
  },
];

function voiceSample(index: number, time: number, layer: AudioLayer) {
  const carrier =
    Math.sin(index * 0.53 + time * layer.voiceRate + layer.phase) * 0.52 +
    Math.sin(index * 0.19 - time * (layer.voiceRate * 0.72) + layer.phase * 1.7) * 0.34 +
    Math.sin(index * 1.31 + time * 0.38 + layer.phase * 0.4) * 0.14;
  const phrase =
    0.38 +
    0.62 *
      Math.pow(
        0.5 + 0.5 * Math.sin(index * 0.047 - time * layer.clusterRate + layer.phase),
        1.9,
      );
  const breath =
    0.74 +
    0.26 * Math.sin(index * 0.013 + time * (layer.clusterRate * 0.41) + layer.phase * 2.3);

  return Math.max(0.08, Math.min(1, Math.abs(carrier) * phrase * breath));
}

function HeroAudioField({ reduced }: { reduced: boolean | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const draw = (now: number) => {
      const time = reduced ? 14 : now * 0.001;

      context.clearRect(0, 0, width, height);
      context.lineCap = 'round';

      for (const layer of AUDIO_LAYERS) {
        const offset = reduced ? 0 : -((time * layer.travel) % layer.gap);

        context.beginPath();
        context.strokeStyle = `rgba(255,255,255,${layer.opacity})`;
        context.lineWidth = layer.width;

        for (let x = -layer.gap * 4 + offset; x <= width + layer.gap * 4; x += layer.gap) {
          const index = (x + time * layer.travel) / layer.gap;
          const path =
            Math.sin(x / layer.wavelength + time * layer.drift + layer.phase) *
              height *
              layer.pathAmplitude +
            Math.sin(x / layer.secondaryWavelength - time * layer.drift * 0.7 + layer.phase) *
              height *
              layer.secondaryAmplitude;
          const centerY = height * layer.center + path;
          const edge = Math.min(1, Math.max(0, x / (width * 0.12), (width - x) / (width * 0.12)));
          const sample = voiceSample(index, time, layer);
          const barHeight = (layer.baseHeight + sample * layer.voiceHeight) * edge;

          context.moveTo(x, centerY - barHeight / 2);
          context.lineTo(x, centerY + barHeight / 2);
        }

        context.stroke();
      }

      if (!reduced) frame = window.requestAnimationFrame(draw);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      draw(performance.now());
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-[-10%] top-14 z-0 h-[calc(100%-3.5rem)] min-h-[720px] w-[120%] opacity-100"
    />
  );
}

/**
 * The first screen. The copy earns roughly the top third and the product takes
 * the rest — the promise is easier to believe once you can see the thing that
 * makes it.
 */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });

  // A few percent of drift, so the preview settles behind the copy as the page
  // moves. Any more than this and it stops being parallax and starts being an
  // effect.
  const previewY = useTransform(scrollYProgress, [0, 1], ['0%', '6%']);
  const previewOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.35]);

  return (
    <section ref={ref} className="relative flex min-h-[100svh] flex-col overflow-hidden pt-16">
      <HeroAudioField reduced={reduced} />

      <Container className="relative z-10 flex flex-1 flex-col">
        <div className="max-w-[610px] pb-8 pt-16 text-left sm:pt-24 lg:pt-28">
          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_SMOOTH }}
            className="mb-5 text-[12px] font-medium uppercase tracking-[0.14em] text-white/55"
          >
            AI receptionist for roofing teams
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_SMOOTH, delay: 0.04 }}
            className="max-w-[11.5ch] text-balance text-[clamp(2.45rem,5vw,3.85rem)] font-semibold leading-[1.01] tracking-[-0.035em] text-white"
          >
            <span className="block">Every missed call</span>
            <span className="block">is lost revenue.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: reduced ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE_SMOOTH, delay: 0.12 }}
            className="mt-5 max-w-[46ch] text-pretty text-[16px] leading-[1.65] text-mk-secondary sm:text-[17px]"
          >
            RoofersLabs answers roofing calls, qualifies homeowners, books appointments, and
            captures urgent leads before they move on.
          </motion.p>
        </div>

        <motion.div
          // Scroll-driven values must own their own element: a motion value in
          // `style` outranks `animate`, so the entrance below gets its own node.
          style={reduced ? undefined : { y: previewY, opacity: previewOpacity }}
          className="min-h-[560px] flex-1 pb-10 sm:pb-12"
        >
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE_SMOOTH, delay: 0.2 }}
            className="h-full"
          >
            <ProductShowcase />
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}

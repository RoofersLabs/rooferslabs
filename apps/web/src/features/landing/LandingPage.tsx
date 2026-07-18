import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  Phone,
  Zap,
  CalendarClock,
  FileText,
  ShieldAlert,
  Bell,
  ArrowRight,
  CheckCircle2,
  Star,
  Clock,
  ShieldCheck,
} from 'lucide-react';

/* ── Motion helpers (respect prefers-reduced-motion via useReducedMotion) ── */
function useReveal(): Variants {
  const reduced = useReducedMotion();
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0, 0, 0.2, 1] } },
  };
}
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const revealViewport = { once: true, amount: 0.3 } as const;

/* ── Content ──────────────────────────────────────────────────────────── */
const features = [
  {
    icon: Phone,
    title: 'Every call answered',
    body: 'Your AI receptionist picks up 24/7 — during jobs, after hours, and on weekends. No more voicemail.',
  },
  {
    icon: Zap,
    title: 'Leads qualified instantly',
    body: 'Names, numbers, addresses, and job details — captured and qualified while the caller is still on the line.',
  },
  {
    icon: ShieldAlert,
    title: 'Emergencies flagged',
    body: 'Active leaks and storm damage are detected in real time and escalated to your team immediately.',
  },
  {
    icon: CalendarClock,
    title: 'Appointments requested',
    body: 'Callers book inspections and estimates in conversation. You confirm the time that works.',
  },
  {
    icon: FileText,
    title: 'Summaries & transcripts',
    body: 'Every conversation arrives as a clean summary with the full transcript and extracted details.',
  },
  {
    icon: Bell,
    title: 'Instant notifications',
    body: 'Know the moment a hot lead or emergency call comes in — on your phone, wherever you are.',
  },
];

const stats = [
  { value: '24/7', label: 'Calls answered' },
  { value: '0.8s', label: 'Avg. pickup time' },
  { value: '100%', label: 'Leads documented' },
  { value: '0', label: 'Missed jobs' },
];

const steps = [
  {
    n: '01',
    title: 'Forward your line',
    desc: 'Point your business number to RoofersLabs in under five minutes — keep your existing number.',
  },
  {
    n: '02',
    title: 'AI answers and qualifies',
    desc: 'Callers are greeted, triaged, and routed. Emergencies are flagged and escalated instantly.',
  },
  {
    n: '03',
    title: 'You get the job, not the voicemail',
    desc: 'Bookings and lead details land in your dashboard, ready to work — nothing falls through.',
  },
];

export function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const reveal = useReveal();
  if (isLoaded && isSignedIn) return <Navigate to="/dashboard" replace />;

  return (
    <div data-theme="dark" className="min-h-screen bg-base text-ink">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line-subtle bg-[color-mix(in_oklab,var(--bg-base)_82%,transparent)] backdrop-blur">
        <div className="mx-auto flex h-16 max-w-marketing items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-ink-on-brand">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-h5 font-bold tracking-tight">RoofersLabs</span>
          </div>
          <nav className="flex items-center gap-2 sm:gap-4">
            <a
              href="#features"
              className="hidden rounded-md px-3 py-2 text-small text-ink-muted transition-colors hover:text-ink sm:block"
            >
              Product
            </a>
            <a
              href="#how"
              className="hidden rounded-md px-3 py-2 text-small text-ink-muted transition-colors hover:text-ink sm:block"
            >
              How it works
            </a>
            <Link
              to="/sign-in"
              className="focus-ring rounded-md px-3 py-2 text-small font-medium text-ink-muted transition-colors hover:text-ink"
            >
              Log in
            </Link>
            <Link
              to="/sign-up"
              className="focus-ring rounded-md bg-accent px-4 py-2 text-small font-semibold text-ink-on-brand shadow-button transition-all duration-fast hover:bg-accent-hover active:scale-[0.98]"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* clay glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 h-[560px] w-[560px] rounded-full opacity-60 blur-2xl"
          style={{
            background: 'radial-gradient(circle, oklch(0.58 0.11 37 / 0.35), transparent 70%)',
          }}
        />
        <div className="mx-auto grid max-w-marketing items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <motion.div initial="hidden" animate="show" variants={stagger}>
            <motion.p
              variants={reveal}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-accent-border bg-accent-subtle px-3.5 py-1.5 text-caption font-medium text-accent"
            >
              <Zap className="h-3.5 w-3.5" aria-hidden />
              r1 echo — early access for roofing companies
            </motion.p>
            <motion.h1
              variants={reveal}
              className="text-balance text-[2.6rem] font-bold leading-[1.08] tracking-tight sm:text-hero"
            >
              Never lose a roofing job because{' '}
              <span className="text-accent">nobody answered the phone</span>
            </motion.h1>
            <motion.p variants={reveal} className="mt-6 max-w-xl text-body-lg text-ink-muted">
              RoofersLabs is the AI front office built exclusively for roofers. It answers every
              inbound call, qualifies the lead, detects emergencies, and books the appointment —
              while you’re on the roof.
            </motion.p>
            <motion.div
              variants={reveal}
              className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
            >
              <Link
                to="/sign-up"
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-body font-semibold text-ink-on-brand shadow-button transition-all duration-fast hover:bg-accent-hover active:scale-[0.98]"
              >
                Start answering every call
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <p className="text-small text-ink-faint">Keep your number. Set up in minutes.</p>
            </motion.div>
          </motion.div>

          <HeroCollage />
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-line-subtle bg-surface-1">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={revealViewport}
          variants={stagger}
          className="mx-auto grid max-w-marketing grid-cols-2 gap-px px-6 py-10 sm:grid-cols-4"
        >
          {stats.map((s) => (
            <motion.div key={s.label} variants={reveal} className="px-2 text-center">
              <div className="font-num text-h2 text-ink">{s.value}</div>
              <div className="mt-1 text-small text-ink-faint">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Feature grid */}
      <section id="features" className="py-20 lg:py-28">
        <div className="mx-auto max-w-marketing px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            variants={reveal}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="text-label uppercase tracking-wider text-accent">What it does</p>
            <h2 className="mt-3 text-balance text-h2 text-ink">
              A full-time receptionist, minus the payroll
            </h2>
            <p className="mt-4 text-body-lg text-ink-muted">
              Every capability a roofing front office needs, handled the moment the phone rings.
            </p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            variants={stagger}
            className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {features.map((feature) => (
              <motion.div
                key={feature.title}
                variants={reveal}
                className="group rounded-xl border border-line-subtle bg-surface-1 p-6 transition-all duration-base ease-standard hover:-translate-y-1 hover:border-line hover:shadow-lg"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                  <feature.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-h5 text-ink">{feature.title}</h3>
                <p className="mt-2 text-body text-ink-muted">{feature.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Emergency highlight */}
      <section className="border-t border-line-subtle bg-surface-1 py-20 lg:py-28">
        <div className="mx-auto grid max-w-marketing items-center gap-12 px-6 lg:grid-cols-2">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            variants={reveal}
          >
            <p className="text-label uppercase tracking-wider text-emergency">Emergencies first</p>
            <h2 className="mt-3 text-balance text-h2 text-ink">
              Storm damage gets triaged the moment it’s reported
            </h2>
            <p className="mt-4 text-body-lg text-ink-muted">
              The AI recognizes urgency in the caller’s words and pages your on-call crew
              immediately — with the address, issue, and callback number already attached. No
              dispatcher required.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                'Active leaks and storm damage detected in real time',
                'On-call crew paged automatically with full context',
                'Caller kept calm and reassured while help is dispatched',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-body text-ink-muted">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            variants={reveal}
          >
            <EmergencyMock />
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 lg:py-28">
        <div className="mx-auto max-w-marketing px-6">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            variants={reveal}
            className="mx-auto max-w-2xl text-center"
          >
            <p className="text-label uppercase tracking-wider text-accent">How it works</p>
            <h2 className="mt-3 text-h2 text-ink">Live in three steps</h2>
          </motion.div>
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={revealViewport}
            variants={stagger}
            className="mt-14 grid gap-6 md:grid-cols-3"
          >
            {steps.map((step) => (
              <motion.div
                key={step.n}
                variants={reveal}
                className="relative rounded-xl border border-line-subtle bg-surface-1 p-6"
              >
                <span className="font-num text-h3 text-accent">{step.n}</span>
                <h3 className="mt-3 text-h5 text-ink">{step.title}</h3>
                <p className="mt-2 text-body text-ink-muted">{step.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="border-t border-line-subtle py-20">
        <motion.figure
          initial="hidden"
          whileInView="show"
          viewport={revealViewport}
          variants={reveal}
          className="mx-auto max-w-narrow px-6 text-center"
        >
          <div className="flex justify-center gap-1 text-accent">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-5 w-5 fill-current" aria-hidden />
            ))}
          </div>
          <blockquote className="mt-6 text-balance text-h4 font-medium leading-relaxed text-ink">
            “We were losing two or three jobs a week to voicemail. Since we switched, every call
            gets answered and the emergency ones reach me before I’ve even put my tools down.”
          </blockquote>
          <figcaption className="mt-6 text-small text-ink-muted">
            <span className="font-medium text-ink">Marcus Webb</span> · Owner, Webb &amp; Sons
            Roofing
          </figcaption>
        </motion.figure>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-24">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={revealViewport}
          variants={reveal}
          className="relative mx-auto max-w-marketing overflow-hidden rounded-2xl border border-line bg-surface-1 px-6 py-16 text-center"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-[520px] rounded-full opacity-50 blur-2xl"
            style={{
              background: 'radial-gradient(circle, oklch(0.58 0.11 37 / 0.4), transparent 70%)',
            }}
          />
          <h2 className="relative text-balance text-h2 text-ink">
            Answer every call starting today
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-body-lg text-ink-muted">
            Join the early access program and never send another roofing lead to voicemail.
          </p>
          <div className="relative mt-8 flex justify-center">
            <Link
              to="/sign-up"
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3.5 text-body font-semibold text-ink-on-brand shadow-button transition-all duration-fast hover:bg-accent-hover active:scale-[0.98]"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Join the early access program
            </Link>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-line-subtle py-8">
        <div className="mx-auto flex max-w-marketing flex-col items-center justify-between gap-3 px-6 text-caption text-ink-faint sm:flex-row">
          <span>© {new Date().getFullYear()} RoofersLabs. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Answering calls 24 hours a day
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ── Hero collage: floating product cards over the clay glow ─────────────── */
function HeroCollage() {
  const reduced = useReducedMotion();
  const float = (delay: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 24, scale: 0.96 },
          animate: { opacity: 1, y: 0, scale: 1 },
          transition: { duration: 0.6, delay, ease: [0, 0, 0.2, 1] as const },
        };

  return (
    <div className="relative mx-auto hidden h-[440px] w-full max-w-[460px] lg:block">
      {/* Incoming call */}
      <motion.div
        {...float(0.1)}
        className="absolute left-2 top-2 w-52 -rotate-2 rounded-xl border border-line-subtle bg-surface-1 p-4 shadow-card"
      >
        <div className="mb-2.5 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emergency" />
          <span className="text-caption text-ink-faint">Incoming call</span>
        </div>
        <div className="text-body font-semibold text-ink">Unknown number</div>
        <div className="mt-0.5 text-small text-ink-faint">Austin, TX</div>
        <div className="mt-3 flex h-5 items-end gap-1">
          {[6, 12, 8, 16, 10, 14, 7, 11].map((h, i) => (
            <span key={i} className="w-1 rounded-sm bg-accent" style={{ height: `${h}px` }} />
          ))}
        </div>
      </motion.div>

      {/* Conversation + emergency */}
      <motion.div
        {...float(0.25)}
        className="absolute left-24 top-14 w-72 rounded-xl border border-line bg-surface-1 p-5 shadow-dialog"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emergency-border bg-emergency-subtle px-2.5 py-0.5 text-caption font-medium text-emergency">
          <span className="h-1.5 w-1.5 rounded-full bg-emergency" />
          Emergency detected
        </span>
        <div className="mt-3.5 space-y-2.5">
          <Bubble who="C">
            “My roof is leaking badly — water’s coming into the attic right now.”
          </Bubble>
          <Bubble who="AI">
            I’m so sorry to hear that. Let’s get someone out today — can I confirm your address?
          </Bubble>
        </div>
      </motion.div>

      {/* Appointment booked */}
      <motion.div
        {...float(0.4)}
        className="absolute bottom-2 left-40 w-56 rotate-2 rounded-xl border border-line-subtle bg-surface-1 p-4 shadow-card"
      >
        <div className="mb-2 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-accent" aria-hidden />
          <span className="text-caption text-ink-faint">Appointment booked</span>
        </div>
        <div className="font-num text-body font-semibold text-ink">Fri, Jul 24 · 9:00 AM</div>
        <div className="mt-0.5 mb-2.5 text-small text-ink-faint">Janet Kowalski — 123 Oak St.</div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-border bg-success-subtle px-2.5 py-0.5 text-caption font-medium text-success">
          Confirmed
        </span>
      </motion.div>

      {/* Notification */}
      <motion.div
        {...float(0.55)}
        className="absolute right-0 top-2 flex w-48 items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3.5 py-3 shadow-lg"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent">
          <Bell className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <div className="text-caption font-semibold text-ink">Crew lead notified</div>
          <div className="text-caption text-ink-faint">Just now</div>
        </div>
      </motion.div>
    </div>
  );
}

function Bubble({ who, children }: { who: 'AI' | 'C'; children: React.ReactNode }) {
  const isAI = who === 'AI';
  return (
    <div className="flex items-start gap-2">
      <span
        className={
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ' +
          (isAI ? 'bg-accent-subtle text-accent' : 'bg-surface-3 text-ink-muted')
        }
      >
        {isAI ? 'AI' : 'J'}
      </span>
      <div
        className={
          'max-w-[220px] rounded-md px-3 py-2 text-small leading-snug text-ink ' +
          (isAI ? 'bg-surface-2' : 'border border-line-subtle')
        }
      >
        {children}
      </div>
    </div>
  );
}

function EmergencyMock() {
  return (
    <div className="rounded-2xl border border-line-subtle bg-surface-1 p-6 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-body font-semibold text-ink">Storm damage — 123 Oak St.</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emergency-border bg-emergency-subtle px-2.5 py-0.5 text-caption font-medium text-emergency">
          <span className="h-1.5 w-1.5 rounded-full bg-emergency" />
          Emergency
        </span>
      </div>
      <p className="mt-3.5 text-body text-ink-muted">
        On-call crew lead paged automatically — no dispatcher required.
      </p>
      <div className="mt-5 flex items-center gap-3 border-t border-line-subtle pt-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-subtle text-caption font-semibold text-accent">
          MW
        </span>
        <span className="text-small text-ink-faint">Marcus Webb accepted · ETA 34 min</span>
      </div>
    </div>
  );
}

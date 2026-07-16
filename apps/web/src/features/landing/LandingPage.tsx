import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import {
  Phone,
  Zap,
  CalendarClock,
  FileText,
  ShieldAlert,
  Bell,
  HardHat,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

const features = [
  {
    icon: Phone,
    title: 'Every call answered',
    body: 'Your AI receptionist picks up 24/7 — during jobs, after hours, and on weekends. No more voicemail.',
  },
  {
    icon: Zap,
    title: 'Leads qualified instantly',
    body: 'Names, numbers, addresses, and the job details — captured and qualified while the caller is still on the line.',
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

const steps = [
  'Create your account and company profile',
  'Teach the AI about your services, areas, and pricing',
  'Forward your existing business number',
  'Every call is answered, qualified, and documented',
];

export function LandingPage() {
  const { isSignedIn, isLoaded } = useAuth();
  if (isLoaded && isSignedIn) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600">
            <HardHat className="h-5 w-5 text-white" aria-hidden />
          </span>
          <span className="text-lg font-bold">RoofersLabs</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            to="/sign-in"
            className="focus-ring rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            Log in
          </Link>
          <Link
            to="/sign-up"
            className="focus-ring rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-4 py-1.5 text-xs font-medium text-brand-300">
          <Zap className="h-3.5 w-3.5" aria-hidden />
          r1 echo — early access for roofing companies
        </p>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Never lose a roofing job because{' '}
          <span className="text-brand-400">nobody answered the phone</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-400">
          RoofersLabs is the AI front office built exclusively for roofers. It answers every inbound
          call, qualifies the lead, detects emergencies, and books the appointment — while you’re on
          the roof.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/sign-up"
            className="focus-ring inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-brand-500"
          >
            Start answering every call
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="text-sm text-slate-500">Keep your existing number. Set up in minutes.</p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-slate-800 bg-slate-900/50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">
            A full-time receptionist, minus the payroll
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
              >
                <feature.icon className="h-6 w-6 text-brand-400" aria-hidden />
                <h3 className="mt-4 text-base font-semibold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">Live in four steps</h2>
          <ol className="mt-10 space-y-4">
            {steps.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-300">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex justify-center">
            <Link
              to="/sign-up"
              className="focus-ring inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-500"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Join the early access program
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} RoofersLabs. All rights reserved.
      </footer>
    </div>
  );
}

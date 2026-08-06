import { useEffect } from 'react';
import { UserButton } from '@clerk/clerk-react';
import { CompanyStatus } from '@rooferslabs/shared';
import { useAccess } from '@/auth/AccessProvider';
import { MARKETING_ROUTES } from '@/marketing/routes';
import { USER_BUTTON_APPEARANCE } from '@/lib/clerk-appearance';
import { formatDateTime } from '@/lib/utils';
import { StandaloneLayout } from '@/layouts/StandaloneLayout';
import { Badge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { IconTile } from '@/components/ui/IconTile';
import { Spinner } from '@/components/ui/spinner';
import {
  ArrowPathIcon,
  ClockIcon,
  LifebuoyIcon,
  PauseCircleIcon,
} from '@heroicons/react/24/outline';

/**
 * How often the page asks whether anything changed.
 *
 * Forty-five seconds is chosen against what the tenant is actually waiting for:
 * a person reading an email and clicking a button, which happens on a scale of
 * minutes to hours. Polling faster would not shorten that wait by a measurable
 * amount; it would only multiply requests from every account in the queue. A
 * tenant in a hurry has the Refresh button, which is instant.
 */
const POLL_INTERVAL_MS = 45_000;

/** What each state of the wall says. Copy in one place, not spread through JSX. */
const COPY = {
  [CompanyStatus.PENDING_APPROVAL]: {
    icon: ClockIcon,
    // Two tone names for one hue: `Badge` calls red "danger" and `IconTile`
    // calls it "emergency". Naming both here is honest about the split rather
    // than papering over it — collapsing the two vocabularies is a change to
    // the design system, not to this page.
    iconTone: 'warning' as const,
    badgeTone: 'warning' as const,
    badge: 'Awaiting approval',
    title: 'Your account is awaiting approval',
    body: 'Our team is reviewing your account. You’ll receive access as soon as your account has been approved.',
    // Setup really is finished, and saying so matters: without it the screen
    // reads as "something is still required of you", and the tenant goes
    // looking for a form that does not exist.
    note: 'Your setup is complete — there is nothing more for you to do.',
  },
  [CompanyStatus.PAUSED]: {
    icon: PauseCircleIcon,
    iconTone: 'emergency' as const,
    badgeTone: 'danger' as const,
    badge: 'Paused',
    title: 'Your rooferslabs account has been temporarily paused',
    body: 'Access to your dashboard has been suspended. Your data, call history, and settings are all safe and will be exactly as you left them when access is restored.',
    note: 'Please contact support and we’ll help get you running again.',
  },
} as const;

/**
 * The approval wall — the only page a tenant behind it can reach.
 *
 * One route serves both states because they are one routing fact: the tenant may
 * see nothing else. What differs is the sentence, and a tenant paused after six
 * months of use must not be told they are "awaiting approval" — so the copy is
 * selected from the live status rather than from the URL.
 *
 * Nothing here is a security boundary. The API refuses every tenant-scoped
 * request from an unapproved account on its own; deleting this component from
 * the bundle would produce a blank screen, not an open one. What it is for is
 * telling a person what happened and giving them the two things they can
 * actually do: wait, or ask.
 */
export function AccountStatusPage() {
  const access = useAccess();
  const company = access.company;

  // Poll, so an approval lands on the screen without anyone reloading. Refetching
  // the session re-derives the stage; `RouteGuard` then moves the browser to the
  // dashboard on the very next render. This page never navigates itself — there
  // is one place in the application that decides where a visitor goes, and it is
  // not here.
  useEffect(() => {
    const timer = window.setInterval(access.retry, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [access.retry]);

  // The session is still resolving, or a status arrived that this page has no
  // copy for. Either way the guard is about to move on; a spinner is the honest
  // thing to show for the frame in between.
  const copy = company && (COPY[company.status as keyof typeof COPY] ?? null);
  if (!company || !copy) {
    return (
      <StandaloneLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="h-5 w-5" />
        </div>
      </StandaloneLayout>
    );
  }

  return (
    <StandaloneLayout action={<UserButton appearance={USER_BUTTON_APPEARANCE} />}>
      <Card className="items-center px-6 py-10 text-center sm:px-10">
        <IconTile icon={copy.icon} tone={copy.iconTone} size="xl" />

        <Badge tone={copy.badgeTone} className="mt-5">
          {copy.badge}
        </Badge>

        <h1 className="mt-4 text-h3 text-ink">{copy.title}</h1>
        <p className="mt-3 max-w-md text-body leading-6 text-ink-muted">{copy.body}</p>
        <p className="mt-2 max-w-md text-small text-ink-faint">{copy.note}</p>

        {/* The two facts that let a tenant confirm this page is about *them* —
            the right company, and how long it has been. A support conversation
            starts with both, so they are on the screen the tenant is looking at
            rather than somewhere they would have to go and find. */}
        <dl className="mt-8 w-full max-w-sm divide-y divide-line-subtle border-y border-line-subtle text-left">
          <DetailRow label="Company" value={company.name} />
          <DetailRow label="Account created" value={formatDateTime(company.createdAt)} />
        </dl>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Button onClick={access.retry} loading={access.isRefreshing}>
            {!access.isRefreshing && <ArrowPathIcon aria-hidden />}
            Refresh status
          </Button>
          <ButtonLink variant="secondary" to={MARKETING_ROUTES.contact}>
            <LifebuoyIcon aria-hidden />
            Contact support
          </ButtonLink>
        </div>

        <p className="mt-6 text-caption text-ink-faint">
          This page checks for updates automatically.
        </p>
      </Card>
    </StandaloneLayout>
  );
}

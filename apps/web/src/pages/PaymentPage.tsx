import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { BillingInterval, SubscriptionPlan } from '@rooferslabs/shared';
import { ROUTES } from '@/auth/stages';
import { useBillingConfig, useCreateCheckoutSession } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import { openCheckout } from '@/lib/paddle';
import { StandaloneLayout } from '@/layouts/StandaloneLayout';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/**
 * The one plan the founding programme sells. The wall used to offer a choice of
 * two; the programme is a single price, so the plan is a constant rather than a
 * selection. The amount actually charged is the provider's price for this plan
 * — the figures below are presentation only.
 */
const FOUNDING_PLAN = SubscriptionPlan.STARTER;

/**
 * Everything the offer says, in one place. The card builds every string it
 * renders from these, so repricing the programme is an edit here and nowhere
 * else — including in the accessible names, which are derived rather than
 * repeated.
 */
const OFFER = {
  badge: 'Founding Customer Program',
  headline: 'Everything you need to automate your roofing office',
  standardPrice: '$199',
  price: '$49',
  cadence: '/month',
  note: 'Special pricing reserved for our founding customers.',
  cta: 'Start Founding Membership',
  reassurance: 'Cancel anytime. No hidden fees.',
} as const;

const FEATURES = [
  'AI Receptionist',
  'Unlimited Lead Capture',
  'Customer Dashboard',
  'Call History & Analytics',
  'Email & SMS Follow-ups',
  'Knowledge Base',
  'Priority Product Updates',
] as const;

/**
 * The payment step. A tenant lands here once setup is finished and cannot reach
 * the application until a subscription is active.
 *
 * There is no subscribed check here on purpose. This page used to redirect to
 * `/dashboard` when `/billing/subscription` reported active, while the route
 * guard read the same fact from `/auth/me` — two independently cached answers
 * that disagreed for a few seconds after checkout and bounced the browser
 * between the two routes. The `payment`-only guard on this route is now the
 * single check, so a subscribed tenant never renders this page at all.
 */
export function PaymentPage() {
  const [params] = useSearchParams();
  const checkout = useCreateCheckoutSession();
  const config = useBillingConfig();
  const [openError, setOpenError] = useState<string | null>(null);

  const start = async () => {
    setOpenError(null);
    try {
      const handle = await checkout.mutateAsync({
        plan: FOUNDING_PLAN,
        interval: BillingInterval.MONTH,
      });
      // The checkout opens over this page rather than navigating away; payment
      // completion arrives by webhook, so nothing here is treated as proof of
      // payment. `config.data` is loaded by now in practice, and openCheckout
      // falls back to the hosted URL when it is not.
      await openCheckout(
        handle,
        config.data ?? { provider: handle.provider, clientToken: '', environment: 'sandbox' },
      );
    } catch (error) {
      // The mutation renders its own error; this catches a failure to *open*
      // the checkout, which would otherwise leave a dead button.
      if (!(error instanceof ApiError)) {
        setOpenError(
          error instanceof Error ? error.message : 'Could not open the checkout. Please try again.',
        );
      }
    }
  };

  const error = openError ?? (checkout.isError ? (checkout.error as ApiError).message : null);

  return (
    <StandaloneLayout>
      {/* The card is the whole page, so it sits in the middle of what is left
          of the viewport below the 64px header — the layout's own 3rem gutters
          become the minimum breathing room rather than the actual position.
          `dvh` keeps it centred while mobile browser chrome comes and goes. */}
      <div className="flex min-h-[calc(100dvh-10rem)] flex-col items-center justify-center">
        <div className="w-full max-w-[480px]">
          {params.get('checkout') === 'cancelled' && (
            <Alert className="mb-6" tone="warning" title="Checkout was cancelled">
              No payment was taken — your place is still here when you are ready.
            </Alert>
          )}

          {error && (
            <Alert className="mb-6" tone="danger">
              {error || 'Could not start checkout. Please try again.'}
            </Alert>
          )}

          <Card className="rounded-2xl px-6 py-8 shadow-md sm:px-9 sm:py-10">
            <Badge tone="brand">{OFFER.badge}</Badge>

            <h1 className="mt-5 text-balance text-h3 text-ink">{OFFER.headline}</h1>

            {/* The price is the one thing a reader should land on, so the old
                price is deliberately small and quiet above it rather than
                competing beside it. */}
            <div className="mt-7">
              <p className="text-body text-ink-faint">
                <span className="sr-only">Regular price </span>
                <s className="font-num decoration-ink-faint/60 decoration-1">
                  {OFFER.standardPrice}
                  {OFFER.cadence}
                </s>
              </p>

              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="sr-only">Founding price </span>
                <span className="font-num text-[2.875rem] font-bold leading-none tracking-[-0.03em] text-ink">
                  {OFFER.price}
                </span>
                <span className="text-body-lg text-ink-muted">{OFFER.cadence}</span>
              </p>

              <p className="mt-3.5 text-body leading-6 text-ink-muted">{OFFER.note}</p>
            </div>

            <ul className="mt-8 space-y-3.5 border-t border-line-subtle pt-8">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-body text-ink">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-subtle"
                  >
                    <Check className="h-3 w-3 text-accent" strokeWidth={3} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            <Button
              className="mt-8 w-full hover:-translate-y-px hover:shadow-md motion-reduce:hover:translate-y-0"
              size="lg"
              loading={checkout.isPending}
              onClick={() => void start()}
            >
              {checkout.isPending ? 'Opening…' : OFFER.cta}
            </Button>

            <p className="mt-4 text-center text-small text-ink-muted">{OFFER.reassurance}</p>
          </Card>

          <p className="mt-8 text-center text-small text-ink-muted">
            Already subscribed?{' '}
            <Link
              to={ROUTES.billing}
              className="focus-ring rounded-xs font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
            >
              Manage billing
            </Link>
          </p>
        </div>
      </div>
    </StandaloneLayout>
  );
}

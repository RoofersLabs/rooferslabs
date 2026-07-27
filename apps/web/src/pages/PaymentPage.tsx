import { Link, useSearchParams } from 'react-router-dom';
import { SubscriptionPlan } from '@rooferslabs/shared';
import { ROUTES } from '@/auth/stages';
import { useCreateCheckoutSession } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import { StandaloneLayout } from '@/layouts/StandaloneLayout';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';

export const PLANS: { plan: SubscriptionPlan; name: string; price: string; blurb: string }[] = [
  {
    plan: SubscriptionPlan.STARTER,
    name: 'Starter',
    price: '$299/month',
    blurb: 'Up to 250 calls per month. 24/7 AI answering, lead capture, appointment booking.',
  },
  {
    plan: SubscriptionPlan.PROFESSIONAL,
    name: 'Professional',
    price: '$599/month',
    blurb: 'Up to 1,000 calls per month. Everything in Starter, plus analytics and integrations.',
  },
];

/**
 * The payment step. A tenant lands here once setup is finished and cannot reach
 * the application until Stripe Checkout completes successfully.
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

  const start = async (plan: SubscriptionPlan) => {
    const { url } = await checkout.mutateAsync(plan);
    // Stripe-hosted Checkout — a full navigation, not a client-side route.
    window.location.assign(url);
  };

  return (
    <StandaloneLayout>
      <PageHeader
        title="Choose your plan"
        description="A subscription is required to use RoofersLabs. You can change or cancel it at any time."
      />

      {params.get('checkout') === 'cancelled' && (
        <Alert className="mb-6" tone="warning" title="Checkout was cancelled">
          No payment was taken — pick a plan to try again.
        </Alert>
      )}

      {checkout.isError && (
        <Alert className="mb-6" tone="danger">
          {(checkout.error as ApiError).message || 'Could not start checkout. Please try again.'}
        </Alert>
      )}

      <div className="space-y-6">
        {PLANS.map((p) => (
          <Card key={p.plan} className="px-6 py-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-h4 text-ink">{p.name}</h2>
              <span className="font-num text-h4 text-ink">{p.price}</span>
            </div>
            <p className="mt-2 text-body leading-6 text-ink-muted">{p.blurb}</p>
            <Button
              className="mt-5 self-start"
              loading={checkout.isPending}
              onClick={() => void start(p.plan)}
            >
              {checkout.isPending ? 'Redirecting…' : `Subscribe to ${p.name}`}
            </Button>
          </Card>
        ))}
      </div>

      <p className="mt-10 text-small text-ink-muted">
        Already subscribed?{' '}
        <Link
          to={ROUTES.billing}
          className="focus-ring rounded-xs font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
        >
          Manage billing
        </Link>
      </p>
    </StandaloneLayout>
  );
}

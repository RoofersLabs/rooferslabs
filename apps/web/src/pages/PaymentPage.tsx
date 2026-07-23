import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { SubscriptionPlan } from '@rooferslabs/shared';
import { useCreateCheckoutSession, useSubscription } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';

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
 * The payment step. A tenant lands here after creating its organization and
 * cannot reach the application until Stripe Checkout completes successfully.
 */
export function PaymentPage() {
  const [params] = useSearchParams();
  const subscription = useSubscription();
  const checkout = useCreateCheckoutSession();

  const start = async (plan: SubscriptionPlan) => {
    const { url } = await checkout.mutateAsync(plan);
    // Stripe-hosted Checkout — a full navigation, not a client-side route.
    window.location.assign(url);
  };

  if (subscription.data?.isActive) return <Navigate to="/dashboard" replace />;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold">Choose your plan</h1>
      <p className="mt-2 text-sm text-gray-600">
        A subscription is required to use RoofersLabs. You can change or cancel it at any time.
      </p>

      {params.get('checkout') === 'cancelled' && (
        <p className="mt-4 rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm">
          Checkout was cancelled. No payment was taken — pick a plan to try again.
        </p>
      )}

      <div className="mt-8 space-y-4">
        {PLANS.map((p) => (
          <div key={p.plan} className="rounded border border-gray-200 bg-white p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <span className="text-lg font-semibold">{p.price}</span>
            </div>
            <p className="mt-2 text-sm text-gray-600">{p.blurb}</p>
            <button
              type="button"
              onClick={() => void start(p.plan)}
              disabled={checkout.isPending}
              className="mt-4 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {checkout.isPending ? 'Redirecting…' : `Subscribe to ${p.name}`}
            </button>
          </div>
        ))}
      </div>

      {checkout.isError && (
        <p className="mt-4 text-sm text-red-600">
          {(checkout.error as ApiError).message || 'Could not start checkout. Please try again.'}
        </p>
      )}

      <p className="mt-8 text-sm text-gray-600">
        Already subscribed?{' '}
        <Link to="/billing" className="underline">
          Manage billing
        </Link>
      </p>
    </main>
  );
}

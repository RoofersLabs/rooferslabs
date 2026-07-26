import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { SubscriptionStatus } from '@rooferslabs/shared';
import { ROUTES } from '@/auth/stages';
import {
  queryKeys,
  useCancelSubscription,
  useCreatePortalSession,
  useResumeSubscription,
  useSubscription,
} from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import { formatDate, humanizeEnum } from '@/lib/utils';

/** Plain-language explanation of each billing state the tenant can be in. */
const STATUS_HELP: Partial<Record<SubscriptionStatus, string>> = {
  [SubscriptionStatus.NONE]: 'You do not have a subscription yet.',
  [SubscriptionStatus.INCOMPLETE]: 'Your first payment has not completed yet.',
  [SubscriptionStatus.INCOMPLETE_EXPIRED]:
    'The initial payment expired before it completed. Start a new subscription.',
  [SubscriptionStatus.PAST_DUE]:
    'The last payment failed. Update your payment method to restore access.',
  [SubscriptionStatus.UNPAID]:
    'An invoice remains unpaid. Settle it in the billing portal to restore access.',
  [SubscriptionStatus.CANCELED]: 'This subscription has ended. Your data is safe and untouched.',
  [SubscriptionStatus.PAUSED]: 'This subscription is paused.',
};

export function BillingPage() {
  const [params] = useSearchParams();
  const returningFromCheckout = params.get('checkout') === 'success';
  const queryClient = useQueryClient();

  // Activation happens on the webhook, which can land after the browser is
  // redirected back, so poll until the subscription flips to active.
  const subscription = useSubscription({ pollUntilActive: returningFromCheckout });
  const portal = useCreatePortalSession();
  const cancel = useCancelSubscription();
  const resume = useResumeSubscription();

  const isActive = subscription.data?.isActive ?? false;

  useEffect(() => {
    // Route guards read the session, so refresh it once billing turns active.
    if (isActive) void queryClient.invalidateQueries({ queryKey: queryKeys.session });
  }, [isActive, queryClient]);

  const openPortal = async () => {
    const { url } = await portal.mutateAsync();
    window.location.assign(url);
  };

  const data = subscription.data;
  const mutationError = (portal.error ?? cancel.error ?? resume.error) as ApiError | null;

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold">Billing</h1>

      {returningFromCheckout && !isActive && (
        <p className="mt-4 rounded border border-blue-300 bg-blue-50 px-4 py-3 text-sm">
          Payment received. Activating your subscription…
        </p>
      )}

      {subscription.isLoading ? (
        <p className="mt-6 text-sm text-gray-600">Loading…</p>
      ) : subscription.isError ? (
        <p className="mt-6 text-sm text-red-600">
          {(subscription.error as ApiError).message || 'Could not load your subscription.'}
        </p>
      ) : data ? (
        <div className="mt-6 space-y-6">
          <dl className="rounded border border-gray-200 bg-white p-6 text-sm">
            <div className="flex justify-between py-1">
              <dt className="text-gray-600">Status</dt>
              <dd className="font-medium">{humanizeEnum(data.status)}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-gray-600">Plan</dt>
              <dd className="font-medium">{data.plan ? humanizeEnum(data.plan) : '—'}</dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-gray-600">
                {data.cancelAtPeriodEnd ? 'Access ends' : 'Renews on'}
              </dt>
              <dd className="font-medium">{formatDate(data.currentPeriodEnd)}</dd>
            </div>
            {data.trialEndsAt && (
              <div className="flex justify-between py-1">
                <dt className="text-gray-600">Trial ends</dt>
                <dd className="font-medium">{formatDate(data.trialEndsAt)}</dd>
              </div>
            )}
          </dl>

          {STATUS_HELP[data.status] && (
            <p className="rounded border border-gray-200 bg-gray-100 px-4 py-3 text-sm">
              {STATUS_HELP[data.status]}
            </p>
          )}

          {data.cancelAtPeriodEnd && isActive && (
            <p className="rounded border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm">
              This subscription is scheduled to end on {formatDate(data.currentPeriodEnd)}.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {data.hasStripeCustomer && (
              <button
                type="button"
                onClick={() => void openPortal()}
                disabled={portal.isPending}
                className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {portal.isPending ? 'Opening…' : 'Manage payment & invoices'}
              </button>
            )}

            {isActive && !data.cancelAtPeriodEnd && (
              <button
                type="button"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
              >
                {cancel.isPending ? 'Cancelling…' : 'Cancel subscription'}
              </button>
            )}

            {data.cancelAtPeriodEnd && (
              <button
                type="button"
                onClick={() => resume.mutate()}
                disabled={resume.isPending}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {resume.isPending ? 'Resuming…' : 'Resume subscription'}
              </button>
            )}

            {!isActive && (
              <Link
                to={ROUTES.payment}
                className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
              >
                Choose a plan
              </Link>
            )}
          </div>

          {mutationError && <p className="text-sm text-red-600">{mutationError.message}</p>}
        </div>
      ) : null}

      <p className="mt-8 text-sm text-gray-600">
        {isActive ? (
          <Link to={ROUTES.dashboard} className="underline">
            Back to dashboard
          </Link>
        ) : (
          <Link to={ROUTES.marketing} className="underline">
            Back to home
          </Link>
        )}
      </p>
    </main>
  );
}

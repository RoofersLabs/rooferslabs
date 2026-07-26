import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CreditCard } from 'lucide-react';
import { SubscriptionStatus } from '@rooferslabs/shared';
import { ROUTES } from '@/auth/stages';
import { StandaloneLayout } from '@/layouts/StandaloneLayout';
import { Alert } from '@/components/ui/Alert';
import { EnumBadge } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { DetailRow } from '@/components/ui/DetailRow';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/spinner';
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
    <StandaloneLayout>
      <PageHeader title="Billing" description="Your subscription, payment method, and invoices." />

      {returningFromCheckout && !isActive && (
        <Alert className="mb-6" tone="info" title="Payment received">
          Activating your subscription — this usually takes a few seconds.
        </Alert>
      )}

      {subscription.isLoading ? (
        <Card>
          <LoadingBlock label="Loading your subscription…" />
        </Card>
      ) : subscription.isError ? (
        <Card>
          <ErrorState
            title="Couldn’t load your subscription"
            message={(subscription.error as ApiError).message}
            onRetry={() => void subscription.refetch()}
          />
        </Card>
      ) : data ? (
        <div className="space-y-6">
          <Card>
            <CardHeader className="items-center">
              <CardTitle as="h2">Subscription</CardTitle>
              <EnumBadge value={data.status} />
            </CardHeader>
            <dl className="divide-y divide-line-subtle border-t border-line-subtle px-6 py-2">
              <DetailRow label="Plan" value={data.plan ? humanizeEnum(data.plan) : '—'} />
              <DetailRow
                label={data.cancelAtPeriodEnd ? 'Access ends' : 'Renews on'}
                value={formatDate(data.currentPeriodEnd)}
              />
              {data.trialEndsAt && (
                <DetailRow label="Trial ends" value={formatDate(data.trialEndsAt)} />
              )}
            </dl>
          </Card>

          {STATUS_HELP[data.status] && <Alert tone="info">{STATUS_HELP[data.status]}</Alert>}

          {data.cancelAtPeriodEnd && isActive && (
            <Alert tone="warning" title="Scheduled to end">
              This subscription ends on {formatDate(data.currentPeriodEnd)}. Resume it any time
              before then to keep your receptionist answering.
            </Alert>
          )}

          {mutationError && <Alert tone="danger">{mutationError.message}</Alert>}

          <div className="flex flex-wrap gap-3">
            {data.hasStripeCustomer && (
              <Button
                variant="secondary"
                loading={portal.isPending}
                onClick={() => void openPortal()}
              >
                <CreditCard className="h-4 w-4" aria-hidden />
                {portal.isPending ? 'Opening…' : 'Manage payment & invoices'}
              </Button>
            )}

            {isActive && !data.cancelAtPeriodEnd && (
              <Button
                variant="outline"
                className="text-emergency hover:border-emergency-border hover:bg-emergency-subtle"
                loading={cancel.isPending}
                onClick={() => cancel.mutate()}
              >
                {cancel.isPending ? 'Cancelling…' : 'Cancel subscription'}
              </Button>
            )}

            {data.cancelAtPeriodEnd && (
              <Button loading={resume.isPending} onClick={() => resume.mutate()}>
                {resume.isPending ? 'Resuming…' : 'Resume subscription'}
              </Button>
            )}

            {!isActive && <ButtonLink to={ROUTES.payment}>Choose a plan</ButtonLink>}
          </div>
        </div>
      ) : null}

      <p className="mt-10">
        <Link
          to={isActive ? ROUTES.dashboard : ROUTES.marketing}
          className="focus-ring inline-flex items-center gap-1.5 rounded-xs text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {isActive ? 'Back to dashboard' : 'Back to home'}
        </Link>
      </p>
    </StandaloneLayout>
  );
}

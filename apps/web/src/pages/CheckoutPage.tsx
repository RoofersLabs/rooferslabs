import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/auth/stages';
import { useBillingConfig } from '@/hooks/queries';
import { loadPaddle } from '@/lib/paddle';
import { StandaloneLayout } from '@/layouts/StandaloneLayout';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/spinner';

/**
 * The provider's payment link target.
 *
 * This page exists because Paddle has no fully-hosted checkout: the "default
 * payment link" configured in the Paddle dashboard must point at a page *we*
 * host that runs Paddle.js, and Paddle appends the transaction as `_ptxn`.
 * It is the landing point for links Paddle itself sends — "update your payment
 * method" emails and dunning notices for a failed charge — so it has to exist
 * even though the in-app flow opens its checkout on /payment instead.
 *
 * Deliberately thin: read the transaction from the URL, open the checkout for
 * it, and get out of the way.
 */
export function CheckoutPage() {
  const [params] = useSearchParams();
  const config = useBillingConfig();
  const [error, setError] = useState<string | null>(null);

  // Paddle's own parameter name. Not ours to choose.
  const transactionId = params.get('_ptxn');
  const clientToken = config.data?.clientToken;

  useEffect(() => {
    if (!transactionId || !config.data || !clientToken) return;

    let cancelled = false;
    void loadPaddle(config.data)
      .then((paddle) => {
        if (cancelled) return;
        if (!paddle) {
          setError(
            'The payment form could not be loaded. Please disable any ad blocker and retry.',
          );
          return;
        }
        paddle.Checkout.open({
          transactionId,
          // This transaction came from one of Paddle's own emails rather than
          // from our checkout call, so there is no server-chosen destination to
          // honour — send the tenant to its billing page to see the result.
          settings: { successUrl: `${window.location.origin}${ROUTES.billing}?checkout=success` },
        });
      })
      .catch(() => {
        if (!cancelled) setError('The payment form could not be loaded. Please try again.');
      });

    // The checkout overlay outlives this effect; cancelling only suppresses a
    // late open after the page has already been navigated away from.
    return () => {
      cancelled = true;
    };
  }, [transactionId, config.data, clientToken]);

  return (
    <StandaloneLayout>
      <PageHeader title="Complete your payment" description="Finish checking out to continue." />

      {!transactionId ? (
        <Alert tone="warning" title="Nothing to pay">
          This link is missing its payment reference. Open billing to start a new checkout.
        </Alert>
      ) : error ? (
        <Alert tone="danger">{error}</Alert>
      ) : config.isError ? (
        <Alert tone="danger">Could not load the payment form. Please try again.</Alert>
      ) : (
        <Card>
          <LoadingBlock label="Opening the secure payment form…" />
        </Card>
      )}

      <p className="mt-10">
        <Link
          to={ROUTES.billing}
          className="focus-ring inline-flex items-center gap-1.5 rounded-xs text-small font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to billing
        </Link>
      </p>
    </StandaloneLayout>
  );
}

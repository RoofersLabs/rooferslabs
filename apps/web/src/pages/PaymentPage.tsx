import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { BillingInterval, SubscriptionPlan } from '@rooferslabs/shared';
import { ROUTES } from '@/auth/stages';
import { useBillingConfig, useConfirmCheckout, useCreateCheckoutSession } from '@/hooks/queries';
import { ApiError } from '@/lib/api-client';
import { loadPayPalSdk, type PayPalButtons } from '@/lib/paypal';
import { StandaloneLayout } from '@/layouts/StandaloneLayout';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * The one plan on sale. The wall used to offer a choice of two; the launch is a
 * single price, so the plan is a constant rather than a selection. The amount
 * actually charged is the provider's price for this plan — the figures below
 * are presentation only, and repricing means changing the backend catalogue
 * (catalog.config.ts) alongside this copy.
 */
const LAUNCH_PLAN = SubscriptionPlan.STARTER;

/**
 * Everything the offer says, in one place. The card builds every string it
 * renders from these, so repricing the launch is an edit here and nowhere
 * else — including in the accessible names, which are derived rather than
 * repeated.
 */
const OFFER = {
  badge: 'Launch Pricing',
  plan: 'Starter',
  headline: 'Everything you need to automate your roofing office',
  price: '$1',
  cadence: '/month',
  note: 'Launch pricing for early customers.',
  cta: 'Subscribe with PayPal',
  reassurance: 'Cancel anytime. No hidden fees.',
  security: 'Secure payments powered by PayPal',
} as const;

/**
 * What the trust line names, per funding source the API offers.
 *
 * Derived rather than fixed: listing methods a payer cannot actually use is
 * the same broken promise as rendering a button that fails, one line lower.
 */
const ACCEPTED: Record<string, string> = {
  paypal: 'PayPal',
  card: 'Visa · Mastercard · American Express · Discover · Debit cards',
};

const FEATURES = [
  'AI Receptionist',
  'Unlimited Lead Capture',
  'Customer Dashboard',
  'Call History & Analytics',
  'Email & SMS Follow-ups',
  'Knowledge Base',
  'Priority Product Updates',
] as const;

/** What the in-context checkout area is doing right now. */
type SdkState = 'loading' | 'ready' | 'fallback';

/**
 * The payment step. A tenant lands here once setup is finished and cannot reach
 * the application until a subscription is active.
 *
 * Two checkout paths, one source of truth:
 *
 *  - **In-context (preferred).** The PayPal JS SDK renders its own PayPal and
 *    card buttons. `createSubscription` asks *our* API to create the pending
 *    subscription — the browser never names a plan or a price — and on approval
 *    the confirm endpoint reads the result back from PayPal. The SDK only
 *    renders funding sources the merchant account can vault for recurring
 *    billing, so an account still awaiting PayPal-wallet approval simply shows
 *    the card button alone.
 *  - **Redirect (fallback).** If the SDK cannot load — blocked script, network —
 *    the classic full-page redirect to PayPal's approval page still works.
 *
 * Neither path is treated as proof of payment: activation arrives only through
 * the verified webhook, or through the confirm endpoint's authenticated re-read
 * of PayPal's own record.
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
  const navigate = useNavigate();
  const config = useBillingConfig();
  const checkout = useCreateCheckoutSession();
  const confirm = useConfirmCheckout();

  const [sdkState, setSdkState] = useState<SdkState>('loading');
  const [openError, setOpenError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [approving, setApproving] = useState(false);

  const paypalSlot = useRef<HTMLDivElement>(null);
  const cardSlot = useRef<HTMLDivElement>(null);

  // `mutateAsync` is referentially stable in TanStack Query v5, so depending on
  // it — rather than on the mutation result object, whose identity changes with
  // every state transition — is what keeps the SDK render effect from tearing
  // the buttons down mid-checkout.
  const createCheckoutSession = checkout.mutateAsync;
  const confirmSubscription = confirm.mutateAsync;

  /** Create the pending subscription server-side and hand its id to the SDK. */
  const createSubscription = useCallback(async (): Promise<string> => {
    setOpenError(null);
    setCancelled(false);
    const handle = await createCheckoutSession({
      plan: LAUNCH_PLAN,
      interval: BillingInterval.MONTH,
    });
    if (!handle.subscriptionId) {
      throw new Error('The checkout could not be started. Please try again.');
    }
    return handle.subscriptionId;
  }, [createCheckoutSession]);

  const onApprove = useCallback(
    async (data: { subscriptionID?: string | null }) => {
      setApproving(true);
      try {
        if (data.subscriptionID) {
          // A read, not a grant: the server looks the subscription up at PayPal
          // and stores whatever PayPal says. If it has not settled yet the
          // billing page's own polling picks the activation up when the
          // webhook lands.
          await confirmSubscription(data.subscriptionID);
        }
      } catch {
        // Confirm racing the webhook is expected; the billing page resolves it.
      }
      navigate(`${ROUTES.billing}?checkout=success`);
    },
    [confirmSubscription, navigate],
  );

  // Stable across renders, so the SDK effect does not tear its buttons down
  // every time the query object is replaced with an identical payload.
  const allowedKey = (config.data?.fundingSources ?? []).join(',');

  /** Load the SDK and render whichever funding sources this account supports. */
  useEffect(() => {
    // No clientId yet: either the config is still loading (the skeleton holds
    // the space) or it failed — and failure is derived at render time below
    // rather than mirrored into state here.
    if (!config.data?.clientId) return;
    const allowed = allowedKey ? allowedKey.split(',') : [];
    if (allowed.length === 0) return;

    let disposed = false;
    const rendered: PayPalButtons[] = [];

    const boot = async () => {
      try {
        const paypal = await loadPayPalSdk(config.data.clientId);
        if (disposed) return;

        // The API decides which methods are offered — it is the only side that
        // knows which ones this merchant account can vault for recurring use.
        // `isEligible()` is still consulted below, but it answers a narrower
        // question ("may this button render?") and would happily render a
        // wallet whose approval always fails.
        const offered = new Set(allowed);
        const slots: Array<[string, string, HTMLDivElement | null]> = [
          ['paypal', paypal.FUNDING.PAYPAL, paypalSlot.current],
          ['card', paypal.FUNDING.CARD, cardSlot.current],
        ];

        let mounted = 0;
        for (const [name, fundingSource, slot] of slots) {
          if (!slot || !offered.has(name)) continue;
          const buttons = paypal.Buttons({
            fundingSource,
            style: { shape: 'pill', label: 'subscribe', height: 44 },
            createSubscription,
            onApprove,
            onCancel: () => setCancelled(true),
            onError: () => {
              setOpenError('The payment could not be completed. Please try again.');
            },
          });
          if (!buttons.isEligible()) continue;
          rendered.push(buttons);
          await buttons.render(slot);
          mounted += 1;
        }

        if (disposed) return;
        setSdkState(mounted > 0 ? 'ready' : 'fallback');
      } catch {
        if (!disposed) setSdkState('fallback');
      }
    };

    void boot();

    return () => {
      disposed = true;
      for (const buttons of rendered) void buttons.close().catch(() => undefined);
    };
  }, [config.data?.clientId, allowedKey, createSubscription, onApprove]);

  // A config that failed to load means the SDK can never boot — the redirect
  // path needs no client id, so it takes over. Derived, not stored: the effect
  // above never has to mirror query state into component state.
  const mode: SdkState = config.isError ? 'fallback' : sdkState;

  const accepted = (config.data?.fundingSources ?? [])
    .map((source) => ACCEPTED[source])
    .filter(Boolean)
    .join(' · ');

  /** The redirect fallback: navigate to PayPal's hosted approval page. */
  const startRedirect = async () => {
    setOpenError(null);
    setCancelled(false);
    try {
      const handle = await checkout.mutateAsync({
        plan: LAUNCH_PLAN,
        interval: BillingInterval.MONTH,
      });
      if (!handle.url) {
        setOpenError('Could not start the checkout. Please try again.');
        return;
      }
      // A full navigation, not a new tab: the payer has to sign in to PayPal to
      // approve the subscription, and a popup is the thing browsers block and
      // phones handle worst. They come back to `successUrl`, which the server
      // chose — nothing here is treated as proof of payment either way, because
      // activation arrives separately by webhook.
      window.location.assign(handle.url);
    } catch (error) {
      if (!(error instanceof ApiError)) {
        setOpenError(
          error instanceof Error
            ? error.message
            : 'Could not start the checkout. Please try again.',
        );
      }
    }
  };

  const error = openError ?? (checkout.isError ? (checkout.error as ApiError).message : null);

  // The fallback button stays in its loading state through the navigation:
  // letting the label snap back invites a second click and a second checkout.
  const leaving = checkout.isPending || checkout.isSuccess;

  return (
    <StandaloneLayout>
      {/* The card is the whole page, so it is centred in everything below the
          64px header rather than sitting in the document flow. `-my-12` gives
          back the layout's own 3rem gutters — on a 720px-tall laptop those 96px
          are the difference between a centred card and a scrollbar — and `py-6`
          re-establishes a smaller minimum of its own. `dvh` keeps it centred
          while mobile browser chrome comes and goes. */}
      <div className="-my-12 flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center py-6">
        <div className="w-full max-w-[420px]">
          {(params.get('checkout') === 'cancelled' || cancelled) && (
            <Alert className="mb-6" tone="warning" title="Checkout was cancelled">
              No payment was taken — your place is still here when you are ready.
            </Alert>
          )}

          {params.get('checkout') === 'pending' && (
            <Alert className="mb-6" tone="info" title="Waiting for PayPal to confirm">
              You approved the subscription and PayPal is settling the first payment. This usually
              takes a few seconds — you can stay on this page.
            </Alert>
          )}

          {error && (
            <Alert className="mb-6" tone="danger">
              {error || 'Could not start checkout. Please try again.'}
            </Alert>
          )}

          <Card className="rounded-2xl px-6 py-6 shadow-md sm:px-8">
            <Badge tone="brand">{OFFER.badge}</Badge>

            <h1 className="mt-4 text-balance text-h4 text-ink">{OFFER.headline}</h1>

            {/* The price is the one thing a reader should land on; the plan
                name sits quietly above it as a label rather than competing
                beside it. */}
            <div className="mt-5">
              <p className="text-small font-medium text-ink-muted">{OFFER.plan}</p>

              <p className="mt-0.5 flex items-baseline gap-1.5">
                <span className="sr-only">{OFFER.plan} plan price </span>
                <span className="font-num text-[2.25rem] font-bold leading-none tracking-[-0.03em] text-ink">
                  {OFFER.price}
                </span>
                <span className="text-body text-ink-muted">{OFFER.cadence}</span>
              </p>

              <p className="mt-2.5 text-small leading-5 text-ink-muted">{OFFER.note}</p>
            </div>

            <ul className="mt-5 space-y-2 border-t border-line-subtle pt-5">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5 text-small text-ink">
                  <span
                    aria-hidden="true"
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent-subtle"
                  >
                    <Check className="h-2.5 w-2.5 text-accent" strokeWidth={3} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            {/* The checkout area. While the SDK loads, a placeholder holds the
                space; if it never arrives, the redirect button takes over. The
                slots stay mounted through 'loading' because the SDK renders
                into them as it becomes ready. */}
            <div className="mt-6" aria-busy={mode === 'loading' || approving}>
              {approving ? (
                <div className="flex h-11 items-center justify-center rounded-full bg-accent-subtle text-small font-medium text-accent">
                  Confirming your subscription…
                </div>
              ) : (
                <>
                  <div className={mode === 'fallback' ? 'hidden' : 'space-y-2.5'}>
                    {mode === 'loading' && <Skeleton className="h-11 w-full rounded-full" />}
                    <div ref={paypalSlot} />
                    <div ref={cardSlot} />
                  </div>

                  {mode === 'fallback' && (
                    <Button
                      className="w-full hover:-translate-y-px hover:shadow-md motion-reduce:hover:translate-y-0"
                      loading={leaving}
                      disabled={leaving}
                      onClick={() => void startRedirect()}
                    >
                      {leaving ? 'Redirecting to PayPal…' : OFFER.cta}
                    </Button>
                  )}
                </>
              )}
            </div>

            <p className="mt-3 text-center text-caption text-ink-muted">{OFFER.reassurance}</p>

            {/* Trust line: what secures the payment and which methods work.
                Plain text rather than brand logos so the card stays quiet and
                nothing here needs image assets or their licensing. */}
            <div className="mt-4 border-t border-line-subtle pt-4 text-center">
              <p className="text-caption font-medium text-ink-muted">{OFFER.security}</p>
              {accepted && <p className="mt-1 text-caption text-ink-faint">{accepted}</p>}
            </div>
          </Card>

          <p className="mt-4 text-center text-small text-ink-muted">
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

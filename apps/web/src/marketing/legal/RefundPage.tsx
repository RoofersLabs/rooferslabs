import { MARKETING_ROUTES } from '../routes';
import { LegalLayout } from './LegalLayout';
import { Callout, InternalLink, LI, MailLink, P, Section, Strong, UL } from './Prose';
import { CONTACT } from './content';

export function RefundPage() {
  return (
    <LegalLayout
      title="Refund Policy"
      subtitle="When we refund, how to ask, and how long it takes. Written to be used, not to be argued with."
      seoDescription="The rooferslabs refund policy — how refunds will work when paid plans open, cancellation, duplicate payments, and processing times."
      path={MARKETING_ROUTES.refunds}
    >
      <Section id="principle" title="Our position">
        <Callout>
          <Strong>No charges are being made yet.</Strong> r1 echo is in its founding-customer phase,
          paid plans have not opened, and no payment method is collected anywhere in the product. So
          there is nothing to refund today. This policy sets out the commitment we are making for
          when billing does open.
        </Callout>
        <P>
          rooferslabs exists to make sure a roofing business never misses a call. If it has not done
          that for you, we would rather refund you than keep money you do not think you got value
          for.
        </P>
        <P>
          Once paid plans open: if the Service did not work as described and you tell us within{' '}
          <Strong>30 days</Strong> of the charge, we will refund it. You will not need to justify
          the decision, and asking will not affect how we treat you afterwards.
        </P>
      </Section>

      <Section id="subscriptions" title="Subscription refunds">
        <UL>
          <LI>
            <Strong>First payment.</Strong> Refundable in full within 30 days if the Service did not
            work as described or did not suit your business.
          </LI>
          <LI>
            <Strong>Renewal payments.</Strong> If a renewal charge took you by surprise — you meant
            to cancel, or did not realise it was due — tell us within 30 days of the charge and we
            will refund it and cancel the subscription.
          </LI>
          <LI>
            <Strong>Partial periods.</Strong> We do not normally pro-rate an unused part of a period
            you chose to cancel in, because you keep full access for the rest of it. If an outage or
            fault on our side cost you a meaningful part of a period, tell us and we will refund or
            credit that part.
          </LI>
        </UL>
      </Section>

      <Section id="cancellation" title="Cancellation">
        <P>
          You will be able to cancel at any time from your account settings, or by emailing{' '}
          <MailLink email={CONTACT.email} />. There is no cancellation fee and no notice period.
        </P>
        <P>
          Cancelling stops the next renewal. Your subscription stays active until the end of the
          period you have already paid for, and you keep full access until then — cancelling does
          not cut you off immediately, and it does not by itself trigger a refund of the current
          period. If you want the current period refunded as well, say so and we will apply the
          rules above.
        </P>
      </Section>

      <Section id="duplicates" title="Duplicate and accidental payments">
        <UL>
          <LI>
            <Strong>Duplicate charges.</Strong> Refunded in full, always, without a time limit. If
            you were charged twice for the same period, that is our error and we will fix it as soon
            as we can confirm it.
          </LI>
          <LI>
            <Strong>Accidental purchases.</Strong> If you subscribed by mistake, or someone in your
            business subscribed without authority, contact us within 30 days and we will refund it.
          </LI>
          <LI>
            <Strong>Charges after cancellation.</Strong> If you were billed after cancelling,
            refunded in full.
          </LI>
        </UL>
      </Section>

      <Section id="disputes" title="Billing disputes">
        <P>
          If a charge looks wrong, email <MailLink email={CONTACT.email} /> with the date and amount
          and we will investigate. We would much rather resolve it directly than have you raise a
          chargeback — a chargeback takes longer for you, and typically results in the subscription
          being suspended while the bank investigates.
        </P>
        <P>
          We will name our payment processor here when paid plans open, so you can recognise how a
          charge appears on your statement.
        </P>
      </Section>

      <Section id="how" title="How to request a refund">
        <P>
          Email <MailLink email={CONTACT.email} /> from the address on your account and include:
        </P>
        <UL>
          <LI>The date and amount of the charge, or the invoice number.</LI>
          <LI>
            The email address the account is under, if it differs from the one you write from.
          </LI>
          <LI>Briefly, what went wrong — this helps us fix the underlying problem.</LI>
        </UL>
        <P>There is no form to fill in and no retention process to sit through.</P>
      </Section>

      <Section id="timing" title="Processing times">
        <UL>
          <LI>
            <Strong>Our decision:</Strong> {CONTACT.responseTime} of receiving your request.
          </LI>
          <LI>
            <Strong>We issue the refund:</Strong> usually within 1–3 business days of approval.
          </LI>
          <LI>
            <Strong>Your bank or card posts it:</Strong> typically 5–10 business days after that,
            depending on the payment method. This last step is outside our control.
          </LI>
        </UL>
        <P>
          Refunds are returned to the original payment method. We cannot send a refund to a
          different card or account.
        </P>
      </Section>

      <Section id="exceptions" title="Where a refund may not apply">
        <P>We may decline a refund where:</P>
        <UL>
          <LI>
            The request comes more than 30 days after the charge, and none of the always-refundable
            cases above applies.
          </LI>
          <LI>
            The account was suspended or terminated for a breach of our{' '}
            <InternalLink to={MARKETING_ROUTES.terms}>Terms of Service</InternalLink>.
          </LI>
          <LI>There is clear evidence of fraudulent or abusive use.</LI>
        </UL>
        <P>
          Nothing in this policy limits any statutory right to a refund you have under the consumer
          law that applies to you. Where that law gives you more than this policy does, it wins.
        </P>
      </Section>

      <Section id="contact" title="Contact">
        <P>
          Refund questions go to <MailLink email={CONTACT.email} />. We reply {CONTACT.responseTime}{' '}
          during {CONTACT.hours}.
        </P>
      </Section>
    </LegalLayout>
  );
}

import { MARKETING_ROUTES } from '../routes';
import { LegalLayout } from './LegalLayout';
import { Callout, InternalLink, LI, MailLink, P, Section, Strong, Subheading, UL } from './Prose';
import { CONTACT, ENTITY } from './content';

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The agreement between you and rooferslabs when you use r1 echo and everything around it."
      seoDescription="The terms governing use of r1 echo by rooferslabs, built for roofing contractors — accounts, subscriptions, billing, cancellation, and acceptable use."
      path={MARKETING_ROUTES.terms}
    >
      <Section id="acceptance" title="1. Acceptance of these terms">
        <P>
          These Terms of Service govern your access to and use of rooferslabs, including the
          website, r1 echo, the customer dashboard, and any related services (together, the{' '}
          <Strong>Service</Strong>). By creating an account, subscribing, or otherwise using the
          Service, you agree to these terms. If you do not agree, do not use the Service.
        </P>
        <P>{ENTITY.description}</P>
      </Section>

      <Section id="service" title="2. What the Service does">
        <P>
          <Strong>r1 echo</Strong> answers inbound telephone calls placed to the number assigned to
          your account. It greets callers in your business’s name, holds a natural conversation,
          captures the details of the enquiry, records and transcribes the call, identifies urgent
          situations, and delivers the result to your dashboard moments after the call ends. Where
          you have configured it to, it also sends follow-up messages on your behalf.
        </P>
        <P>
          You control how r1 echo represents you. The greeting it uses, the service areas it quotes,
          the questions it asks, and what it treats as urgent all follow the configuration you set,
          and you can change that configuration at any time.
        </P>
        <Callout>
          r1 echo is an automated service, designed to work alongside your team rather than in place
          of your own judgement. Treat the leads, summaries, and transcripts it produces as the
          record of a conversation: review the details that matter — names, addresses, scope, and
          urgency — before you quote, dispatch, or otherwise act on them. It is not an emergency
          service, and callers reporting an emergency should be directed to the appropriate
          emergency number.
        </Callout>
        <P>
          We improve the Service continuously, and features may be added, refined, or replaced over
          time. Where a change would materially reduce core functionality you are paying for, we
          will give you reasonable notice before it takes effect.
        </P>
      </Section>

      <Section id="accounts" title="3. Account requirements">
        <UL>
          <LI>You must be at least 18 years old and able to enter into a binding contract.</LI>
          <LI>
            Account information must be accurate and kept up to date, including the business name,
            service areas, and contact details r1 echo relies on when speaking to callers.
          </LI>
          <LI>
            You are responsible for activity under your account and for keeping your sign-in
            credentials secure. Tell us promptly at <MailLink email={CONTACT.email} /> if you
            believe your account has been accessed without your authorisation.
          </LI>
          <LI>
            You must have the right to use any telephone number you connect or forward to the
            Service.
          </LI>
        </UL>
      </Section>

      <Section id="billing" title="4. Subscriptions and billing">
        <P>
          r1 echo is being introduced with a limited group of founding customers ahead of general
          release. Subscription plans, pricing, and billing intervals will be published here before
          the Service becomes commercially available.
        </P>
        <Callout>
          The full payment terms — prices, billing intervals, renewal, taxes, and invoicing — will
          be set out in this section when billing opens. Until they are published and you have
          accepted them, no subscription charge is made for the Service.
        </Callout>
        <P>
          When those terms take effect, we will give notice in advance so you can review them before
          you subscribe, and any later change to the pricing of an active subscription will apply
          from the next renewal, with notice beforehand.
        </P>
        <P>
          Refunds are covered by our{' '}
          <InternalLink to={MARKETING_ROUTES.refunds}>Refund Policy</InternalLink>, which forms part
          of these terms.
        </P>
      </Section>

      <Section id="cancellation" title="5. Cancellation">
        <P>
          You may cancel at any time from your billing settings, or by emailing{' '}
          <MailLink email={CONTACT.email} />. Cancellation stops the next renewal; your subscription
          remains active until the end of the period you have already paid for, and you keep full
          access until then.
        </P>
        <P>
          We do not charge a cancellation fee and do not require notice. After the period ends,
          access to the dashboard ends and calls to your assigned number are no longer answered by
          the Service.
        </P>
      </Section>

      <Section id="ip" title="6. Intellectual property">
        <Subheading>What belongs to us</Subheading>
        <P>
          The Service, including its software, interface, branding, and documentation, belongs to us
          and our licensors. These terms grant you a limited, non-exclusive, non-transferable right
          to use the Service while your subscription is active. Nothing here transfers ownership.
        </P>
        <Subheading>What belongs to you</Subheading>
        <P>
          Your business information, your call recordings and transcripts, your customer records,
          and anything else you or your callers put into the Service remain yours. You grant us the
          licence needed to host, process, and transmit that content in order to operate the Service
          — including sending it to the processors listed in our Privacy Policy.
        </P>
        <P>
          We may use aggregated, de-identified information about how the Service is used to improve
          it. This never identifies you, your callers, or your business.
        </P>
      </Section>

      <Section id="acceptable-use" title="7. Acceptable use">
        <P>You agree not to:</P>
        <UL>
          <LI>Use the Service for anything unlawful, fraudulent, or deceptive.</LI>
          <LI>
            Use it to make or facilitate unsolicited bulk calls or messages, or to route calls you
            are not authorised to receive.
          </LI>
          <LI>
            Attempt to gain unauthorised access to the Service, another customer’s data, or the
            infrastructure behind it.
          </LI>
          <LI>
            Reverse engineer, resell, or offer the Service to third parties as your own, except as
            expressly agreed with us in writing.
          </LI>
          <LI>
            Interfere with the Service’s operation, including by placing artificial load on the
            telephony or AI systems.
          </LI>
        </UL>
      </Section>

      <Section id="availability" title="8. Service availability">
        <P>
          We work to keep the Service available continuously, but we do not guarantee uninterrupted
          operation. The Service depends on third parties — telephony carriers, AI providers, and
          cloud infrastructure — and an outage at any of them can interrupt it.
        </P>
        <P>
          We may suspend the Service for maintenance, and will give advance notice for planned work
          where practical. We do not offer a contractual uptime commitment at this stage of the
          product, and you should not rely on the Service as the only route by which customers can
          reach you.
        </P>
      </Section>

      <Section id="termination" title="9. Termination">
        <P>
          You may stop using the Service at any time. We may suspend or terminate your access if you
          materially breach these terms, if your account is used unlawfully, or if required by law —
          and, where the circumstances allow it, we will tell you why and give you a chance to put
          it right first.
        </P>
        <P>
          On termination, your right to use the Service ends. You may request an export of your data
          by emailing <MailLink email={CONTACT.email} /> before the end of the retention period
          described in our Privacy Policy.
        </P>
      </Section>

      <Section id="changes" title="10. Changes to these terms">
        <P>
          We may update these terms as the Service and the business behind it develop — including
          when RoofersLabs is incorporated, at which point the operator named above will be replaced
          by the new legal entity. We will change the “last updated” date at the top of this page,
          and for material changes we will give notice by email or in the product before they take
          effect. Continuing to use the Service after a change takes effect means you accept it.
        </P>
      </Section>

      <Section id="contact" title="11. Contact">
        <P>
          Questions about these terms can be sent to <MailLink email={CONTACT.email} />. We reply{' '}
          {CONTACT.responseTime} during {CONTACT.hours}.
        </P>
      </Section>
    </LegalLayout>
  );
}

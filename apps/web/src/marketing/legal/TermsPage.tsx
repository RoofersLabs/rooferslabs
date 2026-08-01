import { MARKETING_ROUTES } from '../routes';
import { LegalLayout } from './LegalLayout';
import { Callout, InternalLink, LI, MailLink, P, Section, Strong, Subheading, UL } from './Prose';
import { CONTACT, ENTITY } from './content';

export function TermsPage() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="The agreement between you and rooferslabs when you use the AI receptionist and everything around it."
      seoDescription="The terms governing use of rooferslabs, the AI receptionist for roofing contractors — accounts, subscriptions, billing, cancellation, and acceptable use."
      path={MARKETING_ROUTES.terms}
    >
      <Section id="acceptance" title="1. Acceptance of these terms">
        <P>
          These Terms of Service govern your access to and use of rooferslabs, including the
          website, the AI receptionist, the customer dashboard, and any related services (together,
          the <Strong>Service</Strong>). By creating an account, subscribing, or otherwise using the
          Service, you agree to these terms. If you do not agree, do not use the Service.
        </P>
        <P>{ENTITY.description}</P>
        <P>
          If you are agreeing on behalf of a business, you confirm that you are authorised to bind
          that business, and “you” means both you and that business.
        </P>
      </Section>

      <Section id="service" title="2. What the Service does">
        <P>
          rooferslabs answers inbound telephone calls to a number assigned to you, using an
          automated AI receptionist. It speaks with the caller, captures details of their enquiry,
          records and transcribes the call, flags urgent situations, and makes the resulting
          information available in your dashboard. It may also send follow-up messages on your
          behalf where you have configured it to.
        </P>
        <Callout>
          The AI receptionist is an automated system, not a person, and not a substitute for
          emergency services. It can mishear, misunderstand, or fail to capture a detail. You are
          responsible for reviewing captured leads and for any decision made on the basis of them.
        </Callout>
        <P>
          We develop the Service continuously and may add, change, or remove features. Where a
          change materially reduces core functionality you are paying for, we will give reasonable
          notice.
        </P>
      </Section>

      <Section id="accounts" title="3. Account requirements">
        <UL>
          <LI>You must be at least 18 years old and able to enter into a binding contract.</LI>
          <LI>
            Account information must be accurate and kept up to date, including the business name,
            service areas, and contact details the receptionist relies on when speaking to callers.
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

      <Section id="responsibilities" title="4. Your responsibilities">
        <P>
          The Service records and transcribes telephone calls on your behalf. Call recording is
          regulated, and the rules differ by jurisdiction — some require that every party to a call
          consents.
        </P>
        <UL>
          <LI>
            You are responsible for ensuring that recording and transcribing calls to your number is
            lawful where you and your callers are located, and for any notice or consent this
            requires.
          </LI>
          <LI>
            You are responsible for the accuracy of the business information you configure, which
            the receptionist will state to callers as fact.
          </LI>
          <LI>
            You are responsible for how you use captured contact details, including compliance with
            marketing and do-not-call rules that apply to you.
          </LI>
        </UL>
      </Section>

      <Section id="billing" title="5. Subscriptions and billing">
        <P>
          Paid plans are billed in advance on a recurring basis at the price and interval shown at
          checkout. Your subscription renews automatically at the end of each billing period until
          it is cancelled.
        </P>
        <Callout>
          Payments are processed by <Strong>Paddle</Strong>, which acts as the merchant of record
          for every transaction. Paddle handles the payment, invoicing, and any sales tax or VAT,
          and appears as the seller on your statement. We never receive or store your card details.
        </Callout>
        <UL>
          <LI>
            Prices are shown before you pay. Taxes are calculated by Paddle based on your billing
            location and may be added at checkout.
          </LI>
          <LI>
            We may change subscription pricing. A change affecting an existing subscription takes
            effect at the next renewal, and you will be given notice before it applies so you can
            cancel if you do not accept it.
          </LI>
          <LI>
            If a renewal payment fails, we may retry it and may suspend access until payment
            succeeds.
          </LI>
        </UL>
        <P>
          Refunds are covered by our{' '}
          <InternalLink to={MARKETING_ROUTES.refunds}>Refund Policy</InternalLink>, which forms part
          of these terms.
        </P>
      </Section>

      <Section id="cancellation" title="6. Cancellation">
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

      <Section id="ip" title="7. Intellectual property">
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

      <Section id="acceptable-use" title="8. Acceptable use">
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

      <Section id="availability" title="9. Service availability">
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

      <Section id="liability" title="10. Disclaimers and limitation of liability">
        <P>
          The Service is provided “as is” and “as available”. To the fullest extent permitted by
          law, we disclaim all warranties not expressly stated in these terms, including implied
          warranties of merchantability, fitness for a particular purpose, and non-infringement.
        </P>
        <P>
          To the fullest extent permitted by law, we are not liable for indirect, incidental,
          special, consequential, or punitive damages, or for lost profits, lost revenue, lost
          business, or lost data — including business lost through a call the AI receptionist
          mishandled, missed, or failed to answer.
        </P>
        <P>
          Our total aggregate liability arising out of or relating to the Service is limited to the
          amount you paid us in the twelve months before the event giving rise to the claim.
        </P>
        <P>
          Nothing in these terms excludes liability that cannot lawfully be excluded, including
          liability for fraud or for death or personal injury caused by negligence.
        </P>
      </Section>

      <Section id="termination" title="11. Termination">
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

      <Section id="changes" title="12. Changes to these terms">
        <P>
          We may update these terms as the Service and the business behind it develop — including
          when RoofersLabs is incorporated, at which point the operator named above will be replaced
          by the new legal entity. We will change the “last updated” date at the top of this page,
          and for material changes we will give notice by email or in the product before they take
          effect. Continuing to use the Service after a change takes effect means you accept it.
        </P>
      </Section>

      <Section id="governing-law" title="13. Governing law">
        <P>
          These terms are governed by the laws of {ENTITY.governingLaw}, without regard to conflict
          of law rules. Any dispute arising out of or relating to these terms or the Service is
          subject to the exclusive jurisdiction of the competent courts in {ENTITY.governingLaw}.
        </P>
        <P>
          If any provision of these terms is found unenforceable, the rest remains in force. Our
          failure to enforce a provision is not a waiver of it.
        </P>
      </Section>

      <Section id="contact" title="14. Contact">
        <P>
          Questions about these terms can be sent to <MailLink email={CONTACT.email} />. We reply{' '}
          {CONTACT.responseTime} during {CONTACT.hours}.
        </P>
      </Section>
    </LegalLayout>
  );
}

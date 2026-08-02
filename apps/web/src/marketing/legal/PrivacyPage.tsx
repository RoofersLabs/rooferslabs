import { MARKETING_ROUTES } from '../routes';
import { LegalLayout } from './LegalLayout';
import { Callout, LI, MailLink, P, Section, Strong, Subheading, UL } from './Prose';
import { CONTACT, ENTITY } from './content';

export function PrivacyPage() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="What rooferslabs collects, why, who processes it, and the control you have over it."
      seoDescription="How rooferslabs handles personal data — what is collected, how call recordings and transcripts are used, retention periods, and your rights."
      path={MARKETING_ROUTES.privacy}
    >
      <Section id="who-we-are" title="1. Who we are">
        <P>{ENTITY.description}</P>
        <P>
          This policy explains how we handle personal data when you use rooferslabs. It covers two
          groups of people, and the difference matters: our <Strong>customers</Strong>, the roofing
          businesses who hold accounts, and our customers’ <Strong>callers</Strong>, the homeowners
          and businesses who telephone them.
        </P>
        <Callout>
          For caller data, our customer decides why the calls are answered and recorded, and we act
          on their instructions. In data-protection terms our customer is the controller and we are
          the processor. For account and billing data, we are the controller.
        </Callout>
      </Section>

      <Section id="collect" title="2. Information we collect">
        <Subheading>Account information</Subheading>
        <P>
          Your name, email address, business name, business phone number, service areas, and the
          configuration you give the receptionist — including your business hours, services, and
          knowledge base.
        </P>

        <Subheading>Call information</Subheading>
        <P>
          When a call reaches your rooferslabs number we process the caller’s telephone number, the
          time and duration of the call, an audio recording, a transcript, and the details the
          caller gives during the conversation — typically their name, callback number, property
          address, and what is wrong with their roof.
        </P>

        <Subheading>Billing information</Subheading>
        <P>
          Your billing name, email, country, and subscription status. We hold identifiers issued by
          our payment processor and the status of your subscription, and nothing more.
        </P>

        <Subheading>Technical information</Subheading>
        <P>
          IP address, browser and device type, and log records of requests to the application. This
          is generated automatically and used to operate and secure the Service.
        </P>
      </Section>

      <Section id="use" title="3. How we use information">
        <UL>
          <LI>To answer calls, capture leads, and present them to you in the dashboard.</LI>
          <LI>
            To transcribe and summarise calls, and to detect urgency so genuine emergencies can be
            flagged to you quickly.
          </LI>
          <LI>To send you notifications about calls, leads, and appointments.</LI>
          <LI>To create and manage your account, and to authenticate you.</LI>
          <LI>To take payment and manage your subscription.</LI>
          <LI>To provide support and answer your questions.</LI>
          <LI>To secure the Service, investigate abuse, and comply with legal obligations.</LI>
          <LI>
            To improve the Service, using aggregated and de-identified information that does not
            identify you, your business, or your callers.
          </LI>
        </UL>
        <P>
          We do not sell personal data. We do not use call recordings or transcripts to train
          publicly available AI models.
        </P>
      </Section>

      <Section id="payment" title="4. Payment information">
        <Callout>
          Payments are processed by <Strong>PayPal</Strong>. Card numbers, bank details, and PayPal
          account credentials are entered on PayPal’s own systems and are{' '}
          <Strong>never transmitted to or stored by rooferslabs</Strong>. We hold only the
          identifiers PayPal issues, your subscription status, and the payment history needed to
          show you what you have paid.
        </Callout>
        <P>
          To take a payment we send PayPal your billing email address and your business name, and
          PayPal returns a payer identifier and a subscription identifier that we store against your
          account. PayPal is an independent controller of the payment data it collects and applies
          its own privacy policy to that processing.
        </P>
      </Section>

      <Section id="authentication" title="5. Authentication">
        <P>
          Sign-in is handled by Clerk. When you create an account or sign in, Clerk processes your
          email address, your chosen sign-in method, and session information, and issues the session
          token the application checks on each request. We do not store your password — if you use
          one, it is held by Clerk, hashed.
        </P>
      </Section>

      <Section id="cookies" title="6. Cookies and similar technologies">
        <P>
          We use cookies and browser storage only for what the Service needs to work. There are no
          advertising cookies and no third-party tracking pixels on the application.
        </P>
        <UL>
          <LI>
            <Strong>Essential cookies</Strong> keep you signed in, protect against cross-site
            request forgery, and remember interface preferences such as whether the sidebar is
            collapsed.
          </LI>
          <LI>
            <Strong>Payment cookies</Strong> are set by PayPal on its own pages when you approve or
            manage a subscription, so a payment can be completed securely.
          </LI>
        </UL>
        <P>
          Because these are strictly necessary to deliver a service you have asked for, they do not
          require consent. If we ever add analytics or marketing cookies, we will ask first.
        </P>
      </Section>

      <Section id="transfers" title="7. International transfers">
        <P>
          The Service is operated from {ENTITY.governingLaw} and hosted on infrastructure located in
          the United States. Personal data — including call recordings and transcripts — is
          therefore transferred across borders and processed in countries whose data-protection laws
          may differ from those where you or your callers are located.
        </P>
        <P>
          Where such a transfer involves personal data protected by the laws of the European
          Economic Area or the United Kingdom, we rely on the European Commission’s Standard
          Contractual Clauses, or an equivalent safeguard, in our agreements with the providers who
          process it on our behalf.
        </P>
      </Section>

      <Section id="security" title="8. Data security">
        <UL>
          <LI>All traffic is encrypted in transit using TLS.</LI>
          <LI>
            Data at rest, including call recordings, is encrypted using the storage encryption
            provided by our cloud infrastructure.
          </LI>
          <LI>
            Every request is scoped to the account that made it, so one customer cannot read
            another’s calls, customers, or recordings.
          </LI>
          <LI>Access to production systems is restricted and authenticated.</LI>
          <LI>
            Payment credentials never enter our systems, which removes an entire category of risk
            rather than mitigating it.
          </LI>
        </UL>
        <P>
          No system is perfectly secure. If a breach affects your personal data and is likely to
          result in a risk to your rights, we will notify you and the relevant authority as required
          by law.
        </P>
      </Section>

      <Section id="retention" title="9. Data retention">
        <UL>
          <LI>
            <Strong>Account data</Strong> is kept while your account is open, and for up to 90 days
            after closure so the account can be restored if closure was a mistake.
          </LI>
          <LI>
            <Strong>Call recordings and transcripts</Strong> are kept while your account is open, so
            you can review the history of a customer relationship. You may delete individual
            recordings at any time.
          </LI>
          <LI>
            <Strong>Billing records</Strong> are kept for as long as tax and accounting law
            requires, typically seven years, and this period continues after your account closes.
          </LI>
          <LI>
            <Strong>Technical logs</Strong> are kept for a short operational period and then
            discarded.
          </LI>
        </UL>
        <P>
          You may ask us to delete your data sooner by emailing <MailLink email={CONTACT.email} />.
          We will comply except where we are required to keep something by law.
        </P>
      </Section>

      <Section id="rights" title="10. Your rights">
        <P>
          Depending on where you live, you may have the right to access the personal data we hold
          about you, to have it corrected, to have it deleted, to object to or restrict how we use
          it, to receive a portable copy, and to withdraw consent where our use relies on it.
        </P>
        <P>
          These rights are recognised under India’s Digital Personal Data Protection Act, the EU and
          UK GDPR, and US state privacy laws including the CCPA, among others. Exercise them by
          emailing <MailLink email={CONTACT.email} />. We will respond within the period the
          applicable law allows, and will not charge you or treat you differently for asking.
        </P>
        <P>
          <Strong>If you are a caller</Strong> rather than an account holder, and you want a
          recording of your call deleted, contact the roofing business you telephoned. They decide
          what happens to it, and we will act on their instruction. If you cannot reach them, write
          to us and we will help identify who to ask.
        </P>
      </Section>

      <Section id="children" title="11. Children">
        <P>
          The Service is a business tool and is not directed at children. We do not knowingly
          collect personal data from anyone under 18. If you believe a child’s data has reached us,
          contact us and we will delete it.
        </P>
      </Section>

      <Section id="changes" title="12. Changes to this policy">
        <P>
          We will update this policy as the Service changes, and will revise the “last updated” date
          above. Where a change materially affects how we handle your personal data, we will tell
          you before it takes effect.
        </P>
      </Section>

      <Section id="contact" title="13. Contact">
        <P>
          Questions about privacy, or a request about your data, can be sent to{' '}
          <MailLink email={CONTACT.email} />. We reply {CONTACT.responseTime} during {CONTACT.hours}
          .
        </P>
      </Section>
    </LegalLayout>
  );
}

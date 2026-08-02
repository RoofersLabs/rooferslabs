/**
 * The facts every legal page states about who is behind rooferslabs.
 *
 * One place, because these are the strings that stop being true first.
 * RoofersLabs is not incorporated: it is a trading name operated by an
 * individual, and saying otherwise in a document submitted for payment-
 * processor verification would be a false statement about a legal entity —
 * a worse problem than an obviously provisional one. When incorporation
 * happens, {@link ENTITY} is the edit, and the prose that reads from it
 * follows.
 */
export const ENTITY = {
  /** The brand, lowercase everywhere it is not starting a sentence. */
  brand: 'rooferslabs',
  /** How the operator is named in a contractual sentence. */
  legalName: 'Jagadeesh Kambala',
  /**
   * The full formulation, used the first time each document identifies the
   * counterparty. Deliberately explicit about the pre-incorporation status
   * rather than quietly ambiguous.
   */
  description:
    '“RoofersLabs” is a trading name and brand operated by Jagadeesh Kambala as an individual. RoofersLabs is not yet incorporated. When a company is formed, these terms will be updated to name that entity, and continued use of the Service after that update will be subject to the updated terms.',
  /**
   * No city. The registered office is not fixed until incorporation, and a
   * courts clause naming one would be inventing a fact — "the competent
   * courts in India" is both true today and enforceable.
   */
  governingLaw: 'India',
} as const;

export const CONTACT = {
  /** The address already published in the footer and the sales CTA. */
  email: 'hello@rooferslabs.com',
  /** Support hours, stated in the market the product serves. */
  hours: 'Monday to Friday, 9:00am – 6:00pm US Central Time',
  responseTime: 'within one business day',
} as const;

/**
 * The date the documents last changed in substance.
 *
 * Written by hand rather than derived from the build, which would reset it on
 * every unrelated deploy and tell a reader the terms had changed when nothing
 * had. Update it when the wording changes, not when the site does.
 */
export const LAST_UPDATED = '1 August 2026';

import type { PropertyType } from '@rooferslabs/shared';

/**
 * What the application knows about a caller BEFORE the model says a word.
 *
 * Twilio hands us the caller ID on the voice webhook, and it is persisted on the
 * Call record. Everything here is therefore available at session-build time —
 * which is the whole point: the receptionist used to open every call knowing
 * nothing about who was on the line, so "what's the best number to reach you?"
 * was the only way it could get a callback number, and it asked for one the
 * office already had.
 */
export interface CallerContext {
  /**
   * The caller's number in the form Twilio gave it, or null when the call
   * genuinely has no usable caller ID (withheld, blocked, or a trunk that sends
   * none). Null is the ONLY case in which the receptionist may ask for a number.
   */
  callerNumber: string | null;
  /** The business number the caller dialled, when known. */
  dialedNumber: string | null;
  /** Twilio's Call SID, for correlating a live session with the call record. */
  twilioCallSid: string | null;
  /** The CRM record this caller ID already matches, when there is one. */
  knownCustomer: KnownCustomer | null;
}

/** The parts of an existing customer record worth putting in front of the model. */
export interface KnownCustomer {
  fullName: string | null;
  propertyAddress: string | null;
  propertyType: PropertyType | null;
}

/** A caller context for a call whose caller ID could not be resolved. */
export function anonymousCallerContext(): CallerContext {
  return {
    callerNumber: null,
    dialedNumber: null,
    twilioCallSid: null,
    knownCustomer: null,
  };
}

/**
 * Placeholders carriers and Twilio send in the `From` field when the caller
 * withheld their number. They are not phone numbers and must never be captured
 * as one, echoed back to the caller, or texted after the call.
 *
 * `+266696687` is the last of these and the least obvious: it is ANONYMOUS typed
 * on a phone keypad, which some US carriers send as a literal caller ID.
 */
const WITHHELD_CALLER_IDS = new Set([
  'anonymous',
  'unavailable',
  'unknown',
  'restricted',
  'private',
  'blocked',
  '+266696687',
  '266696687',
]);

/** A plausible dialable number: optional +, then 8–15 digits. */
const DIALABLE = /^\+?\d{8,15}$/;

/**
 * Normalize Twilio's `From` into a number we are willing to treat as the
 * caller's own, or null.
 *
 * Deliberately strict. Treating a placeholder as a real number is the worse
 * failure of the two: it would suppress the one question that recovers the call
 * ("what's the best number to reach you?") AND put a junk value on the lead, so
 * the office would call back nobody. A false negative just means the
 * receptionist asks, exactly as it does today.
 */
export function normalizeCallerNumber(from: string | null | undefined): string | null {
  const value = (from ?? '').trim();
  if (!value) return null;
  if (WITHHELD_CALLER_IDS.has(value.toLowerCase())) return null;

  // SIP and client identifiers ("sip:…", "client:…") are addresses, not numbers.
  if (value.includes(':')) return null;

  const compact = value.replace(/[\s()\-.]/g, '');
  return DIALABLE.test(compact) ? compact : null;
}

/**
 * The caller's number spoken as digits, for a receptionist reading it back.
 *
 * Grouped the way an American receptionist says a number out loud — country
 * code, then area code, then exchange, then line — because the model otherwise
 * reads a raw E.164 string as one fifteen-digit run, which is unintelligible on
 * a phone and defeats the confirmation entirely.
 */
export function spokenNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const national = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (national.length !== 10) return digits.split('').join(' ');

  return [national.slice(0, 3), national.slice(3, 6), national.slice(6)]
    .map((group) => group.split('').join(' '))
    .join(', ');
}

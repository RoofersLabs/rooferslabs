import { normalizeCallerNumber, spokenNumber } from './caller-context';

describe('normalizeCallerNumber', () => {
  it('accepts the E.164 numbers Twilio normally sends', () => {
    expect(normalizeCallerNumber('+15125551234')).toBe('+15125551234');
    expect(normalizeCallerNumber('+442071838750')).toBe('+442071838750');
  });

  it('strips the punctuation a human-formatted caller ID may carry', () => {
    expect(normalizeCallerNumber(' (512) 555-1234 ')).toBe('5125551234');
  });

  it('rejects every withheld-caller-ID placeholder', () => {
    // Treating one of these as a real number is the damaging failure: it would
    // suppress the one question that recovers the call AND write a junk callback
    // number onto the lead, so the office rings nobody.
    for (const withheld of [
      'anonymous',
      'Anonymous',
      'unavailable',
      'unknown',
      'restricted',
      'private',
      'blocked',
      '+266696687', // ANONYMOUS typed on a keypad — a real US carrier caller ID
      '',
      '   ',
      null,
      undefined,
    ]) {
      expect(normalizeCallerNumber(withheld)).toBeNull();
    }
  });

  it('rejects SIP and client identifiers, which are addresses rather than numbers', () => {
    expect(normalizeCallerNumber('sip:dana@example.com')).toBeNull();
    expect(normalizeCallerNumber('client:dana')).toBeNull();
  });

  it('rejects anything too short or too long to dial', () => {
    expect(normalizeCallerNumber('+1234')).toBeNull();
    expect(normalizeCallerNumber('+1234567890123456')).toBeNull();
  });
});

describe('spokenNumber', () => {
  it('groups a US number the way a receptionist reads one aloud', () => {
    // Read back as one fifteen-digit run, a confirmation is useless on a phone.
    expect(spokenNumber('+15125551234')).toBe('5 1 2, 5 5 5, 1 2 3 4');
    expect(spokenNumber('5125551234')).toBe('5 1 2, 5 5 5, 1 2 3 4');
  });

  it('falls back to plain digits for anything that is not a 10-digit number', () => {
    expect(spokenNumber('+442071838750')).toBe('4 4 2 0 7 1 8 3 8 7 5 0');
  });
});

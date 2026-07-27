import { detectPlatform, installStrategy } from './platform';

/**
 * Real user-agent strings. The install flow branches on these, so they are
 * pinned here rather than approximated — the iPadOS entry in particular is the
 * one that broke the shipped behaviour, by being indistinguishable from a Mac
 * on its UA alone.
 */
const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
  androidEdge:
    'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36 EdgA/121.0.0.0',
  samsungInternet:
    'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:123.0) Gecko/123.0 Firefox/123.0',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  ipadOs13Plus:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  desktopSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
};

const signals = (userAgent: string, maxTouchPoints = 0, coarsePointer = false) => ({
  userAgent,
  maxTouchPoints,
  coarsePointer,
});

describe('detectPlatform', () => {
  describe('Android', () => {
    it.each([
      ['Chrome', UA.androidChrome],
      ['Edge', UA.androidEdge],
      ['Samsung Internet', UA.samsungInternet],
      ['Firefox', UA.firefoxAndroid],
    ])('treats Android %s as mobile, not iOS', (_name, ua) => {
      const p = detectPlatform(signals(ua, 5, true));
      expect(p).toEqual({ isIos: false, isAndroid: true, isMobile: true });
    });
  });

  describe('iOS', () => {
    it('detects iPhone Safari', () => {
      expect(detectPlatform(signals(UA.iphoneSafari, 5, true))).toEqual({
        isIos: true,
        isAndroid: false,
        isMobile: true,
      });
    });

    // The regression behind issue 1: iPadOS 13+ sends a desktop Safari UA, so
    // UA-only detection classified an iPad as a desktop and handed it the QR
    // code. Touch points are what separate it from a real Mac.
    it('detects iPadOS 13+ despite its desktop user agent', () => {
      const p = detectPlatform(signals(UA.ipadOs13Plus, 5, true));
      expect(p.isIos).toBe(true);
      expect(p.isMobile).toBe(true);
    });

    // Hardware iPads report 5; emulators and some virtualised browsers report
    // 1. Both must land on the iOS path, never the desktop QR.
    it.each([1, 2, 5, 10])('detects iPadOS when maxTouchPoints is %i', (touchPoints) => {
      const p = detectPlatform(signals(UA.ipadOs13Plus, touchPoints, true));
      expect(p.isIos).toBe(true);
    });

    it('does not mistake a real Mac for an iPad', () => {
      const p = detectPlatform(signals(UA.desktopSafari, 0, false));
      expect(p.isIos).toBe(false);
      expect(p.isMobile).toBe(false);
    });
  });

  describe('desktop', () => {
    it.each([
      ['Chrome', UA.desktopChrome],
      ['Safari', UA.desktopSafari],
    ])('treats desktop %s as non-mobile so it keeps the QR flow', (_name, ua) => {
      expect(detectPlatform(signals(ua))).toEqual({
        isIos: false,
        isAndroid: false,
        isMobile: false,
      });
    });
  });

  describe('fallbacks', () => {
    it('classifies an unrecognised touch-primary device as mobile', () => {
      // Anything with touch as the primary input must not be shown a QR code
      // pointing at the device already in the user's hand.
      const p = detectPlatform(signals('Mozilla/5.0 (Unknown Tablet)', 5, true));
      expect(p.isMobile).toBe(true);
    });

    it('is inert with no signals at all', () => {
      expect(detectPlatform(signals(''))).toEqual({
        isIos: false,
        isAndroid: false,
        isMobile: false,
      });
    });
  });
});

/**
 * End-to-end decision table: user agent in, install behaviour out. Each row is
 * one of the scenarios the install flow has to serve.
 */
describe('install strategy by scenario', () => {
  const strategyFor = (
    ua: string,
    { canPrompt = false, installed = false, touch = false } = {},
  ) => {
    const { isIos, isMobile } = detectPlatform(signals(ua, touch ? 5 : 0, touch));
    return installStrategy({ installed, canPrompt, isIos, isMobile });
  };

  it('1. desktop Chrome → QR flow', () => {
    expect(strategyFor(UA.desktopChrome)).toBe('desktop');
  });

  it('1b. desktop keeps the QR flow even when a native prompt is available', () => {
    // The desktop modal offers "Install on this computer" inside itself, so the
    // QR must not be skipped just because Chrome offered a prompt.
    expect(strategyFor(UA.desktopChrome, { canPrompt: true })).toBe('desktop');
  });

  it.each([
    ['2. Android Chrome', UA.androidChrome],
    ['3. Android Edge', UA.androidEdge],
    ['4. Samsung Internet', UA.samsungInternet],
  ])('%s with a prompt available → native install', (_name, ua) => {
    expect(strategyFor(ua, { canPrompt: true, touch: true })).toBe('native');
  });

  it('5. Android before beforeinstallprompt fires → menu instructions, never QR', () => {
    expect(strategyFor(UA.androidChrome, { canPrompt: false, touch: true })).toBe('mobile-help');
  });

  it('6. Firefox Android (no prompt support) → menu instructions', () => {
    expect(strategyFor(UA.firefoxAndroid, { touch: true })).toBe('mobile-help');
  });

  it('7. iOS Safari → Share-sheet instructions', () => {
    expect(strategyFor(UA.iphoneSafari, { touch: true })).toBe('ios');
  });

  it('8. iPadOS 13+ → iOS instructions, not the desktop QR', () => {
    expect(strategyFor(UA.ipadOs13Plus, { touch: true })).toBe('ios');
  });

  it.each([
    ['installed Android PWA', UA.androidChrome],
    ['installed iOS PWA', UA.iphoneSafari],
    ['installed desktop PWA', UA.desktopChrome],
  ])('9. %s → button hidden, never re-prompted', (_name, ua) => {
    expect(strategyFor(ua, { installed: true, canPrompt: true, touch: true })).toBe('hidden');
  });

  it('no handheld can ever reach the desktop QR flow', () => {
    const handhelds = [
      UA.androidChrome,
      UA.androidEdge,
      UA.samsungInternet,
      UA.firefoxAndroid,
      UA.iphoneSafari,
      UA.ipadOs13Plus,
    ];
    for (const ua of handhelds) {
      for (const canPrompt of [true, false]) {
        expect(strategyFor(ua, { canPrompt, touch: true })).not.toBe('desktop');
      }
    }
  });

  it('installed always wins, on every platform and prompt state', () => {
    for (const ua of Object.values(UA)) {
      for (const canPrompt of [true, false]) {
        for (const touch of [true, false]) {
          expect(strategyFor(ua, { installed: true, canPrompt, touch })).toBe('hidden');
        }
      }
    }
  });
});

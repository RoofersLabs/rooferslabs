/**
 * Platform detection for the PWA install flow.
 *
 * Kept pure and separate from React so the branch every install path depends on
 * can be unit-tested against real user-agent strings instead of being trusted.
 *
 * The install experience only ever needs three answers: is this iOS (no
 * `beforeinstallprompt`, manual Share-sheet steps), is it a phone/tablet (must
 * never be shown the desktop QR code), and — from the caller — is a native
 * prompt waiting.
 */
export interface PlatformSignals {
  userAgent: string;
  /** `navigator.maxTouchPoints`. The tell for iPadOS 13+, which lies in its UA. */
  maxTouchPoints: number;
  /** `matchMedia('(pointer: coarse)').matches`. Touch is the primary input. */
  coarsePointer: boolean;
}

export interface Platform {
  isIos: boolean;
  isAndroid: boolean;
  /** Any handheld/tablet: the QR flow must never be shown to these. */
  isMobile: boolean;
}

export function detectPlatform({
  userAgent,
  maxTouchPoints,
  coarsePointer,
}: PlatformSignals): Platform {
  const ua = userAgent.toLowerCase();

  // iPadOS 13+ reports the desktop Safari UA verbatim ("Macintosh; Intel Mac
  // OS X"), so the UA alone cannot see it. A Mac reporting *any* touch point is
  // an iPad: real Macs report 0, touch-bar models included, and trackpads are
  // pointer devices rather than touch. Hardware iPads report 5, but emulators
  // and some remote/virtualised browsers report 1 — testing for > 0 rather than
  // > 1 keeps those on the iOS path instead of dropping them onto the desktop
  // QR flow, which is the failure this whole branch exists to prevent.
  const isIpadOs = /macintosh/.test(ua) && maxTouchPoints > 0;
  const isIos = /iphone|ipad|ipod/.test(ua) || isIpadOs;
  const isAndroid = /android/.test(ua);

  // `coarsePointer` is the backstop for anything neither list names — Windows
  // tablets, Firefox's mobile UA, KaiOS. Erring toward "mobile" is the safe
  // direction: the worst case is a desktop user being told to use their
  // browser menu, which works, rather than a phone user being handed a QR code
  // pointing at the device already in their hand.
  const isMobile = isIos || isAndroid || coarsePointer;

  return { isIos, isAndroid, isMobile };
}

/**
 * How the install button should behave for this visitor.
 *
 * - `hidden`      — already installed; the button must not render.
 * - `native`      — a deferred prompt is waiting on a handheld: prompt at once.
 * - `ios`         — iOS/iPadOS, which has no `beforeinstallprompt`: Share-sheet steps.
 * - `mobile-help` — a handheld with no prompt available: browser-menu steps.
 * - `desktop`     — the existing QR flow, plus the native option when offered.
 */
export type InstallStrategy = 'hidden' | 'native' | 'ios' | 'mobile-help' | 'desktop';

/**
 * The full install decision table, kept pure so every row can be asserted.
 *
 * The ordering matters: `installed` wins over everything so a launched PWA
 * never re-prompts, and `isMobile` is checked before `desktop` can be reached,
 * which is the invariant that keeps the QR code off handhelds.
 */
export function installStrategy({
  installed,
  canPrompt,
  isIos,
  isMobile,
}: {
  installed: boolean;
  canPrompt: boolean;
  isIos: boolean;
  isMobile: boolean;
}): InstallStrategy {
  if (installed) return 'hidden';
  if (!isMobile) return 'desktop';
  if (canPrompt) return 'native';
  return isIos ? 'ios' : 'mobile-help';
}

/** Reads the signals from the live browser. Returns desktop defaults under SSR. */
export function readPlatformSignals(): PlatformSignals {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return { userAgent: '', maxTouchPoints: 0, coarsePointer: false };
  }
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    coarsePointer: window.matchMedia?.('(pointer: coarse)').matches ?? false,
  };
}

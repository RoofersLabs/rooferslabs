import { registerPwaListeners, usePwaStore, __resetPwaListenersForTest } from './pwa.store';

/**
 * Regression cover for the defect behind the hidden install button:
 * `registerPwaListeners` existed but was never called, so
 * `beforeinstallprompt` was never captured, `canPrompt` stayed false forever,
 * and the button hid itself on every Android device.
 *
 * The event fires once and early; if nothing is listening it is unrecoverable,
 * so this is asserted rather than assumed.
 *
 * Jest runs this project in the `node` environment. Rather than pull in
 * `jest-environment-jsdom` for four listeners, the handful of `window` members
 * the store touches are faked here — the code under test is exercised exactly
 * as written.
 */
type Listener = (event: FakeEvent) => void;

interface FakeEvent {
  type: string;
  defaultPrevented?: boolean;
  preventDefault?: () => void;
}

function installFakeWindow() {
  const listeners = new Map<string, Listener[]>();
  const win = {
    addEventListener: (type: string, fn: Listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    dispatchEvent: (event: FakeEvent) => {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
    },
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    /** How many handlers the store attached for a given event. */
    count: (type: string) => (listeners.get(type) ?? []).length,
  };
  (globalThis as { window?: unknown }).window = win;
  return win;
}

function makeInstallPromptEvent(): FakeEvent {
  const event: FakeEvent = { type: 'beforeinstallprompt', defaultPrevented: false };
  event.preventDefault = () => {
    event.defaultPrevented = true;
  };
  return event;
}

describe('registerPwaListeners', () => {
  let win: ReturnType<typeof installFakeWindow>;

  beforeEach(() => {
    __resetPwaListenersForTest();
    usePwaStore.setState({ deferredPrompt: null, installed: false });
    win = installFakeWindow();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('captures beforeinstallprompt so the button can offer a native install', () => {
    registerPwaListeners();
    expect(usePwaStore.getState().deferredPrompt).toBeNull();

    win.dispatchEvent(makeInstallPromptEvent());

    expect(usePwaStore.getState().deferredPrompt).not.toBeNull();
  });

  it('ignores the event entirely when registration never ran', () => {
    // The shipped bug, pinned: no listener means no prompt, forever.
    win.dispatchEvent(makeInstallPromptEvent());
    expect(usePwaStore.getState().deferredPrompt).toBeNull();
  });

  it('suppresses the browser mini-infobar via preventDefault', () => {
    registerPwaListeners();
    const event = makeInstallPromptEvent();
    win.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('marks installed and drops the stale prompt on appinstalled', () => {
    registerPwaListeners();
    win.dispatchEvent(makeInstallPromptEvent());

    win.dispatchEvent({ type: 'appinstalled' });

    expect(usePwaStore.getState().installed).toBe(true);
    // Reusing a spent event is forbidden by Chrome, so it must not survive.
    expect(usePwaStore.getState().deferredPrompt).toBeNull();
  });

  it('is idempotent, so repeat calls cannot double-bind handlers', () => {
    registerPwaListeners();
    registerPwaListeners();
    registerPwaListeners();

    expect(win.count('beforeinstallprompt')).toBe(1);
    expect(win.count('appinstalled')).toBe(1);
  });
});

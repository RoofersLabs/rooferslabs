import { create } from 'zustand';

/** Chrome's non-standard install prompt event. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** Deferred install prompt (Chrome/Edge/Android). Null when unavailable. */
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** True when running as an installed app or after a successful install. */
  installed: boolean;
  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void;
  setInstalled: (installed: boolean) => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  deferredPrompt: null,
  installed:
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari standalone flag
      (navigator as unknown as { standalone?: boolean }).standalone === true),
  setDeferredPrompt: (event) => set({ deferredPrompt: event }),
  setInstalled: (installed) => set({ installed }),
}));

/**
 * Whether `registerPwaListeners` has already run.
 *
 * `beforeinstallprompt` fires once. Binding a second listener would not
 * duplicate the prompt, but re-running under HMR would leave dead handlers
 * attached to `window`, so registration is made idempotent rather than relying
 * on the caller.
 */
let registered = false;

/** Test-only: clears the idempotence latch so each case starts unregistered. */
export function __resetPwaListenersForTest(): void {
  registered = false;
}

/**
 * Capture the browser install prompt globally.
 *
 * MUST be called at module scope in main.tsx, before React renders: Chrome
 * fires `beforeinstallprompt` very early, and an event missed here is gone for
 * the rest of the page's life — leaving `canPrompt` false forever, which is
 * exactly how the install button came to be hidden on Android.
 */
export function registerPwaListeners(): void {
  if (registered || typeof window === 'undefined') return;
  registered = true;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Suppress Chrome's own mini-infobar so the prompt happens on our button's
    // terms, and stash the event for `promptInstall()`.
    event.preventDefault();
    usePwaStore.getState().setDeferredPrompt(event as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    usePwaStore.getState().setInstalled(true);
    // The event cannot be reused once installed; dropping it stops the button
    // from offering a second, guaranteed-to-fail prompt.
    usePwaStore.getState().setDeferredPrompt(null);
  });

  // Catches the display-mode flip when the app is installed and launched while
  // this document is still alive, which `appinstalled` alone can miss.
  const standalone = window.matchMedia('(display-mode: standalone)');
  standalone.addEventListener?.('change', (event) => {
    if (event.matches) usePwaStore.getState().setInstalled(true);
  });
}

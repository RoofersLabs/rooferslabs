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
 * Capture the browser install prompt globally (must be registered before the
 * event fires, so this runs at module import time in main.tsx).
 */
export function registerPwaListeners(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    usePwaStore.getState().setDeferredPrompt(event as BeforeInstallPromptEvent);
  });
  window.addEventListener('appinstalled', () => {
    usePwaStore.getState().setInstalled(true);
    usePwaStore.getState().setDeferredPrompt(null);
  });
}

import { useCallback, useMemo } from 'react';
import { usePwaStore } from '@/state/pwa.store';
import { detectPlatform, installStrategy, readPlatformSignals } from '@/lib/platform';

export type { InstallStrategy } from '@/lib/platform';

/**
 * PWA install state + action for the "Add to Home Screen" button.
 *
 * `canPrompt` is only ever true if `registerPwaListeners()` ran at startup —
 * the event fires once, early, and cannot be recovered if missed.
 */
export function usePwaInstall() {
  const { deferredPrompt, installed, setDeferredPrompt, setInstalled } = usePwaStore();

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
    }
    // Cleared either way: Chrome forbids reusing the event, so keeping it would
    // let a second tap fire a prompt that silently does nothing.
    setDeferredPrompt(null);
    return choice.outcome === 'accepted';
  }, [deferredPrompt, setDeferredPrompt, setInstalled]);

  // The signals cannot change for the life of the document.
  const { isIos, isAndroid, isMobile } = useMemo(() => detectPlatform(readPlatformSignals()), []);

  const canPrompt = deferredPrompt !== null;
  const strategy = installStrategy({ installed, canPrompt, isIos, isMobile });

  return { canPrompt, installed, promptInstall, isIos, isAndroid, isMobile, strategy };
}

import { useCallback } from 'react';
import { usePwaStore } from '@/state/pwa.store';

/**
 * PWA install state + action for the "Add to Home Screen" button.
 *
 * - `canPrompt`: the native prompt is available (Chrome/Edge/Android).
 * - `installed`: hide the button entirely (required by the MVP spec).
 * - iOS Safari never fires beforeinstallprompt; callers show manual
 *   instructions when `!canPrompt && !installed` on iOS.
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
    setDeferredPrompt(null);
    return choice.outcome === 'accepted';
  }, [deferredPrompt, setDeferredPrompt, setInstalled]);

  const isIos =
    typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

  return { canPrompt: deferredPrompt !== null, installed, promptInstall, isIos };
}

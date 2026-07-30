import { useEffect, useState } from 'react';
import { BUILD_TIME_LAUNCH_MODE, fetchLaunchMode, type LaunchMode } from './launchMode';

/**
 * The launch mode, resolved once per page load and shared by every caller.
 *
 * Cached at module scope rather than in a query client because the first caller
 * — the public route table — sits ABOVE QueryClientProvider, which is mounted
 * inside the authenticated shell. Two consumers, one fetch, no provider
 * required.
 *
 * `null` means "not asked yet"; the promise is memoised so concurrent mounts
 * share a single request rather than racing.
 */
let cached: LaunchMode | null = null;
let inFlight: Promise<LaunchMode> | null = null;

function load(): Promise<LaunchMode> {
  if (cached !== null) return Promise.resolve(cached);
  inFlight ??= fetchLaunchMode().then((mode) => {
    cached = mode;
    inFlight = null;
    return mode;
  });
  return inFlight;
}

export interface LaunchModeState {
  mode: LaunchMode;
  /** True until the API has answered. Callers that gate rendering must respect it. */
  isLoading: boolean;
}

export function useLaunchMode(): LaunchModeState {
  // Seed from the build-time value so the first paint is already correct in the
  // common case and the fetch only ever confirms or corrects it.
  const [mode, setMode] = useState<LaunchMode>(cached ?? BUILD_TIME_LAUNCH_MODE);
  const [isLoading, setIsLoading] = useState(cached === null);

  useEffect(() => {
    if (cached !== null) return;
    let active = true;
    void load().then((resolved) => {
      if (!active) return;
      setMode(resolved);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { mode, isLoading };
}

/** Test seam: forget the cached answer between cases. */
export function resetLaunchModeCache(): void {
  cached = null;
  inFlight = null;
}

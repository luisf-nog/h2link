import { useEffect, useCallback } from "react";

/**
 * Calls `onVisible` whenever the browser tab becomes visible again.
 * The callback itself should check staleness (e.g. via store.lastFetchedAt).
 */
export function useVisibilityRefresh(onVisible: () => void) {
  const stableCallback = useCallback(onVisible, [onVisible]);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        stableCallback();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [stableCallback]);
}

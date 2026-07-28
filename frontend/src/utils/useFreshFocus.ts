import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

const DEFAULT_STALE_MS = 30000;

/**
 * Drop-in replacement for the common
 *   useFocusEffect(useCallback(() => { loadData(); }, []))
 * pattern used across every screen in this app. Plain useFocusEffect refetches
 * everything from scratch on every single focus -- so switching Home -> Circles
 * -> Home re-runs a full network load (and shows a loading spinner) even if you
 * were on that screen 5 seconds ago. This skips the reload if the screen was
 * already loaded within the last `staleMs`, and always loads on the very first
 * focus so nothing shows stale/empty on initial mount.
 *
 * Returns `markFresh()` -- call it after any load you trigger yourself outside
 * this hook (e.g. from a pull-to-refresh handler, or right after a
 * create/update/delete that reloads the list) so the staleness timer resets
 * and the next focus doesn't immediately re-fetch data that's actually current.
 * Skipping that call isn't a bug, just a missed optimization -- worst case is
 * one redundant fetch before the timer naturally expires.
 */
export function useFreshFocus(loadFn: () => void, staleMs: number = DEFAULT_STALE_MS): { markFresh: () => void } {
  const lastLoadedAt = useRef<number>(0);
  // Always-latest ref so the useFocusEffect callback below can have a stable
  // identity (not recreated every render) while still calling the current
  // version of loadFn, avoiding stale-closure bugs from capturing old state.
  const loadFnRef = useRef(loadFn);
  loadFnRef.current = loadFn;

  const markFresh = useCallback(() => {
    lastLoadedAt.current = Date.now();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastLoadedAt.current > staleMs) {
        lastLoadedAt.current = now;
        loadFnRef.current();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [staleMs])
  );

  return { markFresh };
}

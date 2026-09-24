/**
 * Android's Back button, while `active` (T-211).
 *
 * ⚠ **Registration order is the design.** React Native calls the most recently
 * registered handler first. Each screen registers only while it has something
 * to close (a card, the licences, the privacy text), so the innermost open
 * thing is always the newest registration and closes first; the app-level
 * handler in `App.tsx` then walks the screens (`backTarget`). Keyed on
 * `active` alone, with the callback in a ref, so a re-render does not
 * re-register and reshuffle that order.
 *
 * A hook: call it above any early return (`hooksOrder.test.ts`, T-209).
 */

import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

export function useBackHandler(active: boolean, onBack: () => void): void {
  const latest = useRef(onBack);
  latest.current = onBack;

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      latest.current();
      return true;
    });
    return () => subscription.remove();
  }, [active]);
}

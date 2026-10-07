/**
 * Call `callback` each time the app returns to the front, and not when it is
 * merely starting (`returnToFront.ts` says why the two differ). Returns the
 * unsubscribe.
 */

import { AppState } from 'react-native';
import { isReturnToFront, type FrontState } from './returnToFront';

export function onReturnToFront(callback: () => void): () => void {
  let previous: FrontState = AppState.currentState as FrontState;
  const subscription = AppState.addEventListener('change', (next) => {
    const returned = isReturnToFront(previous, next as FrontState);
    previous = next as FrontState;
    if (returned) callback();
  });
  return () => subscription.remove();
}

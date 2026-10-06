/**
 * The offer to unlock the passport (T-156d, D-089).
 *
 * Opened from a locked stamp's card, and later from Settings (T-156e). Never
 * opened by the app on its own: no notification, no banner, no timer (T-157,
 * the project lead's rule against nagging).
 *
 * What it says in each state is `entitlement/unlockSheet.ts`, tested in Node;
 * how it looks is `UnlockSheetView`, which the workbench draws in every state.
 * This file only moves between states: it asks `billingSync` for the price,
 * starts a purchase or a restore, and listens for what Google says.
 */

import { useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import {
  buyPassport,
  passportPrice,
  restorePurchases,
  subscribe,
} from '../entitlement/billingSync';
import { getMedals } from '../content/medalCatalogue';
import { getContentPack } from '../content/poiCatalogue';
import { isUnlocked } from '../entitlement/entitlementStore';
import { founderWindowOpen } from '../entitlement/founder';
import { stateAfterFailure, unlockSheetModel, type UnlockState } from '../entitlement/unlockSheet';
import { deviceLanguage } from '../i18n';
import type { PassportStamp } from './PassportView';
import { colors, spacing } from './theme';
import UnlockSheetView from './UnlockSheetView';

export default function UnlockSheet({
  waiting,
  onClose,
  onUnlocked,
  startWithRestore = false,
}: {
  /**
   * The locked stamps, the one tapped first (D-097, sheet A): drawn in colour
   * behind frosted glass, and counted in the headline. Empty from Settings
   * when nothing is waiting.
   */
  waiting: PassportStamp[];
  onClose: () => void;
  /** The passport is unlocked: redraw what was waiting. */
  onUnlocked: () => void;
  /** Settings' *Recover purchase* (T-156e): ask Google at once, on opening. */
  startWithRestore?: boolean;
}) {
  const [state, setState] = useState<UnlockState>({ kind: 'offer' });
  /** Google's price, kept through every state once it has answered. */
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    let open = true;
    const unsubscribe = subscribe((event) => {
      if (!open) return;
      if (event.kind === 'unlocked') {
        setState({ kind: 'unlocked' });
        onUnlocked();
      } else if (event.kind === 'pending') {
        setState({ kind: 'pending' });
      } else {
        setState(stateAfterFailure(event.failure));
        if (event.failure === 'alreadyOwned') void restore();
      }
    });
    if (startWithRestore) void restore();
    void (async () => {
      const answer = await passportPrice();
      if (!open) return;
      if ('price' in answer) {
        setPrice(answer.price);
      } else if (answer.failure !== 'failed') {
        setState(stateAfterFailure(answer.failure));
      }
      // A failed price lookup leaves the offer without a price; Buy still works.
    })();
    return () => {
      open = false;
      unsubscribe();
    };
    // Once per opening; the callbacks are the screen's and do not change meaning.
  }, []);

  const buy = () => {
    setState({ kind: 'working' });
    void (async () => {
      const failure = await buyPassport();
      // Success arrives through `subscribe`, as Google's sheet closes.
      if (failure !== null) setState(stateAfterFailure(failure));
    })();
  };

  const restore = async () => {
    setState({ kind: 'working' });
    const failure = await restorePurchases();
    if (failure !== null) {
      setState(stateAfterFailure(failure));
    } else if (await isUnlocked()) {
      setState({ kind: 'unlocked' });
      onUnlocked();
    } else {
      setState((current) =>
        current.kind === 'pending' ? current : { kind: 'nothingToRestore' }
      );
    }
  };

  const model = unlockSheetModel({
    state,
    price,
    waiting: waiting.length,
    // Medals whenever content defines any (T-235). The founder stamp only
    // while buying now would still earn it: never while its start is unset,
    // so no testing build promises it (T-233).
    offers: {
      medals: getMedals().length > 0,
      founder: founderWindowOpen(Date.now(), getContentPack().founderWindow),
    },
    language: deviceLanguage(),
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <UnlockSheetView
          model={model}
          waiting={waiting}
          unlocked={state.kind === 'unlocked'}
          working={state.kind === 'working'}
          onBuy={buy}
          onRestore={() => void restore()}
          onClose={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
});

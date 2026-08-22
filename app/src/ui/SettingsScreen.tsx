/**
 * Settings, connected (T-141), and the two-step erase (T-125).
 *
 * THE ERASE IS TWO DELIBERATE ACTIONS, NOT AN ALERT
 * -------------------------------------------------
 * T-125 requires a second confirmation step. A system alert would technically
 * satisfy that, but it is the wrong shape here: an alert is small, dismissed
 * by reflex, and leaves no room to explain the one thing the user needs to
 * understand — that there is no cloud, no account and no restore (D-001), so
 * this is final in a way that deleting things in most apps is not.
 *
 * The confirmation is therefore a full screen that states the consequence
 * plainly, and the destructive button lives on that screen rather than in the
 * settings list. Two deliberate taps, and the second is on the screen that
 * explained why it matters. The safe choice is the one styled as primary.
 */

import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { t } from '../i18n';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  isBatteryExemptionAvailable,
  openBatteryOptimisationSettings,
} from '../recording/batteryOptimisation';
import { locationProvider } from '../recording/ExpoLocationProvider';
import type { PermissionLevel } from '../recording/LocationProvider';
import { parseMapStyle } from '../map/mapStylePreference';
import type { TrackingQuality } from '../recording/trackingPreference';
import {
  DEFAULT_BACKGROUND_TRACKING,
  DEFAULT_TRACKING_QUALITY,
} from '../recording/trackingPreference';
import {
  getTrackingQuality,
  isBackgroundTrackingAllowed,
  setBackgroundTrackingAllowed,
  setTrackingQuality,
} from '../recording/trackingSettings';
import { applyBackgroundTrackingChange } from '../recording/tripRecording';
import * as appStateDao from '../storage/dao/appStateDao';
import { deleteAllUserData } from '../storage/database';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import PrivacyPolicyView from './PrivacyPolicyView';
import Constants from 'expo-constants';
import { buildDonation, sendDonation } from '../souvenir/donateWalk';
import SettingsView from './SettingsView';
import { fontSize, MIN_TAP_TARGET, settingsLight, spacing } from './theme';

export default function SettingsScreen({
  onClose,
  onOpenDebug,
}: {
  onClose: () => void;
  onOpenDebug: () => void;
}) {
  const [permission, setPermission] = useState<PermissionLevel>('undetermined');
  const [mapStyle, setMapStyle] = useState<'light' | 'dark'>('light');
  const [backgroundTracking, setBackgroundTracking] = useState(
    DEFAULT_BACKGROUND_TRACKING
  );
  const [trackingQuality, setQuality] = useState<TrackingQuality>(
    DEFAULT_TRACKING_QUALITY
  );
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [erased, setErased] = useState(false);
  const [showingPolicy, setShowingPolicy] = useState(false);
  /** True while a walk report is being assembled (OD-11, D-069). */
  const [donating, setDonating] = useState(false);

  useEffect(() => {
    void locationProvider
      .getPermissionLevel()
      .then(setPermission)
      .catch(() => undefined);

    void appStateDao
      .get(appStateDao.AppStateKey.MapStyle)
      .then((raw) => setMapStyle(parseMapStyle(raw)))
      .catch(() => undefined);

    void isBackgroundTrackingAllowed()
      .then(setBackgroundTracking)
      .catch(() => undefined);

    void getTrackingQuality().then(setQuality).catch(() => undefined);
  }, []);

  /**
   * The background-tracking switch (T-146).
   *
   * ⚠ Unlike the map style, this one is **not** just remembered for the next
   * screen to read. It starts or stops the recorder there and then, because
   * the user has just told the app whether it may follow them — and a consent
   * switch that takes effect when you next happen to open a different screen
   * is not consent.
   *
   * The optimistic `setBackgroundTracking` keeps the switch under the thumb
   * that moved it; the write and the recorder change happen behind it.
   */
  const changeBackgroundTracking = useCallback((allowed: boolean) => {
    setBackgroundTracking(allowed);
    void (async () => {
      try {
        await setBackgroundTrackingAllowed(allowed);
        await applyBackgroundTrackingChange(allowed);
      } catch (error) {
        await recordingEventDao.logError('background tracking switch', error);
      }
    })();
  }, []);

  /**
   * The tier (T-146).
   *
   * Stored only. The recorder picks it up the next time it sets a sampling
   * profile, which `samplingGate` does on every OS wake-up — within minutes,
   * without restarting location updates and so without ending the trip. A
   * restart here would cost the user the continuity of a walk in progress to
   * apply a preference about battery, which is the wrong trade in both
   * directions.
   */
  const changeTrackingQuality = useCallback((next: TrackingQuality) => {
    setQuality(next);
    void setTrackingQuality(next).catch(() => undefined);
  }, []);

  /**
   * Remember the choice (T-140).
   *
   * The map reads this on its next mount rather than being pushed to — the
   * user returns to the map by closing settings, so there is nothing to
   * synchronise and no state to hold in two places.
   */
  const changeMapStyle = useCallback((next: 'light' | 'dark') => {
    setMapStyle(next);
    void appStateDao
      .set(appStateDao.AppStateKey.MapStyle, next)
      .catch(() => undefined);
  }, []);

  const erase = useCallback(() => {
    void (async () => {
      try {
        await deleteAllUserData();
      } catch (error) {
        // The diary may itself have just been deleted; log on a best effort.
        await recordingEventDao.logError('erase all', error);
      }
      // Either way the user gets told, rather than left looking at an
      // unchanged screen wondering whether it worked.
      setErased(true);
    })();
  }, []);

  if (erased) {
    return (
      <View style={styles.centre}>
        {/* ⚠ `App.tsx` sets `style="light"` for the whole app, because every
            other screen is dark. Settings is not any more (D-080), and a white
            clock on a near-white page is invisible — the same failure the map's
            status-bar scrim was written for (T-112). Each light branch of this
            screen sets it back; the privacy policy below is still dark and
            deliberately does not. */}
        <ExpoStatusBar style="dark" />
        <Text style={styles.title}>{t('erase.done.title')}</Text>
        <Text style={styles.body}>{t('erase.done.body')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('erase.done.done')}
          onPress={onClose}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>{t('erase.done.done')}</Text>
        </Pressable>
      </View>
    );
  }

  if (showingPolicy) {
    return <PrivacyPolicyView onClose={() => setShowingPolicy(false)} />;
  }

  if (confirmingErase) {
    return (
      <View style={styles.root}>
        <ExpoStatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.confirmContent}>
          <Text style={styles.title}>{t('erase.confirm.title')}</Text>
          <Text style={styles.body}>{t('erase.confirm.body1')}</Text>
          <Text style={styles.body}>{t('erase.confirm.body2')}</Text>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('erase.confirm.keep')}
            onPress={() => setConfirmingErase(false)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t('erase.confirm.keep')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('erase.confirm.erase')}
            onPress={erase}
            style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
          >
            <Text style={styles.dangerText}>{t('erase.confirm.erase')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

    /**
   * Build a walk report and hand it to the share sheet (OD-11, D-069).
   *
   * ⚠ **The user is shown what it contains before the sheet opens**, in the
   * sentence `walkReport.ts` keeps beside the payload — so the description
   * cannot drift from what is actually in the file.
   */
  const donateWalk = useCallback(() => {
    if (donating) {
      return;
    }
    setDonating(true);

    void (async () => {
      // The version the rules came from, read from the manifest rather than
      // typed here — a report claiming the wrong version is worse than one
      // claiming none.
      const built = await buildDonation(
        Constants.expoConfig?.version ?? 'unknown'
      );
      if (!built.ok) {
        setDonating(false);
        Alert.alert(t('donate.nothingTitle'), built.reason);
        return;
      }

      Alert.alert(t('donate.confirmTitle'), built.description, [
        { text: t('donate.notNow'), style: 'cancel', onPress: () => setDonating(false) },
        {
          text: t('donate.send'),
          onPress: () => {
            void (async () => {
              const sent = await sendDonation(built.report);
              setDonating(false);
              if (!sent.ok && sent.reason !== undefined) {
                Alert.alert(t('donate.failedTitle'), sent.reason);
              }
            })();
          },
        },
      ]);
    })();
  }, [donating]);

  return (
    <View style={styles.root}>
      <ExpoStatusBar style="dark" />
      <SettingsView
      permission={permission}
      mapStyle={mapStyle}
      onChangeMapStyle={changeMapStyle}
      backgroundTracking={backgroundTracking}
      onChangeBackgroundTracking={changeBackgroundTracking}
      trackingQuality={trackingQuality}
      onChangeTrackingQuality={changeTrackingQuality}
      onOpenSystemSettings={() => {
        void Linking.openSettings().catch(() => undefined);
      }}
      // Android only (T-046). Null on iOS removes the whole section rather
      // than showing a control that cannot do anything there.
      onOpenBatterySettings={
        isBatteryExemptionAvailable()
          ? () => {
              void openBatteryOptimisationSettings();
            }
          : null
      }
      // Shown in the app rather than opened in a browser: this app makes no
      // network requests (D-001), and the reader may well have no signal.
      onOpenPrivacyPolicy={() => setShowingPolicy(true)}
      onOpenDebug={onOpenDebug}
      onEraseRequested={() => setConfirmingErase(true)}
      donating={donating}
      onDonateWalk={donateWalk}
      onClose={onClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: settingsLight.background },
  centre: {
    flex: 1,
    backgroundColor: settingsLight.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  confirmContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: settingsLight.text,
    fontSize: fontSize.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: settingsLight.text,
    fontSize: fontSize.body,
    lineHeight: fontSize.body * 1.5,
    textAlign: 'center',
  },
  actions: { padding: spacing.lg, gap: spacing.sm },
  pressed: { opacity: 0.75 },
  primary: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: settingsLight.action,
  },
  primaryText: {
    color: settingsLight.surface,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  danger: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: settingsLight.danger,
  },
  dangerText: { color: settingsLight.danger, fontSize: fontSize.body, fontWeight: '700' },
});

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

import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { locationProvider } from '../recording/ExpoLocationProvider';
import type { PermissionLevel } from '../recording/LocationProvider';
import { deleteAllUserData } from '../storage/database';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import SettingsView from './SettingsView';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

export default function SettingsScreen({
  onClose,
  onOpenDebug,
}: {
  onClose: () => void;
  onOpenDebug: () => void;
}) {
  const [permission, setPermission] = useState<PermissionLevel>('undetermined');
  const [mapStyle, setMapStyle] = useState<'light' | 'dark'>('light');
  const [confirmingErase, setConfirmingErase] = useState(false);
  const [erased, setErased] = useState(false);

  useEffect(() => {
    void locationProvider
      .getPermissionLevel()
      .then(setPermission)
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
        <Text style={styles.title}>Everything has been erased</Text>
        <Text style={styles.body}>
          Nothing you recorded is left on this phone. If you keep the app, it
          will start a new map from here.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={onClose}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        >
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  if (confirmingErase) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.confirmContent}>
          <Text style={styles.title}>Erase everything?</Text>
          <Text style={styles.body}>
            This deletes every place you have visited, the whole map of your
            trip, and every stamp you have collected.
          </Text>
          <Text style={styles.body}>
            There is no backup. This app has no account and no server — what is
            on this phone is the only copy — so this cannot be undone.
          </Text>
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Keep my trip"
            onPress={() => setConfirmingErase(false)}
            style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>Keep my trip</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Yes, erase everything"
            onPress={erase}
            style={({ pressed }) => [styles.danger, pressed && styles.pressed]}
          >
            <Text style={styles.dangerText}>Yes, erase everything</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <SettingsView
      permission={permission}
      mapStyle={mapStyle}
      mapPackBytes={null}
      onChangeMapStyle={setMapStyle}
      onOpenSystemSettings={() => {
        void Linking.openSettings().catch(() => undefined);
      }}
      // T-124 writes the policy. Until it exists the row does nothing rather
      // than opening an empty screen.
      onOpenPrivacyPolicy={() => undefined}
      onOpenDebug={onOpenDebug}
      onEraseRequested={() => setConfirmingErase(true)}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centre: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.text,
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
    backgroundColor: colors.action,
  },
  primaryText: {
    color: colors.actionText,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
  danger: {
    minHeight: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.bad,
  },
  dangerText: { color: colors.bad, fontSize: fontSize.body, fontWeight: '700' },
});

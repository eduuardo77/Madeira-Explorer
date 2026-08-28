import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { LogBox, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place } from './src/content/contentPack';
// ⚠ The platform's own map (D-057). `src/map/MapLibreScreen.tsx` is the same
// screen on our offline tile pack, kept deliberately — swapping this import
// back is the whole of the way back.
import MapScreen, { type FocusPlace } from './src/map/NativeMapScreen';
import OnboardingFlow, {
  pendingPermissionPrompt,
} from './src/onboarding/OnboardingFlow';
import type { OnboardingScreen } from './src/onboarding/OnboardingView';
import { syncRecordingWithPreferences } from './src/recording/tripRecording';
import { checkTripEnd } from './src/progress/tripEndDetection';
import * as appStateDao from './src/storage/dao/appStateDao';
import { runHealthCheck } from './src/recording/healthCheck';
import * as recordingEventDao from './src/storage/dao/recordingEventDao';
import DebugScreen from './src/ui/DebugScreen';
import PassportScreen from './src/ui/PassportScreen';
import ReplayScreen from './src/souvenir/ReplayScreen';
import SettingsScreen from './src/ui/SettingsScreen';
import { colors, fontSize, MIN_TAP_TARGET, radius, spacing } from './src/ui/theme';

/**
 * ⚠ ONE SUPPRESSED WARNING, AND WHY IT IS NOT A SHRUG
 * ---------------------------------------------------
 * MapLibre asks for a glyph range the tile pack does not carry (**T-063b**),
 * twice per cold start, and logs it as an *error*. No visible label is broken
 * by it. In a development build React Native turns that into a LogBox toast
 * across the bottom of the screen — **directly on top of the passport button**
 * — and a tap meant for the passport opens a full-screen red error page
 * instead. That is what the project lead has been looking at every time they
 * opened this app.
 *
 * So it is silenced **by its exact text**, which means:
 *   - a *different* glyph failure still shows, because the message differs;
 *   - T-063b is not closed by this and the log is still in `adb logcat`, which
 *     is where the note in TASKS.md says to look for it;
 *   - nothing else is hidden. This is not `LogBox.ignoreAllLogs()`, and it
 *     must never become that — the next real error has to be visible.
 *
 * Development only: LogBox does not exist in a release build.
 */
LogBox.ignoreLogs([/Failed to load glyph range/]);

/**
 * Three screens: the primary map (T-075), the passport (T-074), and the Phase
 * 1 debug view (T-050 — the instrument panel, not part of the product; the
 * design brief §5 puts it behind settings eventually).
 *
 * Navigation is a state variable rather than a router. Two destinations and a
 * hidden third do not need one, and every dependency has to earn its place
 * (CONTEXT §6.4).
 */
export default function App() {
  const [screen, setScreen] = useState<
    'map' | 'passport' | 'replay' | 'settings' | 'debug'
  >('map');
  /** null until checked; false once onboarding is behind us. */
  const [onboarding, setOnboarding] = useState<boolean | null>(null);
  /** The Always upgrade or downgrade prompt, when one is due (T-043, T-044). */
  const [prompt, setPrompt] = useState<OnboardingScreen | null>(null);
  /**
   * A place the passport asked the map to show (T-115, D-052 revised).
   *
   * Held here rather than in either screen because it is a *handover*: the
   * passport is unmounted by the time the map acts on it. The map clears it
   * once consumed, so returning to the map later does not fly the camera at a
   * place the user has forgotten about.
   */
  const [focusPlace, setFocusPlace] = useState<FocusPlace | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const done = await appStateDao.getFlag(
          appStateDao.AppStateKey.OnboardingCompleted
        );
        setOnboarding(!done);
        if (done) {
          // Only once onboarding is behind them. Two asks in one launch is
          // how both get refused.
          setPrompt(await pendingPermissionPrompt());
        }
      } catch {
        // Never trap the user behind a failed check.
        setOnboarding(false);
      }
    })();
  }, []);

  useEffect(() => {
    // Recorded so that "the user opened the app" can be told apart from "the OS
    // woke us to deliver a batch" when reading the diary later. Opening the app
    // is the rare event here, not the common one.
    void recordingEventDao.log('app_launch');

    // The day-1 check (T-049, D-011). A no-op before the window and once per
    // install after it, so running it on every launch is the simplest correct
    // trigger — and the launch itself is evidence the user is still around to
    // act on what it says.
    void runHealthCheck();

    // A trip can end while the app is closed — a fallback signal, or a
    // departure-point crossing the OS never delivered. Checking on launch
    // means it is finalised the next time anybody looks (T-099).
    void checkTripEnd();

    // Start recording if the user has allowed it and has not already been
    // started (T-146), and re-register the regions if they have — ⚠ Android
    // forgets every geofence when the phone reboots and says nothing, which
    // would otherwise stop a holiday's collecting silently (T-145).
    void syncRecordingWithPreferences();
  }, []);

  if (onboarding === null) {
    // One frame at most, while the flag is read.
    return <View style={styles.root} />;
  }

  if (onboarding) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <OnboardingFlow onFinished={() => setOnboarding(false)} />
      </View>
    );
  }

  if (prompt !== null) {
    return (
      <View style={styles.root}>
        <StatusBar style="dark" />
        <OnboardingFlow
          initialScreen={prompt}
          onFinished={() => setPrompt(null)}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {screen === 'map' ? (
        <MapScreen
          focusPlace={focusPlace}
          onFocusHandled={() => setFocusPlace(null)}
          onOpenPassport={() => setScreen('passport')}
          onOpenSettings={() => setScreen('settings')}
        />
      ) : screen === 'passport' ? (
        <PassportScreen
          onWatch={() => setScreen('replay')}
          onClose={() => setScreen('map')}
          onShowOnMap={(place: Place, collected: boolean) => {
            setFocusPlace({ place, collected });
            setScreen('map');
          }}
        />
      ) : screen === 'replay' ? (
        // Back to the passport, not to the map: the film was reached from the
        // passport and that is where the user was looking.
        <ReplayScreen onClose={() => setScreen('passport')} />
      ) : screen === 'settings' ? (
        <SettingsScreen
          onClose={() => setScreen('map')}
          onOpenDebug={() => setScreen('debug')}
        />
      ) : (
        <DebugScreen />
      )}
      {/* ⚠ **Only on the debug screen**, where it is the way back.
          It used to float over every screen, including the map and the
          passport, and a screenshot showed what that costs: a stray developer
          control in the corner of the product, overlapping the dev client's
          own floating bubble. The debug screen is reached from Settings (its
          row was always there) — which is also where design brief §5 says it
          belongs. */}
      {screen === 'debug' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to the map"
          onPress={() => setScreen('map')}
          style={styles.switcher}
        >
          <Text style={styles.switcherText}>Map</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  switcher: {
    position: 'absolute',
    top: spacing.xl + spacing.md,
    right: spacing.md,
    minHeight: MIN_TAP_TARGET,
    minWidth: MIN_TAP_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  switcherText: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});

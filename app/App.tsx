import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapScreen from './src/map/MapScreen';
import { checkTripEnd } from './src/progress/tripEndDetection';
import { runHealthCheck } from './src/recording/healthCheck';
import * as recordingEventDao from './src/storage/dao/recordingEventDao';
import DebugScreen from './src/ui/DebugScreen';
import PassportScreen from './src/ui/PassportScreen';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './src/ui/theme';

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
  const [screen, setScreen] = useState<'map' | 'passport' | 'debug'>('map');

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
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {screen === 'map' ? (
        <MapScreen onOpenPassport={() => setScreen('passport')} />
      ) : screen === 'passport' ? (
        <PassportScreen onClose={() => setScreen('map')} />
      ) : (
        <DebugScreen />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          screen === 'debug' ? 'Open the map' : 'Open the debug screen'
        }
        onPress={() => setScreen(screen === 'debug' ? 'map' : 'debug')}
        style={styles.switcher}
      >
        <Text style={styles.switcherText}>
          {screen === 'debug' ? 'Map' : 'Debug'}
        </Text>
      </Pressable>
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
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  switcherText: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});

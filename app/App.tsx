import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapScreen from './src/map/MapScreen';
import * as recordingEventDao from './src/storage/dao/recordingEventDao';
import DebugScreen from './src/ui/DebugScreen';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './src/ui/theme';

/**
 * Two screens for now: the map (T-056/T-059 — the emerging product) and the
 * Phase 1 debug screen (T-050 — the instrument panel). The floating switch is
 * scaffolding, not design; the real primary screen layout is T-075.
 */
export default function App() {
  const [screen, setScreen] = useState<'map' | 'debug'>('map');

  useEffect(() => {
    // Recorded so that "the user opened the app" can be told apart from "the OS
    // woke us to deliver a batch" when reading the diary later. Opening the app
    // is the rare event here, not the common one.
    void recordingEventDao.log('app_launch');
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {screen === 'map' ? <MapScreen /> : <DebugScreen />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          screen === 'map' ? 'Open the debug screen' : 'Open the map'
        }
        onPress={() => setScreen(screen === 'map' ? 'debug' : 'map')}
        style={styles.switcher}
      >
        <Text style={styles.switcherText}>
          {screen === 'map' ? 'Debug' : 'Map'}
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

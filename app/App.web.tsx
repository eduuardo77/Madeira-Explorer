/**
 * The design workbench (web only).
 *
 *     cd app && npx expo start --web
 *
 * Metro resolves `App.web.tsx` in preference to `App.tsx` when bundling for
 * the browser, so this replaces the real app there. **The shipping app has no
 * web target** — it needs background location, OS geofences and a native
 * offline renderer, none of which a browser has (see `backgroundTasks.web.ts`).
 *
 * WHAT THIS IS FOR
 * ----------------
 * D-032 put the remaining effort into the interface, and an interface nobody
 * can look at cannot be judged. This mounts the presentational screens against
 * fixture data so their layout, density and legibility can be seen in seconds
 * instead of waiting on a device build.
 *
 * It is the same idea as `tiles/viewer` for the cartography: a workbench, not
 * a product. Every screen below is rendered from **props only** — no database,
 * no recorder, no map — which is also why those screens were written to take
 * their data as props in the first place.
 *
 * ⚠ What it cannot tell you: real device text scaling, real touch targets,
 * sunlight legibility (T-065), or anything about the map (the native renderer
 * has no web build). Those still need hardware.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from './src/content/contentPack';
import type { StampAward } from './src/storage/types';
import type { TripProgress } from './src/progress/tripProgress';
import PassportView from './src/ui/PassportView';
import PrimaryOverlay from './src/ui/PrimaryOverlay';
import { colors, fontSize, spacing } from './src/ui/theme';

/**
 * A believable content pack shape, without any content.
 *
 * The counts are what T-066 is aiming at (150–250, D-002) so the layouts are
 * judged at the density they will actually face. Names are synthetic — no
 * Madeira knowledge lives in `app/` (D-017), and that rule does not relax for
 * a preview.
 */
function makeProgress(collected: number, total = 180): TripProgress {
  const perCategory = Math.floor(total / CATEGORIES.length);
  let remaining = collected;

  const byCategory = CATEGORIES.map((category, index) => {
    // Last row absorbs the rounding, so the rows always sum to the total.
    const categoryTotal =
      index === CATEGORIES.length - 1
        ? total - perCategory * (CATEGORIES.length - 1)
        : perCategory;
    const categoryCollected = Math.min(remaining, categoryTotal);
    remaining -= categoryCollected;
    return { category, collected: categoryCollected, total: categoryTotal };
  });

  return {
    collected,
    total,
    byCategory,
    byRegion: [
      { regionId: 'region-one', collected: Math.min(collected, 12), total: 40 },
      { regionId: 'region-two', collected: Math.max(0, Math.min(collected - 12, 5)), total: 35 },
      { regionId: 'region-three', collected: 0, total: 28 },
    ],
    lockedRegionCount: 0,
  };
}

function makeAwards(count: number): StampAward[] {
  const awards: StampAward[] = [];
  const now = Date.now();
  for (let i = 0; i < count; i += 1) {
    awards.push({
      id: i + 1,
      trip_id: 1,
      place_id: `place-${i}`,
      awarded_ts: now - (count - i) * 3600_000,
      dwell_seconds: 600,
      mean_speed_mps: 0.5,
      confidence: 0.9,
      reason: 'fixture',
    });
  }
  return awards;
}

/**
 * The two densities T-081 requires the passport to survive: a first morning,
 * and a completed collection.
 */
const SCENARIOS = [
  { label: '0 stamps — day one', collected: 0 },
  { label: '3 stamps — T-081 low', collected: 3 },
  { label: '23 stamps — mid-trip', collected: 23 },
  { label: '180 stamps — T-081 high', collected: 180 },
] as const;

type Screen = 'passport' | 'primary' | 'primary-while-using';

const SCREENS: { id: Screen; label: string }[] = [
  { id: 'passport', label: 'Passport (T-074)' },
  { id: 'primary', label: 'Primary — Always (T-075)' },
  { id: 'primary-while-using', label: 'Primary — While-Using' },
];

export default function DesignWorkbench() {
  const [scenario, setScenario] = useState<number>(1);
  const [screen, setScreen] = useState<Screen>('passport');

  const collected = SCENARIOS[scenario].collected;
  const progress = makeProgress(collected);
  const awards = makeAwards(collected);

  return (
    <View style={styles.root}>
      <View style={styles.bar}>
        <Text style={styles.barTitle}>Design workbench — not the app</Text>
        <View style={styles.barButtons}>
          {SCENARIOS.map((option, index) => (
            <Pressable
              key={option.label}
              onPress={() => setScenario(index)}
              style={[styles.chip, index === scenario && styles.chipActive]}
            >
              <Text
                style={[
                  styles.chipText,
                  index === scenario && styles.chipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.barButtons}>
        {SCREENS.map((option) => (
          <Pressable
            key={option.id}
            onPress={() => setScreen(option.id)}
            style={[styles.chip, option.id === screen && styles.chipActive]}
          >
            <Text
              style={[
                styles.chipText,
                option.id === screen && styles.chipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.stage}>
        {/* A phone-shaped frame, so density is judged at the size it will be
            read at rather than across a desktop window. */}
        <View style={styles.phone}>
          {screen === 'passport' ? (
            <PassportView progress={progress} awards={awards} />
          ) : (
            <View style={styles.mapStandIn}>
              {/* The map cannot render here — the native renderer has no web
                  build. A flat panel in roughly the light style's ground
                  colour stands in, which is enough to judge whether the
                  chrome has enough contrast against it. */}
              <Text style={styles.mapStandInText}>
                the map (native only — see tiles/viewer)
              </Text>
              <PrimaryOverlay
                progress={progress}
                showRecordingControl={screen === 'primary-while-using'}
                isRecording={false}
                onOpenPassport={() => setScreen('passport')}
                onOpenSettings={() => undefined}
                onToggleRecording={() => undefined}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0e12' },
  bar: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  barTitle: {
    color: colors.textMuted,
    fontSize: fontSize.small,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  barButtons: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.action, borderColor: colors.action },
  chipText: { color: colors.textMuted, fontSize: fontSize.small },
  chipTextActive: { color: colors.actionText, fontWeight: '700' },
  stage: { alignItems: 'center', padding: spacing.lg },
  mapStandIn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // The light style's paper ground (tiles/style/generate.mjs).
    backgroundColor: '#eeebe4',
  },
  mapStandInText: { color: '#9a948a', fontSize: fontSize.small },
  phone: {
    width: 390,
    height: 844,
    backgroundColor: colors.background,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
});

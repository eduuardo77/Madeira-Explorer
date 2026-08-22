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
import OnboardingView, {
  type OnboardingScreen,
} from './src/onboarding/OnboardingView';
import PassportView, { type PassportStamp } from './src/ui/PassportView';
import { visibleStamps } from './src/entitlement/freeTier';
import PlaceCardView from './src/ui/PlaceCardView';
import { buildPlaceCard } from './src/places/placeCard';
import PrivacyPolicyView from './src/ui/PrivacyPolicyView';
import SettingsView from './src/ui/SettingsView';
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
 * Every place for the artwork (T-070, D-058) — collected *and* not.
 *
 * Synthetic names, in the same spread of lengths a real pack will have,
 * including ones long enough to be truncated on the band, which is where the
 * layout breaks if it is going to. The uncollected ones matter as much as the
 * collected: they are the majority of the screen for most of a trip, and they
 * are drawn in a different palette.
 */
function makeStamps(
  count: number,
  byCategory: TripProgress['byCategory'],
  freeTier = false
): PassportStamp[] {
  const names = [
    'High Rock', 'Miradouro Grande', 'Water Walk', 'Long Canal Trail',
    'Machico', 'Ribeira Brava', 'Black Sands', 'Calheta Bay',
    'Old Fort', 'Cable Car Station', 'Sé', 'Cabo',
  ];
  const stamps: PassportStamp[] = [];
  let index = 0;
  for (const row of byCategory) {
    for (let i = 0; i < row.total; i += 1) {
      stamps.push({
        placeId: `place-${index}`,
        name: names[index % names.length],
        category: row.category,
        // The first `collected` of each category are earned; the rest are the
        // recommendations (CONTEXT §4.1).
        collected: i < row.collected && index < count,
      });
      index += 1;
    }
  }

  if (!freeTier) {
    return stamps;
  }

  // The free tier, drawn (T-155). ⚠ Composed from the shipping module rather
  // than approximated here — a workbench that invents its own version of the
  // rule shows a screen that does not exist.
  //
  // ⚠ The fixture is bent to produce D-072's *interesting* case, because the
  // default one hides it: `makeProgress` fills the first category first, so all
  // 23 stamps land in Viewpoints, no levada is ever earned and the guarantee
  // never fires. So one levada is collected here and stamped **late** — the
  // driving day, then a walk on day four, which is the exact shape the
  // exemption exists to rescue. Expect **eleven** visible, one of them a levada.
  const firstUncollectedLevada = stamps.some(
    (stamp) => stamp.category === 'levada' && stamp.collected
  )
    ? undefined
    : stamps.find((stamp) => stamp.category === 'levada')?.placeId;

  const withLevada = stamps.map((stamp) =>
    stamp.placeId === firstUncollectedLevada ? { ...stamp, collected: true } : stamp
  );

  const earned = withLevada
    .filter((stamp) => stamp.collected)
    .map((stamp, i) => ({
      placeId: stamp.placeId,
      category: stamp.category,
      // Levadas last, so the walk is the twelfth stamp rather than the second.
      awardedTs: (stamp.category === 'levada' ? 1_000 + i : i) * 3_600_000,
    }));
  const locked = new Set(visibleStamps(earned, false).locked);

  return withLevada.map((stamp) => ({ ...stamp, locked: locked.has(stamp.placeId) }));
}

/**
 * The two densities T-081 requires the passport to survive: a first morning,
 * and a completed collection.
 */
const SCENARIOS = [
  { label: '0 stamps — day one', collected: 0 },
  { label: '3 stamps — T-081 low', collected: 3 },
  { label: '23 stamps — mid-trip', collected: 23 },
  // ⚠ The screen a non-paying user actually sees once they pass ten (D-072).
  // Look at whether the padlock reads at 96 dp, and whether a locked sticker
  // is still clearly *different* from one that was never collected — if those
  // two states look the same, the app is telling people they did not go.
  { label: '23 stamps — free tier (T-155)', collected: 23, freeTier: true },
  { label: '180 stamps — T-081 high', collected: 180 },
] as const;

type Screen =
  | 'passport'
  | 'primary'
  | 'primary-while-using'
  | 'place-card'
  | 'place-card-collected'
  | 'settings'
  | 'privacy'
  | 'passport-confirm'
  | `onboarding:${OnboardingScreen}`;

const SCREENS: { id: Screen; label: string }[] = [
  { id: 'passport', label: 'Passport (T-074)' },
  { id: 'passport-confirm', label: 'Passport — "did you walk it?" (T-149)' },
  { id: 'primary', label: 'Primary — Always (T-075)' },
  { id: 'primary-while-using', label: 'Primary — While-Using' },
  { id: 'place-card', label: 'Place card (T-115)' },
  { id: 'place-card-collected', label: 'Place card — collected, no fix' },
  { id: 'settings', label: 'Settings (T-141/T-125)' },
  { id: 'privacy', label: 'Privacy policy (T-124)' },
  { id: 'onboarding:welcome', label: 'Welcome (T-114)' },
  { id: 'onboarding:location', label: 'Location ask (T-042)' },
  { id: 'onboarding:notifications', label: 'Notifications ask' },
  { id: 'onboarding:android-disclosure', label: 'Play disclosure (T-121)' },
  { id: 'onboarding:always-upgrade', label: 'Always upgrade (T-043)' },
  { id: 'onboarding:downgrade', label: 'Downgrade (T-044)' },
];

/**
 * The place card in its two interesting states (T-115).
 *
 * `distance` false is the ordinary case for a user on While-Using who is not
 * recording: no recent fix, so no number (`placeCard.ts` rule 1). It is worth
 * looking at, because it is the layout with a line missing.
 */
function makeCard(collected: boolean, distance: boolean) {
  const now = Date.now();
  return buildPlaceCard({
    placeId: 'place-1',
    name: collected ? 'Long Canal Trail' : 'Miradouro Grande',
    category: collected ? 'levada' : 'viewpoint',
    collected,
    // Invented, like every other string here: the workbench judges the layout
    // and must not become a second content pack (D-017, D-038).
    regionName: 'North Parish',
    lat: 32.66,
    lon: -16.91,
    position: distance
      ? { ts: now - 120_000, lat: 32.65, lon: -16.91, accuracy_m: 15 }
      : null,
    nowMs: now,
  });
}

export default function DesignWorkbench() {
  const [scenario, setScenario] = useState<number>(1);
  const [screen, setScreen] = useState<Screen>('passport');

  const showsCard = screen === 'place-card' || screen === 'place-card-collected';
  const collected = SCENARIOS[scenario].collected;
  const progress = makeProgress(collected);
  const awards = makeAwards(collected);
  const stamps = makeStamps(
    collected,
    progress.byCategory,
    'freeTier' in SCENARIOS[scenario]
  );

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
          {screen.startsWith('onboarding:') ? (
            <OnboardingView
              screen={screen.slice('onboarding:'.length) as OnboardingScreen}
              onContinue={() => undefined}
              onSkip={() => undefined}
            />
          ) : screen === 'passport' || screen === 'passport-confirm' ? (
            <PassportView
              progress={progress}
              awards={awards}
              stamps={stamps}
              onSelectStamp={() => setScreen('place-card-collected')}
              // Under the hero, opposite the invitation it replaces (T-105e).
              // ⚠ There is nowhere for it to go here: the replay is the real
              // Google map now (D-076), and the workbench has no map.
              onWatch={() => undefined}
              // The question D-065 leaves the app holding, at the length it
              // actually renders — a real levada name and a real evidence
              // string, invented rather than imported (D-017, D-038).
              confirmation={
                screen === 'passport-confirm'
                  ? {
                      placeId: 'long-canal-trail',
                      question: 'Did you walk the Long Canal Trail?',
                      detail:
                        'Walked 2.1 km of 5.0 km (42%) — enough to ask, not enough for the app to be sure.',
                      confirmLabel: 'I walked it',
                      declineLabel: 'Not this time',
                    }
                  : undefined
              }
            />
          ) : screen === 'privacy' ? (
            <PrivacyPolicyView onClose={() => setScreen('settings')} />
          ) : screen === 'settings' ? (
            <SettingsView
              permission="while_using"
              mapStyle="light"
              backgroundTracking
              onChangeBackgroundTracking={() => undefined}
              trackingQuality="balanced"
              onChangeTrackingQuality={() => undefined}
              onChangeMapStyle={() => undefined}
              onOpenSystemSettings={() => undefined}
              // Forced on so the row can be looked at (D-038). On the web
              // workbench Platform.OS is 'web', so it would never show.
              onOpenBatterySettings={() => undefined}
              onOpenPrivacyPolicy={() => setScreen('privacy')}
              onOpenDebug={() => undefined}
              onEraseRequested={() => undefined}
              onClose={() => undefined}
            />
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
                mapStyle="light"
                progress={progress}
                isRecording={false}
                // Nothing to press here — the workbench has no map to centre
                // (D-080's re-center is measured on the device, not in the DOM).
                onRecenter={() => undefined}
                // Worst case on purpose: a While-Using user, so both bottom
                // controls are present *and* a card is open.
                bottomSlot={
                  showsCard ? (
                    <PlaceCardView
                      card={makeCard(
                        screen === 'place-card-collected',
                        screen === 'place-card'
                      )}
                      // The passport's card carries this; the map's does not.
                      onShowOnMap={
                        screen === 'place-card-collected'
                          ? () => setScreen('primary')
                          : undefined
                      }
                      onClose={() => setScreen('primary')}
                    />
                  ) : null
                }
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

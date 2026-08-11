/**
 * The passport, connected to the database (T-074).
 *
 * `PassportView` is the design; this is the plumbing. Splitting them is what
 * lets the workbench (`App.web.tsx`) judge the layout against 3 stamps and 200
 * without a device, which is how T-081 was actually answered.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getContentPack } from '../content/poiCatalogue';
import { getCurrentProgress } from '../progress/currentProgress';
import { runAwardPass } from '../progress/stampAwards';
import type { TripProgress } from '../progress/tripProgress';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import type { StampAward } from '../storage/types';
import PassportView, { type PassportStamp } from './PassportView';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

export default function PassportScreen({ onClose }: { onClose: () => void }) {
  const [progress, setProgress] = useState<TripProgress | null>(null);
  const [awards, setAwards] = useState<StampAward[]>([]);
  const [stamps, setStamps] = useState<PassportStamp[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Opening the passport is the moment the user most expects it to be
        // right, so judge before reading (T-071). Idempotent and cheap.
        await runAwardPass();

        const [nextProgress, trip] = await Promise.all([
          getCurrentProgress(),
          tripDao.getActiveTrip(),
        ]);
        const nextAwards =
          trip === null ? [] : await stampAwardDao.getAwards(trip.id);

        if (!cancelled) {
          setProgress(nextProgress);
          setAwards(nextAwards);
          setStamps(resolveStamps(nextAwards));
        }
      } catch (error) {
        await recordingEventDao.logError('passport', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.root}>
      {progress === null ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.action} />
        </View>
      ) : (
        <PassportView progress={progress} awards={awards} stamps={stamps} />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to the map"
        onPress={onClose}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>Map</Text>
      </Pressable>
    </View>
  );
}

/**
 * Join awards to the places they were earned at, so the artwork has a name and
 * a category to draw from (T-070).
 *
 * An award whose place has left the pack is skipped rather than drawn nameless
 * — it can only happen when curation changes under an older trip, and a blank
 * sticker is worse than one fewer. The row *count* still comes from
 * `progress`, which is derived from the same pack, so the two agree.
 */
function resolveStamps(awards: StampAward[]): PassportStamp[] {
  const places = new Map(
    getContentPack().places.map((place) => [place.id, place])
  );

  const stamps: PassportStamp[] = [];
  for (const award of awards) {
    const place = places.get(award.place_id);
    if (place === undefined) {
      continue;
    }
    stamps.push({
      placeId: place.id,
      name: place.name,
      category: place.category,
    });
  }
  return stamps;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  back: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.md,
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: 14,
    backgroundColor: colors.action,
  },
  backText: {
    color: colors.actionText,
    fontSize: fontSize.body,
    fontWeight: '700',
  },
});

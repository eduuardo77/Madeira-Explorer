/**
 * The passport, connected to the database (T-074).
 *
 * `PassportView` is the design; this is the plumbing. Splitting them is what
 * lets the workbench (`App.web.tsx`) judge the layout against 3 stamps and 200
 * without a device, which is how T-081 was actually answered.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place } from '../content/contentPack';
import { getContentPack } from '../content/poiCatalogue';
import { representativeGeofence } from '../map/placeMarkers';
import type { PlaceCard } from '../places/placeCard';
import { buildPlaceCard } from '../places/placeCard';
import { getCurrentProgress } from '../progress/currentProgress';
import { runAwardPass } from '../progress/stampAwards';
import type { TripProgress } from '../progress/tripProgress';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import type { StampAward } from '../storage/types';
import PassportView, { type PassportStamp } from './PassportView';
import PlaceCardView from './PlaceCardView';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

export default function PassportScreen({
  onClose,
  onShowOnMap,
}: {
  onClose: () => void;
  /**
   * The user asked to see a stamp's place on the map (T-115, D-052 revised).
   * The whole `Place` travels, because the map needs its representative
   * geofence and the rule for picking that lives in one module.
   */
  onShowOnMap: (place: Place, collected: boolean) => void;
}) {
  const [progress, setProgress] = useState<TripProgress | null>(null);
  const [awards, setAwards] = useState<StampAward[]>([]);
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  /** The tapped stamp's card, or null — which is nearly always. */
  const [card, setCard] = useState<PlaceCard | null>(null);
  const [cardPlace, setCardPlace] = useState<Place | null>(null);
  /** Whether the tapped place is collected — the map needs it for the marker. */
  const [cardCollected, setCardCollected] = useState(false);

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
        const awardedIds =
          trip === null
            ? new Set<string>()
            : await stampAwardDao.getAwardedPlaceIds(trip.id);

        if (!cancelled) {
          setProgress(nextProgress);
          setAwards(nextAwards);
          setStamps(resolveStamps(awardedIds));
        }
      } catch (error) {
        await recordingEventDao.logError('passport', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * A stamp was tapped (T-115).
   *
   * Everything the card needs is looked up now rather than held: the place
   * from the pack, and the recorder's last fix, which is what decides whether
   * a distance can honestly be shown at all (`placeCard.ts`).
   */
  const openCard = (stamp: PassportStamp) => {
    void (async () => {
      const place = getContentPack().places.find(
        (candidate) => candidate.id === stamp.placeId
      );
      if (place === undefined) {
        return;
      }

      let position = null;
      try {
        const trip = await tripDao.getActiveTrip();
        position = trip === null ? null : await rawFixDao.getLastFix(trip.id);
      } catch (error) {
        await recordingEventDao.logError('place card position', error);
      }

      const geofence = representativeGeofence(place);

      setCardPlace(place);
      setCardCollected(stamp.collected);
      setCard(
        buildPlaceCard({
          placeId: place.id,
          name: place.name,
          category: place.category,
          collected: stamp.collected,
          lat: geofence.lat,
          lon: geofence.lon,
          position,
          nowMs: Date.now(),
        })
      );
    })();
  };

  const closeCard = () => {
    setCard(null);
    setCardPlace(null);
  };

  return (
    <View style={styles.root}>
      {progress === null ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.action} />
        </View>
      ) : (
        <PassportView
          progress={progress}
          awards={awards}
          stamps={stamps}
          onSelectStamp={openCard}
        />
      )}

      {card === null ? null : (
        <View style={styles.cardHolder} pointerEvents="box-none">
          <PlaceCardView
            card={card}
            onShowOnMap={
              cardPlace === null
                ? undefined
                : () => onShowOnMap(cardPlace, cardCollected)
            }
            onClose={closeCard}
          />
        </View>
      )}

      {/* ⚠ **Top-left, in a navigation bar, not floating bottom-right.**
          A floating pill sat on top of the last category row — the scroll's
          bottom padding cannot know about a button the *screen* draws — and a
          back control in the bottom corner is not a convention anyone has.
          iOS puts it above the large title, and so does this. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to the map"
        onPress={onClose}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.backText}>‹ Map</Text>
      </Pressable>
    </View>
  );
}

/**
 * Every curated place, marked with whether it has been collected (D-058).
 *
 * ⚠ **Driven by the content pack, not by the awards.** It used to be the other
 * way round — awards joined to places — which meant the passport could only
 * ever show where you had already been. An award whose place has left the pack
 * simply does not appear, which is right: curation changed under an older
 * trip, and the row counts come from `progress`, derived from the same pack,
 * so the two agree.
 *
 * Order is the pack's own. Collected ones are **not** floated to the top: the
 * passport is a fixed set of pages to fill (CONTEXT §4.2), and a sticker that
 * moves once you earn it is a page that rearranges itself under you.
 */
function resolveStamps(awarded: Set<string>): PassportStamp[] {
  return getContentPack().places.map((place) => ({
    placeId: place.id,
    name: place.name,
    category: place.category,
    collected: awarded.has(place.id),
  }));
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  cardHolder: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xl,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  back: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.sm,
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  backText: {
    // Tinted text with a chevron: the iOS back button, which carries no fill.
    color: colors.tint,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});

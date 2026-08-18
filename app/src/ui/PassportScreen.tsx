/**
 * The passport, connected to the database (T-074).
 *
 * `PassportView` is the design; this is the plumbing. Splitting them is what
 * lets the workbench (`App.web.tsx`) judge the layout against 3 stamps and 200
 * without a device, which is how T-081 was actually answered.
 */

import { useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Place } from '../content/contentPack';
import { getContentPack } from '../content/poiCatalogue';
import { getRegionName } from '../content/regionCatalogue';
import { representativeGeofence } from '../map/placeMarkers';
import type { PlaceCard } from '../places/placeCard';
import { buildPlaceCard } from '../places/placeCard';
import { isUnlocked } from '../entitlement/entitlementStore';
import { visibleStamps, type EarnedStamp } from '../entitlement/freeTier';
import { getCurrentProgress } from '../progress/currentProgress';
import { runAwardPass } from '../progress/stampAwards';
import {
  CONFIRMED_CONFIDENCE,
  confirmationReason,
  nextPrompt,
  type ConfirmationCandidate,
  type ConfirmationPrompt,
} from '../progress/stampConfirmation';
import type { TripProgress } from '../progress/tripProgress';
import * as appStateDao from '../storage/dao/appStateDao';
import * as rawFixDao from '../storage/dao/rawFixDao';
import * as recordingEventDao from '../storage/dao/recordingEventDao';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import type { StampAward } from '../storage/types';
import ShareCardView from '../souvenir/ShareCardView';
import type { ShareCard } from '../souvenir/shareCard';
import { buildCardForTrip, shareCardImage } from '../souvenir/shareTrip';
import PassportView, { type PassportStamp } from './PassportView';
import PlaceCardView from './PlaceCardView';
import { colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';

export default function PassportScreen({
  onClose,
  onShowOnMap,
  onWatch,
}: {
  onClose: () => void;
  /** Watch the trip back (T-105e). */
  onWatch: () => void;
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
  /** The one walk the app wants settled (T-149), or null — which is usually. */
  const [confirmation, setConfirmation] = useState<ConfirmationPrompt | null>(null);
  const [confirmationEvidence, setConfirmationEvidence] = useState('');
  /**
   * The share card, built only when asked for (T-105d).
   *
   * ⚠ It has to be *mounted* to be photographed — `captureRef` photographs a
   * view, not a description — so it is rendered off to the side of the screen
   * while the share sheet is being prepared, and unmounted afterwards.
   */
  const [shareCard, setShareCard] = useState<ShareCard | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Opening the passport is the moment the user most expects it to be
        // right, so judge before reading (T-071). Idempotent and cheap — and
        // its result carries the walks worth asking about (T-149, D-065).
        const pass = await runAwardPass();

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

        const prompt = await resolvePrompt(pass.awaitingConfirmation, awardedIds);

        // ⚠ The free tier is applied **here and only here** (T-155, D-072).
        // Everything above this line ran for a paying and a non-paying user
        // alike — the award pass, the geofence set, the writes. That is what
        // makes "buy in month three, receive months one and two" true, and
        // `freeTier.test.ts` fails the build if the recorder ever learns
        // otherwise.
        const locked = new Set(
          visibleStamps(earnedStamps(nextAwards), await isUnlocked()).locked
        );

        if (!cancelled) {
          setProgress(nextProgress);
          setAwards(nextAwards);
          setStamps(resolveStamps(awardedIds, locked));
          setConfirmation(prompt?.prompt ?? null);
          setConfirmationEvidence(prompt?.evidence ?? '');
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
          regionName: getRegionName(place.regionId),
          lat: geofence.lat,
          lon: geofence.lon,
          position,
          nowMs: Date.now(),
        })
      );
    })();
  };

  /**
   * Build the card, let React draw it, photograph it, hand it to the OS.
   *
   * The wait is not a guess at a render time — `requestAnimationFrame` fires
   * after the frame the card was drawn in, which is exactly the moment it
   * becomes photographable.
   */
  const shareTrip = () => {
    if (sharing) {
      return;
    }
    setSharing(true);

    void (async () => {
      const built = await buildCardForTrip();
      if (!built.ok) {
        setSharing(false);
        // The honest sentence from the export door, shown rather than swallowed
        // (ARCHITECTURE §10) — most often "the trace could not be masked".
        Alert.alert(t('passport.share.nothingTitle'), built.reason);
        return;
      }

      setShareCard(built.card);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const shared = await shareCardImage(shareCardRef);
      setShareCard(null);
      setSharing(false);
      if (!shared.ok && shared.reason !== undefined) {
        Alert.alert(t('passport.share.failedTitle'), shared.reason);
      }
    })();
  };

  const closeCard = () => {
    setCard(null);
    setCardPlace(null);
  };

  /**
   * The user says they walked it (T-149).
   *
   * The award carries the machine's own evidence in its reason, so a confirmed
   * stamp is never indistinguishable from a measured one — and T-131 can read
   * these rows as "the bar was too high here".
   */
  const confirmWalk = (placeId: string) => {
    void (async () => {
      const trip = await tripDao.getActiveTrip();
      if (trip === null) {
        return;
      }
      try {
        await stampAwardDao.award({
          trip_id: trip.id,
          place_id: placeId,
          awarded_ts: Date.now(),
          // Neither was measured on this route, and filling a column with a
          // plausible number is what ARCHITECTURE section 10 forbids.
          dwell_seconds: null,
          mean_speed_mps: null,
          confidence: CONFIRMED_CONFIDENCE,
          reason: confirmationReason(confirmationEvidence),
        });
        const awardedIds = await stampAwardDao.getAwardedPlaceIds(trip.id);
        const nextAwards = await stampAwardDao.getAwards(trip.id);
        // Recomputed rather than patched: a confirmed walk is a levada, so it
        // can be the stamp that claims D-072's guaranteed exemption and
        // un-locks nothing else. Patching the previous set would miss that.
        const locked = new Set(
          visibleStamps(earnedStamps(nextAwards), await isUnlocked()).locked
        );
        setConfirmation(null);
        setAwards(nextAwards);
        setStamps(resolveStamps(awardedIds, locked));
        setProgress(await getCurrentProgress());
      } catch (error) {
        await recordingEventDao.logError('confirm walk', error);
      }
    })();
  };

  /** The user says they did not. Remembered, so it is never asked again. */
  const declineWalk = (placeId: string) => {
    void (async () => {
      setConfirmation(null);
      try {
        const declined =
          (await appStateDao.getJson<string[]>(
            appStateDao.AppStateKey.ConfirmationsDeclined
          )) ?? [];
        if (!declined.includes(placeId)) {
          await appStateDao.setJson(appStateDao.AppStateKey.ConfirmationsDeclined, [
            ...declined,
            placeId,
          ]);
        }
      } catch (error) {
        await recordingEventDao.logError('decline walk', error);
      }
    })();
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
          confirmation={confirmation ?? undefined}
          onConfirm={confirmWalk}
          onDecline={declineWalk}
          onWatch={onWatch}
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

      {/* The card being photographed. Off-screen rather than hidden: a view
          with zero opacity or `display: none` is not guaranteed to have pixels
          to capture, and one placed beyond the edge always does. */}
      {shareCard === null ? null : (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCardView ref={shareCardRef} card={shareCard} />
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share your trip as an image"
        onPress={shareTrip}
        style={({ pressed }) => [styles.share, pressed && styles.pressed]}
      >
        <Text style={styles.shareText}>{sharing ? t('passport.sharing') : t('passport.share')}</Text>
      </Pressable>

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
/**
 * Turn the award pass's list of *nearly* into one question, or nothing (T-149).
 *
 * The pass hands over the evidence with each id, so nothing here recomputes
 * D-065's arithmetic — a second implementation would be free to disagree with
 * the first. All this adds is the place's name and the memory of what the user
 * has already declined.
 */
async function resolvePrompt(
  awaitingConfirmation: readonly { placeId: string; evidence: string }[],
  awarded: Set<string>
): Promise<{ prompt: ConfirmationPrompt; evidence: string } | null> {
  if (awaitingConfirmation.length === 0) {
    return null;
  }

  let declined: string[] = [];
  try {
    declined =
      (await appStateDao.getJson<string[]>(
        appStateDao.AppStateKey.ConfirmationsDeclined
      )) ?? [];
  } catch (error) {
    // A read failure must not cost the question. Worst case the user is asked
    // about something they already declined, which is annoying, not wrong.
    await recordingEventDao.logError('confirmations declined', error);
  }

  const places = getContentPack().places;
  const candidates: ConfirmationCandidate[] = [];
  for (const { placeId, evidence } of awaitingConfirmation) {
    const place = places.find((candidate) => candidate.id === placeId);
    if (place !== undefined) {
      candidates.push({ placeId, name: place.name, evidence });
    }
  }

  const prompt = nextPrompt(candidates, new Set(declined), awarded);
  if (prompt === null) {
    return null;
  }
  return {
    prompt,
    evidence:
      candidates.find((candidate) => candidate.placeId === prompt.placeId)?.evidence ?? '',
  };
}

function resolveStamps(
  awarded: Set<string>,
  locked: Set<string>
): PassportStamp[] {
  return getContentPack().places.map((place) => ({
    placeId: place.id,
    name: place.name,
    category: place.category,
    // ⚠ Still `true` for a locked stamp. It was collected; only the drawing is
    // withheld. This is also what keeps the row counts and the hero number
    // honest — they count what the user earned, not what they paid for.
    collected: awarded.has(place.id),
    locked: locked.has(place.id),
  }));
}

/**
 * The awards, in the shape the free-tier arithmetic needs.
 *
 * The category comes from the content pack rather than the award row, because
 * `stamp_award` deliberately stores no copy of it — the pack is the one place a
 * place's category is written (D-017), and a stamp for a place that has since
 * left the pack is a stamp the app cannot categorise, so it is dropped from the
 * ordering rather than guessed at.
 */
function earnedStamps(awards: StampAward[]): EarnedStamp[] {
  const categories = new Map(
    getContentPack().places.map((place) => [place.id, place.category])
  );

  return awards.flatMap((entry) => {
    const category = categories.get(entry.place_id);
    return category === undefined
      ? []
      : [{ placeId: entry.place_id, category, awardedTs: entry.awarded_ts }];
  });
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
  // Off the side of the screen, where it can be drawn and photographed without
  // ever being seen.
  offscreen: { position: 'absolute', left: -4000, top: 0 },
  // Opposite the back control, where iOS puts a share action.
  share: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.sm,
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  shareText: {
    color: colors.tint,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
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

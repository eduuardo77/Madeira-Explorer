/**
 * The passport, connected to the database (T-074).
 *
 * `PassportView` is the design; this is the plumbing. Splitting them is what
 * lets the workbench (`App.web.tsx`) judge the layout against 3 stamps and 200
 * without a device, which is how T-081 was actually answered.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deviceLanguage, n, t } from '../i18n';
import { DATE_LOCALES, type Language } from '../i18n/languages';
import type { StringKey } from '../i18n/strings';
import type { WalkedEvidence } from '../progress/levadaCoverage';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Category, Place } from '../content/contentPack';
import { getContentPack } from '../content/poiCatalogue';
import { getRegionName } from '../content/regionCatalogue';
import { representativeGeofence } from '../map/placeMarkers';
import type { PlaceCard } from '../places/placeCard';
import { buildPlaceCard } from '../places/placeCard';
import { cardPosition } from '../places/cardPosition';
import { BETA_BUILD, isUnlocked, purchaseTimeMs } from '../entitlement/entitlementStore';
import { founderYear, isFounder } from '../entitlement/founder';
import { freeLeftIn, visibleStamps, type EarnedStamp } from '../entitlement/freeTier';
import { getCurrentProgress } from '../progress/currentProgress';
import { runAwardPass, type AwardPassResult } from '../progress/stampAwards';
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
import { getSouvenirComposition } from '../souvenir/souvenirPlan';
import { formatDateRange, type ShareCard } from '../souvenir/shareCard';
import { listedTrips, withSomethingToShow } from '../souvenir/tripList';
import { localStartOfDay, tripDayCount } from '../souvenir/tripDays';
import { storedRoadsFor } from '../matching/roadNetwork';
import { REFUSAL_KEYS, buildCardForTrip, shareCardImage } from '../souvenir/shareTrip';
import PassportView, {
  PASSPORT_BAR_TOP,
  type FounderCard,
  type MedalTile,
  type PassportStamp,
  type PassportTripRow,
} from './PassportView';
import { medalProgress, type MedalProgress } from '../progress/medals';
import { getIslandProgress, getLockedRegionIds } from '../progress/currentProgress';
import {
  getIslandByPlace,
  getIslandByRegion,
  getOpenIslandPassports,
  visiblePlacesNow,
} from '../progress/islandGateStore';
import { inPassport, islandMedalIds, placesIn } from '../progress/islandPassports';
import { getRegions } from '../content/regionCatalogue';
import type { IslandCard } from './PassportView';
import { medalSetName, medalTitleFor, setMedalWordsFor } from '../passport/medalView';
import PlaceCardView from './PlaceCardView';
import UnlockSheet from './UnlockSheet';
import MedalSetSheet from './MedalSetSheet';
import TrophyCard from './TrophyCard';
import { trophyFacts } from '../places/trophy';
import { getMedals } from '../content/medalCatalogue';
import { formatDistance } from '../places/placeCard';
import {
  decodePassportSummary,
  encodePassportSummary,
  type PassportSummary,
} from '../passport/passportSummary';
import { finishTrip } from '../recording/finishTrip';
import { unlessSame } from './unlessSame';
import { useBackHandler } from './useBackHandler';
import ChevronMark from './ChevronMark';
import { album, colors, fontSize, MIN_TAP_TARGET, spacing } from './theme';
import { StatusBar } from 'expo-status-bar';

/**
 * The founder stamp's card when this phone's purchase earned one (T-233), else
 * null. Google's purchase time against the pack's window; a beta build has no
 * purchase, so no founder (plan V15).
 */
function founderCard(boughtMs: number | null, language: Language): FounderCard | null {
  const pack = getContentPack();
  if (boughtMs === null || !isFounder(boughtMs, pack.founderWindow)) return null;
  return {
    words: {
      title: t('medal.founder.title'),
      destination: pack.destination,
      year: founderYear(pack.founderWindow),
    },
    boughtOn: new Date(boughtMs).toLocaleDateString(DATE_LOCALES[language], {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
  };
}

/**
 * The medal shelf's tiles (T-235): finished sets first, in content order
 * within each group, so what was earned is seen before what is under way.
 */
function medalTiles(progress: readonly MedalProgress[], language: Language): MedalTile[] {
  const finished = (medal: MedalProgress) => (medal.state === 'progress' ? 1 : 0);
  return [...progress]
    .sort((a, b) => finished(a) - finished(b))
    .map((medal): MedalTile => {
      const detail =
        medal.state === 'locked'
          ? t('medal.set.locked')
          : medal.state === 'complete' && medal.completedTs !== null
            ? t('medal.set.complete', {
                date: new Date(medal.completedTs).toLocaleDateString(DATE_LOCALES[language], {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
              })
            : t('medal.set.progress', { collected: medal.collected, total: medal.total });
      return {
        id: medal.id,
        name: medalSetName(medal.rule),
        detail,
        locked: medal.state === 'locked',
        words: setMedalWordsFor(medal),
        placeIds: medal.placeIds,
        collected: medal.collected,
        total: medal.total,
      };
    });
}

/** How often a return to the passport may run its slow half again. */
const SLOW_HALF_EVERY_MS = 60_000;

/** One island's own passport page (D-109), read with the main page. */
type IslandPage = {
  id: string;
  name: string;
  progress: TripProgress;
  medals: MedalTile[];
  /** Its own free stamps still to come; null once bought. */
  freeLeft: number | null;
};

export default function PassportScreen({
  active = true,
  onClose,
  onShowOnMap,
  onWatch,
  onOpenTrip,
}: {
  /**
   * The screen in front. Once opened the passport stays mounted, hidden, under
   * the other screens (`keepsPassportMounted`): its pop-ups close and its Back
   * handling waits while covered, and it reads everything again, in place, on
   * the way back.
   */
  active?: boolean;
  onClose: () => void;
  /** Watch the trip back (T-105e). */
  onWatch: () => void;
  /** Open one of the listed trips in the trip viewer (T-261). */
  onOpenTrip: (tripId: number) => void;
  /**
   * The user asked to see a stamp's place on the map (T-115, D-052 revised).
   * The whole `Place` travels, because the map needs its representative
   * geofence and the rule for picking that lives in one module.
   */
  onShowOnMap: (place: Place, collected: boolean, locked?: boolean) => void;
}) {
  const [progress, setProgress] = useState<TripProgress | null>(null);
  const [awards, setAwards] = useState<StampAward[]>([]);
  const [stamps, setStamps] = useState<PassportStamp[]>([]);
  /** The tapped stamp's card, or null — which is nearly always. */
  const [card, setCard] = useState<PlaceCard | null>(null);
  const [cardPlace, setCardPlace] = useState<Place | null>(null);
  /**
   * The tapped stamp: drawn on the card (T-218), and whether it is collected,
   * which the map needs for the marker.
   */
  const [cardStamp, setCardStamp] = useState<PassportStamp | null>(null);
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
  /** T-204: whether a trip is open, which is when "End trip" is offered. */
  const [tripOpen, setTripOpen] = useState(false);
  /**
   * T-217: whether there is a film to watch, stamps or not.
   *
   * ⚠ **Asked of the planner, not of a fix count** (found on the P30,
   * 2026-09-25). The first version offered *Watch* whenever the trip had two
   * fixes, and on the project lead's phone it opened "nothing to watch": the
   * trip was mostly at home, and D-040's masking removes where you sleep, so
   * nothing drawable was left. A resident is exactly that case.
   */
  const [canWatch, setCanWatch] = useState(false);
  const [trips, setTrips] = useState<PassportTripRow[]>([]);
  /** T-262: absent until the stored roads are read, and while none is lit. */
  const [stats, setStats] = useState<{ trip: string; total: string | null } | undefined>();
  /** The founder stamp, when this phone's purchase earned one (T-233). */
  const [founder, setFounder] = useState<FounderCard | null>(null);
  /** Free stamps still to come, for the passport card; null once bought (D-105). */
  const [freeLeft, setFreeLeft] = useState<number | null>(null);
  /** The set medals' shelf (T-235). */
  const [medals, setMedals] = useState<MedalTile[]>([]);
  /**
   * Islands with a passport of their own (D-109): each one's count, medal and
   * free stamps, read with the main page. Empty when the pack has none.
   */
  const [islandPages, setIslandPages] = useState<IslandPage[]>([]);
  /** The island whose passport is open over the main one, or null. */
  const [openIsland, setOpenIsland] = useState<string | null>(null);
  /** Bumped to read everything again, after a trip is ended here. */
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * The unlock sheet's waiting stamps, the one it was opened from first (a
   * locked stamp's card, T-156d; the reminder card, D-097 R1). Null when closed.
   */
  const [unlockWaiting, setUnlockWaiting] = useState<PassportStamp[] | null>(null);
  /**
   * A collected, unlocked stamp's trophy (T-251), with what it says; null when
   * closed. Locked and uncollected stamps open the place card instead.
   */
  const [trophy, setTrophy] = useState<TrophyView | null>(null);
  /** The medal whose set is open over the passport (`MedalSetSheet`). */
  const [openMedal, setOpenMedal] = useState<MedalTile | null>(null);
  /** Open the sheet with every locked stamp, `first` leading the fan. */
  const waiting = useMemo(() => stamps.filter((stamp) => stamp.locked === true), [stamps]);
  const openUnlock = useCallback(
    (first: PassportStamp | null) =>
      setUnlockWaiting(
        first === null ? waiting : [first, ...waiting.filter((stamp) => stamp.placeId !== first.placeId)]
      ),
    [waiting]
  );
  const unlockFromPage = useCallback(() => openUnlock(null), [openUnlock]);
  const shareCardRef = useRef<View>(null);

  /** Covered by another screen: whatever was open over the passport closes. */
  useEffect(() => {
    if (active) return;
    setCard(null);
    setCardPlace(null);
    setCardStamp(null);
    setTrophy(null);
    setOpenMedal(null);
    setUnlockWaiting(null);
  }, [active]);

  /** Back in front: read everything again, in place, with no spinner. */
  const wasActive = useRef(active);
  /** The next load is a return to the front, which may skip the slow half. */
  const returning = useRef(false);
  /** When the slow half of the load last finished (`SLOW_HALF_EVERY_MS`). */
  const slowHalfAt = useRef(0);
  useEffect(() => {
    if (active && !wasActive.current) {
      returning.current = true;
      setReloadKey((key) => key + 1);
    }
    wasActive.current = active;
  }, [active]);
  /**
   * Prepared behind the map and not yet opened (`keepsPassportMounted`): the
   * load stops after the stored page, and the award pass, the film's offer and
   * the trip list wait for the first opening, so a launch does not pay for them.
   */
  const everOpened = useRef(active);
  if (active) everOpened.current = true;

  useEffect(() => {
    let cancelled = false;

    /**
     * The page from what is stored: stamps, medals, the offer. `awaiting` is
     * the award pass's walks worth asking about (T-149, D-065), or null to
     * leave the question as it is.
     */
    const readPage = async (awaiting: AwardPassResult['awaitingConfirmation'] | null) => {
      // T-204: an ended trip stays on show (tripDao.getTripOnShow).
      const [nextProgress, trip, openTrip] = await Promise.all([
        getCurrentProgress(),
        tripDao.getTripOnShow(),
        tripDao.getActiveTrip(),
      ]);
      const nextAwards = trip === null ? [] : await stampAwardDao.getAwards(trip.id);
      const awardedIds =
        trip === null ? new Set<string>() : await stampAwardDao.getAwardedPlaceIds(trip.id);
      const prompt = awaiting === null ? undefined : await resolvePrompt(awaiting, awardedIds);
      const unlocked = await isUnlocked();

      // ⚠ The free tier is applied **here and only here** (T-155, D-072).
      // Everything above this line ran for a paying and a non-paying user
      // alike — the award pass, the geofence set, the writes. That is what
      // makes "buy in month three, receive months one and two" true, and
      // `freeTier.test.ts` fails the build if the recorder ever learns
      // otherwise.
      // D-109: an island with its own passport has its own free stamps.
      const islands = getIslandByPlace();
      const earnedNow = earnedStamps(nextAwards);
      const locked = new Set(visibleStamps(earnedNow, unlocked, islands).locked);
      const nextFreeLeft = unlocked ? null : freeLeftIn(earnedNow, islands, null);

      const nextFounder = founderCard(await purchaseTimeMs(), deviceLanguage());
      // T-235: every award of the trip, locked stamps included (D-075): a
      // set completes from what was earned, paid or not.
      // D-109: the main shelf from the main island's places only, so a
      // category set never takes in an island's; each island shows its one.
      const lockedRegions = await getLockedRegionIds();
      const byRegion = getIslandByRegion();
      const places = getContentPack().places;
      const nextMedals = medalTiles(
        medalProgress(getMedals(), placesIn(places, byRegion, null), nextAwards, unlocked, lockedRegions),
        deviceLanguage()
      );
      const nextIslandPages: IslandPage[] = [];
      for (const island of await getOpenIslandPassports()) {
        const own = islandMedalIds(getMedals(), byRegion, island.id);
        nextIslandPages.push({
          id: island.id,
          name: island.name,
          progress: await getIslandProgress(island.id),
          medals: medalTiles(
            medalProgress(
              getMedals().filter((medal) => own.has(medal.id)),
              placesIn(places, byRegion, island.id),
              nextAwards,
              unlocked,
              lockedRegions
            ),
            deviceLanguage()
          ),
          freeLeft: unlocked ? null : freeLeftIn(earnedNow, islands, island.id),
        });
      }

      if (cancelled) return;
      setProgress(unlessSame<TripProgress | null>(nextProgress));
      setTripOpen(openTrip !== null);
      setAwards(unlessSame(nextAwards));
      setStamps(unlessSame(resolveStamps(awardedIds, locked)));
      if (prompt !== undefined) {
        setConfirmation(prompt?.prompt ?? null);
        setConfirmationEvidence(prompt?.evidence ?? '');
      }
      setFounder(unlessSame(nextFounder));
      setFreeLeft(nextFreeLeft);
      setMedals(unlessSame(nextMedals));
      setIslandPages(unlessSame(nextIslandPages));
    };

    (async () => {
      try {
        // The trip line and the film's offer as last worked out, so they are
        // in place with the stamps instead of pushing them down on arrival.
        const language = deviceLanguage();
        const shown = await tripDao.getTripOnShow();
        const kept =
          shown === null
            ? null
            : decodePassportSummary(await appStateDao.get(appStateDao.AppStateKey.PassportSummary), shown.id);
        if (kept !== null && !cancelled) {
          setCanWatch(kept.canWatch);
          setStats(unlessSame(wordStats(kept, language)));
        }

        // What is stored, at once; then judge (T-071) behind the page, and read
        // again only when the pass found a stamp or a walk to ask about. It
        // judged first until 2026-10-18, which kept a spinner up for about two
        // seconds on every opening on the P30; the recorder's batches and the
        // map judge too, so the pass rarely finds anything here.
        await readPage(null);
        if (!everOpened.current) return;
        // ⚠ The slow half (the award pass, the film's offer, the trip list and
        // the distances) took about 2.4 s of the JavaScript thread on every
        // opening on the P30, and a stamp tapped meanwhile opened 300 ms later.
        // On a return to the front it runs at most once a minute; the stamps
        // above are read every time, and the recorder and the map judge new
        // positions anyway. Ending the trip or unlocking here still runs it.
        const recent = returning.current && Date.now() - slowHalfAt.current < SLOW_HALF_EVERY_MS;
        returning.current = false;
        if (recent) return;
        const pass = await runAwardPass();
        if (pass.newlyAwarded.length > 0 || pass.awaitingConfirmation.length > 0) {
          await readPage(pass.awaitingConfirmation);
        } else if (!cancelled) {
          setConfirmation(null);
          setConfirmationEvidence('');
        }

        // After the page is on screen: this reads and masks the whole trace,
        // and nobody should wait for it to see their stamps.
        const film = await getSouvenirComposition({ quiet: true });
        if (!cancelled) {
          setCanWatch(film.renderable);
        }
        // T-261: the trips worth listing, worded for the page. The stamps at
        // once; the days once the stored roads are read, which waits on the
        // road network if the map has not decoded it yet.
        const nowMs = Date.now();
        const summaries = await tripDao.getTripSummaries();
        const listed = listedTrips(summaries);
        const row = (trip: (typeof listed)[number], days: number | null): PassportTripRow => ({
          id: trip.id,
          dates: formatDateRange(trip.started_ts, trip.ended_ts ?? nowMs, language),
          detail:
            days === null
              ? n('passport.trips.stamps', trip.stamp_count)
              : `${n('passport.trips.days', days)} · ${n('passport.trips.stamps', trip.stamp_count)}`,
        });
        if (!cancelled) {
          // Only the first time: on a reload the list on screen stays until the
          // one with days replaces it, rather than losing its days for a moment.
          setTrips((current) => (current.length > 0 ? current : listed.map((trip) => row(trip, null))));
        }
        // ⚠ The viewer's days, not the days with any recording (the lead's
        // choice, 2026-10-07): a trip spent mostly at home said "14 dias" here
        // and "Dia 2 de 2" when opened.
        // Every trip, not only the listed ones: the total counts all road lit.
        const roads = await storedRoadsFor(summaries.map((trip) => trip.id));
        const known = new Set(getContentPack().places.map((place) => place.id));
        const daysOf = async (tripId: number) => {
          const stampTs = (await stampAwardDao.getAwards(tripId))
            .filter((award) => known.has(award.place_id))
            .map((award) => award.awarded_ts);
          return tripDayCount(roads.runs.get(tripId) ?? [], stampTs, localStartOfDay);
        };
        const days = new Map<number, number>();
        for (const trip of listed) {
          days.set(trip.id, await daysOf(trip.id));
        }
        if (!cancelled) {
          setTrips(unlessSame(withSomethingToShow(listed, days).map((trip) => row(trip, days.get(trip.id) ?? 0))));
        }

        // T-262, the lead's option A: the trip on show in one line, and all
        // trips' road under it when that says something the first does not.
        // Undefined when nothing is lit, which also clears the line after an
        // erase in Settings while the passport stayed mounted.
        const onShow = await tripDao.getTripOnShow();
        const summary: PassportSummary | null =
          onShow === null
            ? null
            : {
                tripId: onShow.id,
                tripLitM: roads.litM.get(onShow.id) ?? 0,
                totalLitM: roads.totalLitM,
                days: days.get(onShow.id) ?? (await daysOf(onShow.id)),
                canWatch: film.renderable,
              };
        if (!cancelled) {
          setStats(unlessSame(summary === null ? undefined : wordStats(summary, language)));
        }
        if (summary !== null) {
          await appStateDao.set(appStateDao.AppStateKey.PassportSummary, encodePassportSummary(summary));
        }
        slowHalfAt.current = Date.now();
      } catch (error) {
        await recordingEventDao.logError('passport', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /** T-204: confirm, then stop recording and close the trip (finishTrip.ts). */
  const endTrip = useCallback(() => {
    Alert.alert(t('passport.endTrip.title'), t('passport.endTrip.body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('passport.endTrip.confirm'),
        style: 'destructive',
        onPress: () => {
          void finishTrip()
            .catch((error) => recordingEventDao.logError('end trip', error))
            .finally(() => setReloadKey((key) => key + 1));
        },
      },
    ]);
  }, []);

  /**
   * A stamp was tapped (T-115).
   *
   * Everything the card needs is looked up now rather than held: the place
   * from the pack, and the recorder's last fix, which is what decides whether
   * a distance can honestly be shown at all (`placeCard.ts`).
   */
  const openCard = useCallback((stamp: PassportStamp) => {
    void (async () => {
      const place = getContentPack().places.find(
        (candidate) => candidate.id === stamp.placeId
      );
      if (place === undefined) {
        return;
      }

      let position = null;
      try {
        position = await cardPosition();
      } catch (error) {
        await recordingEventDao.logError('place card position', error);
      }

      const geofence = representativeGeofence(place);
      const language = deviceLanguage();
      // The day it was earned, for the card's status line (option B).
      const award = awards.find((candidate) => candidate.place_id === place.id);
      const visitedOn =
        award === undefined
          ? null
          : new Date(award.awarded_ts).toLocaleDateString(DATE_LOCALES[language], {
              day: 'numeric',
              month: 'long',
            });

      // T-251: a collected stamp the user can see is a trophy, not a card.
      if (stamp.collected && stamp.locked !== true) {
        setTrophy(trophyView(stamp, place, awards, language));
        return;
      }

      setCardPlace(place);
      setCardStamp(stamp);
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
          language,
          why: place.why,
          walk: place.walk,
          visitedOn,
        })
      );
    })();
  }, [awards]);

  /**
   * Build the card, let React draw it, photograph it, hand it to the OS.
   *
   * The wait is not a guess at a render time — `requestAnimationFrame` fires
   * after the frame the card was drawn in, which is exactly the moment it
   * becomes photographable.
   */
  const canShare = progress !== null && progress.collected > 0;

  const shareTrip = () => {
    if (sharing || !canShare) {
      return;
    }
    setSharing(true);

    void (async () => {
      const built = await buildCardForTrip();
      if (!built.ok) {
        setSharing(false);
        // The honest answer from the export door, shown rather than swallowed
        // (ARCHITECTURE §10) — most often "the trace could not be masked".
        // ⚠ T-190: the translated refusal, never `reason`, which is the diary's
        // English and was shown here until 2026-09-23.
        Alert.alert(t('passport.share.nothingTitle'), t(REFUSAL_KEYS[built.refusal]));
        return;
      }

      setShareCard(built.card);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

      const shared = await shareCardImage(shareCardRef);
      setShareCard(null);
      setSharing(false);
      if (!shared.ok) {
        Alert.alert(t('passport.share.failedTitle'), t(REFUSAL_KEYS[shared.refusal]));
      }
    })();
  };

  const closeCard = () => {
    setCard(null);
    setCardPlace(null);
    setCardStamp(null);
  };
  // D-109: Back on an island's page returns to the main passport. Registered
  // before the card's, so an open card still closes first.
  const closeIsland = useCallback(() => setOpenIsland(null), []);
  useBackHandler(active && openIsland !== null, closeIsland);
  // T-211: Back closes an open card before App.tsx's handler leaves the passport.
  useBackHandler(active && card !== null, closeCard);

  /**
   * The user says they walked it (T-149).
   *
   * The award carries the machine's own evidence in its reason, so a confirmed
   * stamp is never indistinguishable from a measured one — and T-131 can read
   * these rows as "the bar was too high here".
   */
  const confirmWalk = useCallback((placeId: string) => {
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
          visibleStamps(earnedStamps(nextAwards), await isUnlocked(), getIslandByPlace()).locked
        );
        setConfirmation(null);
        setAwards(nextAwards);
        setStamps(resolveStamps(awardedIds, locked));
        setProgress(await getCurrentProgress());
      } catch (error) {
        await recordingEventDao.logError('confirm walk', error);
      }
    })();
  }, [confirmationEvidence]);

  /** The user says they did not. Remembered, so it is never asked again. */
  const declineWalk = useCallback((placeId: string) => {
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
  }, []);

  // D-109: the page on show, the main passport's or an island's, from one load.
  const islandPage = openIsland === null ? null : islandPages.find((page) => page.id === openIsland) ?? null;
  const passportId = islandPage?.id ?? null;
  const pageStamps = useMemo(
    () => stamps.filter((stamp) => inPassport(stamp.placeId, getIslandByPlace(), passportId)),
    [stamps, passportId]
  );
  const pageWaiting = useMemo(() => pageStamps.filter((stamp) => stamp.locked === true), [pageStamps]);
  const islandCards = useMemo<IslandCard[]>(
    () =>
      islandPages
        // An island with no places yet has nothing to sell.
        .filter((page) => page.progress.total > 0)
        .map((page) => ({
          id: page.id,
          name: page.name,
          count: n('passport.island.count', page.progress.total, { collected: page.progress.collected }),
          emblem: {
            emblem: {
              kind: 'outline',
              points: getRegions().find((region) => region.islandId === page.id)?.outline ?? [],
            },
            name: page.name,
            collected: page.progress.collected,
            total: page.progress.total,
            look: page.progress.collected === page.progress.total ? 'gold' : 'silver',
          },
          onOpen: () => setOpenIsland(page.id),
        })),
    [islandPages]
  );

  return (
    <View style={styles.root}>
      {/* T-203: the passport is the dark album, so the status bar goes light
          while it is on screen; the rest of the app keeps the dark one. */}
      {active ? <StatusBar style="light" /> : null}
      {progress === null ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={album.tint} />
        </View>
      ) : (
        islandPage !== null ? (
          <PassportView
            // Its own scroll, from the top, and back to the main one's on return.
            key={islandPage.id}
            title={islandPage.name}
            progress={islandPage.progress}
            awards={awards}
            stamps={pageStamps}
            onSelectStamp={openCard}
            waiting={pageWaiting}
            freeLeft={islandPage.freeLeft ?? undefined}
            onUnlock={BETA_BUILD ? undefined : unlockFromPage}
            medals={islandPage.medals}
            onOpenMedal={setOpenMedal}
          />
        ) : (
        <PassportView
          progress={progress}
          awards={awards}
          stamps={pageStamps}
          islands={islandCards}
          onSelectStamp={openCard}
          confirmation={confirmation ?? undefined}
          onConfirm={confirmWalk}
          onDecline={declineWalk}
          onWatch={canWatch ? onWatch : undefined}
          onEndTrip={tripOpen ? endTrip : undefined}
          trips={trips}
          stats={stats}
          onOpenTrip={onOpenTrip}
          waiting={pageWaiting}
          freeLeft={freeLeft ?? undefined}
          // D-097, R1: the reminder, only where something can be bought.
          onUnlock={BETA_BUILD ? undefined : unlockFromPage}
          founder={founder ?? undefined}
          medals={medals}
          onOpenMedal={setOpenMedal}
        />
        )
      )}
      {/* The bar behind `‹ Map` and Share, in the album's colour, under every
          sheet: without it the stamps scrolled through the controls and under
          the status bar (T-263, seen in the visual pass). */}
      <View style={styles.bar} pointerEvents="none" />

      {/* T-201: dim the stamps behind the card, which competed with it (review
          P1-4). Tapping the dimmed page closes the card, as a sheet's backdrop
          does. Drawn before the back and share controls, so they stay above it
          and reachable: the card is still not modal (PlaceCardView). Hidden
          from screen readers, which close the card with its own button. */}
      {card === null ? null : (
        <Pressable
          style={styles.scrim}
          onPress={closeCard}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      )}
      {card === null ? null : (
        <View style={styles.cardHolder} pointerEvents="box-none">
          <PlaceCardView
            card={card}
            // Dark over the dark album, as the trophy is (2026-10-07).
            tone="dark"
            stamp={cardStamp ?? undefined}
            onShowOnMap={
              cardPlace === null || cardStamp === null
                ? undefined
                : () => onShowOnMap(cardPlace, cardStamp.collected, cardStamp.locked === true)
            }
            onUnlock={
              cardStamp?.locked === true && !BETA_BUILD
                ? () => {
                    openUnlock(cardStamp);
                    closeCard();
                  }
                : undefined
            }
            onClose={closeCard}
          />
        </View>
      )}
      {trophy === null ? null : (
        <TrophyCard
          stamp={trophy.stamp}
          awardedTs={trophy.awardedTs}
          subtitle={trophy.subtitle}
          ribbon={trophy.ribbon}
          medal={trophy.medal}
          next={trophy.next}
          onShowOnMap={() => {
            setTrophy(null);
            onShowOnMap(trophy.place, true);
          }}
          onShowNext={() => {
            setTrophy(null);
            if (trophy.nextPlace !== null) onShowOnMap(trophy.nextPlace, false);
          }}
          onClose={() => setTrophy(null)}
        />
      )}
      {openMedal === null ? null : (
        <MedalSetSheet
          medal={openMedal}
          stamps={stamps}
          awards={awards}
          onSelectStamp={(stamp) => {
            setOpenMedal(null);
            openCard(stamp);
          }}
          onUnlock={
            BETA_BUILD
              ? undefined
              : () => {
                  setOpenMedal(null);
                  openUnlock(null);
                }
          }
          onClose={() => setOpenMedal(null)}
        />
      )}
      {unlockWaiting === null ? null : (
        <UnlockSheet
          waiting={unlockWaiting}
          onClose={() => setUnlockWaiting(null)}
          // Read everything again: the stamps that were waiting are now shown.
          onUnlocked={() => setReloadKey((key) => key + 1)}
        />
      )}

      {/* The card being photographed. Off-screen rather than hidden: a view
          with zero opacity or `display: none` is not guaranteed to have pixels
          to capture, and one placed beyond the edge always does. */}
      {shareCard === null ? null : (
        <View style={styles.offscreen} pointerEvents="none">
          <ShareCardView ref={shareCardRef} card={shareCard} />
        </View>
      )}

      {/* ⚠ T-192: nothing to share before the first stamp. It used to share
          at 0 / 80, and the image was almost entirely black (review P1-5). */}
      {islandPage !== null ? null : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('passport.a11y.share')}
        accessibilityHint={canShare ? undefined : t('passport.a11y.shareLater')}
        accessibilityState={{ disabled: !canShare }}
        disabled={!canShare}
        onPress={shareTrip}
        style={({ pressed }) => [
          styles.share,
          !canShare && styles.shareDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.shareText}>{sharing ? t('passport.sharing') : t('passport.share')}</Text>
      </Pressable>
      )}

      {/* ⚠ **Top-left, in a navigation bar, not floating bottom-right.**
          A floating pill sat on top of the last category row — the scroll's
          bottom padding cannot know about a button the *screen* draws — and a
          back control in the bottom corner is not a convention anyone has.
          iOS puts it above the large title, and so does this. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={islandPage === null ? t('passport.a11y.backToMap') : t('passport.island.a11y.back')}
        onPress={islandPage === null ? onClose : closeIsland}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <View style={styles.backRow}>
          <ChevronMark size={20} color={album.tint} direction="left" />
          <Text style={styles.backText}>{islandPage === null ? t('passport.back') : t('passport.title')}</Text>
        </View>
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
 * T-262, the lead's option A: the trip on show in one line, and all trips' road
 * under it when that says something the first does not. Undefined while
 * nothing is lit.
 */
function wordStats(
  summary: PassportSummary,
  language: Language
): { trip: string; total: string | null } | undefined {
  if (summary.tripLitM <= 0) return undefined;
  const tripDistance = formatDistance(summary.tripLitM, language);
  const totalDistance = formatDistance(summary.totalLitM, language);
  return {
    trip: n('passport.stats.trip', summary.days, { distance: tripDistance }),
    total: totalDistance === tripDistance ? null : t('passport.stats.total', { distance: totalDistance }),
  };
}

/**
 * Turn the award pass's list of *nearly* into one question, or nothing (T-149).
 *
 * The pass hands over the evidence with each id, so nothing here recomputes
 * D-065's arithmetic — a second implementation would be free to disagree with
 * the first. All this adds is the place's name and the memory of what the user
 * has already declined.
 */
async function resolvePrompt(
  awaitingConfirmation: readonly {
    placeId: string;
    evidence: string;
    walked: WalkedEvidence | null;
  }[],
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
  for (const { placeId, evidence, walked } of awaitingConfirmation) {
    const place = places.find((candidate) => candidate.id === placeId);
    if (place !== undefined) {
      candidates.push({ placeId, name: place.name, evidence, walked });
    }
  }

  const prompt = nextPrompt(candidates, new Set(declined), awarded, deviceLanguage());
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
  // T-067a: a hidden island's places are not in the passport until the user
  // has been there. The gate was read just before (`getCurrentProgress`).
  return visiblePlacesNow().map((place) => ({
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

/** Everything a trophy shows, worked out when it is opened (T-251). */
type TrophyView = {
  place: Place;
  stamp: { placeId: string; name: string; category: Category };
  awardedTs: number | null;
  subtitle: string;
  ribbon: string | null;
  medal: {
    title: string;
    progress: string;
    stamps: Array<{ placeId: string; name: string; category: Category; collected: boolean }>;
  } | null;
  next: { placeId: string; name: string; category: Category; distance: string; countsForMedal: boolean } | null;
  nextPlace: Place | null;
};

function trophyView(stamp: PassportStamp, place: Place, awards: StampAward[], language: Language): TrophyView {
  // Suggests only places in the same passport (D-109), and none on an island
  // still hidden (T-067a).
  const places = placesIn(visiblePlacesNow(), getIslandByRegion(), getIslandByRegion().get(place.regionId) ?? null);
  // The trip's stamps in the order they were earned.
  const order = [...awards].sort((a, b) => a.awarded_ts - b.awarded_ts).map((award) => award.place_id);
  const facts = trophyFacts(place.id, places, order, getMedals());
  const medalDefinition = getMedals().find((each) => each.id === facts.medal?.medalId);
  const award = awards.find((candidate) => candidate.place_id === place.id);
  const date =
    award === undefined
      ? null
      : new Date(award.awarded_ts).toLocaleDateString(DATE_LOCALES[language], {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
  const category = t(`placeCard.category.${place.category}` as StringKey);
  const byId = new Map(places.map((each) => [each.id, each]));
  const collected = new Set(order);

  return {
    place,
    stamp: { placeId: place.id, name: place.name, category: place.category },
    awardedTs: award?.awarded_ts ?? null,
    subtitle: date === null ? category : t('trophy.subtitle', { category, date }),
    ribbon: facts.orderInTrip === null ? null : t('trophy.ribbon', { count: facts.orderInTrip }),
    medal:
      facts.medal === null || medalDefinition === undefined
        ? null
        : {
            title: medalTitleFor(medalDefinition),
            progress:
              facts.medal.collected === facts.medal.total
                ? t('trophy.medal.done', { total: facts.medal.total })
                : n('trophy.medal.progress', facts.medal.total - facts.medal.collected, {
                    collected: facts.medal.collected,
                    total: facts.medal.total,
                  }),
            stamps: facts.medal.placeIds.flatMap((id) => {
              const each = byId.get(id);
              return each === undefined
                ? []
                : [{ placeId: id, name: each.name, category: each.category, collected: collected.has(id) }];
            }),
          },
    next:
      facts.next === null
        ? null
        : {
            placeId: facts.next.placeId,
            name: facts.next.name,
            category: facts.next.category,
            distance: formatDistance(facts.next.distanceM, language),
            countsForMedal: facts.next.countsForMedal,
          },
    nextPlace: facts.next === null ? null : (byId.get(facts.next.placeId) ?? null),
  };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: album.background },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
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
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: PASSPORT_BAR_TOP + MIN_TAP_TARGET,
    backgroundColor: album.background,
  },
  // Opposite the back control, where iOS puts a share action.
  share: {
    position: 'absolute',
    top: PASSPORT_BAR_TOP,
    right: spacing.sm,
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  // Disabled controls are exempt from the contrast floor (WCAG 1.4.3); the
  // hint says why it is off.
  shareDisabled: { opacity: 0.4 },
  shareText: {
    color: album.tint,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
  back: {
    position: 'absolute',
    top: PASSPORT_BAR_TOP,
    left: spacing.sm,
    minHeight: MIN_TAP_TARGET,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  // The chevron drawn, not typed (review of 19 Oct, N4): the font set "‹" thin
  // and low beside the word, unlike the drawn mark everywhere else.
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -4 },
  backText: {
    // Tinted text with a chevron: the iOS back button, which carries no fill.
    color: album.tint,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});

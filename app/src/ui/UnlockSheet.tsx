/**
 * The offer to unlock the passport (T-156d, D-089).
 *
 * Opened from the passport's card, a locked stamp, a locked medal, the map's
 * passport mark, the new-stamp pop-up and Settings (D-097, which replaced
 * T-157's rule against asking more than once). Never from a notification.
 *
 * What it says in each state is `entitlement/unlockSheet.ts`, tested in Node;
 * how it looks is `UnlockSheetView`, which the workbench draws in every state.
 * This file only moves between states: it asks `billingSync` for the price,
 * starts a purchase or a restore, and listens for what Google says.
 */

import { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  buyPassport,
  passportPrice,
  restorePurchases,
  subscribe,
} from '../entitlement/billingSync';
import { getMedals } from '../content/medalCatalogue';
import { getContentPack } from '../content/poiCatalogue';
import { isUnlocked } from '../entitlement/entitlementStore';
import { getIslandByRegion, getOpenIslandPassports, passportPlacesNow, visiblePlacesNow } from '../progress/islandGateStore';
import { getLockedRegionIds } from '../progress/currentProgress';
import { placesIn } from '../progress/islandPassports';
import { medalProgress } from '../progress/medals';
import { getRegions } from '../content/regionCatalogue';
import { islandMap, type IslandMap } from '../passport/islandMapArt';
import { medalSetName, setMedalWordsFor } from '../passport/medalView';
import type { FounderWords } from '../passport/medalArt';
import * as stampAwardDao from '../storage/dao/stampAwardDao';
import * as tripDao from '../storage/dao/tripDao';
import { t } from '../i18n';
import { founderWindowEndMs, founderWindowOpen, founderYear, parseWindowStart } from '../entitlement/founder';
import { SHOWCASE_COUNT, showcase, stateAfterFailure, unlockSheetModel, type UnlockState } from '../entitlement/unlockSheet';
import { deviceLanguage } from '../i18n';
import type { PassportStamp } from './PassportView';
import { labelFitsBand } from '../passport/stampArt';

/** N20: samples whose names print whole on the band, unless too few do. */
function wholeNames<T extends { name: string; category: PassportStamp['category'] }>(places: readonly T[]): readonly T[] {
  const whole = places.filter((place) => labelFitsBand(place.name, place.category));
  return whole.length >= SHOWCASE_COUNT ? whole : places;
}
import { colors, spacing } from './theme';
import UnlockSheetView, { type UnlockMedal } from './UnlockSheetView';

export default function UnlockSheet({
  waiting,
  focusId = null,
  onClose,
  onUnlocked,
  startWithRestore = false,
}: {
  /**
   * The locked stamps, the one tapped first (D-097, sheet A): drawn in colour
   * behind frosted glass, and counted in the headline. Empty from Settings
   * when nothing is waiting.
   */
  waiting: PassportStamp[];
  /**
   * T-319: the stamp the user tapped to get here, or null from anywhere else.
   * Page 1 then shows that stamp, half frosted and half in colour.
   */
  focusId?: string | null;
  onClose: () => void;
  /** The passport is unlocked: redraw what was waiting. */
  onUnlocked: () => void;
  /** Settings' *Recover purchase* (T-156e): ask Google at once, on opening. */
  startWithRestore?: boolean;
}) {
  const [state, setState] = useState<UnlockState>({ kind: 'offer' });
  /** Google's price, kept through every state once it has answered. */
  const [price, setPrice] = useState<string | null>(null);
  /** Island passports open to the user, by name: named from day one (D-109). */
  const [islands, setIslands] = useState<string[]>([]);
  /** T-319: the main island's places the user has been to, for the island page. */
  const [visited, setVisited] = useState<ReadonlySet<string> | null>(null);
  /** T-319: the category medals' progress, for the sets page. */
  const [medals, setMedals] = useState<UnlockMedal[]>([]);
  const screen = useWindowDimensions();
  /** With nothing waiting, a few places in colour; picked once per opening. */
  const [shown] = useState<PassportStamp[]>(() =>
    waiting.length > 0
      ? []
      : showcase(wholeNames(visiblePlacesNow()), SHOWCASE_COUNT, Math.random).map((place) => ({
          placeId: place.id,
          name: place.name,
          category: place.category,
          collected: true,
        }))
  );

  useEffect(() => {
    let open = true;
    const unsubscribe = subscribe((event) => {
      if (!open) return;
      if (event.kind === 'unlocked') {
        setState({ kind: 'unlocked' });
        onUnlocked();
      } else if (event.kind === 'pending') {
        setState({ kind: 'pending' });
      } else {
        setState(stateAfterFailure(event.failure));
        if (event.failure === 'alreadyOwned') void restore();
      }
    });
    if (startWithRestore) void restore();
    void readProgress().then(
      (progress) => {
        if (!open || progress === null) return;
        setVisited(progress.visited);
        setMedals(progress.medals);
      },
      () => undefined
    );
    void getOpenIslandPassports().then(
      (passports) => open && setIslands(passports.map((passport) => passport.name)),
      () => undefined
    );
    void (async () => {
      const answer = await passportPrice();
      if (!open) return;
      if ('price' in answer) {
        setPrice(answer.price);
      } else if (answer.failure !== 'failed') {
        setState(stateAfterFailure(answer.failure));
      }
      // A failed price lookup leaves the offer without a price; Buy still works.
    })();
    return () => {
      open = false;
      unsubscribe();
    };
    // Once per opening; the callbacks are the screen's and do not change meaning.
  }, []);

  const buy = () => {
    setState({ kind: 'working' });
    void (async () => {
      const failure = await buyPassport();
      // Success arrives through `subscribe`, as Google's sheet closes.
      if (failure !== null) setState(stateAfterFailure(failure));
    })();
  };

  const restore = async () => {
    setState({ kind: 'working' });
    const failure = await restorePurchases();
    if (failure !== null) {
      setState(stateAfterFailure(failure));
    } else if (await isUnlocked()) {
      setState({ kind: 'unlocked' });
      onUnlocked();
    } else {
      setState((current) =>
        current.kind === 'pending' ? current : { kind: 'nothingToRestore' }
      );
    }
  };

  const pack = getContentPack();
  const mainPlaces = passportPlacesNow(null);
  const focus = focusId === null ? undefined : waiting.find((stamp) => stamp.placeId === focusId);
  const island = visited === null ? null : mainIsland(mainPlaces, visited, screen.width - 2 * spacing.lg);
  const founderOpen = founderWindowOpen(Date.now(), pack.founderWindow);
  const founder: FounderWords | null = founderOpen
    ? { title: t('medal.founder.title'), destination: pack.destination ?? null, year: founderYear(pack.founderWindow) }
    : null;

  const model = unlockSheetModel({
    state,
    price,
    waiting: waiting.length,
    focusName: focus?.name ?? null,
    places:
      island === null || visited === null
        ? null
        : { visited: mainPlaces.filter((place) => visited.has(place.id)).length, total: mainPlaces.length },
    founderEndMs: founderWindowEndMs(pack.founderWindow),
    // Medals whenever content defines any (T-235). The founder stamp only
    // while buying now would still earn it: never while its start is unset,
    // so no testing build promises it (T-233).
    offers: {
      medals: medals.length > 0,
      founder: founderOpen,
      islands,
    },
    // D-110: content dates the launch price; the line goes at midnight UTC
    // after its last day.
    launchPriceEndMs: launchPriceEndMs(getContentPack().launchPriceUntil),
    nowMs: Date.now(),
    language: deviceLanguage(),
  });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.scrim}>
        <UnlockSheetView
          model={model}
          // The tapped stamp leads, so page 1 draws it.
          waiting={focus === undefined ? waiting : [focus, ...waiting.filter((stamp) => stamp !== focus)]}
          showcase={shown}
          island={island}
          medals={medals}
          founder={founder}
          unlocked={state.kind === 'unlocked'}
          onBuy={buy}
          onClose={onClose}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: colors.scrim,
  },
});

/**
 * Every place on the trip on show the user has been to, and the category
 * medals' progress, read as the passport reads them (T-235, D-109: the main
 * island's places only). Null with no trip.
 */
async function readProgress(): Promise<{ visited: Set<string>; medals: UnlockMedal[] } | null> {
  const trip = await tripDao.getTripOnShow();
  if (trip === null) return null;
  const awards = await stampAwardDao.getAwards(trip.id);
  const byRegion = getIslandByRegion();
  const progress = medalProgress(
    getMedals(),
    placesIn(getContentPack().places, byRegion, null),
    awards,
    false,
    await getLockedRegionIds()
  );
  return {
    visited: new Set(awards.map((award) => award.place_id)),
    // The medals content has (municipalities and levadas, not the five
    // category sets the first sketch drew): the five furthest along, which
    // fit a page. The passport shows them all.
    medals: progress
      .filter((medal) => medal.total > 0)
      .sort((a, b) => b.collected / b.total - a.collected / a.total || b.total - a.total)
      .slice(0, UNLOCK_MEDALS)
      .map((medal) => ({
        id: medal.id,
        name: medalSetName(medal.rule),
        collected: medal.collected,
        total: medal.total,
        words: setMedalWordsFor(medal),
      })),
  };
}

/** How many medals the sets page lists. */
const UNLOCK_MEDALS = 5;

/** The main island's municipalities and places, drawn `width` wide. */
function mainIsland(
  places: ReturnType<typeof passportPlacesNow>,
  visited: ReadonlySet<string>,
  width: number
): IslandMap | null {
  const byRegion = getIslandByRegion();
  return islandMap(
    getRegions()
      .filter((region) => region.outline !== null && !byRegion.has(region.id))
      .map((region) => ({ id: region.id, outline: region.outline ?? [] })),
    places.map((place) => ({
      id: place.id,
      regionId: place.regionId,
      lat: place.geofences[0].lat,
      lon: place.geofences[0].lon,
    })),
    visited,
    width
  );
}

/** The first millisecond after the launch price's last day, or null. */
function launchPriceEndMs(until: string | null): number | null {
  const lastDay = until === null ? null : parseWindowStart(until);
  return lastDay === null ? null : lastDay + 24 * 3_600_000;
}

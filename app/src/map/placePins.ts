/**
 * A faint pin for every place, once the map is zoomed in to a town (A6 of the
 * 30 Oct fix plan; the lead's answer to Q1, option c; D-070 amended).
 *
 * The island view stays as the lead asked on 4 Oct, roads only. A tourist
 * zoomed into a town sees what is there to collect, and a tap opens the
 * place's card, as the passport's *Ver no mapa* does.
 *
 * Pure: which pins, and when. `NativeMapScreen` draws them.
 */

import type { Place } from '../content/contentPack.ts';
import { representativeGeofence } from './placeMarkers.ts';

/**
 * Pins appear at this zoom and above: about 6 km across a phone's screen, a
 * town such as Funchal's centre. A starting point chosen by reasoning, not a
 * measurement; the lead judges it on the phone.
 */
export const PINS_SHOW_ZOOM = 13;
/**
 * And hide below this one. The gap keeps a pinch that hovers at the threshold
 * from making every pin flicker in and out.
 */
export const PINS_HIDE_ZOOM = 12.5;

/** Whether pins show at `zoom`, given whether they show now. */
export function pinsVisible(zoom: number, shownNow: boolean): boolean {
  if (!Number.isFinite(zoom)) return shownNow;
  return shownNow ? zoom >= PINS_HIDE_ZOOM : zoom >= PINS_SHOW_ZOOM;
}

/** Marker ids are `place:<id>`, so a tap can tell a place pin from the gold focus pin. */
export const PIN_ID_PREFIX = 'place:';

export type PlacePin = {
  id: string;
  coordinates: { latitude: number; longitude: number };
  /** Read by a screen reader on the map. */
  title: string;
};

/**
 * One pin per place, at the point its card frames, leaving out the place
 * whose gold pin is showing (it would sit under it).
 */
export function placePins(places: readonly Place[], focusedId: string | null): PlacePin[] {
  return places
    .filter((place) => place.id !== focusedId)
    .map((place) => {
      const point = representativeGeofence(place);
      return {
        id: `${PIN_ID_PREFIX}${place.id}`,
        coordinates: { latitude: point.lat, longitude: point.lon },
        title: place.name,
      };
    });
}

/** The place a tapped marker stands for, or null for any other marker. */
export function placeIdFromPin(markerId: string | undefined): string | null {
  if (markerId === undefined || !markerId.startsWith(PIN_ID_PREFIX)) return null;
  const id = markerId.slice(PIN_ID_PREFIX.length);
  return id === '' ? null : id;
}

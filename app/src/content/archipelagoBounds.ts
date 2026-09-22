/**
 * The archipelago's bounding box, in one place (T-171).
 *
 * Read from the shipped map style's metadata rather than written here as
 * coordinates: **the app carries no Madeira knowledge** (D-017, absolute), and
 * this is the same source the camera frames from.
 *
 * ⚠ **Why it is its own module.** `tripEndDetection` used to derive this
 * privately, and then T-171 needed the recorder to ask the same question —
 * *is this position outside the archipelago* — before opening a trip for a fix.
 * Two copies of a bounding box is two chances for the rule that **ends** a trip
 * and the rule that **starts** one to disagree, and a disagreement between
 * exactly those two is the loop T-171 is about.
 *
 * ⚠ **Madeira and Porto Santo are ONE region** (D-021). The bounds cover both.
 */

import type { Bounds } from '../progress/tripEnd';

import lightTemplate from '../../assets/map/light.json';

const [WEST, SOUTH, EAST, NORTH] = lightTemplate.metadata['madeira:bounds'] as [
  number,
  number,
  number,
  number,
];

export const ARCHIPELAGO_BOUNDS: Bounds = {
  west: WEST,
  south: SOUTH,
  east: EAST,
  north: NORTH,
};

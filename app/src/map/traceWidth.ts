/**
 * How wide the lit roads are drawn, by camera zoom (D-104).
 *
 * WHY THE WIDTH HAS TO CHANGE WITH THE ZOOM
 * -----------------------------------------
 * Google's polylines keep the width they are given in screen pixels at every
 * zoom. A line that sits neatly on a street at street zoom is therefore about
 * 200 m of ground wide at the island view, and a town's streets, 40 to 100 m
 * apart, run together into one solid patch: measured on the P30 over Caniço
 * on 2026-10-10, and drawn for a town centre walked end to end, where it hid
 * the town's own name. Thinner lines further out keep the streets apart, so a
 * lot of walking reads as a mesh of streets rather than a blot.
 *
 * WHY STEPS AND NOT A SMOOTH CURVE
 * --------------------------------
 * A new width means handing the map every polyline again. In steps, that
 * happens only when a pinch crosses one; a width that followed the zoom
 * exactly would redraw every line on every camera event, which is the cost
 * T-254 took out of this screen.
 *
 * ⚠ **NOT TUNED.** Chosen from drawings over the P30's own screenshots, never
 * judged outdoors. A walk in a town and three screenshots (island, town,
 * street) are what settle them.
 *
 * Pure. Tested in `traceWidth.test.ts`.
 */

/** Widest first: the first step whose zoom the camera has reached wins. */
export const TRACE_WIDTH_STEPS: readonly { readonly fromZoom: number; readonly widthDp: number }[] = [
  // Street zoom, where *Centrar* lands (16): the width the map always used.
  { fromZoom: 15, widthDp: 4 },
  { fromZoom: 13.5, widthDp: 3 },
  { fromZoom: 12, widthDp: 2.5 },
  // The island view. Thinner than 2 dp was too faint to find outdoors in
  // the drawings, so this is the floor.
  { fromZoom: -Infinity, widthDp: 2 },
];

/** The lit roads' width in dp at a camera zoom. */
export function traceWidthDp(zoom: number): number {
  const z = Number.isFinite(zoom) ? zoom : -Infinity;
  for (const step of TRACE_WIDTH_STEPS) {
    if (z >= step.fromZoom) return step.widthDp;
  }
  return TRACE_WIDTH_STEPS[TRACE_WIDTH_STEPS.length - 1]!.widthDp;
}

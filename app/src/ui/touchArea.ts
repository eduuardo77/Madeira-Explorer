/**
 * Grow a pressable's own box to the size Play's pre-launch report measures,
 * without moving anything (N27, 2026-10-27).
 *
 * `hitSlop` already gives these controls a finger-sized target, but it is a
 * touch rule, not a size: the report and `uiautomator` measure the view, and
 * found *Ver tudo* 19 dp tall and the gold badge 19 × 22. Padding grows the
 * view; an equal negative margin gives the space back, so the layout and the
 * drawing stay exactly as they were. Pure, so it is tested in Node.
 */

/** What the pre-launch report asks of a touch target, dp. */
export const MEASURED_TARGET = 48;

export type TouchGrowth = {
  paddingVertical: number;
  marginVertical: number;
  paddingHorizontal: number;
  marginHorizontal: number;
};

/** The style that grows a `drawnHeight` (and, if given, `drawnWidth`) box to 48 dp. */
export function growTouch(drawnHeight: number, drawnWidth?: number): TouchGrowth {
  const grow = (drawn: number) => Math.max(0, Math.ceil((MEASURED_TARGET - drawn) / 2));
  const vertical = grow(drawnHeight);
  const horizontal = drawnWidth === undefined ? 0 : grow(drawnWidth);
  return {
    paddingVertical: vertical,
    marginVertical: 0 - vertical || 0,
    paddingHorizontal: horizontal,
    marginHorizontal: 0 - horizontal || 0,
  };
}

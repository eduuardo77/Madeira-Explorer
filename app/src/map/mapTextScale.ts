/**
 * Apply the system font scale to map labels (T-061).
 *
 * WHY THIS IS NOT ONE MULTIPLICATION
 * ----------------------------------
 * CONTEXT §6.5 requires system font scaling to be respected *everywhere*, and
 * the map is the one screen where React Native does not do it for us: MapLibre
 * draws its labels itself from the style's `text-size`, which knows nothing
 * about the phone's accessibility settings.
 *
 * The obvious fix — wrap the whole thing as `["*", scale, <original>]` — is
 * **invalid**. A `["zoom"]` expression may only appear as the input to a
 * top-level `interpolate` or `step`; burying it inside an arithmetic operator
 * makes the style fail to parse. And `text-size` in the shipped style is
 * exactly that shape: a zoom `interpolate` whose outputs are `case`
 * expressions keyed on `population_rank`.
 *
 * So the scale has to be pushed *down* to the leaves — the output values —
 * leaving the zoom stops and the conditions alone. Multiplying a zoom stop
 * would move the zoom level at which a label changes size, which is not a
 * font-size change at all.
 *
 * ⚠ **WHAT THIS CANNOT DECIDE, AND T-065 MUST.** Bigger labels collide sooner,
 * and MapLibre resolves a collision by *dropping* a label. At a large
 * accessibility scale the map may end up with fewer, larger names — which is
 * more legible per label and possibly less legible overall. No cap is applied
 * here, because the stated rule is to respect the setting and inventing a
 * ceiling would be inventing a threshold nobody has measured. **The outdoor
 * test (T-065) is where this gets judged**, at the largest scale a phone
 * offers.
 *
 * Pure: no React Native, no style loading, no knowledge of which style it is
 * given. Tested in `mapTextScale.test.ts`, including against the real shipped
 * styles.
 */

/** A style expression, or a plain value. Deliberately loose — this walks JSON. */
type Expression = unknown;

/**
 * Expression heads whose *outputs* are sizes and whose inputs are not.
 *
 * The layout of each is fixed by the style specification:
 *   interpolate: [head, interpolation, input, stop, output, stop, output, …]
 *   step:        [head, input, output, stop, output, stop, output, …]
 *   case:        [head, condition, output, condition, output, …, fallback]
 *   match:       [head, input, label, output, label, output, …, fallback]
 */
const INTERPOLATE_HEADS = new Set([
  'interpolate',
  'interpolate-hcl',
  'interpolate-lab',
]);

function scaleNumber(value: number, scale: number): number {
  // Two decimal places: enough to keep the ramp smooth, few enough that the
  // serialised style does not gain floating-point noise on every label.
  return Math.round(value * scale * 100) / 100;
}

/**
 * Scale every size-producing leaf of a `text-size` value.
 *
 * Anything it does not recognise is returned untouched rather than guessed at.
 * That is the safe direction — an unscaled label is a bug, a corrupted
 * expression is a map that will not render — and `mapTextScale.test.ts` runs
 * over the real styles to catch a shape this does not know.
 */
export function scaleTextSize(value: Expression, scale: number): Expression {
  if (typeof value === 'number') {
    return scaleNumber(value, scale);
  }

  if (!Array.isArray(value) || value.length === 0) {
    return value;
  }

  const head = value[0];

  if (typeof head === 'string' && INTERPOLATE_HEADS.has(head)) {
    // Keep head, interpolation and input. Then alternate: stop, output.
    const out: Expression[] = [value[0], value[1], value[2]];
    for (let i = 3; i < value.length; i += 2) {
      out.push(value[i]);
      if (i + 1 < value.length) out.push(scaleTextSize(value[i + 1], scale));
    }
    return out;
  }

  if (head === 'step') {
    // Keep head and input. Then the default output, then stop/output pairs.
    const out: Expression[] = [value[0], value[1]];
    for (let i = 2; i < value.length; i += 1) {
      // Indices 2, 4, 6 … are outputs; 3, 5, 7 … are stops.
      out.push(i % 2 === 0 ? scaleTextSize(value[i], scale) : value[i]);
    }
    return out;
  }

  if (head === 'case') {
    // Conditions at odd indices, outputs at even — plus a trailing fallback.
    const out: Expression[] = [value[0]];
    for (let i = 1; i < value.length; i += 1) {
      const isFallback = i === value.length - 1;
      const isOutput = i % 2 === 0;
      out.push(isOutput || isFallback ? scaleTextSize(value[i], scale) : value[i]);
    }
    return out;
  }

  if (head === 'match') {
    // [match, input, label, output, label, output, …, fallback]
    const out: Expression[] = [value[0], value[1]];
    for (let i = 2; i < value.length; i += 1) {
      const isFallback = i === value.length - 1;
      const isOutput = i % 2 === 1;
      out.push(isOutput || isFallback ? scaleTextSize(value[i], scale) : value[i]);
    }
    return out;
  }

  // `literal`, `get`, comparisons, anything else: not a size producer.
  return value;
}

/** A style layer, as far as this module needs to understand one. */
type Layer = { type?: unknown; layout?: Record<string, unknown> } & Record<
  string,
  unknown
>;

/** A style document, as far as this module needs to understand one. */
export type StyleDocument = { layers?: Layer[] } & Record<string, unknown>;

/**
 * Return a copy of `style` with every symbol layer's `text-size` scaled.
 *
 * A scale of exactly 1 returns the style untouched — the common case, and
 * worth not rewriting a 2,500-line document for.
 */
export function applyFontScale(
  style: StyleDocument,
  scale: number
): StyleDocument {
  if (!Number.isFinite(scale) || scale === 1 || scale <= 0) {
    return style;
  }
  if (!Array.isArray(style.layers)) {
    return style;
  }

  return {
    ...style,
    layers: style.layers.map((layer) => {
      if (layer.type !== 'symbol' || layer.layout === undefined) {
        return layer;
      }
      const textSize = layer.layout['text-size'];
      if (textSize === undefined) {
        return layer;
      }
      return {
        ...layer,
        layout: { ...layer.layout, 'text-size': scaleTextSize(textSize, scale) },
      };
    }),
  };
}

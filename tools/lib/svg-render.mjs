/**
 * The preview tools' shared drawing, in one place.
 *
 * ⚠ **This is the project's "second renderer", and there is only ever one of
 * it.** CLAUDE.md's rule is that anything visual gets a second renderer so the
 * artwork can be *looked at* outside the app — `preview-stamps.mjs` for the
 * stamps, `preview-film.mjs` for the souvenir film. When `preview-tour.mjs`
 * needed both, the choice was to copy them or to extract them. A copy would
 * have made a **third** drawing of the same thing, free to disagree with the
 * two that had already been approved by eye, which is the exact failure the
 * one-renderer rule exists to prevent.
 *
 * Everything here composes the app's own pure modules — `stampArt.ts`,
 * `frame.ts` — and adds no judgement of its own.
 */

import {
  CANVAS,
  designFor,
  stampElements,
  toPolygon,
} from '../../app/src/passport/stampArt.ts';
import { projector } from '../../app/src/souvenir/frame.ts';
import { CATEGORY_COLOUR, stampMarkPoints } from '../../app/src/souvenir/filmPaint.ts';

export function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function attrs(element) {
  const out = [];
  for (const [key, value] of Object.entries(element)) {
    if (key === 'kind' || key === 'text' || key === 'clip' || value === undefined) continue;
    // camelCase → kebab-case: strokeWidth becomes stroke-width. Both SVG in a
    // browser and react-native-svg accept their own spelling; only this side
    // needs the conversion.
    out.push(`${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${value}"`);
  }
  return out.join(' ');
}

/**
 * One passport stamp, as a standalone `<svg>`.
 *
 * `id` also names the clip path, which is not cosmetic: several stamps render
 * into one document here, and a shared id would make every band take the first
 * stamp's shape.
 */
export function stampSvg(id, name, category, collected, extraStyle = '', motif = undefined) {
  const design = designFor(id, category, motif);
  const elements = stampElements(design, name, collected);

  const body = elements
    .map((element) => {
      if (element.kind === 'text') {
        const { text, textLength, ...rest } = element;
        // `textLength` and `lengthAdjust` are camelCase in SVG itself, so they
        // bypass the kebab-case conversion above.
        const fit =
          textLength === null || textLength === undefined
            ? ''
            : ` textLength="${textLength}" lengthAdjust="spacingAndGlyphs"`;
        return `<text ${attrs(rest)}${fit} text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" letter-spacing="0.6">${escapeXml(text)}</text>`;
      }
      // Which elements clip is `stampArt.ts`'s decision, not this file's: the
      // band and the sunburst both need it, and guessing from the kind would
      // have let the sunburst paint over the borders.
      const clip = element.clip === true ? ` clip-path="url(#panel-${id})"` : '';
      return `<${element.kind} ${attrs(element)}${clip} />`;
    })
    .join('\n      ');

  // Taken from the design rather than by indexing the element list — the list
  // gained two layers when the artwork was made more detailed, and an index
  // would have silently clipped the band to the wrong outline.
  const panelPoints = toPolygon(design.panel);

  return `<svg viewBox="0 0 ${CANVAS} ${CANVAS}" style="transform: rotate(${design.tiltDeg}deg);${extraStyle}">
      <defs><clipPath id="panel-${id}"><polygon points="${panelPoints}" /></clipPath></defs>
      ${body}
    </svg>`;
}

/**
 * One frame of the souvenir film's **geometry**, as a standalone `<svg>`.
 *
 * ⚠⚠ **THERE IS NO BASEMAP HERE, AND THE APP HAS ONE.** Since D-076 the replay
 * is Google's own map with the camera following the walk; this preview cannot
 * draw that — there are no tiles in a Node script — so it draws the *shapes*
 * against a plain ground and nothing else. That distinction cost a
 * misunderstanding once: the project lead saw a black rectangle with white
 * lines on it and reasonably asked whether that was the product.
 *
 * ⚠ So the ground is a **map-ish slate, deliberately not black**, and every
 * caller must say in words that the basemap is missing from the preview rather
 * than from the app. What this still answers is worth having: does the walk
 * draw in the right order, does the camera point at the right thing, does a
 * stamp land off the edge.
 *
 * It takes a `Frame` from `frame.ts` and projects it with `frame.ts`'s own
 * `projector`. Nothing about *what* is on screen is decided here.
 */
export function filmFrameSvg(frame, width, height, options = {}) {
  const { ground = '#2A2E35', trace = '#5AA9FF' } = options;
  const toPixel = projector(frame.bounds, width, height);
  const strokeWidth = Math.max(1.5, width / 180);

  const paths = frame.strokes
    .map((stroke) => {
      const d = stroke
        .map(([lon, lat], i) => {
          const [x, y] = toPixel(lon, lat);
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
      return `<path d="${d}" fill="none" stroke="${trace}" stroke-width="${strokeWidth.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join('');

  const marks = frame.stamps
    .map((stamp) => {
      const [x, y] = toPixel(stamp.lon, stamp.lat);
      // The app's own pop curve (`filmPaint.ts`), scaled to this preview's
      // size rather than re-invented — otherwise the marks here would settle at
      // a different size from the ones on the map.
      const r = (stampMarkPoints(stamp.ageMs) / 9) * strokeWidth * 1.6;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${CATEGORY_COLOUR[stamp.category] ?? '#FFFFFF'}"/>`;
    })
    .join('');

  const hero =
    frame.hero === null
      ? ''
      : `<text x="${width / 2}" y="${height - height * 0.14}" text-anchor="middle" fill="#FFFFFF" font-size="${Math.round(width / 7)}" font-weight="700" font-family="system-ui, -apple-system, Roboto, sans-serif">${frame.hero.collected} / ${frame.hero.total}</text>`;

  return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${ground}"/>
  ${paths}${marks}${hero}
</svg>`;
}

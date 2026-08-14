/**
 * Tests for the stamp artwork (T-070).
 *
 *     cd app && npm test
 *
 * Artwork cannot be unit-tested and this file does not pretend otherwise —
 * whether it *looks* good is judged by eye, from `tools/preview-stamps.mjs`.
 * What is tested is the part that would fail invisibly and be blamed on
 * something else:
 *
 *   1. **Stability.** A stamp that changes shape or colour between two
 *      launches is not a souvenir. Everything varies from a hash of the place
 *      id and nothing else — no clock, no random, no list index that shifts as
 *      the pack grows.
 *   2. **The emblem carries the category.** D-015 forbids meaning by hue
 *      alone. Since 2026-08-11 the silhouette varies per place, so the emblem
 *      is the *only* non-colour signal left and two categories sharing one
 *      would break the rule silently.
 *   3. **The place name fits.** The project lead's requirement, and the thing
 *      most likely to break on one shape out of eight and be missed.
 *   4. **The variation actually varies.** A hash returning the same slot for
 *      every id would look exactly like a working system until somebody
 *      noticed the whole page was one colour.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATEGORIES, type Category } from '../content/contentPack.ts';
import {

  CANVAS,
  EDGE_STYLES,
  MAX_LINE_CHARS,
  MAX_LINES,
  MAX_TILT_DEG,
  MIN_EMBLEM_ROOM,
  SHAPE_NAMES,
  TILT_FIT,
  bestBandY,
  cutEdge,
  designFor,
  dotsPath,
  estimateTextWidth,
  hashId,
  inset,
  panelWidthAt,
  stampElements,
  sunburstPath,
  toPolygon,
  wrapLabel,
  type Emblem,
  type Point,
  type StampElement,
} from './stampArt.ts';

/** Plausible ids, in the shape `content/README.md` asks curation to use. */
function ids(count: number): string[] {
  const list: string[] = [];
  for (let i = 0; i < count; i += 1) {
    list.push(`place-${i}-${'abcdefghij'[i % 10]}`);
  }
  return list;
}

// ---------------------------------------------------------------------------
// 1. Stability
// ---------------------------------------------------------------------------

test('the same place always gets the same stamp', () => {
  assert.deepEqual(
    designFor('pico-do-arieiro', 'viewpoint'),
    designFor('pico-do-arieiro', 'viewpoint')
  );
});

test('the hash is stable for known inputs', () => {
  // Pinned deliberately. If this fails, every stamp in every existing passport
  // has just changed appearance — which is a decision, not a tidy-up.
  assert.equal(hashId(''), 0x811c9dc5);
  assert.equal(hashId('a'), hashId('a'));
  assert.notEqual(hashId('a'), hashId('b'));
  assert.ok(hashId('levada-do-rei') >= 0);
});

test('nothing in a design depends on anything but the id and the category', () => {
  for (const id of ids(200)) {
    for (const category of CATEGORIES) {
      const design = designFor(id, category);
      assert.ok(design.colourway !== undefined, `${id}/${category} colourway`);
      assert.ok(design.icon.front.length > 0, `${id}/${category} emblem`);
      assert.ok(design.icon.back.length > 0, `${id}/${category} emblem back`);
      assert.ok(design.cutOutline.length > 0, `${id}/${category} outline`);
      assert.ok(design.innerOutline.length > 0, `${id}/${category} inner`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. The emblem carries the category
// ---------------------------------------------------------------------------

test('every category has its own emblem, and no two share one', () => {
  // ⚠ THE ACCESSIBILITY RULE. The silhouette used to carry the category and no
  // longer does (varied shapes, 2026-08-11), so this is the only non-colour
  // signal left. Two categories sharing an emblem would leave the passport
  // readable by hue alone, which D-015 forbids outright.
  const seen = new Map<string, Category>();

  for (const category of CATEGORIES) {
    const emblem = JSON.stringify(designFor('x', category).icon);
    const clash = seen.get(emblem);
    assert.equal(
      clash,
      undefined,
      `${category} has the same emblem as ${clash} — D-015 forbids meaning by colour alone`
    );
    seen.set(emblem, category);
  }
});

test('the emblem never depends on the place, only on the category', () => {
  for (const category of CATEGORIES) {
    const emblems = new Set(
      ids(60).map((id) => JSON.stringify(designFor(id, category).icon))
    );
    assert.equal(emblems.size, 1, `${category} changes emblem between places`);
  }
});

test('a category is not tied to one silhouette', () => {
  // The project lead asked for varied shapes. If a category only ever drew one
  // of the eight, that request would be quietly unmet.
  for (const category of CATEGORIES) {
    const shapes = new Set(ids(120).map((id) => designFor(id, category).shapeName));
    assert.ok(shapes.size >= 5, `${category} only ever uses ${shapes.size} shape(s)`);
  }
});

test('all eight silhouettes get used', () => {
  const shapes = new Set(ids(300).map((id) => designFor(id, 'village').shapeName));
  assert.equal(
    shapes.size,
    SHAPE_NAMES.length,
    `only ${shapes.size} of ${SHAPE_NAMES.length} shapes appear`
  );
});

// ---------------------------------------------------------------------------
// 3. The place name fits
// ---------------------------------------------------------------------------

test('a long name wraps onto two lines rather than being cut short', () => {
  // "MIRADOURO GRA…" technically fits and tells the reader nothing. The
  // requirement is that the name fits, not that it is truncated politely.
  const lines = wrapLabel('Miradouro Grande');
  assert.equal(lines.length, 2);
  assert.deepEqual(lines, ['MIRADOURO', 'GRANDE']);
});

test('a short name stays on one line', () => {
  assert.deepEqual(wrapLabel('Machico'), ['MACHICO']);
  assert.deepEqual(wrapLabel('Sé'), ['SÉ']);
});

test('names never exceed two lines, however many words', () => {
  const lines = wrapLabel('Levada do Caldeirão Verde Norte Alta');
  assert.ok(lines.length <= MAX_LINES);
  for (const line of lines) {
    assert.ok(line.length <= MAX_LINE_CHARS + 3, `"${line}" is ${line.length}`);
  }
});

test('a single unbreakable word is truncated rather than overflowing', () => {
  const lines = wrapLabel('Aaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(lines.length, 1);
  assert.ok(lines[0].length <= MAX_LINE_CHARS + 3);
});

test('the name fits inside the sticker, on every shape and every category', () => {
  // ⚠ THE DEFECT THIS EXISTS TO STOP. Eight silhouettes × one or two lines is
  // sixteen placements, and three of the shapes taper — a triangle, a diamond
  // and a shield are all narrow somewhere. A band at a fixed height would be
  // wrong for some combination and it would show up on *some* names in *some*
  // categories, which is what survives a look at a few examples.
  const names = ['Sé', 'Machico', 'Miradouro Grande', 'Long Canal Trail'];

  for (const id of ids(120)) {
    for (const category of CATEGORIES) {
      const design = designFor(id, category);
      for (const name of names) {
        for (const element of stampElements(design, name, true)) {
          if (element.kind !== 'text') {
            continue;
          }
          const available = panelWidthAt(design.panel, element.y);
          const drawn =
            element.textLength ??
            estimateTextWidth(element.text, element.fontSize);

          assert.ok(
            drawn <= available + 0.01,
            `${design.shapeName}/${category}/"${name}": text ${drawn.toFixed(1)} wide where the sticker is ${available.toFixed(1)}`
          );
        }
      }
    }
  }
});

test('the band lands where the shape is actually wide', () => {
  for (const id of ids(80)) {
    for (const category of CATEGORIES) {
      const design = designFor(id, category);
      const band = stampElements(design, 'Miradouro Grande', true).find(
        (element) => element.kind === 'rect'
      );
      assert.ok(band !== undefined && band.kind === 'rect');

      const middle = band.y + band.height / 2;
      const width = panelWidthAt(design.panel, middle);
      assert.ok(
        width >= 38,
        `${design.shapeName}: band sits where the panel is only ${width.toFixed(1)} wide`
      );
    }
  }
});

test('the band goes low, and never onto the emblem', () => {
  // On an upward triangle the widest part is the bottom, and that is where a
  // luggage label puts its name.
  const upward: Point[] = [
    [50, 10],
    [90, 90],
    [10, 90],
  ];
  assert.ok(bestBandY(upward, 20) > 50);

  // ⚠ On a *downward* triangle the widest part is the top — and the band must
  // still not go there, because the emblem lives above it. This is the shield
  // case that was found by measuring: the band took the top of the panel and
  // left the emblem exactly zero room, so it escaped the sticker upward.
  const downward: Point[] = [
    [10, 10],
    [90, 10],
    [50, 90],
  ];
  assert.ok(
    bestBandY(downward, 20) >= 10 + MIN_EMBLEM_ROOM - 0.001,
    'the band took the emblem’s room'
  );
});

test('every shape leaves the emblem room above the band', () => {
  for (const id of ids(120)) {
    for (const category of CATEGORIES) {
      const design = designFor(id, category);
      const band = stampElements(design, 'Miradouro Grande', true).find(
        (element) => element.kind === 'rect'
      );
      assert.ok(band !== undefined && band.kind === 'rect');

      const panelTop = Math.min(...design.panel.map(([, y]) => y));
      assert.ok(
        band.y - panelTop >= MIN_EMBLEM_ROOM - 0.6,
        `${design.shapeName}: only ${(band.y - panelTop).toFixed(1)} above the band`
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 4. The variation varies
// ---------------------------------------------------------------------------

test('colourways are spread across places, not clumped on one', () => {
  for (const category of CATEGORIES) {
    const used = new Set(ids(150).map((id) => designFor(id, category).colourway.paper));
    assert.ok(used.size >= 4, `${category} only ever uses ${used.size} colourway(s)`);
  }
});

test('shape, colour and tilt do not move together', () => {
  // All three are slices of one hash. If they correlated, every diamond would
  // be the same colour and the page would look mechanical.
  const pairs = new Set(
    ids(200).map((id) => {
      const design = designFor(id, 'beach');
      return `${design.shapeName}/${design.colourway.paper}`;
    })
  );
  assert.ok(pairs.size > SHAPE_NAMES.length, `only ${pairs.size} shape/colour pairings`);
});

test('tilt stays small and within bounds', () => {
  const tilts = new Set<number>();
  for (const id of ids(120)) {
    const { tiltDeg } = designFor(id, 'beach');
    assert.ok(Math.abs(tiltDeg) <= MAX_TILT_DEG, `tilt ${tiltDeg} is too much`);
    tilts.add(tiltDeg);
  }
  assert.ok(tilts.size > 1, 'every stamp is tilted identically');
});

test('a tilted stamp fits the space it is given', () => {
  // ⚠ Measured, not assumed: three stamps in the workbench came back 62, 65
  // and 67 px wide inside 62 px cells, because a rotated square's bounding box
  // is wider than its side. Views do not clip on iOS, so this would have
  // looked correct there and lost corners on Android.
  const cell = 62;
  const drawn = cell * TILT_FIT;
  const worstCase =
    drawn * (Math.cos(radians(MAX_TILT_DEG)) + Math.sin(radians(MAX_TILT_DEG)));

  assert.ok(worstCase <= cell + 0.001, `${worstCase.toFixed(2)} > ${cell}`);
  assert.ok(drawn > cell * 0.85, 'the sticker is swimming in its cell');
});

// ---------------------------------------------------------------------------
// The drawing
// ---------------------------------------------------------------------------

test('a collected stamp draws in its own colours, an uncollected one does not', () => {
  const design = designFor('ponta-de-sao-lourenco', 'viewpoint');
  const on = stampElements(design, 'Ponta', true);
  const off = stampElements(design, 'Ponta', false);

  // Same elements in the same order — only the palette changes. That is what
  // keeps the category readable when the place has not been collected.
  assert.deepEqual(on.map((e) => e.kind), off.map((e) => e.kind));
  assert.notEqual(fillOf(on[0]), fillOf(off[0]));
  assert.equal(pointsOf(on[0]), pointsOf(off[0]));
});

test('an uncollected stamp stays legible rather than nearly invisible', () => {
  // D-015: unvisited is mid-grey, never near-black. The uncollected ink must
  // be clearly lighter than the #12191F background it sits on.
  const off = stampElements(designFor('x', 'beach'), 'Somewhere', false);
  const emblem = off.filter((element) => element.kind === 'path').pop();

  assert.ok(emblem !== undefined);
  assert.ok(parseInt(fillOf(emblem).slice(1, 3), 16) > 0x60);
});

test('the sticker has real detail, not three flat shapes', () => {
  // The first version was called too minimalistic. This pins what was added:
  // two cut borders, a sunburst, perforation dots, a keyline, and a two-tone
  // emblem — so a later simplification is a decision rather than a drift.
  const elements = stampElements(designFor('x', 'landmark'), 'Old Fort', true);

  assert.ok(elements.filter((e) => e.kind === 'polygon').length >= 4);
  assert.ok(elements.filter((e) => e.kind === 'path').length >= 4);
  assert.ok(elements.filter((e) => e.kind === 'rect').length === 1);
});

test('the emblem is drawn back-then-front, in two different colours', () => {
  const design = designFor('x', 'village');
  const paths = stampElements(design, 'Machico', true).filter(
    (element) => element.kind === 'path'
  );
  const back = paths[paths.length - 2];
  const front = paths[paths.length - 1];

  assert.equal(pathOf(back), design.icon.back);
  assert.equal(pathOf(front), design.icon.front);
  assert.notEqual(fillOf(back), fillOf(front));
});

test('the emblem stays inside the panel, on every shape', () => {
  // ⚠ Found by reading the generated markup: scaling the emblem by the height
  // above the band alone pushed it over the band and past the panel on the
  // tapering shapes. The fix is to scale by width *and* height, and this is
  // what stops it regressing — an emblem crossing the border looks like a
  // rendering bug rather than a design, and it would only do it on some shapes.
  for (const id of ids(120)) {
    for (const category of CATEGORIES) {
      const design = designFor(id, category);
      const paths = stampElements(design, 'Miradouro Grande', true).filter(
        (element) => element.kind === 'path' && element.transform !== undefined
      );
      assert.equal(paths.length, 2, 'the emblem is not two transformed layers');

      const box = emblemBox(paths[0], design.icon);
      const panel = bounds(design.panel);
      assert.ok(box.minY >= panel.minY, `${design.shapeName} emblem above panel`);
      assert.ok(box.maxY <= panel.maxY, `${design.shapeName} emblem below panel`);

      // ⚠ Measured at the emblem's **top and bottom edges**, not its middle.
      // Checking the middle is what let an oversized emblem pass on a diamond:
      // it fits the widest line and hangs over the sloped sides. That was a
      // real escape hiding behind a test that looked like it covered this.
      for (const edge of [box.minY, box.maxY]) {
        const room = panelWidthAt(design.panel, edge);
        assert.ok(
          box.maxX - box.minX <= room + 0.01,
          `${design.shapeName}: emblem ${(box.maxX - box.minX).toFixed(1)} wide where the panel is ${room.toFixed(1)}`
        );
      }
    }
  }
});

test('the sunburst is marked for clipping and the borders are not', () => {
  // The sunburst's radius overshoots the canvas on purpose so its rays reach
  // the corners. Unclipped it painted over both borders and outside the
  // sticker entirely — visible in the generated markup as coordinates at
  // x=112 and y=-35 on a 100-unit grid.
  const elements = stampElements(designFor('x', 'viewpoint'), 'High Rock', true);
  const clipped = elements.filter((element) => element.clip === true);

  assert.equal(clipped.length, 2, 'expected the sunburst and the band');
  assert.ok(clipped.some((element) => element.kind === 'path'));
  assert.ok(clipped.some((element) => element.kind === 'rect'));
  // The borders must NOT be clipped — they are the sticker's outer edge.
  assert.equal(elements[0].clip, undefined);
  assert.equal(elements[1].clip, undefined);
});

test('every element lands on the canvas', () => {
  for (const id of ids(60)) {
    for (const category of CATEGORIES) {
      for (const element of stampElements(designFor(id, category), 'A Place', true)) {
        if (element.kind === 'rect') {
          assert.ok(element.y >= 0 && element.y + element.height <= CANVAS);
        }
        if (element.kind === 'text') {
          assert.ok(element.x > 0 && element.x < CANVAS);
          assert.ok(element.y > 0 && element.y < CANVAS, `text at y=${element.y}`);
        }
      }
    }
  }
});

// ---------------------------------------------------------------------------
// The geometry helpers
// ---------------------------------------------------------------------------

test('the cut edge stays on the canvas', () => {
  for (const shape of SHAPE_NAMES) {
    for (const style of EDGE_STYLES) {
      const design = ids(300)
        .map((id) => designFor(id, 'village'))
        .find((candidate) => candidate.shapeName === shape);
      assert.ok(design !== undefined, `no place ever drew ${shape}`);

      for (const [x, y] of cutEdge(design.outline, style)) {
        assert.ok(x >= -1 && x <= CANVAS + 1, `${shape}/${style} x=${x}`);
        assert.ok(y >= -1 && y <= CANVAS + 1, `${shape}/${style} y=${y}`);
      }
    }
  }
});

test('the panel sits inside both borders', () => {
  for (const id of ids(60)) {
    const design = designFor(id, 'beach');
    const outer = bounds(design.outline);
    const inner = bounds(design.panel);

    assert.ok(inner.minX > outer.minX, `${design.shapeName} panel escapes left`);
    assert.ok(inner.maxX < outer.maxX, `${design.shapeName} panel escapes right`);
    assert.ok(inner.minY > outer.minY, `${design.shapeName} panel escapes top`);
    assert.ok(inner.maxY < outer.maxY, `${design.shapeName} panel escapes bottom`);
  }
});

test('insetting past the centre collapses rather than inverting', () => {
  // A triangle inset by more than its own radius must not turn inside out —
  // it would draw as a bow tie, on exactly one shape.
  const box = bounds(
    inset(
      [
        [50, 10],
        [90, 90],
        [10, 90],
      ],
      500
    )
  );
  assert.ok(box.maxX - box.minX < 1);
  assert.ok(box.maxY - box.minY < 1);
});

test('the scanline measures a known shape correctly', () => {
  // Probe check: a square 80 wide must measure 80, or every fit assertion
  // above is measuring nothing. This project has been caught by a probe that
  // silently matched nothing.
  const square: Point[] = [
    [10, 10],
    [90, 10],
    [90, 90],
    [10, 90],
  ];
  assert.equal(panelWidthAt(square, 50), 80);

  const triangle: Point[] = [
    [50, 0],
    [90, 100],
    [10, 100],
  ];
  assert.equal(Math.round(panelWidthAt(triangle, 50)), 40);
  assert.equal(panelWidthAt(square, 500), 0);
});

test('the ornaments produce real path data', () => {
  const burst = sunburstPath(50, 50, 40, 16);
  assert.equal((burst.match(/M/g) ?? []).length, 8, 'eight wedges from sixteen');
  assert.ok(!burst.includes('NaN'));

  const dots = dotsPath(
    [
      [10, 10],
      [90, 10],
      [90, 90],
      [10, 90],
    ],
    8,
    1
  );
  assert.ok((dots.match(/M/g) ?? []).length >= 30, 'dots do not go round');
  assert.ok(!dots.includes('NaN'));
});

test('polygons render as SVG point pairs', () => {
  assert.equal(toPolygon([[1, 2], [3.456, 4]]), '1,2 3.46,4');
});

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function fillOf(element: StampElement): string {
  return 'fill' in element ? element.fill : '';
}

function pointsOf(element: StampElement): string {
  return element.kind === 'polygon' ? element.points : '';
}

function pathOf(element: StampElement): string {
  return element.kind === 'path' ? element.d : '';
}

/**
 * Where a transformed emblem layer actually lands.
 *
 * The emblem is authored on the same 0–100 grid and placed with
 * `translate(...) scale(...)`, so its box is that grid mapped through the
 * transform. Parsing the path data would be wrong — it contains relative arcs
 * whose numbers are radii and flags, not coordinates. (A first attempt did
 * exactly that and reported the artwork escaping by 30 units when it was not.)
 */
function emblemBox(element: StampElement, emblem: Emblem) {
  assert.ok(element.kind === 'path' && element.transform !== undefined);
  const match = element.transform.match(
    /translate\((-?[\d.]+) (-?[\d.]+)\) scale\(([\d.]+)\)/
  );
  assert.ok(match !== null, `unparsed transform: ${element.transform}`);

  const [, tx, ty, scale] = match;
  const [minX, minY, maxX, maxY] = emblem.box;
  const s = Number(scale);
  return {
    minX: Number(tx) + minX * s,
    maxX: Number(tx) + maxX * s,
    minY: Number(ty) + minY * s,
    maxY: Number(ty) + maxY * s,
  };
}

function bounds(points: Point[]) {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

// ---------------------------------------------------------------------------
// A cut name says so (D-058)
// ---------------------------------------------------------------------------

test('a name too long for the band is marked as cut, not silently shortened', () => {
  // ⚠ **The defect this exists to prevent, seen at eighty places.**
  // `Alto da Ponta do Pargo` rendered as "ALTO DA PONTA DO" — not an
  // abbreviation the reader can complete, but a different name that reads as
  // finished. The old behaviour was justified by the passport showing the full
  // name beside the sticker; D-058 removed that, so the band is the only place
  // the name appears.
  const lines = wrapLabel('Alto da Ponta do Pargo');
  assert.ok(
    lines.join(' ').endsWith('…'),
    `expected a cut to be marked, got ${JSON.stringify(lines)}`
  );
  assert.ok(lines.length <= MAX_LINES);
});

test('a name that fits is left alone — no ellipsis for its own sake', () => {
  assert.deepEqual(wrapLabel('Pico do Areeiro'), ['PICO DO', 'AREEIRO']);
  assert.deepEqual(wrapLabel('Fanal'), ['FANAL']);
  // Two full lines that consume the whole name must not gain an ellipsis.
  for (const name of ['Câmara de Lobos', "Praia da Baía D'Abra", 'Praia Formosa']) {
    assert.ok(
      !wrapLabel(name).join(' ').includes('…'),
      `${name} was marked as cut when it fits`
    );
  }
});

test('every curated place name still produces a drawable band', () => {
  // Read rather than imported: JSON import attributes are not available to
  // the stripper Node's test runner uses, and `lightStyle.test.ts` reads its
  // fixtures the same way.
  const realPack = JSON.parse(
    readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..', '..', '..', 'content', 'pois.json'
      ),
      'utf8'
    )
  ) as { places: { name: string }[] };

  // The real pack, not a fixture: 80 names, several of them very long
  // Portuguese ones. Each must give at least one line, never more than two,
  // and never an empty line.
  for (const place of realPack.places) {
    const lines = wrapLabel(place.name);
    assert.ok(lines.length >= 1 && lines.length <= MAX_LINES, place.name);
    for (const line of lines) {
      assert.ok(line.trim().length > 0, `${place.name} produced a blank line`);
    }
  }
});

/**
 * Tests for the per-place motifs (T-158, D-079).
 *
 *     cd app && npm test
 *
 * What is being pinned down, in order of what it would cost to get wrong:
 *
 *   1. ⚠⚠ **No island knowledge leaks into `app/`.** D-017 is absolute, and the
 *      tempting mistake here is a motif called `levada-do-furado`. That would
 *      put Madeira in the app one string at a time, and no other test would
 *      notice.
 *   2. **A typo in content cannot blank a stamp.** Content is hand-edited.
 *   3. **The glyphs are drawable** — two layers, a real box, on the same grid
 *      as the emblems they replace.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORIES } from '../content/contentPack.ts';
import { CANVAS, designFor } from './stampArt.ts';
import { MOTIFS, MOTIF_NAMES, emblemFor, isMotifName } from './stampMotif.ts';

test('⚠⚠ no motif name carries island knowledge (D-017)', () => {
  // The words that would mean Madeira had crept into `app/`. Deliberately
  // includes the generic-sounding ones — `levada` is a Madeiran word for a
  // Madeiran thing, however ordinary it looks in this repository.
  const ISLAND_WORDS = [
    'madeira',
    'levada',
    'funchal',
    'pico',
    'areeiro',
    'ruivo',
    'girao',
    'girão',
    'fanal',
    'porto',
    'moniz',
    'machico',
    'santana',
    'calheta',
    'seixal',
    'santo',
    'curral',
    'faial',
  ];

  for (const name of MOTIF_NAMES) {
    const lower = name.toLowerCase();
    for (const word of ISLAND_WORDS) {
      assert.ok(
        !lower.includes(word),
        `motif "${name}" contains "${word}" — island knowledge belongs in content/, not app/ (D-017)`
      );
    }
  }
});

test('a motif is generic enough to be a fallback for nothing in particular', () => {
  // Every motif should be a *kind of place*, which is what makes it reusable
  // and what keeps D-017 true. A quick proxy: no digits, no punctuation, no
  // proper-noun capitalisation at the start.
  for (const name of MOTIF_NAMES) {
    assert.match(name, /^[a-z][a-zA-Z]*$/, `motif "${name}" is not a plain lowerCamel word`);
  }
});

test('every motif has both layers and a box inside the canvas', () => {
  for (const name of MOTIF_NAMES) {
    const motif = MOTIFS[name];

    assert.ok(motif.back.length > 0, `${name} has no back layer`);
    assert.ok(motif.front.length > 0, `${name} has no front layer`);

    const [minX, minY, maxX, maxY] = motif.box;
    assert.ok(minX >= 0 && minY >= 0, `${name}'s box starts outside the canvas`);
    assert.ok(maxX <= CANVAS && maxY <= CANVAS, `${name}'s box runs past the canvas`);
    assert.ok(maxX > minX && maxY > minY, `${name}'s box is empty or inverted`);
  }
});

test('a motif fills enough of the canvas to be seen at 96 dp', () => {
  // ⚠ The passport draws stickers at 96 dp and the emblem gets the space above
  // the name band. A motif occupying a third of the grid would render as a
  // speck — which is the failure the stamp mark already had once, and it was
  // only found by looking.
  for (const name of MOTIF_NAMES) {
    const [minX, minY, maxX, maxY] = MOTIFS[name].box;
    const area = ((maxX - minX) * (maxY - minY)) / (CANVAS * CANVAS);
    assert.ok(area >= 0.45, `${name} covers only ${(area * 100).toFixed(0)}% of the grid`);
  }
});

test('the motif replaces the category emblem when a place names one', () => {
  const withMotif = designFor('some-place', 'viewpoint', 'waterfall');
  const without = designFor('some-place', 'viewpoint');

  assert.deepEqual(withMotif.icon, MOTIFS.waterfall);
  assert.notDeepEqual(withMotif.icon, without.icon);
});

test('⚠ a typo in content falls back rather than blanking the stamp', () => {
  // Content is hand-edited. `waterfal`, `Waterfall`, an empty string, a value
  // left over from a rename — none of them may produce a stamp with no picture.
  for (const bad of ['waterfal', 'Waterfall', '', 'levada-do-rei', undefined]) {
    const design = designFor('some-place', 'beach', bad);
    assert.deepEqual(
      design.icon,
      designFor('some-place', 'beach').icon,
      `"${String(bad)}" did not fall back to the category emblem`
    );
  }
});

test('a motif changes nothing else about the design', () => {
  // The silhouette, the colourway, the cut edge and the tilt all come from the
  // place id. A motif must not disturb them, or adding one to a place already
  // collected would silently change a sticker somebody has already seen.
  const plain = designFor('some-place', 'village');
  const fancy = designFor('some-place', 'village', 'terrace');

  assert.deepEqual(fancy.outline, plain.outline);
  assert.deepEqual(fancy.colourway, plain.colourway);
  assert.equal(fancy.tiltDeg, plain.tiltDeg);
  assert.deepEqual(fancy.panel, plain.panel);
});

test('every category still has a picture with no motif at all', () => {
  for (const category of CATEGORIES) {
    const design = designFor(`place-${category}`, category);
    assert.ok(design.icon.front.length > 0, `${category} lost its emblem`);
  }
});

test('isMotifName is honest about what it accepts', () => {
  assert.equal(isMotifName('cliff'), true);
  assert.equal(isMotifName('cliffs'), false);
  assert.equal(isMotifName(42), false);
  assert.equal(isMotifName(undefined), false);
});

test('no two motifs are the same drawing', () => {
  // A copy-pasted path is the easy mistake when writing eleven of these by
  // hand, and it would show up as two places sharing a picture for no reason.
  const seen = new Map<string, string>();

  for (const name of MOTIF_NAMES) {
    const key = `${MOTIFS[name].back}|${MOTIFS[name].front}`;
    const clash = seen.get(key);
    assert.equal(clash, undefined, `${name} draws exactly the same as ${clash}`);
    seen.set(key, name);
  }
});

test('emblemFor never returns undefined for a real category', () => {
  const emblems = Object.fromEntries(
    CATEGORIES.map((category) => [category, designFor('x', category).icon])
  ) as Parameters<typeof emblemFor>[2];

  for (const category of CATEGORIES) {
    assert.ok(emblemFor(category, undefined, emblems) !== undefined);
    assert.ok(emblemFor(category, 'peak', emblems) !== undefined);
  }
});

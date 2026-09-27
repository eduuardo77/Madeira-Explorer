/**
 * What the map draws, and a test that fails the build if it changes by accident
 * (T-167, D-082; since 2026-09-27, D-093: the roads travelled, not the fixes).
 *
 *     cd app && npm test
 *
 * ⚠⚠ WHY THIS FILE EXISTS — T-145'S SHAPE, AGAIN
 * ----------------------------------------------
 * `traceCleanup.ts` was written, documented and given its own test file
 * (T-150/D-066, 16 August). **The map never called it.** `NativeMapScreen`
 * called `splitIntoSegments` — the raw splitter — and went on doing so for a
 * month, while the souvenir card and every preview tool drew the cleaned line.
 * Everything anybody *previewed* was clean; the thing on the phone was not.
 *
 * Nothing caught it, because nothing tests a screen: 619 passing tests could
 * not see it, exactly as 399 could not see T-145. The project lead found it by
 * looking at the running app and saying the line made *"lines in random
 * places"*.
 *
 * So the defence is the same one `freeTier.test.ts` uses for the paywall —
 * **read the screen's source and fail on the wrong dependency**, because the
 * difference between the two functions is invisible to every other kind of test
 * this project can run without a device.
 *
 * ⚠ **`splitIntoSegments` is not forbidden generally, and must not become so.**
 * `souvenir/composition.ts` calls it on purpose: it paces the film by the
 * fixes' own timestamps, and cleaning first coarsened that timing until a stamp
 * cue landed at the start of the draw. Its own tests caught that. The rule here
 * is about **the map screen**, which wants the tidied line.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  drawableSegments,
  splitIntoSegments,
  type TraceFix,
} from './traceGeoJson.ts';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The recorder's own gap rule, as the screen passes it. */
const GAP_MS = 30 * 60 * 1000;

/**
 * A straight walk with one fix thrown 150 m sideways, reported with a
 * respectable accuracy.
 *
 * ⚠ **150 m is chosen to sit in the hole.** `traceGeoJson`'s jump rule only
 * breaks above 250 m *and* 55 m/s, and the accuracy filter cannot see a spike
 * that reports ±12 m. It is the artefact that reaches the screen through every
 * other rule, and only `cleanTrace` removes it.
 */
function walkWithASpike(): TraceFix[] {
  const fixes: TraceFix[] = [];
  const lat = 32.6486;
  const lon = -16.9088;
  const stepDeg = 12 / 111_320; // ~12 m of easting per fix

  for (let i = 0; i < 21; i += 1) {
    fixes.push({
      ts: 1_800_000_000_000 + i * 10_000,
      lat,
      lon: lon + i * stepDeg,
      accuracy_m: 8,
    });
  }

  // One fix, 150 m north of a line that never leaves its latitude.
  fixes[10] = { ...fixes[10], lat: lat + 150 / 110_540, accuracy_m: 12 };
  return fixes;
}

test('the spike survives the raw splitter — which is why the screen must not use it', () => {
  const [segment] = splitIntoSegments(walkWithASpike(), GAP_MS);

  assert.equal(segment.fixes.length, 21, 'no rule in traceGeoJson removes it');
  assert.ok(
    segment.fixes.some((fix) => fix.lat > 32.649),
    'the fix 150 m off the path is still there, and would be drawn as a V'
  );
});

test('the cleaned splitter removes it', () => {
  const [segment] = drawableSegments(walkWithASpike(), GAP_MS);

  assert.ok(
    segment.fixes.every((fix) => fix.lat < 32.649),
    'the spike is gone'
  );
  assert.ok(
    segment.fixes.length < 21,
    'and the straight run is simplified rather than drawn vertex by vertex'
  );
});

test('the two functions genuinely differ, so the source check below is not guarding a no-op', () => {
  const fixes = walkWithASpike();
  const raw = splitIntoSegments(fixes, GAP_MS)[0].fixes.length;
  const clean = drawableSegments(fixes, GAP_MS)[0].fixes.length;

  assert.notEqual(raw, clean);
});

/**
 * ⚠⚠ THE ONE THAT MATTERS, AMENDED BY D-093 (2026-09-27).
 *
 * Everything above passes whether or not the screen calls the right function.
 * This is the only kind of assertion that would have caught T-167. Since
 * D-093 the map draws **the roads travelled**, matched to the shipped network,
 * not the fixes at all, cleaned or raw: the cleaned GPS line is what the
 * project lead kept objecting to (`docs/map-lines-problem.md`).
 */
test('NativeMapScreen draws the matched roads, not the fixes', () => {
  const source = codeOnly(readFileSync(path.join(srcRoot, 'map/NativeMapScreen.tsx'), 'utf8'));

  assert.ok(
    /roadLinesFor\(/.test(source),
    'NativeMapScreen must build its lines with roadLinesFor (D-093).'
  );
  assert.ok(
    !/drawableSegments\s*\(|splitIntoSegments\s*\(|buildTrace\s*\(/.test(source),
    'NativeMapScreen draws GPS fixes again. The map draws the roads travelled ' +
      '(D-093): fixes joined by lines drift where the phone lay still and cut ' +
      'corners the street does not.'
  );
});

/**
 * The share card and the film leave the phone. They must use the export path
 * (masked fixes, then cut at the mask circle: `matching/roadTrace.ts` says why
 * masking fixes is no longer enough), never the map's private lines.
 */
test('the share card and the film draw roads from the masked export only', () => {
  for (const file of ['souvenir/shareTrip.ts', 'souvenir/souvenirPlan.ts']) {
    const source = codeOnly(readFileSync(path.join(srcRoot, file), 'utf8'));
    assert.ok(
      /exportRoadSegments\(\s*trace\.fixes,\s*trace\.accommodation,\s*MASK_RADIUS_M\s*\)/.test(source),
      `${file} must draw exportRoadSegments(trace.fixes, trace.accommodation, MASK_RADIUS_M).`
    );
    assert.ok(
      !/roadLinesFor\s*\(|rawFixDao/.test(source),
      `${file} reaches the unmasked trace. Exports go through getExportableTrace only (D-040).`
    );
  }
});

/**
 * The film's own fallback, asserted so that a later sweep does not "tidy" it
 * away: with no roads given, composition still paces the film by the fixes'
 * own timestamps.
 */
test('the film composition keeps the raw splitter as its fallback, on purpose', () => {
  const source = readFileSync(
    path.join(srcRoot, 'souvenir/composition.ts'),
    'utf8'
  );

  assert.ok(
    /splitIntoSegments\(/.test(source),
    "composition.ts paces the film by the fixes' own timestamps when it is not " +
      'given roads, and must NOT be switched to drawableSegments: cleaning first ' +
      'moved a stamp cue to the start of the draw.'
  );
});

/** Source without comments, so the rules above can be explained in comments. */
function codeOnly(source: string): string {
  return source
    .split('\n')
    .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
    .join('\n');
}

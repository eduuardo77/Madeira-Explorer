/**
 * The map draws the *cleaned* trace, and a test that fails the build if it stops
 * (T-167, D-082).
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
 * ⚠⚠ THE ONE THAT MATTERS.
 *
 * Everything above passes whether or not the screen calls the right function.
 * This is the only assertion that would have caught the bug.
 */
test('NativeMapScreen draws the cleaned trace', () => {
  const source = readFileSync(
    path.join(srcRoot, 'map/NativeMapScreen.tsx'),
    'utf8'
  );

  assert.ok(
    /drawableSegments\(/.test(source),
    'NativeMapScreen must build its trace with drawableSegments — see T-167.'
  );

  // Comments explain the rule and must not trip it, so only real calls count.
  const calls = source
    .split('\n')
    .filter((line) => !line.trim().startsWith('*') && !line.trim().startsWith('//'))
    .filter((line) => /splitIntoSegments\s*\(/.test(line));

  assert.deepEqual(
    calls,
    [],
    'NativeMapScreen calls splitIntoSegments. That is the RAW trace: spikes under ' +
      '250 m, the scribble where somebody stood still, and every jitter vertex are ' +
      'drawn in full. Use drawableSegments — see T-167 and D-082.'
  );
});

test('the souvenir card draws the cleaned trace too', () => {
  const source = readFileSync(path.join(srcRoot, 'souvenir/shareTrip.ts'), 'utf8');
  assert.ok(
    /drawableSegments\(/.test(source),
    'shareTrip must build its strokes with drawableSegments.'
  );
});

/**
 * The deliberate exception, asserted so that a later sweep does not "tidy" it
 * into the rule and quietly break the film's timing.
 */
test('the film composition still uses the raw splitter, on purpose', () => {
  const source = readFileSync(
    path.join(srcRoot, 'souvenir/composition.ts'),
    'utf8'
  );

  assert.ok(
    /splitIntoSegments\(/.test(source),
    'composition.ts paces the film by the fixes\' own timestamps and must NOT be ' +
      'switched to drawableSegments — cleaning first moved a stamp cue to the start ' +
      'of the draw. See the header of drawableSegments in traceGeoJson.ts.'
  );
});

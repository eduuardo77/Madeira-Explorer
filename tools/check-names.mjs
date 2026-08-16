/**
 * Check every curated name against OSM (T-066).
 *
 *     node tools/check-names.mjs
 *
 * WHY A NAME IS WORTH CHECKING AND A COORDINATE MOSTLY IS NOT
 * ----------------------------------------------------------
 * The name is the whole of the reward. A stamp is a seal with a place's name
 * printed across it — that is the artefact the user collects, photographs and
 * remembers — so a name that is wrong is a prize that means nothing.
 *
 * ⚠ **And the starter set has a known way of being wrong.** Most of it was
 * copied out of the tile pack's `pois` layer, which carries **fragments**:
 * `Barcelos`, `Bodes`, `Escalvado`, `Facho`. OSM's own nodes at those exact
 * places say **Pico dos Barcelos**, **Pico dos Bodes**, **Ponta do Rosto**. The
 * viewpoints were rebuilt from OSM on 2026-08-14 for that reason; the villages,
 * beaches and landmarks were not, and have never been checked.
 *
 * WHAT IT DOES
 * ------------
 * One Overpass request asks for everything named within `SEARCH_RADIUS_M` of
 * every curated geofence, and each place is then sorted into one of four:
 *
 *   - **exact** — OSM has the same name at that spot. Nothing to do.
 *   - **fragment** — OSM has a *longer* name containing the curated one, at
 *     that spot. Almost certainly the tile pack's abbreviation, and the OSM
 *     name is the one to take.
 *   - **more specific** — the curated name contains OSM's, which is the
 *     harmless direction and usually deliberate.
 *   - **unmatched** — nothing nearby carries the name at all. Could be a place
 *     OSM names differently, could be the wrong coordinate. Needs eyes.
 *
 * ⚠ **Run on the 80-place starter set (2026-08-16): 63 exact, 0 fragments.**
 * The fragment fear was real for viewpoints and had already been fixed; the
 * villages, beaches and landmarks turned out to be OSM's own names. What it
 * did find was a *duplicate* — see `Monumento Natural do Cabo Girão`.
 *
 * ⚠ **It suggests; it does not edit.** Which name a stamp carries is curation
 * and the project lead's (T-066). This prints the evidence.
 *
 * ⚠ **Build-time only.** It talks to Overpass, which the app never does
 * (D-001).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { metresBetween } from './lib/geo.mjs';
import { overpass } from './lib/overpass.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/**
 * How far from the curated coordinate to look, in metres.
 *
 * 400 m is generous on purpose. The curated coordinate is the *geofence*, which
 * is often the car park or the trailhead rather than the labelled feature, and
 * a 250 m radius stamp is already saying "somewhere around here". Too tight a
 * search reports a name as missing when it is one field away.
 */
const SEARCH_RADIUS_M = 400;

/** Comparable form of a name: no accents, no case, no punctuation. */
function normalise(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Everything named near any curated place, in one request. */
async function fetchNamesNear(points) {
  const clauses = points
    .map((point) => `nwr(around:${SEARCH_RADIUS_M},${point.lat},${point.lon})["name"];`)
    .join('\n  ');

  const result = await overpass(
    `[out:json][timeout:240];\n(\n  ${clauses}\n);\nout center tags;`,
    { tool: 'check-names' }
  );

  return (result.elements ?? []).flatMap((element) => {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const name = element.tags?.name;
    if (typeof name !== 'string' || lat === undefined || lon === undefined) {
      return [];
    }
    return [{ name, lat, lon, kind: describe(element.tags) }];
  });
}

/** The tag worth showing a curator, out of the dozens a feature can carry. */
function describe(tags) {
  for (const key of ['tourism', 'natural', 'place', 'leisure', 'historic', 'amenity']) {
    if (typeof tags[key] === 'string') {
      return `${key}=${tags[key]}`;
    }
  }
  return '';
}

/**
 * Levadas are not checked here, and it is not laziness.
 *
 * ⚠ **This tool compares a point against a point, and a levada is a line.**
 * Overpass returns a way's *centre*, which for a 12 km contour is kilometres
 * from the trailhead the geofence sits at — so every levada came back as
 * "unmatched", or worse, matched the `Madre da Levada dos Tornos` (its spring,
 * a different feature entirely) and suggested renaming the walk after it.
 *
 * They already have a stricter check: `build-levadas.mjs` matches each curated
 * levada name against OSM exactly, falls back to a prefix, and prints
 * NOTHING FOUND in capitals when neither works. A levada whose name is wrong
 * has no course to draw, which is loud.
 */
const CHECKED_CATEGORIES = ['viewpoint', 'village', 'beach', 'landmark'];

/** How one curated place compares with what OSM has around it. */
function judge(place, nearby) {
  const point = place.geofences[0];
  const curated = normalise(place.name);

  const around = nearby
    .map((feature) => ({ ...feature, metres: Math.round(metresBetween(point, feature)) }))
    .filter((feature) => feature.metres <= SEARCH_RADIUS_M)
    .sort((a, b) => a.metres - b.metres);

  const exact = around.find((feature) => normalise(feature.name) === curated);
  if (exact !== undefined) {
    return { verdict: 'exact', match: exact };
  }

  // A longer OSM name containing the curated one, as a whole word: `Barcelos`
  // inside `Pico dos Barcelos`. The word boundary matters — without it,
  // `Faial` matches `Faial da Terra`, which is a different village.
  const fragment = around.find((feature) => {
    const words = normalise(feature.name).split(' ');
    return (
      normalise(feature.name) !== curated &&
      curated.split(' ').every((word) => words.includes(word))
    );
  });
  if (fragment !== undefined) {
    return { verdict: 'fragment', match: fragment };
  }

  // The other way round: we say *Miradouro da Rocha do Navio* where OSM says
  // *Rocha do Navio*. Benign, and usually deliberate — a curated name may be
  // more specific than the tag — so it is reported apart from the ones that
  // need a decision.
  const specific = around.find((feature) => {
    const curatedWords = curated.split(' ');
    return normalise(feature.name)
      .split(' ')
      .every((word) => curatedWords.includes(word));
  });
  if (specific !== undefined) {
    return { verdict: 'specific', match: specific };
  }

  return { verdict: 'unmatched', nearest: around.slice(0, 3) };
}

async function main() {
  const pack = JSON.parse(readFileSync(path.join(root, 'content', 'pois.json'), 'utf8'));
  const places = (pack.places ?? []).filter((place) =>
    CHECKED_CATEGORIES.includes(place.category)
  );
  const skipped = (pack.places ?? []).length - places.length;
  if (places.length === 0) {
    console.log('No places in content/pois.json, so there is nothing to check.');
    return;
  }

  process.stdout.write(`asking OSM about ${places.length} places … `);
  const nearby = await fetchNamesNear(places.map((place) => place.geofences[0]));
  console.log(`${nearby.length} named features nearby`);
  console.log();

  const byVerdict = { exact: [], fragment: [], specific: [], unmatched: [] };
  for (const place of places) {
    const result = judge(place, nearby);
    byVerdict[result.verdict].push({ place, result });
  }

  if (byVerdict.fragment.length > 0) {
    console.log(
      `⚠ ${byVerdict.fragment.length} name(s) look like the tile pack's abbreviation:`
    );
    for (const { place, result } of byVerdict.fragment) {
      console.log(
        `  ${place.name.padEnd(34)} → OSM says "${result.match.name}"` +
          ` (${result.match.metres} m${result.match.kind === '' ? '' : `, ${result.match.kind}`})`
      );
    }
    console.log('  A stamp reading "GATO" means nothing; one reading the full name is a place.');
    console.log();
  }

  if (byVerdict.unmatched.length > 0) {
    console.log(`⚠ ${byVerdict.unmatched.length} name(s) match nothing within ${SEARCH_RADIUS_M} m:`);
    for (const { place, result } of byVerdict.unmatched) {
      const nearest =
        result.nearest.length === 0
          ? 'nothing named nearby at all'
          : result.nearest
              .map((feature) => `"${feature.name}" (${feature.metres} m)`)
              .join(', ');
      console.log(`  ${place.name.padEnd(34)} nearest: ${nearest}`);
    }
    console.log(
      '  Either OSM names it differently — which is normal and fine — or the\n' +
        '  coordinate is not where the name is. The second one is a stamp that\n' +
        '  fires in the wrong place.'
    );
    console.log();
  }

  if (byVerdict.specific.length > 0) {
    console.log(`${byVerdict.specific.length} name(s) are more specific than OSM's, which is fine:`);
    for (const { place, result } of byVerdict.specific) {
      console.log(`  ${place.name.padEnd(34)} OSM: "${result.match.name}" (${result.match.metres} m)`);
    }
    console.log();
  }

  console.log(
    `${byVerdict.exact.length} exact · ${byVerdict.fragment.length} fragment · ` +
      `${byVerdict.specific.length} more specific · ${byVerdict.unmatched.length} unmatched, ` +
      `of ${places.length} checked (${skipped} levadas checked by build-levadas.mjs instead)`
  );
  if (byVerdict.fragment.length === 0 && byVerdict.unmatched.length === 0) {
    console.log('Every curated name is OSM’s own, at the coordinate it is curated at.');
  }
}

await main();

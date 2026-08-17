/**
 * What the official PR network says about each curated levada (D-068, T-068).
 *
 * WHY
 * ---
 * `WALKED_MINUTES = 45` is **one number for all eleven levadas**, and
 * `docs/field-notes.md` already flags that as the weak part of D-068: a typical
 * completion time is a per-levada fact and 45 minutes is a per-project guess.
 * The project lead cannot walk eleven levadas to find out — PR18 alone took
 * them over three hours — so the number has to come from somewhere that is not
 * fieldwork.
 *
 * Madeira's walking routes are **officially signed and numbered** (`PR 1`…
 * `PR 22`), and OSM carries those relations with `ref`, and often `distance`,
 * `duration`, `ascent` and an official `website`. That is a citable source for
 * per-levada figures, and it costs no walking.
 *
 * ⚠ **THIS TOOL REPORTS; IT DOES NOT DECIDE.** It writes no content file. The
 * output is a draft for the project lead to veto (D-064's standing method), and
 * every figure carries where it came from so a wrong one can be traced rather
 * than absorbed.
 *
 * ⚠ **OSM's `duration` is not the government's duration.** It is whatever a
 * mapper typed, and for many routes nobody has. Where it is missing this says
 * *missing* rather than estimating one — an invented duration would be exactly
 * the measured-sounding number CLAUDE.md forbids, and it would then be used to
 * set a crediting threshold.
 *
 *     node tools/levada-routes.mjs
 *     node tools/levada-routes.mjs --json    # for pasting into a draft
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { overpass } from './lib/overpass.mjs';
import { metresBetween, slug } from './lib/geo.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/** Madeira and Porto Santo. */
const BBOX = '32.35,-17.35,33.15,-16.20';

/** How far a route relation may sit from a trailhead and still be that levada. */
const MATCH_RADIUS_M = 3000;

const normalise = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Walking pace including stops, in km/h — **derived from one real walk**.
 *
 * ⚠ **PROVENANCE, AND IT IS A SINGLE DATA POINT.** The project lead walked PR18
 * Levada do Rei there-and-back in *"+3 hours"*. OSM gives PR18 as 5.3 km, so
 * the round trip is ~10.6 km, which is ~3.4 km/h with the stops a real walk
 * has in it. That is the only pace figure this project has ever measured.
 *
 * ⚠ **It will be wrong for other levadas**, in a direction that is known: they
 * told us narrow sections force you to **wait for people to cross**, so a
 * popular levada at peak hours is *slower* than this, and an empty one at the
 * end of the day — which is what PR18 was — is the fast case. Treat a derived
 * duration as a floor, not an estimate.
 */
const PACE_KMH_WITH_STOPS = 3.4;

/** Where the pace came from, printed with anything derived from it. */
const PACE_SOURCE = 'PR18 there-and-back, ~10.6 km in 3+ h (docs/field-notes.md)';

/**
 * The drawn length of the course this app actually measures against, in km.
 *
 * Not the same number as the route's `distance` tag and worth keeping separate:
 * `distance` is the signed walk, this is *however much of the channel OSM
 * happens to have mapped*, which `docs/field-notes.md` warns can run on for
 * tens of kilometres past where anybody turns back. `levadaCoverage` divides by
 * this one, so it is the number D-065's 60% fraction is a fraction *of*.
 */
function mappedCourseKm() {
  const fc = JSON.parse(readFileSync(path.join(root, 'content', 'levadas.json'), 'utf8'));
  const byPlace = new Map();
  for (const feature of fc.features ?? []) {
    const placeId = feature.properties?.placeId;
    if (!placeId) continue;
    const lines =
      feature.geometry.type === 'MultiLineString'
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates];
    let metres = 0;
    for (const line of lines) {
      for (let i = 1; i < line.length; i += 1) {
        metres += metresBetween(
          { lat: line[i - 1][1], lon: line[i - 1][0] },
          { lat: line[i][1], lon: line[i][0] }
        );
      }
    }
    byPlace.set(placeId, (byPlace.get(placeId) ?? 0) + metres);
  }
  return byPlace;
}

function curatedLevadas() {
  const pack = JSON.parse(readFileSync(path.join(root, 'content', 'pois.json'), 'utf8'));
  return (pack.places ?? [])
    .filter((place) => place.category === 'levada')
    .map((place) => ({
      id: place.id,
      name: place.name,
      regionId: place.regionId,
      geofences: (place.geofences ?? []).map((g) => ({ lat: g.lat, lon: g.lon, role: g.role })),
    }));
}

/**
 * Every signed walking route on the islands, with its tags and enough geometry
 * to tell which levada it is.
 *
 * `>>` pulls the relation's members so a route can be located; `out center`
 * gives each way a representative point, which is all the matching needs.
 */
async function fetchRoutes() {
  const query = `
    [out:json][timeout:180];
    (
      relation["route"~"^(hiking|foot)$"]["ref"~"^PR",i](${BBOX});
      relation["route"~"^(hiking|foot)$"]["name"~"levada",i](${BBOX});
    );
    out tags;
    >>;
    out center;
  `;
  const data = await overpass(query, { tool: 'levada-routes' });

  const relations = data.elements.filter((el) => el.type === 'relation');
  const points = new Map();
  for (const el of data.elements) {
    if (el.type === 'relation') continue;
    const point = el.center ?? (el.lat !== undefined ? { lat: el.lat, lon: el.lon } : null);
    if (point) points.set(`${el.type}/${el.id}`, point);
  }

  return relations.map((relation) => ({
    id: relation.id,
    tags: relation.tags ?? {},
    // Overpass `out tags` on a relation omits members, so the geometry comes
    // from the recursed children keyed by type/id — which requires the members
    // list. When it is absent, fall back to matching by name alone.
    members: (relation.members ?? [])
      .map((m) => points.get(`${m.type}/${m.ref}`))
      .filter(Boolean),
  }));
}

/** The nearest point of a route to any of a levada's geofences, in metres. */
function metresFrom(levada, route) {
  if (route.members.length === 0 || levada.geofences.length === 0) return null;
  let best = Infinity;
  for (const gate of levada.geofences) {
    for (const point of route.members) {
      best = Math.min(best, metresBetween(gate, point));
    }
  }
  return best === Infinity ? null : Math.round(best);
}

/**
 * Which route is this levada.
 *
 * Name first — a route called "Levada do Rei" is that levada whatever its
 * geometry says — then proximity, which is what catches a route signed only by
 * its PR number.
 */
function matchFor(levada, routes) {
  const target = normalise(levada.name);
  const scored = routes
    .map((route) => {
      const routeName = normalise(route.tags.name ?? '');
      const nameHit =
        routeName !== '' && (routeName.includes(target) || target.includes(routeName));
      return { route, nameHit, metres: metresFrom(levada, route) };
    })
    .filter((c) => c.nameHit || (c.metres !== null && c.metres <= MATCH_RADIUS_M));

  scored.sort((a, b) => {
    if (a.nameHit !== b.nameHit) return a.nameHit ? -1 : 1;
    return (a.metres ?? Infinity) - (b.metres ?? Infinity);
  });
  return scored;
}

const pick = (tags, ...keys) => {
  for (const key of keys) {
    if (tags[key] !== undefined && String(tags[key]).trim() !== '') return String(tags[key]).trim();
  }
  return null;
};

async function main() {
  const levadas = curatedLevadas();
  process.stdout.write(`asking OSM about the signed routes near ${levadas.length} levadas … `);
  const routes = await fetchRoutes();
  console.log(`${routes.length} route relations`);
  console.log();

  const courses = mappedCourseKm();

  const rows = levadas.map((levada) => {
    const candidates = matchFor(levada, routes);
    const best = candidates[0] ?? null;
    const tags = best?.route.tags ?? {};
    const signedKm = Number(pick(tags, 'distance'));
    const courseKm = (courses.get(levada.id) ?? 0) / 1000;
    // The there-and-back is the normal case (field notes), so the walk is twice
    // the signed one-way distance. Where nothing is signed, the mapped course
    // stands in — and it is the weaker number, so it is labelled as such.
    const walkKm = Number.isFinite(signedKm) && signedKm > 0 ? signedKm * 2 : courseKm * 2;
    return {
      id: levada.id,
      name: levada.name,
      regionId: levada.regionId,
      ref: pick(tags, 'ref'),
      mappedCourseKm: Number(courseKm.toFixed(2)),
      derivedRoundTripKm: Number(walkKm.toFixed(1)),
      derivedMinutes: walkKm > 0 ? Math.round((walkKm / PACE_KMH_WITH_STOPS) * 60) : null,
      derivedFrom: Number.isFinite(signedKm) && signedKm > 0 ? 'signed distance ×2' : 'mapped course ×2',
      routeName: pick(tags, 'name'),
      distanceKm: pick(tags, 'distance'),
      duration: pick(tags, 'duration'),
      ascent: pick(tags, 'ascent'),
      descent: pick(tags, 'descent'),
      difficulty: pick(tags, 'difficulty', 'sac_scale'),
      website: pick(tags, 'website', 'url', 'source'),
      matchedBy: best === null ? null : best.nameHit ? 'name' : 'proximity',
      metresFromTrailhead: best?.metres ?? null,
      otherCandidates: candidates.slice(1, 4).map((c) => ({
        ref: c.route.tags.ref ?? null,
        name: c.route.tags.name ?? null,
        metres: c.metres,
      })),
    };
  });

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }

  const pad = (value, width) => String(value ?? '—').padEnd(width);
  console.log(
    pad('levada', 29) +
      pad('PR', 7) +
      pad('signed', 8) +
      pad('mapped', 8) +
      pad('walk', 7) +
      pad('~time', 8) +
      'from'
  );
  console.log('-'.repeat(88));
  for (const row of rows) {
    console.log(
      pad(row.name, 29) +
        pad(/^PR/i.test(row.ref ?? '') ? row.ref : null, 7) +
        pad(row.distanceKm ? `${row.distanceKm} km` : null, 8) +
        pad(`${row.mappedCourseKm} km`, 8) +
        pad(`${row.derivedRoundTripKm} km`, 7) +
        pad(row.derivedMinutes === null ? null : `${Math.floor(row.derivedMinutes / 60)}h${String(row.derivedMinutes % 60).padStart(2, '0')}`, 8) +
        row.derivedFrom
    );
  }
  console.log();
  console.log(`  "walk" is there-and-back; "~time" is that at ${PACE_KMH_WITH_STOPS} km/h.`);
  console.log(`  ⚠ DERIVED, NOT MEASURED. The pace is ${PACE_SOURCE} — one walk.`);
  console.log('  ⚠ Narrow levadas at peak hours are slower: you wait for people to cross.');

  // ⚠ `ref` is not the same as *a PR number*. Five of these levadas carry a
  // levada abbreviation instead — `LNS`, `LC`, `LF` — and counting those as
  // official signed routes overstates the evidence.
  const withRef = rows.filter((r) => /^PR/i.test(r.ref ?? ''));
  const withDuration = rows.filter((r) => r.duration !== null);
  const withDistance = rows.filter((r) => r.distanceKm !== null);
  console.log();
  console.log(`  ${withRef.length}/${rows.length} carry an official PR number`);
  console.log(`  ${withDistance.length}/${rows.length} carry a distance`);
  console.log(`  ${withDuration.length}/${rows.length} carry a duration`);
  console.log();
  console.log('⚠ A missing duration is left missing. Estimating one and then using it to set a');
  console.log('  crediting threshold is how a guess becomes a fact nobody can trace.');

  for (const row of rows.filter((r) => r.otherCandidates.length > 0 && r.matchedBy === 'proximity')) {
    console.log();
    console.log(`⚠ ${row.name} matched by proximity only — check it is not one of:`);
    for (const other of row.otherCandidates) {
      console.log(`    ${other.ref ?? '—'}  ${other.name ?? '—'}  (${other.metres} m)`);
    }
  }
}

await main();

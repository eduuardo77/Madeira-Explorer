/**
 * Gather the evidence a curation draft has to be defensible with (T-066, D-064).
 *
 *     node tools/curation-evidence.mjs
 *     → tools/out/curation-evidence.json
 *
 * WHY THIS EXISTS
 * ---------------
 * D-064 changed the arrangement: the assistant now **drafts** the place list and
 * the project lead vetoes it. That decision carries a condition — *the draft
 * must be defensible, not confident* — because a list written from a language
 * model's impressions of Madeira, stated fluently, invites approval instead of
 * judgement. It would also be exactly the "prominence, not merit" list that
 * D-064 exists to replace.
 *
 * So every place in the draft has to arrive with something checkable attached.
 * This collects it.
 *
 * WHAT COUNTS AS EVIDENCE, AND WHAT EACH SIGNAL IS ACTUALLY WORTH
 * ---------------------------------------------------------------
 *   - **Wikipedia language count** (via Wikidata sitelinks). The best mechanical
 *     proxy for *"a visitor has heard of this"*. Pico Ruivo has articles in
 *     dozens of languages; a municipal park has none. ⚠ It is a proxy for fame,
 *     not for worth — a beach nobody writes about can still be the best hour of
 *     somebody's holiday, so a zero here is a question, never a verdict.
 *   - **A PR route number** (`ref=PR 1`, `PR 8`…). Madeira's official signed
 *     walking routes. For a levada this is close to decisive: it means signed,
 *     maintained, and mapped by the regional government.
 *   - **Elevation** (`ele`). For a peak or a miradouro, the difference between a
 *     roadside pull-in and something you climb.
 *   - **Heritage / protection tags**, `historic=*`, `heritage=*`.
 *   - **`website`, `opening_hours`, `fee`** — signs of a *managed* attraction:
 *     somebody staffs it, so it is a place you visit rather than a label on a
 *     map. Also a warning: a fee and an opening time are things a stamp has to
 *     live with (D-009's dwell rule cannot be met at a place that is shut).
 *
 * ⚠ **None of this decides anything.** It is what the one-line reason beside
 * each place gets to cite. The judgement is still a judgement, and where there
 * is no evidence the draft has to say so out loud.
 *
 * ⚠ **Build-time only.** Talks to Overpass and to Wikidata; the app talks to
 * neither (D-001).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { metresBetween, slug } from './lib/geo.mjs';
import { overpass } from './lib/overpass.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/** How close a named OSM feature has to be to count as *this* place. */
const MATCH_RADIUS_M = 300;

/** Wikidata takes 50 entity ids per request. */
const WIKIDATA_BATCH = 50;

function normalise(name) {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Every place worth gathering evidence for: the curated pack and the candidates. */
function placesToStudy() {
  const read = (file) => {
    try {
      return JSON.parse(readFileSync(path.join(root, 'content', file), 'utf8')).places ?? [];
    } catch {
      return [];
    }
  };

  const seen = new Map();
  const add = (place, source) => {
    const geofence = place.geofences?.[0];
    if (geofence === undefined) {
      return;
    }
    const key = slug(place.name);
    const existing = seen.get(key);
    if (existing === undefined) {
      seen.set(key, {
        name: place.name,
        category: place.category,
        lat: geofence.lat,
        lon: geofence.lon,
        sources: [source],
      });
    } else if (!existing.sources.includes(source)) {
      existing.sources.push(source);
    }
  };

  for (const place of read('pois.json')) add(place, 'curated');
  for (const place of read('pois.candidates.json')) add(place, 'candidate');
  return [...seen.values()];
}

/** Everything named near every place, with the tags that carry evidence. */
async function fetchFeatures(places) {
  const clauses = places
    .map((place) => `nwr(around:${MATCH_RADIUS_M},${place.lat},${place.lon})["name"];`)
    .join('\n  ');

  const result = await overpass(
    `[out:json][timeout:300];\n(\n  ${clauses}\n);\nout center tags;`,
    { tool: 'curation-evidence' }
  );

  return (result.elements ?? []).flatMap((element) => {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    if (typeof tags.name !== 'string' || lat === undefined || lon === undefined) {
      return [];
    }
    return [{ name: tags.name, lat, lon, tags }];
  });
}

/**
 * How many language Wikipedias write about each entity.
 *
 * ⚠ Wikidata, not Wikipedia: one request answers fifty places, and the
 * sitelink count is the number this is actually after.
 */
async function fetchSitelinkCounts(wikidataIds) {
  const counts = new Map();

  for (let i = 0; i < wikidataIds.length; i += WIKIDATA_BATCH) {
    const batch = wikidataIds.slice(i, i + WIKIDATA_BATCH);
    const url =
      'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks' +
      `&ids=${batch.join('|')}`;

    const response = await fetch(url, {
      headers: { 'User-Agent': 'madeira-explorer curation-evidence (contact via repository)' },
    });
    if (!response.ok) {
      // Not fatal: a missing sitelink count costs one line of evidence, and the
      // draft has to survive missing evidence anyway.
      process.stdout.write(`(wikidata ${response.status}) `);
      continue;
    }

    const body = await response.json();
    for (const [id, entity] of Object.entries(body.entities ?? {})) {
      const sitelinks = entity?.sitelinks;
      if (sitelinks !== undefined) {
        // `*wiki` only — `*wikivoyage`, `commonswiki` and friends are not
        // encyclopaedia articles and would flatter a place with a photo album.
        const wikis = Object.keys(sitelinks).filter((site) => /^[a-z_]+wiki$/.test(site));
        counts.set(id, wikis.length);
      }
    }
  }

  return counts;
}

/** The evidence tags, kept apart from the hundred OSM tags that are not evidence. */
function evidenceFrom(tags) {
  const evidence = {};
  const keep = [
    'wikidata',
    'wikipedia',
    'ele',
    'ref',
    'heritage',
    'historic',
    'tourism',
    'natural',
    'leisure',
    'protect_class',
    'website',
    'opening_hours',
    'fee',
    'operator',
  ];
  for (const key of keep) {
    if (typeof tags[key] === 'string') {
      evidence[key] = tags[key];
    }
  }
  return evidence;
}

/** The feature that *is* this place: same name, nearest. */
function matchFor(place, features) {
  const wanted = normalise(place.name);
  let best = null;
  for (const feature of features) {
    if (normalise(feature.name) !== wanted) {
      continue;
    }
    const metres = metresBetween(place, feature);
    if (metres <= MATCH_RADIUS_M && (best === null || metres < best.metres)) {
      best = { feature, metres: Math.round(metres) };
    }
  }
  return best;
}

async function main() {
  const places = placesToStudy();
  if (places.length === 0) {
    console.log('Nothing to study. Run: node tools/poi-candidates.mjs');
    return;
  }

  process.stdout.write(`asking OSM about ${places.length} places … `);
  const features = await fetchFeatures(places);
  console.log(`${features.length} named features`);

  const studied = places.map((place) => {
    const match = matchFor(place, features);
    return {
      ...place,
      matched: match !== null,
      metresFromMatch: match?.metres ?? null,
      evidence: match === null ? {} : evidenceFrom(match.feature.tags),
    };
  });

  const wikidataIds = [
    ...new Set(
      studied
        .map((place) => place.evidence.wikidata)
        .filter((id) => typeof id === 'string' && /^Q\d+$/.test(id))
    ),
  ];
  process.stdout.write(`asking Wikidata about ${wikidataIds.length} entities … `);
  const sitelinks = await fetchSitelinkCounts(wikidataIds);
  console.log('done');

  for (const place of studied) {
    place.wikipediaLanguages = sitelinks.get(place.evidence.wikidata) ?? 0;
  }

  studied.sort(
    (a, b) => b.wikipediaLanguages - a.wikipediaLanguages || a.name.localeCompare(b.name)
  );

  const outDir = path.join(root, 'tools', 'out');
  mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'curation-evidence.json');
  writeFileSync(out, `${JSON.stringify(studied, null, 2)}\n`);

  const withArticle = studied.filter((place) => place.wikipediaLanguages > 0);
  const withRoute = studied.filter((place) => /^PR/i.test(place.evidence.ref ?? ''));
  const unmatched = studied.filter((place) => !place.matched);

  console.log();
  console.log(`Wrote ${studied.length} places to tools/out/curation-evidence.json`);
  console.log(`  ${withArticle.length} have a Wikipedia article in at least one language`);
  console.log(`  ${withRoute.length} carry an official PR route number`);
  console.log(`  ${unmatched.length} match no OSM feature of that name within ${MATCH_RADIUS_M} m`);
  console.log();
  console.log('Best known, by number of language Wikipedias:');
  for (const place of studied.slice(0, 15)) {
    console.log(
      `  ${String(place.wikipediaLanguages).padStart(3)}  ${place.name.padEnd(34)} ${place.sources.join('+')}`
    );
  }
  console.log();
  console.log('⚠ Fame is not worth. A zero here is a question, not a verdict (D-064).');
}

await main();

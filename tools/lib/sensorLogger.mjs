/**
 * Reading a Sensor Logger export into the fixes the app's own modules consume
 * (T-017, T-020).
 *
 * WHY THIS EXISTS
 * ---------------
 * Every threshold in the trace chapter is a guess — the 60 m corridor, the
 * 16 m simplification tolerance, the 120 m accuracy cut, the 45 minutes of
 * D-068. They were written against **modelled** noise: Gaussian jitter and
 * spikes invented by `preview-trace.mjs`. The project lead's phone can record
 * the real thing with Sensor Logger, and this turns that export into a fixture
 * `preview-trace.mjs --fixes` can run the app's real `cleanTrace` against.
 *
 * ⚠ **DO NOT BUILD A LOGGER** (T-017 is explicit). This only reads one.
 *
 * WHAT IT REFUSES TO DO
 * ---------------------
 * ⚠ **It never invents or moves a coordinate**, for the same reason
 * `traceCleanup.ts` does not: a fixture that has been tidied cannot falsify a
 * rule, and the whole point of a fixture is that it is allowed to disagree with
 * us. Rows are dropped only when they are not positions at all — missing or
 * unparseable lat/lon — and every drop is counted and reported.
 *
 * ⚠ **It does not fill gaps.** "Data on the levada comes and goes"
 * (`docs/field-notes.md`) is the observation this file exists to *measure*, so
 * a gap must survive into the fixture as a gap.
 *
 * FORMAT TOLERANCE, AND WHY
 * -------------------------
 * ⚠ The exact column names in a Sensor Logger export have **not been checked
 * against a real file** — nobody here has one yet. So nothing below hard-codes
 * a header: columns are matched by a list of plausible names, and if none
 * matches, the error says which headers it actually saw. A wrong guess about a
 * column name then costs a one-line edit, not a session.
 *
 * Pure: no filesystem, no process. The CLI half is
 * `tools/import-sensor-logger.mjs`.
 */

/** Column names seen in the wild, per field, lowercased and punctuation-free. */
const COLUMNS = {
  lat: ['latitude', 'lat'],
  lon: ['longitude', 'lon', 'long', 'lng'],
  accuracy: [
    'horizontalaccuracy',
    'accuracy',
    'horizontalaccuracym',
    'haccuracy',
    'positionaccuracy',
  ],
  time: ['time', 'timestamp', 'ts', 'datetime', 'date'],
  elapsed: ['secondselapsed', 'elapsed', 'elapsedseconds'],
  altitude: ['altitude', 'alt', 'elevation'],
  speed: ['speed'],
};

const normaliseKey = (key) => String(key).toLowerCase().replace(/[^a-z]/g, '');

/**
 * Sensor Logger writes epoch **nanoseconds**; other tools write millis, micros
 * or plain seconds. Rather than trust the exporter, judge by magnitude — the
 * ranges are orders of magnitude apart, so this cannot be ambiguous for any
 * date this project will ever see.
 *
 * An ISO 8601 string is passed to `Date` instead.
 */
export function toEpochMillis(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'string' && /[-T:]/.test(value) && !/^-?\d+$/.test(value.trim())) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    return null;
  }
  // Boundaries sit between the plausible ranges for a date after ~2001, not at
  // a round power of ten, so a value never lands on a fence.
  if (n >= 1e17) return Math.round(n / 1e6); // nanoseconds
  if (n >= 1e14) return Math.round(n / 1e3); // microseconds
  if (n >= 1e11) return Math.round(n); // milliseconds
  return Math.round(n * 1000); // seconds
}

/** A minimal CSV reader: quoted fields, doubled quotes, CRLF. No dependencies. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Which of a record's keys carries each field, or null if none does. */
function mapColumns(keys) {
  const seen = new Map(keys.map((key) => [normaliseKey(key), key]));
  const found = {};
  for (const [field, candidates] of Object.entries(COLUMNS)) {
    found[field] = candidates.map(normaliseKey).map((c) => seen.get(c)).find(Boolean) ?? null;
  }
  return found;
}

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Records (already parsed from CSV or JSON) to `TraceFix`es.
 *
 * `TraceFix` is `app/src/map/traceGeoJson.ts`'s shape — `{ts, lat, lon,
 * accuracy_m}` — deliberately, so a fixture drops straight into `cleanTrace`
 * with nothing in between to disagree with the app.
 */
export function recordsToFixes(records) {
  if (records.length === 0) {
    return { fixes: [], columns: {}, dropped: 0, warnings: ['the export contained no rows'] };
  }

  const columns = mapColumns(Object.keys(records[0]));
  const warnings = [];
  if (!columns.lat || !columns.lon) {
    throw new Error(
      'No latitude/longitude columns found. Saw: ' +
        Object.keys(records[0]).join(', ') +
        '\nAdd the real names to COLUMNS in tools/lib/sensorLogger.mjs.'
    );
  }
  if (!columns.accuracy) {
    // Not fatal: `traceGeoJson` draws a fix with no reported accuracy rather
    // than blanking the trace, so a fixture without the column is still usable
    // — it just cannot exercise the accuracy rules, which is worth saying.
    warnings.push(
      'no accuracy column — every fix imports as accuracy null, so the 120 m ' +
        'cut (D-067) is not exercised by this fixture'
    );
  }
  if (!columns.time && !columns.elapsed) {
    throw new Error(
      'No time column found. Saw: ' + Object.keys(records[0]).join(', ')
    );
  }

  let dropped = 0;
  let elapsedBase = null;
  const fixes = [];

  for (const record of records) {
    const lat = numberOrNull(record[columns.lat]);
    const lon = numberOrNull(record[columns.lon]);
    if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      dropped += 1;
      continue;
    }

    let ts = columns.time ? toEpochMillis(record[columns.time]) : null;
    if (ts === null && columns.elapsed) {
      // `seconds_elapsed` alone still gives correct *intervals*, which is what
      // every rule here actually judges. The absolute date is then fictional,
      // so it is anchored at 0 and the caller is told.
      const elapsed = numberOrNull(record[columns.elapsed]);
      if (elapsed !== null) {
        if (elapsedBase === null) elapsedBase = elapsed;
        ts = Math.round((elapsed - elapsedBase) * 1000);
      }
    }
    if (ts === null) {
      dropped += 1;
      continue;
    }

    const fix = {
      ts,
      lat,
      lon,
      accuracy_m: columns.accuracy ? numberOrNull(record[columns.accuracy]) : null,
    };
    const altitude = columns.altitude ? numberOrNull(record[columns.altitude]) : null;
    if (altitude !== null) fix.altitude_m = altitude;
    const speed = columns.speed ? numberOrNull(record[columns.speed]) : null;
    if (speed !== null) fix.speed_ms = speed;
    fixes.push(fix);
  }

  // The exporter's order is not guaranteed, and every downstream rule reads
  // consecutive pairs. Sorting reorders rows; it never alters one.
  fixes.sort((a, b) => a.ts - b.ts);

  if (dropped > 0) {
    warnings.push(`${dropped} rows had no usable position or time and were dropped`);
  }
  return { fixes, columns, dropped, warnings };
}

/**
 * A whole export — JSON or CSV — to fixes.
 *
 * Sensor Logger's JSON export is one flat array with a `sensor` field per
 * record, so the location rows have to be picked out of it.
 */
export function parseSensorLoggerExport(text) {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed);
    const all = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.records)
        ? parsed.records
        : Array.isArray(parsed.data)
          ? parsed.data
          : null;
    if (!all) {
      throw new Error('JSON export is neither an array nor {records|data: [...]}.');
    }
    // If any row declares a sensor, keep only the location ones; if none does,
    // the file is already a location-only export.
    const tagged = all.filter((r) => typeof r?.sensor === 'string');
    const rows =
      tagged.length > 0
        ? tagged.filter((r) => /^location(gps|network)?$/i.test(r.sensor.replace(/\s/g, '')))
        : all;
    if (rows.length === 0) {
      throw new Error(
        'No location records in the export. Sensors present: ' +
          [...new Set(all.map((r) => r?.sensor).filter(Boolean))].join(', ')
      );
    }
    return { ...recordsToFixes(rows), format: 'json' };
  }

  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error('CSV export has no data rows.');
  }
  const [header, ...body] = rows;
  const records = body.map((cells) =>
    Object.fromEntries(header.map((key, i) => [key.trim(), cells[i] ?? '']))
  );
  return { ...recordsToFixes(records), format: 'csv' };
}

const percentile = (sorted, p) =>
  sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

/**
 * What the walk actually measured — the numbers T-020 asks for.
 *
 * `gapSeconds` is the threshold above which a silence counts as a **drop**
 * rather than a sampling interval. It is a reporting choice, not a rule the app
 * applies, so it lives here and not in `app/`.
 */
export function summariseFixes(fixes, { gapSeconds = 30 } = {}) {
  if (fixes.length === 0) {
    return { count: 0 };
  }
  const intervals = [];
  const gaps = [];
  for (let i = 1; i < fixes.length; i += 1) {
    const seconds = (fixes[i].ts - fixes[i - 1].ts) / 1000;
    intervals.push(seconds);
    if (seconds > gapSeconds) {
      gaps.push({ fromTs: fixes[i - 1].ts, toTs: fixes[i].ts, seconds });
    }
  }
  const sortedIntervals = [...intervals].sort((a, b) => a - b);
  const accuracies = fixes
    .map((f) => f.accuracy_m)
    .filter((a) => a !== null && a !== undefined)
    .sort((a, b) => a - b);

  const lats = fixes.map((f) => f.lat);
  const lons = fixes.map((f) => f.lon);

  return {
    count: fixes.length,
    startTs: fixes[0].ts,
    endTs: fixes[fixes.length - 1].ts,
    durationS: (fixes[fixes.length - 1].ts - fixes[0].ts) / 1000,
    interval: {
      median: percentile(sortedIntervals, 0.5),
      p95: percentile(sortedIntervals, 0.95),
      max: sortedIntervals[sortedIntervals.length - 1] ?? null,
    },
    gaps,
    longestGapS: gaps.reduce((worst, gap) => Math.max(worst, gap.seconds), 0),
    droppedTimeS: gaps.reduce((total, gap) => total + gap.seconds, 0),
    accuracy: {
      reported: accuracies.length,
      missing: fixes.length - accuracies.length,
      median: percentile(accuracies, 0.5),
      p90: percentile(accuracies, 0.9),
      worst: accuracies[accuracies.length - 1] ?? null,
      // The share the app would refuse to draw, which is the number D-067 is
      // an argument about.
      over120: accuracies.filter((a) => a > 120).length,
    },
    bbox: {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    },
  };
}

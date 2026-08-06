/**
 * Reads and writes for `sensor_sample` — barometer and pedometer.
 *
 * These are the channels that survive where GPS does not (ARCHITECTURE §8.4),
 * so they are captured alongside every location batch rather than only when
 * GPS is healthy. By the time we notice GPS has died it is too late to start.
 */

import { getDatabase } from '../database';
import type { SensorSample, SensorSampleInput } from '../types';

export async function insertSamples(
  samples: SensorSampleInput[]
): Promise<number> {
  if (samples.length === 0) {
    return 0;
  }

  const db = await getDatabase();
  let inserted = 0;

  await db.withTransactionAsync(async () => {
    const statement = await db.prepareAsync(
      `INSERT INTO sensor_sample
         (trip_id, ts, pressure_hpa, relative_altitude_m, step_count_delta)
       VALUES (?, ?, ?, ?, ?);`
    );
    try {
      for (const sample of samples) {
        await statement.executeAsync(
          sample.trip_id,
          sample.ts,
          sample.pressure_hpa,
          sample.relative_altitude_m,
          sample.step_count_delta
        );
        inserted += 1;
      }
    } finally {
      await statement.finalizeAsync();
    }
  });

  return inserted;
}

export async function countSamples(tripId: number): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sensor_sample WHERE trip_id = ?;',
    tripId
  );
  return row?.n ?? 0;
}

export async function getLastSample(
  tripId: number
): Promise<SensorSample | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<SensorSample>(
    'SELECT * FROM sensor_sample WHERE trip_id = ? ORDER BY ts DESC LIMIT 1;',
    tripId
  );
  return row ?? null;
}

/** Total steps recorded in a window. Feeds the sensor-only fallback (T-090). */
export async function sumSteps(
  tripId: number,
  fromTs: number,
  toTs: number
): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number | null }>(
    `SELECT SUM(step_count_delta) AS total
       FROM sensor_sample
      WHERE trip_id = ? AND ts >= ? AND ts <= ?;`,
    tripId,
    fromTs,
    toTs
  );
  return row?.total ?? 0;
}

/**
 * The T-179 measurement: does expo-sqlite leak statements on this phone, and
 * does `withStatement` stop it? Debug screen only — an instrument, not a feature.
 *
 * It runs expo/expo#48995's loop — concurrent read-then-write pairs on one
 * handle, with heap churn between batches so Hermes actually collects — twice,
 * on two **throwaway databases with their own connections**:
 *
 *   - `bare`: the library's own `getFirstAsync` / `runAsync`, as the app called
 *     them until T-179.
 *   - `held`: the same statements through `withStatement`.
 *
 * Then a `TRUNCATE` checkpoint on each. A leaked `SELECT` holds a read
 * transaction, so the checkpoint fails with *"database table is locked"* —
 * which is the WAL pin itself, measured rather than inferred.
 *
 * ⚠ `madeira.db` is never opened here. A leaked statement pins only the
 * connection it belongs to, and both files are closed and deleted at the end.
 * ⚠ #48995 also reports a native crash on the bare path. `held` runs first so
 * its result is logged even if `bare` takes the process down.
 *
 * Results go to logcat, prefixed `T179`: `adb logcat -s ReactNativeJS`.
 */

import * as SQLite from 'expo-sqlite';

import { withStatement } from './database';

type Arm = 'bare' | 'held';

/**
 * Three loads. ⚠ At 8 — #48995's figure — the bare arm released **nothing** in
 * 4,800 statements on the P30, with or without a forced-GC storm: the probe was
 * inert, not the bug absent. expo-sqlite runs on `Dispatchers.IO` (64 threads)
 * and SQLite serialises calls on one connection, so only a load well past 64
 * leaves calls queued with their arguments unconverted — #49799's phase C.
 */
const LOADS: readonly { concurrency: number; batches: number }[] = [
  { concurrency: 8, batches: 300 },
  { concurrency: 64, batches: 60 },
  { concurrency: 256, batches: 40 },
];

/** Objects allocated between batches, so Hermes collects inside the window. */
const CHURN = 50_000;

/** Written to so the churn cannot be optimised away. */
let churnSink: unknown = null;

export type StressResult = {
  arm: Arm;
  concurrency: number;
  statements: number;
  released: number;
  otherErrors: number;
  firstOtherError: string | null;
  checkpoint: string;
};

async function read(db: SQLite.SQLiteDatabase, arm: Arm): Promise<unknown> {
  const sql = 'SELECT a, b FROM t WHERE id = 1;';
  if (arm === 'bare') {
    return db.getFirstAsync(sql);
  }
  return withStatement(db, sql, async (statement) =>
    (await statement.executeAsync()).getFirstAsync()
  );
}

async function write(
  db: SQLite.SQLiteDatabase,
  arm: Arm,
  a: string,
  b: string | null
): Promise<unknown> {
  const sql = 'UPDATE t SET a = ?, b = ? WHERE id = 1;';
  if (arm === 'bare') {
    return db.runAsync(sql, a, b);
  }
  return withStatement(db, sql, (statement) => statement.executeAsync(a, b));
}

async function runArm(
  arm: Arm,
  concurrency: number,
  batches: number
): Promise<StressResult> {
  const name = `t179-${arm}.db`;
  // A fresh connection of its own: never the cached handle `getDatabase` holds.
  const db = await SQLite.openDatabaseAsync(name, { useNewConnection: true });
  const result: StressResult = {
    arm,
    concurrency,
    statements: 0,
    released: 0,
    otherErrors: 0,
    firstOtherError: null,
    checkpoint: 'not run',
  };

  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY CHECK (id = 1), a TEXT, b TEXT);
      INSERT OR IGNORE INTO t (id, a, b) VALUES (1, '', '');
    `);

    for (let batch = 0; batch < batches; batch += 1) {
      await Promise.all(
        Array.from({ length: concurrency }, async (_, k) => {
          try {
            await read(db, arm);
            await write(db, arm, `v${batch}-${k}`, k % 2 === 0 ? null : `x${k}`);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('already released')) {
              result.released += 1;
            } else {
              result.otherErrors += 1;
              result.firstOtherError ??= message.slice(0, 160);
            }
          } finally {
            result.statements += 2;
          }
        })
      );
      churnSink = Array.from({ length: CHURN }, (_, i) => ({ i }));
    }

    try {
      const row = await withStatement(db, 'PRAGMA wal_checkpoint(TRUNCATE);', async (s) =>
        (await s.executeAsync<{ busy: number; log: number; checkpointed: number }>()).getFirstAsync()
      );
      result.checkpoint = row === null ? 'no row' : `ok (${row.busy}, ${row.log}, ${row.checkpointed})`;
    } catch (error) {
      result.checkpoint = `FAILED: ${error instanceof Error ? error.message : String(error)}`;
    }
  } finally {
    // closeAsync finalizes any leaked statement, which is what lets the file go.
    await db.closeAsync().catch(() => {});
    await SQLite.deleteDatabaseAsync(name).catch(() => {});
  }

  console.log(`T179 ${JSON.stringify(result)}`);
  return result;
}

/** Both arms, `held` first. Returns one line per arm for the alert. */
export async function runStatementStress(): Promise<string> {
  console.log(`T179 start: ${JSON.stringify(LOADS)}, churn ${CHURN}`);
  const lines: string[] = [];
  for (const { concurrency, batches } of LOADS) {
    for (const arm of ['held', 'bare'] as const) {
      const r = await runArm(arm, concurrency, batches);
      lines.push(
        `${r.arm} x${r.concurrency}: ${r.released} released, ${r.otherErrors} other, checkpoint ${r.checkpoint}`
      );
    }
  }
  churnSink = null;
  console.log('T179 done');
  return lines.join('\n');
}

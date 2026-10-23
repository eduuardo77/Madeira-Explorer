// Summarises SurfaceFlinger `--latency` readings taken by `measure-map-frames.sh`.
//
//     node tools/map-frames.mjs <raw.txt>
//
// Each reading is the refresh period in ns, then one line per frame:
// desired present, actual present, frame ready. Readings overlap, so frames are
// merged by their actual present time. Gaps longer than IDLE_MS are the map at
// rest between gestures and are not counted as motion.
//
// ⚠ N10, 2026-10-23: a gap under IDLE_MS is not always a stall. Every gap over
// 100 ms in 25 runs on the P30 was one of two things the eye does not see:
// - a **wait**: the map had stopped, and the next gesture began inside the gap
//   (atrace: no touch in it, the map's GL thread idle in waitForFrame, and the
//   map answering the touch within 30 ms). `measure-map-frames.sh` logs a
//   marker (`MARK <s>`) just before each gesture to find these.
// - a **settle**: at the end of a glide, one last frame 100 to 250 ms after the
//   others and then stillness until the next gesture.
// The fps and interval lines count everything, as before; the stall line
// leaves both out, and every gap over 50 ms is listed with its kind.
import { readFileSync } from 'node:fs';

const IDLE_MS = 250;
const PENDING = '9223372036854775807';
// From the marker to the gesture's first touch: the `input` command starts a
// Java VM first: 306 to 326 ms on the P30 (11 gestures under atrace, 2026-10-23).
const TOUCH_LAG_S = 0.45;

const text = readFileSync(process.argv[2], 'utf8');
// The refresh period opens each reading; one reading on the P30 said 8.4 ms
// in the middle of a 60 Hz run, so the most common value is the one used.
const periods = new Map();
const presents = new Set();
const marks = [];
for (const line of text.split(/\r?\n/)) {
  const parts = line.trim().split(/\s+/);
  if (parts[0] === 'MARK' && parts.length === 2) {
    marks.push(Number(parts[1]));
  } else if (parts.length === 1 && /^\d+$/.test(parts[0])) {
    periods.set(parts[0], (periods.get(parts[0]) ?? 0) + 1);
  } else if (parts.length === 3 && parts[1] !== '0' && parts[1] !== PENDING) {
    presents.add(parts[1]);
  }
}

const periodNs = Number([...periods].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0);
const times = [...presents].map((value) => Number(BigInt(value) / 1000n) / 1000).sort((a, b) => a - b);
const periodMs = periodNs / 1e6;
const intervals = [];
const long50 = [];
let motionMs = 0;
for (let i = 1; i < times.length; i += 1) {
  const gap = times[i] - times[i - 1];
  if (gap <= IDLE_MS) {
    intervals.push(gap);
    motionMs += gap;
    if (gap > 50) {
      // Times are in ms; markers in s.
      const from = times[i - 1] / 1000;
      const to = times[i] / 1000;
      const wait = marks.some((mark) => mark >= from - TOUCH_LAG_S && mark <= to);
      const lone = i + 1 >= times.length || times[i + 1] - times[i] > IDLE_MS;
      const kind = wait ? 'wait' : lone ? 'settle' : 'STALL';
      long50.push({ gap, at: (times[i - 1] - times[0]) / 1000, kind });
    }
  }
}
if (intervals.length === 0) {
  console.log('No frames in motion: did the map move?');
  process.exit(1);
}

const sorted = [...intervals].sort((a, b) => a - b);
const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
const missed = intervals.reduce((sum, gap) => sum + Math.max(0, Math.round(gap / periodMs) - 1), 0);
const expected = Math.round(motionMs / periodMs);
const long = (ms) => intervals.filter((gap) => gap > ms).length;

const f = (n) => n.toFixed(1);
console.log(`refresh ${f(periodMs)} ms, ${times.length} frames on screen, ${f(motionMs / 1000)} s in motion`);
console.log(`fps in motion ${f((intervals.length / motionMs) * 1000)}, vsyncs missed ${missed} of ${expected} (${f((missed / expected) * 100)}%)`);
console.log(`interval p50 ${f(pct(50))}  p90 ${f(pct(90))}  p99 ${f(pct(99))}  max ${f(sorted[sorted.length - 1])} ms`);
console.log(`gaps > 33 ms: ${long(33.4)}, > 50 ms: ${long(50)}, > 100 ms: ${long(100)}`);
if (marks.length === 0) {
  console.log('⚠ no gesture markers in this file: a wait reads as a stall');
}
const stalls = long50.filter((entry) => entry.kind === 'STALL');
const worst = stalls.reduce((max, entry) => Math.max(max, entry.gap), 0);
const count = (kind) => long50.filter((entry) => entry.kind === kind).length;
console.log(
  `stalls in motion > 50 ms: ${stalls.length}, > 100 ms: ${stalls.filter((entry) => entry.gap > 100).length}, ` +
    `worst ${f(worst)} ms (left out: ${count('wait')} waits, ${count('settle')} settles)`
);
for (const entry of long50) {
  console.log(`  ${f(entry.gap)} ms at +${entry.at.toFixed(2)} s, ${entry.kind}`);
}

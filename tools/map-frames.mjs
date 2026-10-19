// Summarises SurfaceFlinger `--latency` readings taken by `measure-map-frames.sh`.
//
//     node tools/map-frames.mjs <raw.txt>
//
// Each reading is the refresh period in ns, then one line per frame:
// desired present, actual present, frame ready. Readings overlap, so frames are
// merged by their actual present time. Gaps longer than IDLE_MS are the map at
// rest between gestures and are not counted as motion.
import { readFileSync } from 'node:fs';

const IDLE_MS = 250;
const PENDING = '9223372036854775807';

const text = readFileSync(process.argv[2], 'utf8');
let periodNs = 0;
const presents = new Set();
for (const line of text.split(/\r?\n/)) {
  const parts = line.trim().split(/\s+/);
  if (parts.length === 1 && /^\d+$/.test(parts[0])) {
    periodNs = Number(parts[0]);
  } else if (parts.length === 3 && parts[1] !== '0' && parts[1] !== PENDING) {
    presents.add(parts[1]);
  }
}

const times = [...presents].map((value) => Number(BigInt(value) / 1000n) / 1000).sort((a, b) => a - b);
const periodMs = periodNs / 1e6;
const intervals = [];
let motionMs = 0;
for (let i = 1; i < times.length; i += 1) {
  const gap = times[i] - times[i - 1];
  if (gap <= IDLE_MS) {
    intervals.push(gap);
    motionMs += gap;
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

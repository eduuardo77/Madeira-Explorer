/**
 * Tests for what the video you keep shows over the map (T-329).
 *
 *     cd app && npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_NAME } from '../brand.ts';
import { planPacedFilm, type TimedRoad } from './pacedFilm.ts';
import { END_CARD_MS, PILL_MS, TITLE_HOLD_MS, overlayAt, planOverlay, videoDurationMs, type InfoMode, type Tier } from './videoOverlay.ts';

const T0 = Date.parse('2026-10-01T09:00:00Z');
const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

function eastward(lat: number, lon: number, metres: number, startTs: number): TimedRoad {
  const degPerM = 1 / (111_320 * Math.cos((lat * Math.PI) / 180));
  const points = [];
  for (let m = 0, i = 0; m <= metres; m += 50, i += 1) points.push({ ts: startTs + i * 5000, lat, lon: lon + m * degPerM });
  return { points };
}

const DRAW_START = 1200;
const FINALE = 15_200;
const DURATION = 18_200;
const road = eastward(40, 10, 6000, T0);
// Three awards close together (one name, "and 2 more"), one later on its own.
const awards = [road.points[20], road.points[21], road.points[22], road.points[90]].map((p, i) => ({ placeId: `p${i}`, awardedTs: p.ts }));
const paced = planPacedFilm({ roads: [road, eastward(40.05, 10, 3000, T0 + 86_400_000)], awards, drawFromMs: DRAW_START, drawMs: FINALE - DRAW_START, dayKey, tripStartKey: dayKey(T0), totalKm: 9 });
const names = new Map([['p0', 'First'], ['p1', 'Second'], ['p2', 'Third'], ['p3', 'Fourth']]);

const plan = (info: InfoMode, tier: Tier = 'free', language: 'en' | 'pt' | 'de' = 'en') =>
  planOverlay({
    language, title: 'Somewhere', firstTs: T0, lastTs: T0 + 86_400_000, tripDays: 2, paced, placeNames: names,
    collected: 4, total: 10, drawStartMs: DRAW_START, finaleAtMs: FINALE, durationMs: DURATION, info, tier,
  });

test('discreet: one line, counting while drawing and the places at the close', () => {
  const p = plan('discreet');
  const drawing = overlayAt(p, 9000);
  assert.equal(drawing.card, null);
  assert.match(drawing.line!.text, /^\d+ km · \d+ stamps?$/);
  const close = overlayAt(p, FINALE + 2500);
  assert.equal(close.line!.text, '4 of 10 places · 9 km of roads lit');
  assert.equal(close.finale, null);
});

test('full: the card while drawing, then the count rises to the total at the close', () => {
  const p = plan('full');
  assert.ok(overlayAt(p, 9000).card!.opacity > 0.99);
  assert.equal(overlayAt(p, 9000).line, null);
  assert.equal(overlayAt(p, FINALE + 200).finale!.count, '0');
  assert.equal(overlayAt(p, FINALE + 2500).finale!.count, '4');
  assert.ok(overlayAt(p, FINALE + 2500).card!.opacity < 0.01);
});

test('none: no numbers, no day, no names, and the title leaves after its hold', () => {
  const p = plan('none');
  for (const t of [3000, 9000, FINALE + 1000]) {
    const f = overlayAt(p, t);
    assert.equal(f.line, null);
    assert.equal(f.card, null);
    assert.equal(f.day, null);
    assert.equal(f.pill, null);
    assert.equal(f.finale, null);
  }
  assert.ok(overlayAt(p, 1000).title.opacity > 0.9);
  assert.ok(overlayAt(p, TITLE_HOLD_MS + 800).title.opacity < 0.01);
});

test('free ends on the end card, without the watermark; paid has neither', () => {
  const free = plan('discreet', 'free');
  assert.equal(videoDurationMs(free), DURATION + END_CARD_MS);
  const end = overlayAt(free, DURATION + 1500);
  assert.equal(end.endCard!.text, `Made with ${APP_NAME}, on Google Play`);
  assert.equal(end.watermark.opacity, 0);
  assert.equal(end.title.opacity, 0);
  const paid = plan('discreet', 'paid');
  assert.equal(videoDurationMs(paid), DURATION);
  assert.equal(overlayAt(paid, DURATION).endCard, null);
  assert.equal(overlayAt(paid, DURATION).watermark.tier, 'paid');
});

test('stamp names come one at a time, for PILL_MS each, and say how many landed with them', () => {
  const p = plan('discreet');
  assert.equal(p.pills[0].name, 'First');
  assert.equal(p.pills[0].more, 2);
  for (let i = 1; i < p.pills.length; i += 1) assert.ok(p.pills[i].startMs >= p.pills[i - 1].endMs);
  for (const pill of p.pills) assert.ok(Math.abs(pill.endMs - pill.startMs - PILL_MS) < 1e-6);
  const shown = overlayAt(p, p.pills[0].startMs + PILL_MS / 2).pill!;
  assert.equal(shown.more, 'and 2 more');
  assert.ok(shown.opacity > 0.99);
});

test('the day shows while drawing, in the app language', () => {
  const day = overlayAt(plan('discreet', 'free', 'pt'), 4000).day!;
  assert.equal(day.text, 'Dia 1 de 2');
  assert.equal(day.date, '1 de outubro');
  assert.equal(overlayAt(plan('discreet'), FINALE + 500).day, null);
});

test('the head: none before drawing or at the close; its tail ends on it', () => {
  const p = plan('discreet');
  assert.equal(overlayAt(p, DRAW_START - 100).head, null);
  assert.equal(overlayAt(p, FINALE + 100).head, null);
  const head = overlayAt(p, 6000).head!;
  const last = head.tail[head.tail.length - 1];
  assert.deepEqual(last, [head.lon, head.lat]);
  assert.ok(head.opacity > 0 && head.scale > 0.99);
});

test('a frame depends on its time alone', () => {
  const p = plan('full');
  assert.deepEqual(overlayAt(p, 7777), overlayAt(p, 7777));
});

test('no dash in anything the video writes, in any language', () => {
  for (const language of ['en', 'pt', 'de'] as const) {
    for (const info of ['full', 'discreet'] as const) {
      const p = plan(info, 'free', language);
      for (const t of [500, 4000, 9000, FINALE + 2500, DURATION + 1500]) {
        const text = JSON.stringify(overlayAt(p, t));
        assert.ok(!/[–—]/.test(text), `${language} ${info} ${t}: ${text}`);
      }
    }
  }
});

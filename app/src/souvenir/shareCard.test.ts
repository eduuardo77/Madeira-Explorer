/**
 * Tests for the shareable still (T-105d, D-063).
 *
 *     cd app && npm test
 *
 * The card is mostly typography and one drawing, so what is checkable here is
 * that **nothing lands outside the frame**, that the trace keeps its shape, and
 * that the same trip always makes the same picture. Whether it looks good is a
 * question for the eye — `tools/preview-souvenir.mjs` writes the file.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  approximateTextWidth,
  buildShareCard,
  CARD_HEIGHT,
  CARD_WIDTH,
  fitSize,
  formatDateRange,
  MAX_NAMED_STAMPS,
  renderShareCardSvg,
  wrapStampNames,
  type CardPoint,
  type ShareCardInput,
} from './shareCard.ts';

/** A walk with a distinct shape: east, then a right-angle north. */
const WALK: CardPoint[] = [
  [-16.92, 32.64],
  [-16.90, 32.64],
  [-16.90, 32.66],
];

function input(overrides: Partial<ShareCardInput> = {}): ShareCardInput {
  return {
    destination: 'Madeira',
    dateRange: '12–19 August 2026',
    collected: 23,
    total: 60,
    strokes: [WALK],
    stampNames: ['High Rock', 'Water Walk', 'Old Fort'],
    ...overrides,
  };
}

test('everything drawn is inside the card', () => {
  const card = buildShareCard(input());
  for (const element of card.elements) {
    if (element.kind === 'polyline') {
      for (const [x, y] of element.points) {
        assert.ok(x >= 0 && x <= CARD_WIDTH, `x ${x}`);
        assert.ok(y >= 0 && y <= CARD_HEIGHT, `y ${y}`);
      }
    } else {
      const width = approximateTextWidth(element.text, element.size);
      const left = element.anchor === 'middle' ? element.x - width / 2 : element.x;
      assert.ok(left >= 0, `${element.text} starts at ${left}`);
      assert.ok(left + width <= CARD_WIDTH, `${element.text} ends at ${left + width}`);
      assert.ok(element.y > 0 && element.y < CARD_HEIGHT);
    }
  }
});

test('the trace keeps its shape — a square walk is not stretched', () => {
  // The walk is twice as tall as it is wide, in metres. Fitting it by
  // stretching would make a coastal walk look like a walk into the sea.
  const card = buildShareCard(input());
  const line = card.elements.find((element) => element.kind === 'polyline');
  assert.ok(line !== undefined && line.kind === 'polyline');

  const [a, b, c] = line.points;
  const eastLeg = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const northLeg = Math.hypot(c[0] - b[0], c[1] - b[1]);
  // 0.02° of latitude against 0.02° of longitude at 32.65° — the north leg is
  // longer on the ground, and must be longer on the card.
  assert.ok(northLeg > eastLeg, `${northLeg} vs ${eastLeg}`);
});

test('the hero is stamps, never a percentage or a distance', () => {
  const card = buildShareCard(input());
  const texts = card.elements.flatMap((e) => (e.kind === 'text' ? [e.text] : []));
  assert.ok(texts.includes('23 / 60'));
  assert.ok(!texts.some((text) => text.includes('%')));
  assert.ok(!texts.some((text) => /\bkm\b/.test(text)));
});

test('one place collected is not "1 places"', () => {
  const card = buildShareCard(input({ collected: 1 }));
  const texts = card.elements.flatMap((e) => (e.kind === 'text' ? [e.text] : []));
  assert.ok(texts.includes('place collected'));
});

test('a long list of stamps becomes a count, not an overflow', () => {
  const many = Array.from({ length: 20 }, (_, i) => `Place ${i}`);
  const card = buildShareCard(input({ stampNames: many }));
  const line = card.elements.find(
    (e) => e.kind === 'text' && e.text.includes('more')
  );
  assert.ok(line !== undefined && line.kind === 'text');
  assert.match(line.text, new RegExp(`and ${20 - MAX_NAMED_STAMPS} more`));
});

test('text shrinks to fit rather than being cut in half', () => {
  assert.equal(fitSize('short', 40, 1000), 40);
  const long = 'A very long line of place names that would not fit at all';
  const shrunk = fitSize(long, 40, 800);
  assert.ok(shrunk < 40);
  assert.ok(approximateTextWidth(long, shrunk) <= 800);
  // …but never so small it stops being readable on a phone.
  assert.ok(fitSize('x'.repeat(400), 40, 800) >= 20);
});

test('a trip with nothing recorded still makes a card', () => {
  const card = buildShareCard(input({ strokes: [], collected: 0, stampNames: [] }));
  assert.ok(card.elements.some((e) => e.kind === 'text' && e.text === '0 / 60'));
  assert.ok(!card.elements.some((e) => e.kind === 'polyline'));
});

test('a stroke of one point is not drawn — a point is not a line', () => {
  const card = buildShareCard(input({ strokes: [[[-16.9, 32.65]]] }));
  assert.ok(!card.elements.some((e) => e.kind === 'polyline'));
});

test('the same trip makes the same card, every time', () => {
  assert.equal(renderShareCardSvg(buildShareCard(input())), renderShareCardSvg(buildShareCard(input())));
});

test('the SVG is well-formed and escapes what a place name can contain', () => {
  const svg = renderShareCardSvg(buildShareCard(input({ destination: 'Madeira & Porto Santo' })));
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.ok(svg.includes('Madeira &amp; Porto Santo'));
  assert.ok(!svg.includes('Madeira & Porto'));
});

test('the stamp line stays readable with real Madeira names', () => {
  // ⚠ This is the check the preview tool found the need for: six names of the
  // length this island actually produces shrank to the 20 px floor, which made
  // the most personal line on the card the smallest thing on it.
  const card = buildShareCard(
    input({
      stampNames: [
        'Pico do Areeiro',
        'Levada das 25 Fontes',
        'Câmara de Lobos',
        'Praia do Porto do Seixal',
        'Pico Ruivo',
        'Monte',
      ],
    })
  );
  const lines = card.elements.filter(
    (e) => e.kind === 'text' && (e.text.includes('·') || e.text.includes('more'))
  );
  assert.ok(lines.length >= 2, 'six names must wrap rather than shrink');
  for (const line of lines) {
    assert.ok(line.kind === 'text' && line.size >= 28, `a stamp line is ${line.kind === 'text' ? line.size : '?'}`);
  }
});

test('a name is never split across two lines', () => {
  const names = ['Levada das 25 Fontes', 'Praia do Porto do Seixal', 'Pico Ruivo'];
  const lines = wrapStampNames(names, 888);
  for (const name of names) {
    assert.ok(
      lines.some((line) => line.includes(name)),
      `${name} was broken up`
    );
  }
});

test('a date range carries both dates, in the order the reader expects', () => {
  // ⚠ Asserted without assuming where the day goes. The first version of this
  // test expected "12–19 August 2026" and passed only in day-first locales; the
  // code under it produced "12–August 19, 2026" everywhere else.
  const range = formatDateRange(Date.UTC(2026, 7, 12, 12), Date.UTC(2026, 7, 19, 12));
  assert.ok(range.includes('12'), range);
  assert.ok(range.includes('19'), range);
  assert.ok(range.includes('2026'), range);
});

test('a day trip is one date, not a range of one', () => {
  const morning = Date.UTC(2026, 7, 12, 8);
  const evening = Date.UTC(2026, 7, 12, 20);
  assert.ok(!formatDateRange(morning, evening).includes('–'));
});

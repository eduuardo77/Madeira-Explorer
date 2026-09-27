/**
 * Synthetic trips along the real road network, with known ground truth, for
 * judging the matcher (D-093). Build-time and test-time only.
 *
 * A trip is a random walk along edges of the graph (no immediate U-turns),
 * sampled like the recorder samples, with GPS error added. The error is the
 * part that matters, and it is modelled on what the P30 showed rather than on
 * independent noise per fix: real GPS error is **correlated in time**, a
 * slowly wandering offset (the desk drift of `docs/field-notes.md` is exactly
 * that), which independent jitter badly flatters. So the offset is an AR(1)
 * process with a time constant of `correlationS`, plus rare outliers.
 *
 * ⚠ It is still a model. It says whether the matcher does what it was built
 * to do; it does not say how Madeira's GPS behaves. The lead's outing does.
 */

/** A small seeded PRNG, so a failing case can be rerun exactly. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(random) {
  const u = Math.max(1e-12, random());
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * A route: a random walk of about `lengthM` metres from `startEdge`, as a list
 * of { edge, forward } steps, only over edges whose kind is in `kinds`.
 */
export function randomRoute(graph, startEdge, lengthM, random, kinds) {
  const steps = [{ edge: startEdge, forward: random() < 0.5 }];
  let total = graph.edgeLength[startEdge];
  const allowed = (e) => kinds.includes(graph.edgeKindCodes[e].toLowerCase());
  while (total < lengthM) {
    const last = steps[steps.length - 1];
    const node = last.forward ? graph.edgeTo[last.edge] : graph.edgeFrom[last.edge];
    const options = [];
    for (let i = graph.adjStart[node]; i < graph.adjStart[node + 1]; i += 1) {
      const e = graph.adjEdge[i];
      if (e !== last.edge && allowed(e)) {
        options.push(e);
      }
    }
    if (options.length === 0) {
      // A dead end: turn round, as a person would.
      if (!allowed(last.edge) || steps.length > 2000) {
        break;
      }
      options.push(last.edge);
    }
    // People rarely drive or walk into a dead end only to come straight back,
    // so prefer ways that lead somewhere.
    const onward = options.filter((e) => {
      const far = graph.edgeFrom[e] === node ? graph.edgeTo[e] : graph.edgeFrom[e];
      return graph.adjStart[far + 1] - graph.adjStart[far] > 1;
    });
    const pool = onward.length > 0 ? onward : options;
    const edge = pool[Math.floor(random() * pool.length)];
    const forward = graph.edgeFrom[edge] === node;
    steps.push({ edge, forward });
    total += graph.edgeLength[edge];
  }
  return steps;
}

/**
 * A route the way people drive: shortest paths between random destinations
 * 1 to 3 km apart, only over edges whose kind is in `kinds`.
 */
export function drivenRoute(graph, routing, startEdge, lengthM, random, kinds) {
  const allowed = (e) => kinds.includes(graph.edgeKindCodes[e].toLowerCase());
  const pool = [];
  for (let e = 0; e < graph.edgeCount; e += 1) {
    if (allowed(e)) pool.push(e);
  }
  const scratch = routing.createScratch(graph);
  const steps = [];
  let at = { edge: startEdge, offset: 0 };
  let total = 0;
  for (let attempt = 0; attempt < 400 && total < lengthM; attempt += 1) {
    const edge = pool[Math.floor(random() * pool.length)];
    const p = graph.pointStart[edge];
    const q = graph.pointStart[at.edge];
    const crow = Math.hypot(
      (graph.lat[p] - graph.lat[q]) * 110_540,
      (graph.lon[p] - graph.lon[q]) * 93_800
    );
    if (crow < 1000 || crow > 3000) continue;
    const pieces = routing.routeBetween(graph, scratch, at, { edge, offset: 0 }, 8000, allowed);
    if (pieces === null) continue;
    for (const piece of pieces) {
      // Whole edges only: the truth is scored per edge.
      const forward = piece.to >= piece.from;
      const last = steps[steps.length - 1];
      if (last !== undefined && last.edge === piece.edge) continue;
      steps.push({ edge: piece.edge, forward });
      total += graph.edgeLength[piece.edge];
    }
    at = { edge, offset: 0 };
  }
  return steps;
}

/** The position `metres` along a route, [lat, lon]. */
function positionAlong(graph, pointAt, steps, metres) {
  let left = metres;
  for (const step of steps) {
    const length = graph.edgeLength[step.edge];
    if (left <= length) {
      return { point: pointAt(graph, step.edge, step.forward ? left : length - left), edge: step.edge };
    }
    left -= length;
  }
  const last = steps[steps.length - 1];
  return {
    point: pointAt(graph, last.edge, last.forward ? graph.edgeLength[last.edge] : 0),
    edge: last.edge,
  };
}

/**
 * Fixes along a route.
 *
 * @param options.speedMps       travel speed
 * @param options.intervalS      seconds between fixes
 * @param options.sigmaM         standard deviation of the wandering offset, per axis
 * @param options.correlationS   how long the offset takes to forget itself
 * @param options.outlierRate    chance per fix of a wild fix (60 to 150 m off)
 * @param options.accuracyM      the accuracy the fix reports
 * @param options.dropTunnels  no fixes while on a tunnel edge, as GPS stops there
 */
export function sampleTrip(graph, pointAt, steps, random, options) {
  const length = steps.reduce((sum, step) => sum + graph.edgeLength[step.edge], 0);
  const fixes = [];
  let ox = 0;
  let oy = 0;
  const keep = Math.exp(-options.intervalS / options.correlationS);
  const kick = options.sigmaM * Math.sqrt(1 - keep * keep);
  let t = 0;
  for (let metres = 0; metres <= length; metres += options.speedMps * options.intervalS) {
    ox = keep * ox + kick * gaussian(random);
    oy = keep * oy + kick * gaussian(random);
    t += options.intervalS;
    const { point, edge } = positionAlong(graph, pointAt, steps, metres);
    const code = graph.edgeKindCodes[edge];
    if (options.dropTunnels && code !== code.toLowerCase()) {
      continue;
    }
    const [lat, lon] = point;
    let dx = ox;
    let dy = oy;
    if (random() < (options.outlierRate ?? 0)) {
      const angle = random() * 2 * Math.PI;
      const far = 60 + random() * 90;
      dx += far * Math.cos(angle);
      dy += far * Math.sin(angle);
    }
    fixes.push({
      ts: 1_700_000_000_000 + t * 1000,
      lat: lat + dy / 110_540,
      lon: lon + dx / (111_320 * Math.cos((lat * Math.PI) / 180)),
      accuracy_m: options.accuracyM,
      speed_mps: Math.max(0.05, options.speedMps + 0.2 * gaussian(random)),
      // What the phone's motion sensors would say, when the scenario says (D-094).
      activity: options.activity ?? 'unknown',
    });
  }
  return { fixes, lengthM: length };
}

/**
 * How well a result matches the truth: of the true route, how much was lit
 * (recall), and of what was lit, how much is on the true route (precision).
 * Measured per edge interval, in metres.
 */
export function score(graph, steps, visited) {
  const truth = new Set(steps.map((step) => step.edge));
  let truthM = 0;
  for (const edge of truth) {
    truthM += graph.edgeLength[edge];
  }
  let litM = 0;
  let litOnTruthM = 0;
  for (const [edge, intervals] of visited) {
    for (const [low, high] of intervals) {
      litM += high - low;
      if (truth.has(edge)) {
        litOnTruthM += high - low;
      }
    }
  }
  return {
    truthM,
    litM,
    recall: truthM === 0 ? 1 : litOnTruthM / truthM,
    precision: litM === 0 ? 1 : litOnTruthM / litM,
    wrongM: litM - litOnTruthM,
  };
}

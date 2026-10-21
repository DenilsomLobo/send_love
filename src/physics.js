export const PHYSICS = Object.freeze({ gravity: 620, maxPull: 170, minPull: 12, gain: 11, maxFlight: 9, netRadius: 65 });

export function launchVelocity(dx, dy) {
  const length = Math.hypot(dx, dy);
  const scale = Math.min(length, PHYSICS.maxPull) / (length || 1) * PHYSICS.gain;
  return { x: dx * scale, y: dy * scale, power: Math.min(1, length / PHYSICS.maxPull) };
}

export function positionAt(origin, velocity, t) {
  return { x: origin.x + velocity.x * t, y: origin.y + velocity.y * t + .5 * PHYSICS.gravity * t * t };
}

export function crossesNet(previous, current, net) {
  if (previous.x >= net.x || current.x < net.x || current.x <= previous.x) return false;
  const u = (net.x - previous.x) / (current.x - previous.x);
  const y = previous.y + u * (current.y - previous.y);
  return Math.abs(y - net.y) <= PHYSICS.netRadius;
}

export function seededRandom(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let n = Math.imul(seed ^ seed >>> 15, 1 | seed);
    n = n + Math.imul(n ^ n >>> 7, 61 | n) ^ n;
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

// A solution must stay inside the playable height and reach the front of the net.
// Several neighboring powers must work, avoiding a one-pixel solution.
export function findSolutions(level) {
  const solutions = [];
  const distance = level.net.x - level.origin.x;
  for (let angle = 12; angle <= 65; angle += 2) {
    const a = angle * Math.PI / 180;
    let consecutive = 0;
    for (let speed = 550; speed <= PHYSICS.maxPull * PHYSICS.gain; speed += 10) {
      const velocity = { x: Math.cos(a) * speed, y: -Math.sin(a) * speed };
      const t = distance / velocity.x;
      const p = positionAt(level.origin, velocity, t);
      const apexT = Math.min(t, -velocity.y / PHYSICS.gravity);
      const apex = positionAt(level.origin, velocity, apexT).y;
      const valid = t < PHYSICS.maxFlight && apex > -180 && Math.abs(p.y - level.net.y) < PHYSICS.netRadius - 12;
      consecutive = valid ? consecutive + 1 : 0;
      if (consecutive >= 3) { solutions.push({ angle, speed, velocity }); break; }
    }
  }
  return solutions;
}

export function generateLevel(phase, seed) {
  const random = seededRandom(seed);
  const difficulty = Math.min(1, (phase - 1) / 15);
  for (let i = 0; i < 50; i++) {
    const origin = { x: 360, y: 330 + random() * 310 };
    const net = { x: origin.x + 1900 + random() * (300 + difficulty * 650), y: 250 + random() * (270 + difficulty * 130) };
    const level = { origin, net, width: net.x + 550, seed, phase };
    if (findSolutions(level).length >= 2) return level;
  }
  return { origin: { x: 360, y: 550 }, net: { x: 2460, y: 540 }, width: 3010, seed, phase };
}

export function phaseResult(hits) {
  if (!Number.isInteger(hits) || hits < 0 || hits > 3) throw new RangeError('Acertos inválidos');
  return { points: hits, stars: hits, advance: hits > 0 };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel, findSolutions, launchVelocity, positionAt, crossesNet, phaseResult, PHYSICS } from '../src/physics.js';
import { compareScores } from '../src/storage.js';

test('generation is reproducible and 4,000 configurations have multiple attainable solutions', () => {
  for (const phase of [1, 5, 12, 1000]) {
    for (let seed = 0; seed < 1000; seed++) {
      const level = generateLevel(phase, seed);
      const solutions = findSolutions(level);
      assert.ok(solutions.length >= 2, `phase ${phase}, seed ${seed}`);
      const { velocity } = solutions[0];
      const time = (level.net.x - level.origin.x) / velocity.x;
      assert.ok(crossesNet(positionAt(level.origin, velocity, time - .001), positionAt(level.origin, velocity, time + .001), level.net));
    }
  }
  assert.deepEqual(generateLevel(3, 123), generateLevel(3, 123));
});
test('pull strength is capped and direction is preserved', () => {
  const velocity = launchVelocity(1000, -1000);
  assert.ok(Math.abs(Math.hypot(velocity.x, velocity.y) - PHYSICS.maxPull * PHYSICS.gain) < .001);
  assert.equal(velocity.power, 1);
  assert.ok(velocity.x > 0 && velocity.y < 0);
  assert.deepEqual(launchVelocity(0, 0), { x: 0, y: 0, power: 0 });
});
test('fast plane crossing is captured but reverse travel and outside opening are not', () => {
  const net = { x: 100, y: 200 };
  assert.equal(crossesNet({ x: 0, y: 200 }, { x: 300, y: 200 }, net), true);
  assert.equal(crossesNet({ x: 300, y: 200 }, { x: 0, y: 200 }, net), false);
  assert.equal(crossesNet({ x: 0, y: 270 }, { x: 300, y: 270 }, net), false);
});
test('phase rules cover zero through three deliveries', () => {
  for (let hits = 0; hits <= 3; hits++) assert.deepEqual(phaseResult(hits), { points: hits, stars: hits, advance: hits > 0 });
  assert.throws(() => phaseResult(4));
});
test('ranking prioritizes completed phases, points, then earlier record', () => {
  const scores = [{ phases: 1, score: 3, date: 1 }, { phases: 2, score: 2, date: 3 }, { phases: 2, score: 4, date: 2 }, { phases: 2, score: 4, date: 1 }];
  assert.deepEqual(scores.sort(compareScores).map(x => [x.phases, x.score, x.date]), [[2, 4, 1], [2, 4, 2], [2, 2, 3], [1, 3, 1]]);
});

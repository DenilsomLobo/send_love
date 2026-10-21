import test from 'node:test';
import assert from 'node:assert/strict';
import { viewport, launcherView, receiverView, targetIsOffscreen } from '../src/camera.js';
import { generateLevel } from '../src/physics.js';
import { animationFrame } from '../src/art.js';

test('recipient stays outside launcher view on phones, tablets, desktops and ultrawide screens', () => {
  for (const [cssWidth, cssHeight] of [[390, 844], [844, 390], [768, 1024], [1024, 768], [1920, 1080], [3440, 1440], [3840, 600]]) {
    const { width, scale, offsetX } = viewport(cssWidth, cssHeight);
    assert.ok(width <= 1600);
    assert.ok(Math.abs(width * scale + offsetX * 2 - cssWidth) < .001);
    for (let seed = 0; seed < 100; seed++) {
      const level = generateLevel(10, seed);
      assert.ok(targetIsOffscreen(level, width), `${cssWidth} × ${cssHeight} seed ${seed}`);
      const target = level.net.x - receiverView(level, width);
      assert.ok(target > 40 && target < width - 40);
      const origin = level.origin.x - launcherView(level, width);
      assert.ok(origin > 100 && origin < width);
    }
    assert.ok(targetIsOffscreen({ origin: { x: 360, y: 590 }, net: { x: 1960, y: 570 }, width: 2510 }, width));
  }
});
test('actions select distinct authored animation frames', () => {
  assert.equal(animationFrame('aim', 0, .2), 2);
  assert.equal(animationFrame('aim', 0, .9), 3);
  assert.equal(animationFrame('release', .1), 4);
  assert.equal(animationFrame('release', .3), 5);
  assert.equal(animationFrame('wait', 1), 6);
  assert.equal(animationFrame('capture', .1), 7);
  assert.equal(animationFrame('happy', 0), 8);
  assert.equal(animationFrame('happy', .3), 9);
  assert.equal(animationFrame('sad', 0), 10);
  assert.equal(animationFrame('sad', .9), 11);
});

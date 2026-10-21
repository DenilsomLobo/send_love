import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { Window } from 'happy-dom';
import { findSolutions, generateLevel } from '../src/physics.js';

test('touch keyboard, selection, training capture and regular phase progression work together', async () => {
  const bundle = await build({ entryPoints: ['src/main.js'], bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'import.meta.url': '"http://localhost/src/main.js"' } });
  const window = new Window({ url: 'http://localhost:5173', width: 1440, height: 900 });
  const document = window.document;
  let frame;
  window.requestAnimationFrame = callback => { frame = callback; return 1; };
  const noOp = () => {};
  const context = new Proxy({ createLinearGradient: () => ({ addColorStop: noOp }) }, { get: (target, key) => target[key] ?? noOp, set: (target, key, value) => { target[key] = value; return true; } });
  window.HTMLCanvasElement.prototype.getContext = () => context;
  window.HTMLCanvasElement.prototype.setPointerCapture = noOp;
  window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1440, height: 900 });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.Image = class { set src(value) { this.url = value; queueMicrotask(() => this.onload?.()); } };
  window.Math.random = () => .25;
  document.write(await readFile('index.html', 'utf8'));
  window.eval(bundle.outputFiles[0].text);
  const $ = selector => document.querySelector(selector);
  let time = window.performance.now();
  const frames = count => { for (let i = 0; i < count; i++) { time += 1000 / 60; frame(time); } };
  const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };
  try {
    $('#play-button').click();
    assert.equal($('#setup-screen').hidden, false);
    $('#keyboard-toggle').click();
    assert.ok($('#keyboard-dialog').open);
    for (const key of ['L', 'U', 'I', 'Z', 'Á']) $(`[data-key="${key}"]`).click();
    $('[data-key="back"]').click(); $('[data-key="done"]').click();
    assert.equal($('#name').value, 'LUIZ');
    $('[data-character="female"]').click();
    assert.equal($('[data-character="female"]').getAttribute('aria-pressed'), 'true');
    $('#player-form').dispatchEvent(new window.Event('submit', { cancelable: true }));
    await settle(); frames(210);
    assert.equal($('#menu').hidden, true);
    assert.equal($('#phase-label').textContent, 'Treino');
    const pointer = (type, x, y) => {
      const event = new window.Event(type); Object.assign(event, { clientX: x, clientY: y, pointerId: 1 }); $('#game').dispatchEvent(event);
    };
    const shoot = level => {
      const solution = findSolutions(level)[0];
      pointer('pointerdown', level.origin.x, level.origin.y);
      pointer('pointermove', level.origin.x - solution.velocity.x / 11, level.origin.y - solution.velocity.y / 11);
      pointer('pointerup', level.origin.x - solution.velocity.x / 11, level.origin.y - solution.velocity.y / 11);
      frames(500);
    };
    $('#target-camera').click(); frames(70);
    assert.match($('#tutorial-step').textContent, /Volte/);
    $('#home-camera').click(); frames(70);
    assert.match($('#tutorial-step').textContent, /Puxe/);
    shoot({ origin: { x: 360, y: 590 }, net: { x: 1960, y: 570 } });
    assert.ok($('#finish-tutorial'), 'Successful practice should offer the actual game');
    $('#finish-tutorial').click(); await settle(); frames(210);
    assert.equal($('#phase-label').textContent, 'Fase 01');
    $('#pause').click(); assert.ok($('#resume'));
    $('#resume').click(); assert.equal($('#modal').open, false);
    const firstLevel = generateLevel(1, Math.floor(.25 * 2 ** 31) + 7919);
    for (let i = 0; i < 3; i++) shoot(firstLevel);
    assert.match($('#modal-content').textContent, /3 de 3 cartas entregues/);
    assert.match($('#score-label').textContent, /3/);
    $('#next-phase').click(); frames(210);
    assert.equal($('#phase-label').textContent, 'Fase 02');
    const secondLevel = generateLevel(2, Math.floor(.25 * 2 ** 31) + 2 * 7919);
    // Three deliberately low-power shots miss the far target and open the zero-star result.
    for (let i = 0; i < 3; i++) {
      const { x, y } = secondLevel.origin;
      pointer('pointerdown', x, y); pointer('pointermove', x - 20, y); pointer('pointerup', x - 20, y); frames(500);
    }
    assert.match($('#modal-content').textContent, /0 de 3 cartas entregues/);
    assert.ok($('#restart-countdown'));
    $('#result-menu').click();
    assert.equal($('#menu').hidden, false);
    $('#ranking-button').click(); assert.match($('#modal-content').textContent, /LUIZ/);
    $('#close-ranking').click();
    $('#keyboard-toggle').click(); $('[data-key="clear"]').click(); $('[data-key="done"]').click();
    assert.equal($('#name').value, '');
  } finally { await window.happyDOM.abort(); }
});

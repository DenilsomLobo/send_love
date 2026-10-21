// Render the real Canvas scene without a browser, for reproducible art/layout QA.
import { createCanvas, Image, GlobalFonts } from '@napi-rs/canvas';
import { readFileSync, existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Renderer } from '../src/renderer.js';
import { generateLevel, findSolutions } from '../src/physics.js';
import { launcherView, receiverView } from '../src/camera.js';

globalThis.devicePixelRatio = 1;
globalThis.matchMedia = () => ({ matches: false });
globalThis.Image = class extends Image { set src(url) { super.src = readFileSync(fileURLToPath(url)); } };
const font = 'C:/Windows/Fonts/trebucbd.ttf';
if (existsSync(font)) GlobalFonts.registerFromPath(font, 'Trebuchet MS');
await mkdir('artifacts/previews', { recursive: true });
for (const [label, width, height] of [['desktop', 1440, 900], ['phone', 844, 390], ['portrait', 390, 844], ['ultrawide', 2560, 1080]]) {
  globalThis.innerWidth = width; globalThis.innerHeight = height;
  const canvas = createCanvas(width, height), renderer = new Renderer(canvas); await renderer.assetsReady;
  const level = generateLevel(4, 12345);
  const base = { mode: 'ready', level, camera: launcherView(level, renderer.width), character: 'male', reactionTime: 0 };
  const modes = label === 'desktop' ? ['title', 'source', 'target', 'aim', 'hit', 'sad'] : ['source', 'target'];
  for (const mode of modes) {
    const state = { ...base };
    if (mode === 'title') state.mode = 'menu';
    if (['target', 'hit', 'sad'].includes(mode)) state.camera = receiverView(level, renderer.width);
    if (mode === 'aim') { const { velocity } = findSolutions(level)[0]; state.mode = 'aim'; state.velocity = { ...velocity, power: .8 }; state.pull = { x: level.origin.x - velocity.x / 11, y: level.origin.y - velocity.y / 11 }; }
    if (mode === 'hit') Object.assign(state, { mode: 'reaction', reaction: 'hit', captured: true, reactionTime: .8 });
    if (mode === 'sad') Object.assign(state, { mode: 'reaction', reaction: 'lost', reactionTime: .8 });
    renderer.render(state, 2.5);
    await writeFile(`artifacts/previews/${label}-${mode}.png`, canvas.toBuffer('image/png'));
  }
}
console.log('12 scene previews rendered from the production renderer.');

import { PHYSICS, positionAt } from './physics.js';
import { viewport } from './camera.js';
import { ART, animationFrame } from './art.js';

const TAU = Math.PI * 2;
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.images = {};
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.assetsReady = Promise.all(Object.entries(ART).map(([key, path]) => new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => { this.images[key] = image; resolve(); };
      image.onerror = () => reject(new Error(`Falha ao carregar a arte: ${key}. Recarregue o jogo.`)); image.src = path;
    })));
    this.resize();
  }
  resize() {
    Object.assign(this, viewport(innerWidth, innerHeight));
    this.cssWidth = innerWidth; this.cssHeight = innerHeight; this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(innerWidth * this.dpr); this.canvas.height = Math.round(innerHeight * this.dpr);
  }
  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left - this.offsetX) / this.scale, y: (event.clientY - rect.top) / this.scale };
  }
  ellipse(x, y, rx, ry, color) { const c = this.ctx; c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }
  line(points, color, width) { const c = this.ctx; c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
  text(text, x, y, size, color = '#fff4c6') {
    const c = this.ctx; c.font = `900 ${size}px "Baloo 2", "Trebuchet MS", sans-serif`; c.textAlign = 'center'; c.lineWidth = 4; c.strokeStyle = '#674626'; c.strokeText(text, x, y); c.fillStyle = color; c.fillText(text, x, y);
  }
  background(camera, time) {
    const c = this.ctx, image = this.images.forest;
    c.fillStyle = '#bbd7b1'; c.fillRect(0, 0, this.width, 900);
    if (image) {
      // Mirrored repetitions retain continuity and move more slowly than the foreground.
      const tile = 1600, offset = camera * .22;
      for (let i = Math.floor(offset / tile); i < Math.ceil((offset + this.width) / tile); i++) {
        c.save(); c.translate(i * tile - offset, 0);
        if (i % 2) { c.translate(tile, 0); c.scale(-1, 1); }
        c.drawImage(image, 0, 0, tile, 900); c.restore();
      }
      // A small haze separates the playable foreground from the detailed forest.
      c.fillStyle = '#f4f4ce20'; c.fillRect(0, 0, this.width, 900);
    }
    const t = this.reducedMotion ? 0 : time;
    for (let i = 0; i < 22; i++) {
      const x = ((i * 237 + t * (15 + i % 4 * 5) - camera * .45) % (this.width + 100) + this.width + 100) % (this.width + 100) - 50;
      const y = (i * 149 + t * (10 + i % 3 * 6)) % 980 - 40;
      c.save(); c.translate(x, y); c.rotate(Math.sin(t + i) + i);
      this.ellipse(0, 0, 9 + i % 3, 3 + i % 2, i % 3 ? '#789747aa' : '#dcb95dcc'); this.line([[-7, 0], [7, 0]], '#e0cc8a66', 1); c.restore();
    }
    for (let i = 0; i < 18; i++) {
      const x = ((i * 337 - camera * .16) % (this.width + 50) + this.width + 50) % (this.width + 50);
      const y = 250 + Math.sin(i * 5 + t * .4) * 180;
      this.ellipse(x, y, 2, 2, `rgba(255,243,174,${.3 + Math.sin(t + i) * .2})`);
    }
  }
  tree(anchorX, branchY, direction) {
    const image = this.images.tree; if (!image) return;
    const c = this.ctx; c.save(); c.translate(anchorX, 0); c.scale(direction, 1);
    c.drawImage(image, -460, branchY - 1280 * .614, 860, 1280); c.restore();
  }
  squirrel(character, x, footY, direction, action, time, power = 0, size = 275) {
    const image = this.images[character]; if (!image) return;
    const frame = animationFrame(action, this.reducedMotion && action === 'happy' ? 0 : time, power);
    const c = this.ctx;
    const hop = action === 'happy' || action === 'capture' && time > .35 ? Math.max(0, Math.sin(time * Math.PI * 4)) * 13 : 0;
    const breathe = this.reducedMotion ? 1 : 1 + Math.sin(time * 3) * .008;
    c.save(); c.translate(x, footY - (this.reducedMotion ? 0 : hop)); c.scale(direction, breathe);
    this.ellipse(0, -1, size * .26, 7, '#4d3e2e44');
    c.drawImage(image, frame % 4 * 512, Math.floor(frame / 4) * 512, 512, 512, -size / 2, -size * 500 / 512, size, size);
    c.restore();
  }
  plane(x, y, angle = 0, size = 84, time = 0) {
    if (!this.images.plane) return;
    const c = this.ctx; c.save(); c.translate(x, y); c.rotate(angle + .12);
    const flap = this.reducedMotion ? 1 : 1 + Math.sin(time * 15) * .035;
    c.scale(1, flap); c.drawImage(this.images.plane, -size * .52, -size * .42, size, size * .84); c.restore();
  }
  slingshot(origin, pull, front, flightTime = 9) {
    const { x, y } = origin, c = this.ctx;
    let bag = pull || origin;
    if (!pull && flightTime < .35) bag = { x: x + Math.sin(flightTime * 55) * 20 * (1 - flightTime / .35), y };
    if (!front) {
      if (this.images.sling) c.drawImage(this.images.sling, x - 105, y - 18, 210, 180);
      this.line([[x + 43, y - 1], [bag.x, bag.y]], '#9c6950', 7);
    } else {
      this.line([[x - 43, y - 1], [bag.x, bag.y]], '#5f3b2a', 8);
      this.line([[bag.x - 10, bag.y + 2], [bag.x + 10, bag.y + 2]], '#714938', 9);
    }
  }
  net(net, captured, reactionTime, front = false) {
    const c = this.ctx, { x, y } = net;
    // Source art has an opening at (0.37, .25), radius .23 of image height.
    // Vertical scaling makes the visible mouth match the physical 130-unit opening.
    const h = 278, w = 278;
    if (!front) {
      if (this.images.net) {
        c.save(); c.beginPath(); c.rect(x - 120, y - 100, 400, 248); c.clip(); c.translate(x, y);
        const pulse = captured ? Math.sin(Math.min(1, reactionTime / .4) * Math.PI) * .06 : 0;
        c.scale(1 + pulse, 1); c.drawImage(this.images.net, -w * .37, -h * .25, w, h); c.restore();
      }
      if (captured) this.plane(x + 55, y + 25, .18, 65);
    } else {
      // Front lip stays over the captured letter; only the opening is a target.
      c.strokeStyle = '#9b593b'; c.lineWidth = 4; c.beginPath(); c.ellipse(x - 8, y, 12, PHYSICS.netRadius, .02, Math.PI / 2, Math.PI * 1.5); c.stroke();
    }
  }
  menuScene(time) {
    const w = this.width, wide = w > 800;
    const left = wide ? 260 : 100, right = wide ? w - 260 : w - 90, foot = 760;
    this.tree(left + 80, foot, 1); this.tree(right - 80, foot + 10, -1);
    this.squirrel('male', left, foot, 1, 'idle', time, 0, wide ? 320 : 210);
    this.squirrel('female', right, foot + 10, -1, 'idle', time + 1, 0, wide ? 320 : 210);
    if (wide) {
      const t = (time * .1) % 1; const x = left + 100 + (right - left - 200) * t, y = foot - 220 - Math.sin(t * Math.PI) * 180;
      this.plane(x, y, Math.cos(t * Math.PI) * -.4, 70, time);
    }
  }
  scoutIndicator(state, time) {
    const origin = state.level.origin, net = state.level.net, c = this.ctx;
    if (net.x - state.camera > this.width + 30) {
      const x = this.width - 80, y = 435;
      this.ellipse(x, y, 44, 37, '#fff0bddd'); this.text('♥ →', x, y + 9, 27, '#d66477');
      this.text(`${Math.round((net.x - origin.x) / 100)} m`, x, y + 65, 18);
    }
    if (state.mode === 'ready' && Math.abs(state.camera - origin.x) < this.width && !state.tutorial) {
      const x = origin.x - state.camera, y = origin.y;
      c.strokeStyle = `rgba(255,246,196,${.45 + Math.sin(time * 3) * .2})`; c.lineWidth = 3; c.setLineDash([7, 8]); c.beginPath(); c.arc(x, y, 58, 0, TAU); c.stroke(); c.setLineDash([]);
    }
  }
  reactionPortrait(state, time) {
    if (!['hit', 'miss', 'lost'].includes(state.reaction)) return;
    const c = this.ctx, x = 110, y = 680;
    c.save(); this.ellipse(x, y, 90, 90, '#fff0c4ed'); c.beginPath(); c.ellipse(x, y, 90, 90, 0, 0, TAU); c.clip();
    this.squirrel(state.character, x, y + 85, 1, state.reaction === 'hit' ? 'happy' : 'sad', state.reactionTime, 0, 185); c.restore();
    c.strokeStyle = '#94603c'; c.lineWidth = 5; c.beginPath(); c.ellipse(x, y, 90, 90, 0, 0, TAU); c.stroke(); this.text('Você', x, y + 112, 18);
  }
  tutorialGesture(state, time) {
    if (!state.tutorial || state.mode !== 'ready' || state.tutorialStep !== 'launch') return;
    const c = this.ctx, origin = state.level.origin, t = (time % 2) / 2;
    const x = origin.x - state.camera - t * 110, y = origin.y + t * 80;
    c.save(); c.globalAlpha = 1 - t * .55; this.line([[origin.x - state.camera, origin.y], [x, y]], '#fff6c5', 3); this.text('☝', x, y + 26, 46); c.restore();
  }
  render(state, time) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.fillStyle = '#172d22'; c.fillRect(0, 0, this.cssWidth, this.cssHeight);
    c.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, this.offsetX * this.dpr, 0);
    c.save(); c.beginPath(); c.rect(0, 0, this.width, 900); c.clip();
    this.background(state.camera || 0, time);
    if (state.mode === 'menu' || !state.level) { this.menuScene(time); c.restore(); return; }
    const { origin, net } = state.level;
    c.save(); c.translate(-state.camera, 0);
    this.tree(origin.x, origin.y + 150, 1); this.tree(net.x, net.y + 150, -1);
    let senderAction = 'idle', recipientAction = 'wait', actionTime = time;
    if (state.mode === 'aim') senderAction = 'aim';
    if (state.mode === 'flight') { senderAction = 'release'; actionTime = state.flightTime; }
    if (state.reaction === 'hit') { senderAction = 'happy'; recipientAction = 'capture'; actionTime = state.reactionTime; }
    if (['miss', 'lost'].includes(state.reaction)) { senderAction = 'sad'; recipientAction = 'sad'; actionTime = state.reactionTime; }
    this.squirrel(state.character, origin.x - (state.mode === 'aim' ? 100 : 130), origin.y + 150, 1, senderAction, actionTime, state.velocity?.power || 0);
    this.squirrel(state.character === 'male' ? 'female' : 'male', net.x + 225, net.y + 150, -1, recipientAction, actionTime, 0, this.width < 650 ? 240 : 275);
    this.net(net, state.captured, state.reactionTime);
    this.slingshot(origin, state.pull, false, state.mode === 'flight' ? state.flightTime : 9);
    if (state.mode === 'aim' && state.velocity) {
      const maxT = Math.min(.6, this.width * .27 / Math.max(1, state.velocity.x));
      for (let t = .06; t <= maxT; t += .05) { const point = positionAt(origin, state.velocity, t); this.ellipse(point.x, point.y, 5 - t * 2, 5 - t * 2, '#fff9d3'); }
    }
    if (['ready', 'aim', 'intro'].includes(state.mode)) this.plane(state.pull?.x ?? origin.x, state.pull?.y ?? origin.y, state.velocity ? Math.atan2(state.velocity.y, state.velocity.x) : -.12, 84, time);
    this.slingshot(origin, state.pull, true, state.mode === 'flight' ? state.flightTime : 9);
    if (state.projectile) {
      const p = state.projectile;
      for (let i = 0; i < p.trail.length; i++) this.ellipse(p.trail[i].x, p.trail[i].y, 2 + i * .15, 2 + i * .15, `rgba(255,246,225,${i / p.trail.length * .7})`);
      this.plane(p.x, p.y, Math.atan2(p.vy, p.vx), 84, time);
      if (p.y < 30) this.text('✉ ↑', p.x, 125, 27, '#ffeda9');
    }
    this.net(net, state.captured, state.reactionTime, true);
    if (state.reaction === 'hit') {
      for (let i = 0; i < 16; i++) { const age = Math.min(2.4, state.reactionTime), spread = 30 + age * 85; this.text(i % 2 ? '♥' : '✦', net.x + Math.sin(i * 8.3) * spread, net.y - age * 80 + Math.cos(i * 5) * 60, Math.max(5, 26 - age * 8), i % 2 ? '#ed7188' : '#ffdc6a'); }
    }
    c.restore(); this.scoutIndicator(state, time); this.tutorialGesture(state, time); this.reactionPortrait(state, time);
    // Foreground foliage moves independently from the distant illustration.
    for (let i = 0; i < 9; i++) {
      const x = i * 230 - (state.camera * 1.15 % 230), y = 915 + Math.sin(i * 2 + time * .3) * 15;
      this.ellipse(x, y, 65, 30, '#365e35bb');
    }
    if (state.mode === 'intro') {
      const alpha = Math.max(0, 1 - state.introTime * 2); c.fillStyle = `rgba(32,57,33,${alpha})`; c.fillRect(0, 0, this.width, 900);
    }
    c.restore();
  }
}

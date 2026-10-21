import './styles.css';
import { Renderer } from './renderer.js';
import { PHYSICS, launchVelocity, positionAt, crossesNet, generateLevel, phaseResult } from './physics.js';
import { read, write, rankings, saveScore, onStorageError } from './storage.js';
import { ForestAudio } from './audio.js';
import { ART } from './art.js';
import { clampCamera, launcherView, receiverView } from './camera.js';

const $ = selector => document.querySelector(selector);
const renderer = new Renderer($('#game'));
const audio = new ForestAudio(read('sound', true) === true);
const volumes = read('volumes', { ambience: .55, effects: .7 });
audio.setVolumes(Math.max(0, Math.min(1, Number(volumes?.ambience) || 0)), Math.max(0, Math.min(1, Number(volumes?.effects) || 0)));
const stored = read('player', {});
let player = stored && typeof stored === 'object' ? stored : {};
let character = player.character === 'female' ? 'female' : 'male';
let state = { mode: 'menu', character, camera: 0, reactionTime: 0 };
let gesture = null, accumulator = 0, lastFrame = performance.now(), clock = 0, countdown = null;
let keyboardValue = '';
let starting = false;

function showSetup() { $('#title-screen').hidden = true; $('#setup-screen').hidden = false; audio.unlock(); }
$('#play-button').onclick = showSetup;
$('#back-title').onclick = () => { $('#setup-screen').hidden = true; $('#title-screen').hidden = false; };
$('#fullscreen').onclick = async () => {
  try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('Neste navegador, use o modo paisagem para ampliar o jogo.'); }
  catch { toast('Use o modo paisagem para ampliar o jogo neste aparelho.'); }
};
function orientationHint() { $('#orientation-tip').hidden = innerWidth >= innerHeight; }
orientationHint();
function tutorialStage(stage) {
  state.tutorialStep = stage;
  const text = {
    scout: ['1 · Encontre seu amor', 'Arraste a floresta para a esquerda até ver a puçá. Você também pode usar Encontrar meu amor.'],
    return: ['2 · Volte ao seu galho', 'Veja a altura do alvo. Agora arraste de volta ou toque em Meu galho.'],
    launch: ['3 · Puxe, mire e solte!', 'Puxe o avião para trás e para baixo. Mais força leva mais longe. Aqui você pode tentar quantas vezes quiser!'],
  }[stage];
  if (text) { $('#tutorial-step').textContent = text[0]; $('#tutorial-copy').textContent = text[1]; }
}
$('#skip-tutorial').onclick = () => { write('tutorialV2Done', true); if (player.name) startGame(false); else { backToMenu(); showSetup(); } };

function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').hidden = true, 4500); }
onStorageError(toast);
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function hint(text) { $('#hint').textContent = text; }
function updateSoundButton() { $('#sound').setAttribute('aria-label', audio.enabled ? 'Desativar som' : 'Ativar som'); $('#sound').textContent = audio.enabled ? '♫' : '♪'; $('#sound').style.opacity = audio.enabled ? 1 : .55; }
updateSoundButton();
$('#sound').onclick = () => { audio.toggle(); write('sound', audio.enabled); updateSoundButton(); };
$('#name').value = typeof player.name === 'string' ? player.name.slice(0, 16) : '';

function selectCharacter(value) {
  character = value;
  document.querySelectorAll('[data-character]').forEach(button => { const selected = button.dataset.character === value; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', selected); });
}
selectCharacter(character);
document.querySelectorAll('[data-character]').forEach(button => button.onclick = () => { selectCharacter(button.dataset.character); audio.play('click'); });

function openModal(html, dismissible = true) {
  $('#modal-content').innerHTML = html;
  $('#modal').dataset.dismissible = String(dismissible);
  if (!$('#modal').open) $('#modal').showModal();
}
function closeModal() { clearInterval(countdown); countdown = null; $('#modal').close(); }
$('#modal').addEventListener('cancel', event => { event.preventDefault(); if ($('#modal').dataset.dismissible === 'true') { closeModal(); if (state.mode === 'paused') resume(); } });

function showRanking() {
  const list = rankings().slice(0, 10);
  openModal(`<span class="eyebrow">CORREIO DA FLORESTA</span><h2>Grandes entregas ♕</h2><p>Os melhores romances deste navegador e dispositivo.</p>${list.length ? `<table class="ranking"><thead><tr><th>#</th><th>REMETENTE</th><th>FASES</th><th>PONTOS</th></tr></thead><tbody>${list.map((r, i) => `<tr><td>${String(i + 1).padStart(2, '0')}</td><td>${escapeHTML(r.name)}</td><td>${r.phases}</td><td>${r.score} ♡</td></tr>`).join('')}</tbody></table>` : '<p>Nenhuma entrega por aqui ainda. Sua história pode ser a primeira.</p>'}<div class="modal-buttons"><button class="primary" id="close-ranking">Voltar à floresta</button></div>`);
  $('#close-ranking').onclick = closeModal;
}
$('#ranking-button').onclick = showRanking;

function showInstructions() {
  openModal(`<span class="eyebrow">UM GUIA PARA O CORAÇÃO</span><h2>Como enviar amor</h2><ol class="tutorial-steps"><li><strong>Encontre seu amor.</strong> Arraste uma área vazia da floresta ou toque em Ver meu amor.</li><li><strong>Prepare a carta.</strong> Volte ao estilingue. Puxe o avião para trás e para baixo.</li><li><strong>Escolha força e ângulo.</strong> Quanto mais puxar, mais longe ele vai. Os pontinhos mostram apenas o começo do voo.</li><li><strong>Solte e torça.</strong> Acerte a abertura da puçá. São três lançamentos por fase: cada entrega vale um ponto e uma estrela. Um acerto basta para avançar!</li></ol><div class="modal-buttons"><button class="pill" id="close-guide">Voltar</button><button class="primary" id="practice-guide">Experimentar sem perder</button></div>`);
  $('#close-guide').onclick = closeModal;
  $('#practice-guide').onclick = () => { closeModal(); startGame(true); };
}
$('#tutorial-button').onclick = showInstructions;

$('#player-form').addEventListener('submit', event => {
  event.preventDefault();
  const name = $('#name').value.trim();
  if ([...name].length < 2) { $('#form-error').textContent = 'Escreva um nome com pelo menos duas letras.'; return; }
  $('#form-error').textContent = '';
  player = { id: player.id || crypto.randomUUID(), name, character };
  write('player', player); audio.unlock();
  startGame(!read('tutorialV2Done', false));
});

function updateHUD() {
  $('#phase-label').textContent = state.tutorial ? 'Treino' : `Fase ${String(state.phase).padStart(2, '0')}`;
  $('#score-label').innerHTML = `${state.score} <span>♥</span>`;
  $('#attempt-label').innerHTML = state.tutorial ? '∞' : Array.from({ length: 3 }, (_, i) => `<span class="attempt ${state.results?.[i] === true ? 'hit' : state.results?.[i] === false ? 'miss' : i < state.shots ? 'flying' : ''}">${state.results?.[i] === true ? '♥' : state.results?.[i] === false ? '×' : '✉'}</span>`).join('');
  $('#attempt-label').setAttribute('aria-label', state.tutorial ? 'Lançamentos ilimitados no treino' : `${3 - state.shots} lançamentos restantes`);
}
function cameraClamp(value) { return clampCamera(state.level, renderer.width, value); }
function cameraTo(target, duration = .7) { state.cameraTween = { from: state.camera, to: cameraClamp(target), elapsed: 0, duration }; }
function launcherCamera() { return launcherView(state.level, renderer.width); }
function targetCamera() { return receiverView(state.level, renderer.width); }

async function startGame(tutorial = false) {
  if (starting) return;
  starting = true; $('#loading').hidden = false;
  closeModal(); await audio.unlock();
  try { await renderer.assetsReady; } catch (error) { toast(error.message); starting = false; $('#loading').hidden = true; return; }
  starting = false; $('#loading').hidden = true;
  document.body.classList.add('playing'); $('#menu').hidden = true; $('#hud').hidden = false; $('#pause').hidden = false;
  state = { mode: 'ready', phase: 1, score: 0, shots: 0, hits: 0, camera: 0, character, tutorial, seed: Math.floor(Math.random() * 2 ** 31), reactionTime: 0 };
  beginPhase();
}
function beginPhase() {
  Object.assign(state, { shots: 0, hits: 0, results: [], captured: false, projectile: null, reaction: null, pull: null, velocity: null, reactionTime: 0, flightTime: 0 });
  state.level = state.tutorial ? { origin: { x: 360, y: 590 }, net: { x: 1960, y: 570 }, width: 2510 } : generateLevel(state.phase, state.seed + state.phase * 7919);
  state.mode = 'intro'; state.introTime = 0; state.camera = launcherCamera();
  state.cameraTween = null; updateHUD();
  $('#phase-banner').hidden = false;
  $('#banner-title').textContent = state.tutorial ? 'Correio do coração' : `Fase ${state.phase}`;
  $('#banner-subtitle').textContent = state.tutorial ? 'Vamos aprender a enviar amor?' : 'Um novo endereço. Três cartas de amor.';
  $('#tutorial-panel').hidden = !state.tutorial;
  if (state.tutorial) tutorialStage('scout');
  hint('Seu amor está em outra árvore, fora desta tela. Explore a floresta!');
}
function readyAfterIntro() {
  state.mode = 'ready';
  $('#phase-banner').hidden = true;
  hint('Arraste o cenário para encontrar a puçá. Depois, volte ao seu galho e mire!');
}
function backToMenu() {
  closeModal(); if (!state.tutorial && state.level) saveScore(player, state.phase - 1, state.score);
  cancelGesture(); state = { mode: 'menu', camera: 0, character, reactionTime: 0 }; document.body.classList.remove('playing');
  $('#menu').hidden = false; $('#hud').hidden = true; $('#pause').hidden = true;
  $('#setup-screen').hidden = true; $('#title-screen').hidden = false;
}
$('#brand').onclick = event => { event.preventDefault(); if (state.mode !== 'menu') pause(true); };

function cancelGesture() {
  gesture = null; state.pull = null; state.velocity = null; $('#power').hidden = true;
  if (state.mode === 'aim') state.mode = 'ready';
}
$('#cancel-aim').onclick = cancelGesture;
$('#home-camera').onclick = () => { if (state.mode === 'ready') cameraTo(launcherCamera()); };
$('#target-camera').onclick = () => { if (state.mode === 'ready') { cameraTo(targetCamera()); hint('Observe a altura da puçá. Volte ao estilingue para enviar sua carta.'); } };

function pause(fromBrand = false) {
  if (['menu', 'result', 'paused'].includes(state.mode)) return;
  cancelGesture(); state.beforePause = state.mode; state.mode = 'paused';
  openModal(`<div class="center"><span class="modal-icon">❧</span><h2>Uma pausa no caminho</h2><p>O amor pode esperar um pouquinho.<br>Sua carta fica bem guardada aqui.</p><div class="audio-settings"><label>Floresta <input id="ambience-volume" type="range" min="0" max="1" step=".05" value="${audio.ambienceVolume}" aria-label="Volume da floresta"></label><label>Efeitos <input id="effects-volume" type="range" min="0" max="1" step=".05" value="${audio.effectsVolume}" aria-label="Volume dos efeitos"></label></div><div class="modal-buttons"><button class="primary" id="resume">Continuar</button><button class="pill" id="exit">Voltar ao início</button></div></div>`);
  for (const slider of ['#ambience-volume', '#effects-volume']) $(slider).oninput = () => {
    const ambience = Number($('#ambience-volume').value), effects = Number($('#effects-volume').value); audio.setVolumes(ambience, effects); write('volumes', { ambience, effects });
  };
  $('#resume').onclick = resume; $('#exit').onclick = backToMenu;
  if (fromBrand) $('#exit').focus();
}
function resume() { closeModal(); state.mode = state.beforePause || 'ready'; lastFrame = performance.now(); accumulator = 0; }
$('#pause').onclick = () => pause();
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('#modal').open && !$('#keyboard-dialog').open) { if (state.mode === 'aim') cancelGesture(); else pause(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); audio.context?.suspend(); } else if (audio.enabled) audio.unlock(); });

const canvas = $('#game');
canvas.addEventListener('pointerdown', event => {
  if (state.mode !== 'ready' || gesture) return;
  const point = renderer.point(event), worldX = point.x + state.camera, origin = state.level.origin;
  if (point.x < 0 || point.x > renderer.width) return;
  const radius = Math.max(65, 34 / renderer.scale);
  const aiming = Math.hypot(worldX - origin.x, point.y - origin.y) < radius;
  if (aiming && state.tutorial && state.tutorialStep !== 'launch') { hint('Primeiro encontre a puçá e volte ao seu galho. Siga o guia do treino!'); return; }
  canvas.setPointerCapture(event.pointerId); state.cameraTween = null;
  gesture = { id: event.pointerId, type: aiming ? 'aim' : 'pan', point, camera: state.camera };
  if (aiming) { state.mode = 'aim'; state.pull = { ...origin }; state.velocity = { x: 0, y: 0 }; $('#power').hidden = false; $('meter').value = 0; hint('Puxe para trás e para baixo para criar uma parábola.'); }
});
canvas.addEventListener('pointermove', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const point = renderer.point(event);
  if (gesture.type === 'pan') { state.camera = cameraClamp(gesture.camera + gesture.point.x - point.x); return; }
  const origin = state.level.origin;
  const dx = Math.max(0, origin.x - (point.x + state.camera)), dy = origin.y - point.y;
  const length = Math.hypot(dx, dy), ratio = Math.min(1, PHYSICS.maxPull / (length || 1));
  state.pull = { x: origin.x - dx * ratio, y: origin.y - dy * ratio };
  state.velocity = launchVelocity(dx, dy); const power = Math.round(state.velocity.power * 100); $('meter').value = power; $('#power-number').textContent = `${power}%`; audio.tension(state.velocity.power);
});
canvas.addEventListener('pointerup', event => {
  if (!gesture || gesture.id !== event.pointerId) return;
  const type = gesture.type; gesture = null;
  if (type === 'pan') return;
  if (!state.velocity || state.velocity.x < 30 || state.velocity.power * PHYSICS.maxPull < PHYSICS.minPull) { cancelGesture(); hint('Puxe um pouco mais para lançar. Nenhuma chance foi usada.'); return; }
  const velocity = { ...state.velocity }; state.pull = null; state.velocity = null; $('#power').hidden = true;
  state.shots++; state.captured = false; state.mode = 'flight'; state.flightTime = 0;
  state.projectile = { ...state.level.origin, vx: velocity.x, vy: velocity.y, initial: velocity, trail: [] };
  audio.play('launch'); updateHUD(); hint('Uma carta a caminho… ♡');
});
canvas.addEventListener('pointercancel', cancelGesture);
canvas.addEventListener('lostpointercapture', () => { if (gesture) cancelGesture(); });
window.addEventListener('resize', () => { cancelGesture(); renderer.resize(); orientationHint(); if (state.level) { state.camera = cameraClamp(state.camera); state.cameraTween = null; } });
window.addEventListener('blur', () => { if (state.mode !== 'menu') pause(); });

function resolveShot(hit) {
  state.mode = 'reaction'; state.reactionTime = 0; state.projectile = null;
  state.reaction = hit ? 'hit' : 'miss'; state.captured = hit;
  state.results[state.shots - 1] = hit;
  if (hit) { state.hits++; if (!state.tutorial) state.score++; }
  updateHUD();
  audio.play(hit ? 'hit' : 'miss');
  state.cheered = false;
  hint(hit ? 'Chegou! Uma carta, um sorriso e um ponto. ♡' : 'Quase! Observe o voo e ajuste a força e o ângulo.');
}
function endPhase() {
  state.mode = 'result';
  if (state.tutorial) {
    write('tutorialV2Done', true);
    openModal(`<div class="center"><span class="modal-icon">💌</span><span class="eyebrow">PRIMEIRA ENTREGA CONCLUÍDA</span><h2>Você fez o amor voar!</h2><p>Agora são três lançamentos por fase.<br>Cada carta entregue vale um ponto e uma estrela.<br>Com pelo menos um acerto, você segue viagem.</p><div class="modal-buttons"><button class="primary" id="finish-tutorial">${player.name ? 'Começar minha história' : 'Escolher meu nome'}</button></div></div>`, false);
    $('#finish-tutorial').onclick = () => player.name ? startGame(false) : backToMenu();
    return;
  }
  const result = phaseResult(state.hits);
  saveScore(player, result.advance ? state.phase : state.phase - 1, state.score); updateHUD();
  if (!result.advance) { state.reaction = 'lost'; audio.play('lose'); }
  else audio.play('finish');
  openModal(`<div class="center"><span class="eyebrow">${result.advance ? `FASE ${String(state.phase).padStart(2, '0')} CONCLUÍDA` : 'UMA CARTA FICOU PELO CAMINHO'}</span><h2>${result.advance ? state.hits === 3 ? 'Amor de três estrelas!' : 'O carinho chegou!' : 'A saudade pode esperar…'}</h2><div class="result-actors" aria-label="${result.advance ? 'Os dois esquilos comemoram' : 'Os dois esquilos ficam tristes'}"><div class="result-actor ${result.advance ? '' : 'sad'}" style="background-image:url('${ART.male}')"></div><div class="result-actor ${result.advance ? '' : 'sad'}" style="background-image:url('${ART.female}')"></div></div><div class="stars" aria-label="${state.hits} de 3 estrelas">${Array.from({ length: 3 }, (_, i) => `<span class="${i >= state.hits ? 'empty' : ''}">★</span>`).join('')}</div><p>${state.hits} de 3 cartas entregues · <strong>${state.score} pontos no total</strong><br>${result.advance ? 'Seu amor está de mudança. Um novo endereço espera por você.' : `Você concluiu ${state.phase - 1} fases. Vamos tentar outra vez?`}</p><div class="modal-buttons"><button class="primary" id="next-phase">${result.advance ? 'Próximo endereço →' : 'Enviar amor de novo'}</button><button class="pill" id="result-menu">Início</button></div>${result.advance ? '' : '<p id="restart-countdown">Recomeçando em 10 segundos…</p>'}</div>`, false);
  $('#next-phase').onclick = () => { closeModal(); if (result.advance) { state.phase++; beginPhase(); } else startGame(false); };
  $('#result-menu').onclick = backToMenu;
  if (!result.advance) {
    let seconds = 10;
    countdown = setInterval(() => { if (document.hidden) return; seconds--; const label = $('#restart-countdown'); if (label) label.textContent = `Recomeçando em ${seconds} segundos…`; if (seconds <= 0) startGame(false); }, 1000);
  }
}

function step(dt) {
  if (state.mode === 'paused' || state.mode === 'menu') return;
  if (state.cameraTween) {
    const tween = state.cameraTween; tween.elapsed += dt; const t = Math.min(1, tween.elapsed / tween.duration);
    const ease = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    state.camera = tween.from + (tween.to - tween.from) * ease;
    if (t === 1) state.cameraTween = null;
  }
  if (state.mode === 'intro') { state.introTime += dt; if (state.introTime > 1.8) readyAfterIntro(); }
  if (state.tutorial && state.mode === 'ready') {
    const targetX = state.level.net.x - state.camera;
    if (state.tutorialStep === 'scout' && targetX > 40 && targetX < renderer.width - 40) { tutorialStage('return'); hint('Encontrou! Observe a altura da abertura e volte ao seu galho.'); }
    else if (state.tutorialStep === 'return' && Math.abs(state.camera - launcherCamera()) < 25) { tutorialStage('launch'); hint('Agora puxe o avião para trás e para baixo. Solte para enviar amor!'); }
  }
  if (state.mode === 'flight') {
    const p = state.projectile, previous = { x: p.x, y: p.y };
    state.flightTime += dt; const next = positionAt(state.level.origin, p.initial, state.flightTime);
    p.x = next.x; p.y = next.y; p.vy = p.initial.y + PHYSICS.gravity * state.flightTime;
    p.trail.push(previous); if (p.trail.length > 16) p.trail.shift();
    state.camera += (cameraClamp(p.x - renderer.width * .42) - state.camera) * Math.min(1, dt * 5);
    if (crossesNet(previous, next, state.level.net)) resolveShot(true);
    else if (p.y > 880 || p.y < -230 || p.x > state.level.net.x + 260 || state.flightTime > PHYSICS.maxFlight || (p.x > state.level.net.x + 210 && p.y > state.level.net.y - 20) || (p.x < state.level.origin.x + 120 && p.y > state.level.origin.y + 130)) resolveShot(false);
  }
  if (state.mode === 'reaction') {
    state.reactionTime += dt;
    if (state.reaction === 'hit' && !state.cheered && state.reactionTime > .5) { audio.play('cheer'); state.cheered = true; }
    if (state.reactionTime > 2.4) {
      if (state.tutorial && state.hits > 0 || !state.tutorial && state.shots >= 3) endPhase();
      else { state.mode = 'ready'; state.reaction = null; cameraTo(launcherCamera()); hint(state.tutorial ? 'Tente de novo! Puxe para trás e para baixo. Ajuste a força para alcançar a puçá.' : `Mais uma carta? Restam ${3 - state.shots} lançamentos. Ajuste a mira e tente!`); }
    }
  }
}
function frame(now) {
  const elapsed = Math.min((now - lastFrame) / 1000, .08); lastFrame = now;
  if (state.mode !== 'paused' && !document.hidden) clock += elapsed;
  accumulator += elapsed;
  while (accumulator >= 1 / 120) { step(1 / 120); accumulator -= 1 / 120; }
  renderer.render(state, clock); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Dedicated virtual keyboard works on kiosks, tablets and phones without a physical keyboard.
function keyboardPreview() { $('#keyboard-preview').textContent = keyboardValue || 'Seu nome…'; }
function openKeyboard() { keyboardValue = $('#name').value; keyboardPreview(); $('#keyboard-dialog').showModal(); }
$('#keyboard-toggle').onclick = openKeyboard;
$('#keyboard-close').onclick = () => $('#keyboard-dialog').close();
const keyboardRows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM', 'ÁÀÂÃÉÊÍ', 'ÓÔÕÚÜÇ', '1234567890'];
$('#keyboard-keys').innerHTML = keyboardRows.map(row => `<div class="keyboard-row">${[...row].map(letter => `<button type="button" data-key="${letter}">${letter}</button>`).join('')}</div>`).join('');
$('#keyboard-dialog').addEventListener('click', event => {
  const key = event.target.closest('[data-key]')?.dataset.key; if (!key) return;
  audio.play('click');
  if (key === 'done') { $('#name').value = keyboardValue.trim(); $('#keyboard-dialog').close(); return; }
  if (key === 'clear') keyboardValue = '';
  else if (key === 'back') keyboardValue = [...keyboardValue].slice(0, -1).join('');
  else if ([...keyboardValue].length < 16) keyboardValue += key === 'space' ? ' ' : key;
  keyboardPreview();
});
if (matchMedia('(pointer: coarse)').matches) {
  $('#name').readOnly = true; $('#name').addEventListener('click', openKeyboard); $('#name').setAttribute('aria-description', 'Toque para abrir o teclado virtual');
}

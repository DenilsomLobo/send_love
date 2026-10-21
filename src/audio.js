export class ForestAudio {
  constructor(enabled = false) { this.enabled = enabled; this.context = null; this.ambient = null; this.ambienceVolume = .55; this.effectsVolume = .7; this.lastTension = -1; }
  async unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new (window.AudioContext || window.webkitAudioContext)();
      await this.context.resume();
      if (!this.ambient) {
        const ctx = this.context;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * .02) / 1.02; data[i] = last * 3; }
        this.ambient = ctx.createBufferSource(); this.ambient.buffer = buffer; this.ambient.loop = true;
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900;
        this.volume = ctx.createGain(); this.volume.gain.value = .16 * this.ambienceVolume;
        this.ambient.connect(filter).connect(this.volume).connect(ctx.destination); this.ambient.start();
        this.birds = setInterval(() => { if (!this.enabled || document.hidden || this.context.state !== 'running') return; this.chirp(); }, 4700);
      }
    } catch { this.enabled = false; }
  }
  toggle() { this.enabled = !this.enabled; if (this.enabled) this.unlock(); else this.context?.suspend(); return this.enabled; }
  tone(frequency, at, duration, type = 'sine', volume = .08) {
    if (!this.enabled || !this.context) return;
    const ctx = this.context, oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + at);
    gain.gain.setValueAtTime(0, ctx.currentTime + at); gain.gain.linearRampToValueAtTime(Math.max(.001, volume * this.effectsVolume), ctx.currentTime + at + .015);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + at + duration);
    oscillator.connect(gain).connect(ctx.destination); oscillator.start(ctx.currentTime + at); oscillator.stop(ctx.currentTime + at + duration);
  }
  setVolumes(ambience, effects) { this.ambienceVolume = ambience; this.effectsVolume = effects; if (this.volume) this.volume.gain.value = .16 * ambience; }
  chirp() {
    if (!this.context || !this.enabled) return;
    const ctx = this.context;
    for (let i = 0; i < 3; i++) {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(), at = ctx.currentTime + i * .22;
      oscillator.frequency.setValueAtTime(1600 + i * 250, at); oscillator.frequency.exponentialRampToValueAtTime(2900, at + .08); oscillator.frequency.exponentialRampToValueAtTime(1800, at + .17);
      gain.gain.setValueAtTime(.001, at); gain.gain.linearRampToValueAtTime(.025 * this.ambienceVolume, at + .02); gain.gain.exponentialRampToValueAtTime(.001, at + .18);
      oscillator.connect(gain).connect(ctx.destination); oscillator.start(at); oscillator.stop(at + .2);
    }
  }
  tension(power) {
    const level = Math.floor(power * 6);
    if (level !== this.lastTension) { this.lastTension = level; if (level > 0) this.tone(140 + power * 190, 0, .07, 'triangle', .025); }
  }
  swoosh() {
    if (!this.context || !this.enabled) return;
    const ctx = this.context, length = Math.floor(ctx.sampleRate * .3), buffer = ctx.createBuffer(1, length, ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 1800; filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + .3); gain.gain.value = .2 * this.effectsVolume;
    source.connect(filter).connect(gain).connect(ctx.destination); source.start();
  }
  play(event) {
    if (event === 'launch') { this.lastTension = -1; this.swoosh(); this.tone(150, 0, .12, 'triangle', .08); }
    if (event === 'hit') [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * .1, .4));
    if (event === 'miss') { this.tone(294, 0, .2); this.tone(220, .16, .4); }
    if (event === 'finish') [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, i * .13, .6));
    if (event === 'cheer') [784, 1047, 1319].forEach((f, i) => this.tone(f, i * .07, .2, 'triangle', .035));
    if (event === 'lose') [330, 294, 247, 196].forEach((f, i) => this.tone(f, i * .2, .5, 'sine', .05));
    if (event === 'click') this.tone(600, 0, .08, 'sine', .025);
  }
}

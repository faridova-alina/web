"use strict";

/**
 * Звуковой движок на Web Audio API.
 * Все звуки синтезируются процедурно — внешних файлов не требуется.
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.enabled = true;
  }

  /** Инициализация по первому жесту пользователя (требование браузеров). */
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.0;
    this.musicGain.connect(this.master);
  }

  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }

  _tone(freq, dur, type = "sine", gain = 0.3, destination = null, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(destination || this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return osc;
  }

  /** Мяуканье: восходяще-нисходящий глиссандо с вибрато. */
  meow() {
    if (!this.ctx || !this.enabled) return;
    this.resume();
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const vib = this.ctx.createOscillator();
    const vibG = this.ctx.createGain();
    osc.type = "sawtooth";
    const base = Utils.rand(420, 520);
    osc.frequency.setValueAtTime(base, t0);
    osc.frequency.linearRampToValueAtTime(base * 1.5, t0 + 0.12);
    osc.frequency.linearRampToValueAtTime(base * 0.85, t0 + 0.45);
    vib.frequency.value = 18;
    vibG.gain.value = 22;
    vib.connect(vibG);
    vibG.connect(osc.frequency);
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = 4;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    osc.connect(filter); filter.connect(g); g.connect(this.master);
    osc.start(t0); vib.start(t0);
    osc.stop(t0 + 0.6); vib.stop(t0 + 0.6);
  }

  /** Довольное мурчание. */
  purr() {
    if (!this.ctx || !this.enabled) return;
    this.resume();
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      this._tone(55 + i * 2, 0.12, "sawtooth", 0.12, null, i * 0.12);
    }
  }

  /** Короткий приятный «бип» (поймал, выбор и т.п.). */
  blip(freq = 660) {
    if (!this.ctx || !this.enabled) return;
    this.resume();
    this._tone(freq, 0.12, "triangle", 0.25);
    this._tone(freq * 1.5, 0.1, "triangle", 0.15, null, 0.04);
  }

  pop() {
    if (!this.ctx || !this.enabled) return;
    this.resume();
    this._tone(220, 0.08, "square", 0.2);
  }

  /** Весёлая зацикленная мелодия для режима охоты. */
  startHuntMusic() {
    if (!this.ctx || !this.enabled || this.musicTimer) return;
    this.resume();
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.linearRampToValueAtTime(0.22, this.ctx.currentTime + 0.4);
    // Мажорная задорная гамма
    const melody = [523, 659, 784, 659, 587, 784, 880, 784, 523, 659, 784, 1046, 880, 784, 659, 587];
    const bass = [131, 131, 196, 196, 147, 147, 175, 175];
    this.musicStep = 0;
    const tick = () => {
      const step = this.musicStep;
      const note = melody[step % melody.length];
      this._tone(note, 0.16, "square", 0.18, this.musicGain);
      this._tone(note * 2, 0.1, "triangle", 0.06, this.musicGain, 0.02);
      if (step % 2 === 0) {
        this._tone(bass[(step / 2) % bass.length], 0.22, "sawtooth", 0.14, this.musicGain);
      }
      this.musicStep++;
    };
    tick();
    this.musicTimer = setInterval(tick, 180);
  }

  stopHuntMusic() {
    if (!this.musicTimer) return;
    clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3);
    }
  }
}

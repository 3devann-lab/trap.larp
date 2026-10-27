// Music playlist with an optional Web Audio analyser for visualizers and beat pulsing.
import { sameOrigin } from './util.js';

export class Player {
  constructor() {
    this.tracks = [];
    this.order = [];
    this.pos = 0;
    this.opts = {};
    this.listeners = new Set();
    this.started = false;
    this.volume = 0.4;
    this.muted = false;
    // Two elements: same-site files go through the analyser; remote files can't (they'd go silent
    // without CORS headers), so they play on a plain element.
    this.elA = new Audio();
    this.elA.crossOrigin = 'anonymous';
    this.elB = new Audio();
    for (const el of [this.elA, this.elB]) {
      el.preload = 'metadata';
      el.addEventListener('ended', () => this.onEnded());
      el.addEventListener('timeupdate', () => this.emit());
      el.addEventListener('play', () => this.emit());
      el.addEventListener('pause', () => this.emit());
      el.addEventListener('loadedmetadata', () => this.emit());
      el.addEventListener('error', () => { if (this.started && this.tracks.length > 1) setTimeout(() => this.next(), 400); });
    }
    this.ctx = null;
    this.analyser = null;
    this.freq = null;
    this.wave = null;
    this.beat = 0;
  }

  get el() { return this.current && sameOrigin(this.current.url) ? this.elA : this.elB; }
  get current() { return this.tracks[this.order[this.pos]] || null; }
  get playing() { return !this.el.paused && !this.el.ended; }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }

  configure(tracks, opts) {
    const list = (tracks || []).filter((t) => t && t.url);
    const sig = JSON.stringify(list.map((t) => t.url));
    this.opts = opts;
    if (!this.started) this.volume = (opts.volume ?? 40) / 100;
    for (const el of [this.elA, this.elB]) el.volume = this.muted ? 0 : this.volume;
    if (sig === this.sig) {
      this.tracks = list; // titles/covers may have changed
      this.emit();
      return;
    }
    const wasPlaying = this.started && this.playing;
    this.sig = sig;
    this.tracks = list;
    this.order = list.map((_, i) => i);
    if (opts.shuffle) this.shuffle(true);
    this.pos = 0;
    this.load();
    if (wasPlaying) this.play();
    this.emit();
  }

  shuffle(silent) {
    for (let i = this.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.order[i], this.order[j]] = [this.order[j], this.order[i]];
    }
    if (!silent) this.emit();
  }

  load() {
    for (const el of [this.elA, this.elB]) { el.pause(); }
    const t = this.current;
    if (!t) return;
    const el = this.el;
    el.src = t.url;
    el.loop = this.opts.repeat === 'one';
  }

  ensureGraph() {
    if (this.ctx || !window.AudioContext) return;
    try {
      this.ctx = new AudioContext();
      const src = this.ctx.createMediaElementSource(this.elA);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      src.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      this.freq = new Uint8Array(this.analyser.frequencyBinCount);
      this.wave = new Uint8Array(this.analyser.fftSize);
    } catch {
      this.ctx = null;
    }
  }

  // Called after the visitor clicks "enter" (browsers block autoplay before that).
  start() {
    if (this.started) return;
    this.started = true;
    this.ensureGraph();
    if (this.opts.autoplay !== false && this.tracks.length) this.play(this.opts.fadeIn !== false);
  }

  async play(fade) {
    if (!this.current) return;
    this.ensureGraph();
    this.ctx?.resume?.();
    const el = this.el;
    if (!el.src) this.load();
    if (fade && !this.muted) {
      el.volume = 0;
      this.fadeTo(this.volume, 1600);
    } else {
      el.volume = this.muted ? 0 : this.volume;
    }
    try { await el.play(); } catch { /* blocked until next click */ }
    this.emit();
  }

  fadeTo(target, ms) {
    const el = this.el;
    const from = el.volume;
    const t0 = performance.now();
    cancelAnimationFrame(this.fadeRaf);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      el.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k < 1) this.fadeRaf = requestAnimationFrame(step);
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  pause() { this.el.pause(); this.emit(); }
  toggle() { if (this.playing) this.pause(); else this.play(); }

  next() {
    if (!this.tracks.length) return;
    this.pos = (this.pos + 1) % this.order.length;
    if (this.pos === 0 && this.opts.shuffle) this.shuffle(true);
    this.load();
    this.play();
  }

  prev() {
    if (!this.tracks.length) return;
    if (this.el.currentTime > 3) { this.el.currentTime = 0; return; }
    this.pos = (this.pos - 1 + this.order.length) % this.order.length;
    this.load();
    this.play();
  }

  onEnded() {
    if (this.opts.repeat === 'one') return;
    if (this.opts.repeat === 'none' && this.pos === this.order.length - 1) { this.emit(); return; }
    this.next();
  }

  seek(fraction) {
    const el = this.el;
    if (Number.isFinite(el.duration)) el.currentTime = fraction * el.duration;
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.muted = this.volume === 0;
    cancelAnimationFrame(this.fadeRaf);
    for (const el of [this.elA, this.elB]) el.volume = this.volume;
    this.emit();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (!this.muted && this.volume === 0) this.volume = 0.4;
    for (const el of [this.elA, this.elB]) el.volume = this.muted ? 0 : this.volume;
    this.emit();
  }

  // Sample the analyser once per frame. Returns null when there's nothing to analyse.
  sample() {
    if (!this.analyser || this.el !== this.elA || this.elA.paused) {
      this.beat *= 0.9;
      return null;
    }
    this.analyser.getByteFrequencyData(this.freq);
    this.analyser.getByteTimeDomainData(this.wave);
    let bass = 0;
    for (let i = 0; i < 8; i++) bass += this.freq[i];
    bass /= 8 * 255;
    this.beat = Math.max(bass ** 2.2, this.beat * 0.88);
    return { freq: this.freq, wave: this.wave, beat: this.beat };
  }
}

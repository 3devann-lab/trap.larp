// Music playlist with an optional Web Audio analyser for visualizers and beat pulsing.
// YouTube links play through a hidden YouTube embed instead of an <audio> element.
import { sameOrigin, youtubeId } from './util.js';

const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_BUFFERING = 3;

let ytApi = null;
function loadYouTubeApi() {
  ytApi ||= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { ytApi = null; reject(new Error('YouTube unavailable')); };
    document.head.append(s);
  });
  return ytApi;
}

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
    this.level = 0.4;
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
      el.addEventListener('error', () => this.onError());
    }
    this.yt = null;
    this.ytReady = null;
    this.ytId = null;
    this.ytCued = false;
    this.ytState = -1;
    this.ytTimer = null;
    this.ctx = null;
    this.analyser = null;
    this.freq = null;
    this.wave = null;
    this.beat = 0;
  }

  get el() { return this.current && sameOrigin(this.current.url) ? this.elA : this.elB; }
  get current() { return this.tracks[this.order[this.pos]] || null; }
  get currentYt() { return this.current ? youtubeId(this.current.url) : null; }
  get playing() {
    if (this.currentYt) return this.ytState === YT_PLAYING || this.ytState === YT_BUFFERING;
    return !this.el.paused && !this.el.ended;
  }
  get currentTime() { return this.currentYt ? this.yt?.getCurrentTime() || 0 : this.el.currentTime; }
  get duration() { return this.currentYt ? this.yt?.getDuration() || NaN : this.el.duration; }

  // Title, artist and cover for the current track; YouTube fills in whatever was left blank.
  get meta() {
    const t = this.current || {};
    const id = this.currentYt;
    const video = id && id === this.ytId ? this.yt?.getVideoData?.() : null;
    return {
      title: t.title || video?.title || '',
      artist: t.artist || video?.author || '',
      cover: t.cover || (id ? `https://i.ytimg.com/vi/${id}/mqdefault.jpg` : ''),
    };
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }

  configure(tracks, opts) {
    const list = (tracks || []).filter((t) => t && t.url);
    const sig = JSON.stringify(list.map((t) => t.url));
    this.opts = opts;
    if (!this.started) this.volume = (opts.volume ?? 40) / 100;
    this.setLevel(this.muted ? 0 : this.volume);
    // Get the YouTube player ready before the visitor clicks enter, so playback starts right away.
    if (list.some((t) => youtubeId(t.url))) this.ensureYouTube();
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

  // The embed sits off-screen; browsers keep playing audio from it.
  ensureYouTube() {
    this.ytReady ||= loadYouTubeApi().then((YT) => new Promise((resolve) => {
      const host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:-400px;bottom:0;width:200px;height:200px;opacity:0;pointer-events:none';
      const mount = document.createElement('div');
      host.append(mount);
      document.body.append(host);
      const yt = new YT.Player(mount, {
        width: 200,
        height: 200,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, iv_load_policy: 3, playsinline: 1, rel: 0, origin: location.origin },
        events: {
          onReady: () => {
            this.yt = yt;
            yt.setVolume(Math.round(this.level * 100));
            resolve(yt);
          },
          onStateChange: (e) => this.onYtState(e.data),
          onError: () => { if (this.currentYt) this.onError(); },
        },
      });
    })).catch(() => null);
    return this.ytReady;
  }

  load() {
    for (const el of [this.elA, this.elB]) { el.pause(); }
    if (this.ytId) this.yt?.pauseVideo();
    const t = this.current;
    if (!t) return;
    const id = youtubeId(t.url);
    if (id) {
      this.ensureYouTube().then((yt) => {
        if (!yt || this.currentYt !== id || this.ytId === id) return;
        this.ytId = id;
        this.ytCued = true;
        yt.cueVideoById(id);
      });
      return;
    }
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
    const fadeIn = fade && !this.muted;
    this.setLevel(fadeIn ? 0 : this.muted ? 0 : this.volume);
    const id = this.currentYt;
    if (id) {
      const yt = await this.ensureYouTube();
      if (!yt || this.currentYt !== id) return;
      // YouTube buffers before it makes a sound, so the fade waits until it's actually playing.
      this.fadeOnPlay = fadeIn;
      yt.unMute();
      // A cued video ignores playVideo() sent right after cueing, so it's loaded instead.
      if (this.ytId === id && !this.ytCued) yt.playVideo();
      else { this.ytId = id; this.ytCued = false; yt.loadVideoById(id); }
    } else {
      const el = this.el;
      if (!el.src) this.load();
      if (fadeIn) this.fadeTo(this.volume, 1600);
      try { await el.play(); } catch { /* blocked until next click */ }
    }
    this.emit();
  }

  // Output level of every backend (0–1); `volume` is the level the visitor chose.
  setLevel(v) {
    this.level = v;
    for (const el of [this.elA, this.elB]) el.volume = v;
    this.yt?.setVolume(Math.round(v * 100));
  }

  fadeTo(target, ms) {
    const from = this.level;
    const t0 = performance.now();
    cancelAnimationFrame(this.fadeRaf);
    const step = (now) => {
      const k = Math.min(1, (now - t0) / ms);
      this.setLevel(Math.max(0, Math.min(1, from + (target - from) * k)));
      if (k < 1) this.fadeRaf = requestAnimationFrame(step);
    };
    this.fadeRaf = requestAnimationFrame(step);
  }

  pause() {
    if (this.currentYt) this.yt?.pauseVideo();
    else this.el.pause();
    this.emit();
  }

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
    if (this.currentTime > 3) { this.seekTo(0); return; }
    this.pos = (this.pos - 1 + this.order.length) % this.order.length;
    this.load();
    this.play();
  }

  onEnded() {
    if (this.opts.repeat === 'one') return;
    if (this.opts.repeat === 'none' && this.pos === this.order.length - 1) { this.emit(); return; }
    this.next();
  }

  onError() {
    if (this.started && this.tracks.length > 1) setTimeout(() => this.next(), 400);
  }

  onYtState(state) {
    this.ytState = state;
    // The embed has no timeupdate event, so poll for the progress bar while it plays.
    clearInterval(this.ytTimer);
    if (state === YT_PLAYING) this.ytTimer = setInterval(() => this.emit(), 250);
    if (state === YT_PLAYING && this.fadeOnPlay) {
      this.fadeOnPlay = false;
      this.fadeTo(this.volume, 1600);
    }
    if (state === YT_ENDED && this.currentYt) {
      if (this.opts.repeat === 'one') { this.yt.seekTo(0, true); this.yt.playVideo(); } else this.onEnded();
    }
    this.emit();
  }

  seekTo(seconds) {
    if (this.currentYt) this.yt?.seekTo(seconds, true);
    else this.el.currentTime = seconds;
  }

  seek(fraction) {
    if (Number.isFinite(this.duration)) this.seekTo(fraction * this.duration);
  }

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.muted = this.volume === 0;
    cancelAnimationFrame(this.fadeRaf);
    this.setLevel(this.volume);
    this.emit();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (!this.muted && this.volume === 0) this.volume = 0.4;
    this.setLevel(this.muted ? 0 : this.volume);
    this.emit();
  }

  // Sample the analyser once per frame. Returns null when there's nothing to analyse
  // (YouTube audio can't be read by the page).
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

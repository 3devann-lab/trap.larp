// Canvas effects: background particles, cursor trails and click bursts.
import { hexToRgb, rgba } from './util.js';

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const TAU = Math.PI * 2;

const mouse = { x: -9999, y: -9999, active: false };
window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; }, { passive: true });
document.addEventListener('pointerleave', () => { mouse.active = false; mouse.x = mouse.y = -9999; });

function fitCanvas(canvas, dpr = DPR()) {
  const w = window.innerWidth;
  const hh = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(hh * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = hh + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h: hh };
}

// Pre-rendered soft glow sprite (much cheaper than shadowBlur every frame).
const spriteCache = new Map();
function glowSprite(color, size = 64) {
  const key = color + size;
  if (spriteCache.has(key)) return spriteCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const [r, gg, b] = hexToRgb(color);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grad.addColorStop(0.25, `rgba(${r},${gg},${b},.65)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  spriteCache.set(key, c);
  return c;
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.closePath();
}

function starPath(ctx, x, y, r, points = 5, inset = 0.5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inset;
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

const CONFETTI = ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#facc15'];
const LEAVES = ['#d97706', '#b45309', '#dc2626', '#ca8a04', '#ea580c', '#a16207'];
// Particles that drift a fraction of a pixel per frame look the same at 30 fps, at half the cost.
const SLOW_TYPES = new Set(['stars', 'fireflies', 'orbs', 'network', 'bubbles']);
const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン0123456789ABCDEF<>/{}*+-=';

// ---------- background particles ----------
// Lite mode (weak devices) draws at 1x pixel density, about 30 fps and with fewer particles.
// Without it, the loop watches its own frame times and switches to lite if they stay slow.
export class Particles {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.o = opts;
    this.parts = [];
    this.running = true;
    this.lite = Boolean(opts.lite);
    this.slow = 0;
    this.born = performance.now();
    this.img = null;
    if (opts.type === 'image' && opts.image) {
      this.img = new Image();
      this.img.src = opts.image;
    }
    this.emoji = String(opts.emoji || '✨').split(/\s+/).filter(Boolean);
    this.resize = this.resize.bind(this);
    window.addEventListener('resize', this.resize);
    this.resize();
    this.last = performance.now();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  resize() {
    const { ctx, w, h } = fitCanvas(this.canvas, this.lite ? 1 : DPR());
    Object.assign(this, { ctx, w, h });
    this.init();
  }

  goLite() {
    if (this.lite) return;
    this.lite = true;
    this.resize();
    this.o.onLite?.();
  }

  // Frames keep coming in late (under ~40 fps, or under ~20 for types that already draw at 30):
  // switch to lite. The first moments after loading are ignored, and a short hiccup isn't enough.
  watch(now, elapsed) {
    if (this.lite || !this.o.adaptive || now - this.born < 1500) return;
    this.slow = this.slow * 0.95 + (elapsed > (SLOW_TYPES.has(this.o.type) ? 50 : 25) ? 0.05 : 0);
    if (this.slow > 0.5) this.goLite();
  }

  get speed() { return (this.o.speed / 50) || 1; }
  get scale() { return (this.o.size / 50) || 1; }

  count() {
    const area = (this.w * this.h) / (1280 * 720);
    const base = { snow: 140, rain: 220, stars: 180, shooting: 160, fireflies: 45, bubbles: 40, hearts: 35, sakura: 45, leaves: 35, confetti: 110, embers: 90, network: 80, orbs: 18, emoji: 30, image: 30 }[this.o.type] || 60;
    return Math.max(4, Math.round(base * (this.o.density / 50) * Math.min(1.6, Math.max(0.35, area)) * (this.lite ? 0.6 : 1)));
  }

  init() {
    this.parts = [];
    if (this.o.type === 'matrix') {
      this.font = Math.round(16 * this.scale);
      const cols = Math.ceil(this.w / this.font);
      for (let i = 0; i < cols; i++) {
        if (Math.random() > this.o.density / 100 + 0.15) continue;
        this.parts.push({ x: i * this.font, y: rand(-this.h, this.h), v: rand(4, 11), len: Math.floor(rand(8, 26)), chars: [] });
      }
      return;
    }
    const n = this.count();
    for (let i = 0; i < n; i++) this.parts.push(this.spawn(true));
  }

  spawn(initial) {
    const { w, h } = this;
    const s = this.scale;
    const sp = this.speed;
    const t = this.o.type;
    const y0 = initial ? rand(0, h) : -20;
    switch (t) {
      case 'snow': return { x: rand(0, w), y: y0, r: rand(0.8, 3.2) * s, vy: rand(0.4, 1.3) * sp, sway: rand(0, TAU), a: rand(0.4, 1) };
      case 'rain': return { x: rand(0, w * 1.2), y: initial ? rand(0, h) : rand(-h * 0.3, 0), l: rand(10, 24) * s, vy: rand(9, 16) * sp, a: rand(0.15, 0.5) };
      case 'stars':
      case 'shooting': return { x: rand(0, w), y: rand(0, h), r: rand(0.3, 1.6) * s, tw: rand(0, TAU), ts: rand(0.01, 0.05), a: rand(0.3, 1), vx: rand(-0.05, 0.05) * sp };
      case 'fireflies': return { x: rand(0, w), y: rand(0, h), r: rand(2, 5) * s, ang: rand(0, TAU), v: rand(0.2, 0.7) * sp, tw: rand(0, TAU) };
      case 'bubbles': return { x: rand(0, w), y: initial ? rand(0, h) : h + 30, r: rand(4, 16) * s, vy: rand(0.3, 1.1) * sp, sway: rand(0, TAU), a: rand(0.25, 0.6) };
      case 'hearts': return { x: rand(0, w), y: initial ? rand(0, h) : h + 30, r: rand(8, 18) * s, vy: rand(0.4, 1.1) * sp, sway: rand(0, TAU), a: rand(0.35, 0.85), rot: rand(-0.3, 0.3) };
      case 'sakura':
      case 'leaves': return { x: rand(-50, w), y: y0, r: rand(5, 11) * s, vy: rand(0.5, 1.4) * sp, vx: rand(0.2, 1) * sp, rot: rand(0, TAU), vr: rand(-0.03, 0.03), flip: rand(0, TAU), c: t === 'leaves' ? pick(LEAVES) : null, a: rand(0.6, 1) };
      case 'confetti': return { x: rand(0, w), y: y0, wdt: rand(5, 10) * s, hgt: rand(8, 16) * s, vy: rand(1, 2.6) * sp, vx: rand(-0.6, 0.6), rot: rand(0, TAU), vr: rand(-0.08, 0.08), flip: rand(0, TAU), c: pick(CONFETTI) };
      case 'embers': return { x: rand(0, w), y: initial ? rand(0, h) : h + 10, r: rand(1, 3.2) * s, vy: rand(0.5, 1.8) * sp, vx: rand(-0.3, 0.3), life: rand(0.5, 1), tw: rand(0, TAU) };
      case 'network': return { x: rand(0, w), y: rand(0, h), vx: rand(-0.4, 0.4) * sp, vy: rand(-0.4, 0.4) * sp, r: rand(1, 2.4) * s };
      case 'orbs': return { x: rand(0, w), y: rand(0, h), r: rand(40, 140) * s, vx: rand(-0.25, 0.25) * sp, vy: rand(-0.25, 0.25) * sp, a: rand(0.05, 0.18), tw: rand(0, TAU) };
      case 'emoji':
      case 'image': return { x: rand(0, w), y: y0, r: rand(14, 30) * s, vy: rand(0.5, 1.5) * sp, sway: rand(0, TAU), rot: rand(0, TAU), vr: rand(-0.02, 0.02), e: pick(this.emoji), a: rand(0.6, 1) };
      default: return { x: 0, y: 0 };
    }
  }

  repel(p, strength = 1) {
    if (!this.o.interactive || !mouse.active) return;
    const dx = p.x - mouse.x;
    const dy = p.y - mouse.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 110 * 110 && d2 > 1) {
      const d = Math.sqrt(d2);
      const f = ((110 - d) / 110) * 2.2 * strength;
      p.x += (dx / d) * f;
      p.y += (dy / d) * f;
    }
  }

  loop(now) {
    if (!this.running) return;
    requestAnimationFrame(this.loop);
    const elapsed = now - this.last;
    if ((this.lite || SLOW_TYPES.has(this.o.type)) && elapsed < 30) return;
    this.watch(now, elapsed);
    const dt = Math.min(3, elapsed / 16.67);
    this.last = now;
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    const color = this.o.color || '#ffffff';
    const alpha = (this.o.opacity ?? 80) / 100;
    const t = this.o.type;

    if (t === 'matrix') {
      ctx.font = `${this.font}px monospace`;
      ctx.textBaseline = 'top';
      const [r, g, b] = hexToRgb(color);
      for (const col of this.parts) {
        col.y += col.v * this.speed * dt * 0.6;
        if (col.y - col.len * this.font > h) { col.y = rand(-200, 0); col.len = Math.floor(rand(8, 26)); }
        const headRow = Math.floor(col.y / this.font);
        for (let i = 0; i < col.len; i++) {
          const row = headRow - i;
          if (row < 0) continue;
          if (!col.chars[row % 64] || Math.random() < 0.02) col.chars[row % 64] = pick(MATRIX_CHARS);
          const fade = 1 - i / col.len;
          ctx.fillStyle = i === 0 ? `rgba(255,255,255,${alpha})` : `rgba(${r},${g},${b},${fade * alpha})`;
          ctx.fillText(col.chars[row % 64], col.x, row * this.font);
        }
      }
      return;
    }

    if (t === 'network') {
      const pts = this.parts;
      const max = 130;
      ctx.lineWidth = 1;
      for (const p of pts) {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      const [r, g, b] = hexToRgb(color);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const bb = pts[j];
          const dx = a.x - bb.x; const dy = a.y - bb.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < max * max) {
            ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - Math.sqrt(d2) / max) * 0.45 * alpha})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(bb.x, bb.y); ctx.stroke();
          }
        }
        if (this.o.interactive && mouse.active) {
          const dx = a.x - mouse.x; const dy = a.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 180 * 180) {
            ctx.strokeStyle = `rgba(${r},${g},${b},${(1 - Math.sqrt(d2) / 180) * 0.7 * alpha})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, TAU); ctx.fill();
      }
      return;
    }

    const sprite = glowSprite(color);
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      switch (t) {
        case 'snow':
          p.sway += 0.01 * dt; p.y += p.vy * dt; p.x += Math.sin(p.sway) * 0.4 * dt;
          this.repel(p);
          ctx.fillStyle = rgba(color, p.a * alpha);
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
          if (p.y > h + 10) this.parts[i] = this.spawn(false);
          break;
        case 'rain':
          p.y += p.vy * dt; p.x -= p.vy * 0.15 * dt;
          ctx.strokeStyle = rgba(color, p.a * alpha); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + p.l * 0.15, p.y - p.l); ctx.stroke();
          if (p.y > h + 30) this.parts[i] = this.spawn(false);
          break;
        case 'stars':
        case 'shooting':
          p.tw += p.ts * dt; p.x += p.vx * dt;
          if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
          ctx.globalAlpha = Math.max(0, p.a * (0.55 + 0.45 * Math.sin(p.tw))) * alpha;
          ctx.drawImage(sprite, p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6);
          ctx.globalAlpha = 1;
          break;
        case 'fireflies':
          p.ang += rand(-0.15, 0.15) * dt; p.tw += 0.03 * dt;
          p.x += Math.cos(p.ang) * p.v * dt; p.y += Math.sin(p.ang) * p.v * dt;
          this.repel(p, 0.6);
          if (p.x < -20) p.x = w + 20; if (p.x > w + 20) p.x = -20; if (p.y < -20) p.y = h + 20; if (p.y > h + 20) p.y = -20;
          ctx.globalAlpha = (0.35 + 0.65 * Math.abs(Math.sin(p.tw))) * alpha;
          ctx.drawImage(sprite, p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6);
          ctx.globalAlpha = 1;
          break;
        case 'bubbles':
          p.sway += 0.02 * dt; p.y -= p.vy * dt; p.x += Math.sin(p.sway) * 0.5 * dt;
          this.repel(p);
          ctx.strokeStyle = rgba(color, p.a * alpha); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
          ctx.fillStyle = rgba(color, p.a * 0.25 * alpha);
          ctx.beginPath(); ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.22, 0, TAU); ctx.fill();
          if (p.y < -30) this.parts[i] = this.spawn(false);
          break;
        case 'hearts':
          p.sway += 0.02 * dt; p.y -= p.vy * dt; p.x += Math.sin(p.sway) * 0.6 * dt;
          this.repel(p);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(p.sway) * 0.2);
          ctx.fillStyle = rgba(color, p.a * alpha); heartPath(ctx, 0, -p.r / 2, p.r); ctx.fill(); ctx.restore();
          if (p.y < -30) this.parts[i] = this.spawn(false);
          break;
        case 'sakura':
        case 'leaves':
          p.y += p.vy * dt; p.x += (p.vx + Math.sin(p.flip) * 0.4) * dt; p.rot += p.vr * dt; p.flip += 0.03 * dt;
          this.repel(p);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.abs(Math.cos(p.flip)) * 0.8 + 0.2);
          ctx.fillStyle = rgba(p.c || color, p.a * alpha);
          ctx.beginPath();
          if (t === 'sakura') { ctx.ellipse(0, 0, p.r, p.r * 0.6, 0, 0, TAU); } else { ctx.moveTo(0, -p.r); ctx.quadraticCurveTo(p.r, 0, 0, p.r); ctx.quadraticCurveTo(-p.r, 0, 0, -p.r); }
          ctx.fill(); ctx.restore();
          if (p.y > h + 20 || p.x > w + 40) this.parts[i] = this.spawn(false);
          break;
        case 'confetti':
          p.y += p.vy * dt; p.x += p.vx * dt; p.rot += p.vr * dt; p.flip += 0.08 * dt;
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(1, Math.cos(p.flip));
          ctx.globalAlpha = alpha; ctx.fillStyle = p.c; ctx.fillRect(-p.wdt / 2, -p.hgt / 2, p.wdt, p.hgt); ctx.restore();
          if (p.y > h + 20) this.parts[i] = this.spawn(false);
          break;
        case 'embers':
          p.y -= p.vy * dt; p.x += (p.vx + Math.sin(p.tw) * 0.3) * dt; p.tw += 0.05 * dt; p.life -= 0.0012 * dt;
          ctx.globalAlpha = Math.max(0, p.life) * (0.6 + 0.4 * Math.sin(p.tw * 3)) * alpha;
          ctx.drawImage(sprite, p.x - p.r * 3, p.y - p.r * 3, p.r * 6, p.r * 6);
          ctx.globalAlpha = 1;
          if (p.y < -20 || p.life <= 0) this.parts[i] = this.spawn(false);
          break;
        case 'orbs':
          p.x += p.vx * dt; p.y += p.vy * dt; p.tw += 0.008 * dt;
          if (p.x < -p.r) p.x = w + p.r; if (p.x > w + p.r) p.x = -p.r; if (p.y < -p.r) p.y = h + p.r; if (p.y > h + p.r) p.y = -p.r;
          ctx.globalAlpha = p.a * (0.7 + 0.3 * Math.sin(p.tw)) * alpha * 1.6;
          ctx.drawImage(sprite, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          ctx.globalAlpha = 1;
          break;
        case 'emoji':
        case 'image':
          p.sway += 0.015 * dt; p.y += p.vy * dt; p.x += Math.sin(p.sway) * 0.5 * dt; p.rot += p.vr * dt;
          this.repel(p);
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.globalAlpha = p.a * alpha;
          if (t === 'emoji') {
            ctx.font = `${p.r}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(p.e, 0, 0);
          } else if (this.img?.complete && this.img.naturalWidth) {
            const ratio = this.img.naturalHeight / this.img.naturalWidth;
            ctx.drawImage(this.img, -p.r / 2, (-p.r * ratio) / 2, p.r, p.r * ratio);
          }
          ctx.restore();
          if (p.y > h + 40) this.parts[i] = this.spawn(false);
          break;
        default: break;
      }
    }

    // Occasional shooting stars.
    if (t === 'shooting') {
      this.meteors ||= [];
      if (Math.random() < 0.006 * this.speed * dt) this.meteors.push({ x: rand(w * 0.2, w), y: rand(0, h * 0.4), v: rand(9, 15) * this.speed, l: rand(80, 180), life: 1 });
      for (const m of this.meteors) {
        m.x -= m.v * dt; m.y += m.v * 0.45 * dt; m.life -= 0.012 * dt;
        const grad = ctx.createLinearGradient(m.x, m.y, m.x + m.l, m.y - m.l * 0.45);
        grad.addColorStop(0, rgba(color, Math.max(0, m.life) * alpha));
        grad.addColorStop(1, rgba(color, 0));
        ctx.strokeStyle = grad; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(m.x + m.l, m.y - m.l * 0.45); ctx.stroke();
      }
      this.meteors = this.meteors.filter((m) => m.life > 0);
    }
  }

  destroy() {
    this.running = false;
    window.removeEventListener('resize', this.resize);
  }
}

// ---------- cursor trails + click bursts (one canvas on top of everything) ----------
// The loop only runs while something is on screen: even an empty full-screen canvas costs a
// repaint every frame it's cleared.
export class CursorFx {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.o = opts;
    this.parts = [];
    this.points = [];
    this.snake = Array.from({ length: 18 }, () => ({ x: -100, y: -100 }));
    this.hue = 0;
    this.running = true;
    this.emoji = String(opts.trailEmoji || '✨').split(/\s+/).filter(Boolean);
    this.resize = () => Object.assign(this, fitCanvas(this.canvas));
    this.onMove = this.onMove.bind(this);
    this.onClick = this.onClick.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerdown', this.onClick, { passive: true });
    this.resize();
    this.awake = false;
    this.loop = this.loop.bind(this);
  }

  get size() { return (this.o.trailSize || 50) / 50; }

  wake() {
    if (this.awake || !this.running) return;
    this.awake = true;
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  onMove(e) {
    const { trail } = this.o;
    if (!trail || trail === 'none' || e.pointerType === 'touch') return;
    const x = e.clientX; const y = e.clientY;
    this.points.push({ x, y, t: performance.now() });
    if (this.points.length > 40) this.points.shift();
    const s = this.size;
    const c = this.o.trailColor || '#ffffff';
    if (trail === 'sparkle' && Math.random() < 0.7) this.parts.push({ k: 'star4', x, y, vx: rand(-0.6, 0.6), vy: rand(-0.4, 0.9), r: rand(3, 7) * s, life: 1, decay: rand(0.015, 0.03), c, rot: rand(0, TAU) });
    if (trail === 'fairy') for (let i = 0; i < 2; i++) this.parts.push({ k: 'dot', x, y, vx: rand(-1, 1), vy: rand(-0.5, 1.5), r: rand(1, 2.6) * s, life: 1, decay: rand(0.012, 0.025), c: `hsl(${rand(0, 360)},100%,75%)`, g: 0.05 });
    if (trail === 'bubbles' && Math.random() < 0.5) this.parts.push({ k: 'ring', x, y, vx: rand(-0.3, 0.3), vy: rand(-1.2, -0.4), r: rand(3, 8) * s, life: 1, decay: 0.015, c });
    if (trail === 'stars' && Math.random() < 0.5) this.parts.push({ k: 'star5', x, y, vx: rand(-0.8, 0.8), vy: rand(0, 1.2), r: rand(4, 8) * s, life: 1, decay: 0.02, c, rot: rand(0, TAU), vr: rand(-0.1, 0.1) });
    if (trail === 'emoji' && Math.random() < 0.35) this.parts.push({ k: 'emoji', x, y, vx: rand(-0.5, 0.5), vy: rand(0.2, 1), r: rand(14, 22) * s, life: 1, decay: 0.02, e: pick(this.emoji) });
    this.wake();
  }

  onClick(e) {
    const { click } = this.o;
    const x = e.clientX; const y = e.clientY;
    const c = this.o.clickColor || '#ffffff';
    if (click === 'burst') {
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + rand(-0.2, 0.2);
        const v = rand(2, 5);
        this.parts.push({ k: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(1.5, 3.2), life: 1, decay: rand(0.02, 0.035), c, g: 0.06, f: 0.95 });
      }
    } else if (click === 'hearts') {
      for (let i = 0; i < 7; i++) this.parts.push({ k: 'heart', x, y, vx: rand(-1.6, 1.6), vy: rand(-3.2, -1.2), r: rand(8, 15), life: 1, decay: 0.018, c, g: 0.04 });
    }
    this.wake();
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min(3, (now - this.last) / 16.67);
    this.last = now;
    const { ctx, w, h } = this;
    ctx.clearRect(0, 0, w, h);
    const trail = this.o.trail;
    const c = this.o.trailColor || '#ffffff';

    // Path-style trails drawn from recent pointer positions.
    const fresh = this.points.filter((p) => now - p.t < 420);
    this.points = fresh;
    if ((trail === 'line' || trail === 'rainbow') && fresh.length > 1) {
      this.hue = (this.hue + 2 * dt) % 360;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < fresh.length; i++) {
        const a = fresh[i - 1]; const b = fresh[i];
        const k = i / fresh.length;
        ctx.strokeStyle = trail === 'rainbow' ? `hsla(${(this.hue + i * 8) % 360},100%,65%,${k})` : rgba(c, k);
        ctx.lineWidth = k * 5 * this.size + 0.5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    if (trail === 'ghost') {
      fresh.forEach((p, i) => {
        const k = (i + 1) / fresh.length;
        ctx.fillStyle = rgba(c, k * 0.5);
        ctx.beginPath(); ctx.arc(p.x, p.y, k * 7 * this.size, 0, TAU); ctx.fill();
      });
    }
    let snakeMoving = false;
    if (trail === 'snake' && mouse.active) {
      let lead = { x: mouse.x, y: mouse.y };
      this.snake.forEach((seg, i) => {
        if (Math.abs(lead.x - seg.x) + Math.abs(lead.y - seg.y) > 0.5) snakeMoving = true;
        seg.x += (lead.x - seg.x) * 0.35 * Math.min(dt, 2);
        seg.y += (lead.y - seg.y) * 0.35 * Math.min(dt, 2);
        const k = 1 - i / this.snake.length;
        ctx.fillStyle = rgba(c, k * 0.9);
        ctx.beginPath(); ctx.arc(seg.x, seg.y, Math.max(0.5, k * 6 * this.size), 0, TAU); ctx.fill();
        lead = seg;
      });
    }

    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.g) p.vy += p.g * dt;
      if (p.f) { p.vx *= p.f; p.vy *= p.f; }
      if (p.vr) p.rot += p.vr * dt;
      p.life -= p.decay * dt;
      const a = Math.max(0, p.life);
      ctx.save();
      ctx.globalAlpha = a;
      if (p.k === 'dot') { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
      else if (p.k === 'ring') { ctx.strokeStyle = p.c; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke(); }
      else if (p.k === 'star4') { ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; starPath(ctx, 0, 0, p.r * a + 1, 4, 0.3); ctx.fill(); }
      else if (p.k === 'star5') { ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; starPath(ctx, 0, 0, p.r, 5, 0.45); ctx.fill(); }
      else if (p.k === 'heart') { ctx.fillStyle = p.c; heartPath(ctx, p.x, p.y - p.r / 2, p.r); ctx.fill(); }
      else if (p.k === 'emoji') { ctx.font = `${p.r}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.fillText(p.e, p.x, p.y); }
      ctx.restore();
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
    // Nothing left to draw: this frame cleared the canvas, so stop until the next move or click.
    if (this.parts.length || this.points.length || snakeMoving) requestAnimationFrame(this.loop);
    else this.awake = false;
  }

  destroy() {
    this.running = false;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerdown', this.onClick);
  }
}

// Animated film grain tile as a data URL (generated once).
let grainUrl = null;
export function grainTexture() {
  if (grainUrl) return grainUrl;
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 40;
  }
  g.putImageData(img, 0, 0);
  grainUrl = c.toDataURL('image/png');
  return grainUrl;
}

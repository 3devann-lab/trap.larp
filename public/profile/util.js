// Small DOM + formatting helpers shared by the profile page modules.

export function h(tag, attrs, ...children) {
  const el = tag.includes(':') ? document.createElementNS('http://www.w3.org/2000/svg', tag.split(':')[1]) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'vars') for (const [n, x] of Object.entries(v)) el.style.setProperty(n, x);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// ---------- icons ----------
const store = (window.__TRAP__ && window.__TRAP__.icons) || {};
const pending = new Map();
let timer = null;

function svgFor(ref, data) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ico');
  if (data.t === 'si') {
    svg.setAttribute('fill', 'currentColor');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', data.d);
    svg.append(p);
  } else {
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = data.d;
  }
  svg.dataset.icon = ref;
  return svg;
}

export function addIcons(map) {
  Object.assign(store, map || {});
}

export function icon(ref) {
  if (store[ref]) return svgFor(ref, store[ref]);
  // Not bundled with the page: render a placeholder and fetch it.
  const ph = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ph.setAttribute('viewBox', '0 0 24 24');
  ph.classList.add('ico');
  if (!pending.has(ref)) pending.set(ref, []);
  pending.get(ref).push(ph);
  clearTimeout(timer);
  timer = setTimeout(flushIcons, 30);
  return ph;
}

async function flushIcons() {
  const refs = [...pending.keys()];
  if (!refs.length) return;
  const waiting = new Map(pending);
  pending.clear();
  try {
    const res = await fetch('/api/icons?refs=' + encodeURIComponent(refs.join(',')));
    Object.assign(store, await res.json());
  } catch { /* offline */ }
  for (const [ref, nodes] of waiting) {
    if (!store[ref]) continue;
    for (const n of nodes) if (n.isConnected) n.replaceWith(svgFor(ref, store[ref]));
  }
}

// ---------- text ----------
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function safeUrl(u) {
  const v = String(u || '').trim();
  return /^(https?:\/\/|mailto:|\/(?!\/))/i.test(v) ? v : null;
}

// Tiny, safe markdown: **bold** *italic* __underline__ ~~strike~~ `code` [text](url), Discord emoji, autolinks.
export function md(text) {
  let s = escapeHtml(text);
  s = s.replace(/&lt;(a?):(\w{2,32}):(\d{15,22})&gt;/g, (_, a, name, id) => `<img class="emoji" alt=":${name}:" title=":${name}:" src="https://cdn.discordapp.com/emojis/${id}.${a ? 'gif' : 'webp'}?size=48">`);
  s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+)__/g, '<u>$1</u>');
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
  s = s.replace(/\|\|([^|\n]+)\|\|/g, '<span class="spoiler" tabindex="0">$1</span>');
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, label, url) => {
    const href = safeUrl(url.replace(/&amp;/g, '&'));
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${label}</a>` : m;
  });
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener">${url.replace(/^https?:\/\//, '')}</a>`);
  return s.replace(/\n/g, '<br>');
}

export const stripMd = (text) => String(text || '').replace(/<a?:(\w+):\d+>/g, ':$1:').replace(/\*\*|__|~~|\|\||`/g, '').replace(/\*([^*]+)\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

export function fmtNum(n, compact) {
  const v = Number(n) || 0;
  return compact ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : v.toLocaleString('en-US');
}

export function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

// ---------- color ----------
export function hexToRgb(hex) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [255, 255, 255];
  let v = m[1];
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}

export const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;
export const intToHex = (n) => '#' + ((Number(n) >>> 0) & 0xffffff).toString(16).padStart(6, '0');
export const cssUrl = (u) => `url("${String(u).replace(/["\\\n]/g, (c) => encodeURIComponent(c))}")`;

export const isVideo = (u) => /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(String(u || ''));
export const sameOrigin = (u) => {
  try { return new URL(u, location.href).origin === location.origin; } catch { return false; }
};

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = () => window.matchMedia('(hover: none)').matches;

export function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = h('div', { class: 'toast', role: 'status' });
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

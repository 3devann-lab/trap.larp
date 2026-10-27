// Builds the icon set from simple-icons (brand logos) and lucide-static (UI icons).
// Icons are referenced as "si:<slug>" or "lu:<name>" and rendered client-side.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLATFORMS } from '../shared/platforms.js';
import { BADGE_PRESETS } from '../shared/badges.js';
import { SECTIONS } from '../shared/schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = path.join(ROOT, 'node_modules');

// Lucide icons used by the profile page and dashboard UI.
export const UI_ICONS = [
  'eye', 'map-pin', 'calendar', 'hash', 'play', 'pause', 'skip-forward', 'skip-back', 'volume-2', 'volume-1', 'volume-x',
  'shuffle', 'repeat', 'repeat-1', 'music', 'monitor', 'smartphone', 'globe', 'copy', 'check', 'users', 'clock', 'link',
  'external-link', 'x', 'plus', 'trash-2', 'chevron-up', 'chevron-down', 'grip-vertical', 'upload', 'download', 'save',
  'log-out', 'refresh-cw', 'settings', 'image', 'search', 'circle-alert', 'circle-check', 'info', 'sparkles', 'wand-sparkles',
  'monitor-smartphone', 'mouse-pointer-click', 'gamepad-2', 'disc-3', 'radio', 'headphones', 'eye-off', 'undo-2', 'lock',
  'arrow-up-right', 'list-music', 'shield-check', 'tv', 'laptop', 'tablet-smartphone', 'mail', 'star', 'git-fork', 'book-open',
  'user', 'shuffle', 'timer', 'ellipsis', 'film', 'file-audio', 'type', 'folder-open', 'square-pen', 'menu', 'sun-moon',
];

const brand = new Map();
const lucide = new Map();

function loadBrand(slug) {
  if (brand.has(slug)) return brand.get(slug);
  let d = null;
  try {
    const svg = fs.readFileSync(path.join(NM, 'simple-icons', 'icons', `${slug}.svg`), 'utf8');
    d = svg.match(/ d="([^"]+)"/)?.[1] || null;
  } catch { /* missing icon */ }
  brand.set(slug, d);
  return d;
}

function loadLucide(name) {
  if (lucide.has(name)) return lucide.get(name);
  let inner = null;
  try {
    const svg = fs.readFileSync(path.join(NM, 'lucide-static', 'icons', `${name}.svg`), 'utf8');
    inner = svg.replace(/<!--[\s\S]*?-->/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s*\n\s*/g, '').trim();
  } catch { /* missing icon */ }
  lucide.set(name, inner);
  return inner;
}

export function iconData(ref) {
  const [kind, name] = String(ref).split(':');
  if (kind === 'si') {
    const d = loadBrand(name);
    return d ? { t: 'si', d } : null;
  }
  if (kind === 'lu') {
    const d = loadLucide(name);
    return d ? { t: 'lu', d } : null;
  }
  return null;
}

export function iconSet(refs) {
  const out = {};
  for (const ref of refs) {
    const data = iconData(ref);
    if (data) out[ref] = data;
  }
  return out;
}

let allIcons = null;
export function allIconRefs() {
  if (allIcons) return allIcons;
  const refs = new Set(UI_ICONS.map((n) => `lu:${n}`));
  for (const p of PLATFORMS) refs.add(p.icon);
  for (const b of BADGE_PRESETS) refs.add(b.icon);
  for (const s of SECTIONS) if (s.icon) refs.add(s.icon);
  allIcons = [...refs];
  return allIcons;
}

export function missingIcons() {
  return allIconRefs().filter((r) => !iconData(r));
}

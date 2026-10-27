import { h, icon, md, stripMd, fmtNum, rgba, intToHex, cssUrl, isVideo, reducedMotion, isTouch, toast, copyText, safeUrl } from './util.js';
import { Particles, CursorFx, grainTexture } from './effects.js';
import { Player } from './player.js';
import { LanyardLive, presenceWidget, avatarUrl as discordAvatar, bannerUrl, decorationUrl, badgeIconUrl, clanBadgeUrl, STATUS_COLORS, connectionLinks } from './discord.js';
import { resolveLink, platformById } from '/shared/platforms.js';
import { badgePreset } from '/shared/badges.js';
import { fontStack, fontHref } from '/shared/fonts.js';
import { withDefaults, BLOCKS } from '/shared/schema.js';

const BOOT = window.__TRAP__ || {};
const state = {
  cfg: withDefaults(BOOT.config),
  views: BOOT.views || 0,
  dprofile: BOOT.discord || null,
  dprofileFor: BOOT.discord ? BOOT.config?.discord?.userId : null,
  entered: Boolean(BOOT.preview),
  preview: Boolean(BOOT.preview),
  effects: {},
};
const live = new LanyardLive();
const player = new Player();
const app = document.getElementById('app');
const root = document.documentElement;
let cleanup = [];
let onEnter = [];
const persist = {};

const SLOT_NAMES = ['bg', 'fx', 'stage', 'effect', 'filters', 'viz', 'overlay', 'cursor', 'splash'];
const slots = Object.fromEntries(SLOT_NAMES.map((n) => [n, h('div', { class: `slot slot-${n}` })]));
app.append(...Object.values(slots));

const calm = () => state.cfg.page.reduceMotion && reducedMotion();
const later = (fn) => { if (state.entered) fn(); else onEnter.push(fn); };
const every = (ms, fn) => { const id = setInterval(fn, ms); cleanup.push(() => clearInterval(id)); return id; };

function keep(name, key, build) {
  const prev = persist[name];
  if (prev && prev.key === key) return;
  prev?.destroy?.();
  const made = build() || { el: null };
  persist[name] = { key, ...made };
  slots[name].replaceChildren(...(made.el ? [made.el] : []));
}

// ---------- discord data ----------
const lanyardUser = () => live.data?.discord_user || null;

function discordProfileAvatar() {
  const u = lanyardUser();
  if (u?.id) return discordAvatar(u, 512);
  const p = state.dprofile;
  return p?.id ? discordAvatar({ id: p.id, avatar: p.avatar }, 512) : null;
}

function currentAvatar(cfg) {
  if (cfg.profile.avatarSource === 'none') return null;
  if (cfg.profile.avatarSource === 'discord') return discordProfileAvatar() || cfg.profile.avatar || null;
  return cfg.profile.avatar || (cfg.discord.userId ? discordProfileAvatar() : null);
}

function currentName(cfg) {
  if (cfg.discord.useName) return lanyardUser()?.global_name || state.dprofile?.globalName || cfg.profile.displayName;
  return cfg.profile.displayName || cfg.profile.username;
}

function currentDecoration(cfg) {
  if (cfg.avatar.decoration === 'custom') return cfg.avatar.decorationUrl || null;
  if (cfg.avatar.decoration === 'discord') return decorationUrl(lanyardUser()?.avatar_decoration_data?.asset || state.dprofile?.decoration);
  return null;
}

async function refreshDiscordProfile() {
  const id = state.cfg.discord.userId;
  if (!/^\d{15,22}$/.test(id)) { state.dprofile = null; state.dprofileFor = null; return; }
  if (state.dprofileFor === id) return;
  state.dprofileFor = id;
  try {
    const res = await fetch(`/api/discord/profile/${id}`);
    const data = res.ok ? await res.json() : null;
    if (state.dprofileFor === id) { state.dprofile = data; render(); }
  } catch { /* keep going without it */ }
}

// ---------- styling ----------
const loadedFonts = new Set();
function ensureFont(name) {
  if (!name || loadedFonts.has(name)) return;
  loadedFonts.add(name);
  if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((l) => l.href === fontHref(name))) return;
  const href = fontHref(name);
  if (href) document.head.append(h('link', { rel: 'stylesheet', href }));
}

function applyVars(cfg) {
  const L = cfg.look;
  [L.font, cfg.name.font, cfg.splash.font].forEach(ensureFont);
  let customFace = document.getElementById('custom-font');
  if (L.customFont) {
    if (!customFace) { customFace = h('style', { id: 'custom-font' }); document.head.append(customFace); }
    customFace.textContent = `@font-face{font-family:'TrapCustom';src:${cssUrl(L.customFont)};font-display:swap}`;
  } else customFace?.remove();
  const base = L.customFont ? "'TrapCustom', system-ui, sans-serif" : fontStack(L.font) || 'system-ui, sans-serif';
  const theme = L.useDiscordTheme && state.dprofile?.themeColors?.length ? state.dprofile.themeColors.map(intToHex) : null;
  const vars = {
    '--accent': L.accent, '--text': L.textColor, '--muted': L.mutedColor, '--icon': L.iconColor,
    '--font': base, '--name-font': fontStack(cfg.name.font) || base, '--splash-font': fontStack(cfg.splash.font) || base,
    '--scale': L.fontScale / 100, '--bio-size': L.bioSize + 'px',
    '--card-w': (L.layout === 'split' ? Math.max(L.cardWidth, 600) : L.cardWidth) + 'px',
    '--card-pad': L.cardPadding + 'px', '--gap': L.gap + 'px', '--radius': L.cardRadius + 'px',
    '--card-bg': theme ? `linear-gradient(160deg, ${rgba(theme[0], L.cardOpacity / 100)}, ${rgba(theme[1] || theme[0], L.cardOpacity / 100)})`
      : L.cardStyle === 'gradient' ? `linear-gradient(150deg, ${rgba(L.cardColor, L.cardOpacity / 100)}, ${rgba(L.cardColor2, L.cardOpacity / 100)})`
        : rgba(L.cardColor, L.cardOpacity / 100),
    '--card-solid': L.cardColor, '--card-blur': L.cardBlur + 'px', '--border': rgba(L.borderColor, L.borderOpacity / 100), '--border-w': L.borderWidth + 'px',
    '--card-glow': L.cardGlow + 'px', '--card-glow-color': rgba(L.cardStyle === 'neon' ? L.borderColor : L.accent, 0.55),
    '--text-glow': L.textGlow ? `0 0 ${L.textGlow}px ${rgba(L.accent, 0.8)}` : 'none',
    '--name-size': cfg.name.size + 'px', '--name-weight': cfg.name.weight, '--name-color': cfg.name.color,
    '--name-ls': cfg.name.letterSpacing + 'px', '--glow-color': cfg.name.glowColor || L.accent, '--glow-size': cfg.name.glowStrength + 'px',
    '--grad-from': cfg.name.gradientFrom, '--grad-to': cfg.name.gradientTo, '--sparkle': cfg.name.sparkleColor,
    '--avatar-size': cfg.avatar.size + 'px', '--avatar-bw': cfg.avatar.borderWidth + 'px', '--avatar-bc': cfg.avatar.borderColor,
    '--avatar-glow': cfg.avatar.glow + 'px', '--avatar-glow-color': cfg.avatar.glowColor,
    '--link-size': cfg.links.size + 'px', '--link-gap': cfg.links.gap + 'px', '--badge-size': cfg.badges.size + 'px',
    '--banner-h': cfg.profile.bannerHeight + 'px', '--tilt-x': '0deg', '--tilt-y': '0deg', '--beat': 0,
    '--splash-size': cfg.splash.size + 'px', '--viz': cfg.audio.visualizerColor || L.accent,
  };
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, String(v));
  document.body.className = [
    `layout-${L.layout}`, `align-${L.align}`, `card-${L.cardStyle}`,
    L.shadow ? 'has-shadow' : '', calm() ? 'calm' : '',
    cfg.page.noSelect ? 'no-select' : '', state.preview ? 'is-preview' : '', state.entered ? 'entered' : 'waiting',
    `cursor-${cfg.cursor.type}`, state.settled ? 'settled' : '',
    cfg.fx.vhs && !calm() ? 'vhs-on' : '', cfg.audio.visualizer === 'glow' ? 'viz-glow' : '',
    cfg.audio.tracks?.length && ['mini', 'full'].includes(cfg.audio.player) ? `dock-${cfg.audio.player}` : '',
  ].filter(Boolean).join(' ');

  let cursorStyle = document.getElementById('cursor-style');
  if (cfg.cursor.type === 'custom' && cfg.cursor.image) {
    if (!cursorStyle) { cursorStyle = h('style', { id: 'cursor-style' }); document.head.append(cursorStyle); }
    const c = `${cssUrl(cfg.cursor.image)} ${Number(cfg.cursor.hotX) || 0} ${Number(cfg.cursor.hotY) || 0}, auto`;
    cursorStyle.textContent = `html,body,a,button,[role=button],input,label{cursor:${c} !important}`;
  } else cursorStyle?.remove();
}

// ---------- background ----------
function gradientCss(bg) {
  const { gradFrom: a, gradVia: b, gradTo: c, gradAngle: ang } = bg;
  switch (bg.gradType) {
    case 'radial': return `radial-gradient(ellipse at 50% 30%, ${a}, ${b} 55%, ${c})`;
    case 'conic': return `conic-gradient(from ${ang}deg at 50% 50%, ${a}, ${b}, ${c}, ${a})`;
    case 'mesh': return `radial-gradient(at 15% 20%, ${a} 0, transparent 55%), radial-gradient(at 85% 15%, ${b} 0, transparent 50%), radial-gradient(at 70% 85%, ${a} 0, transparent 50%), radial-gradient(at 20% 90%, ${b} 0, transparent 55%), ${c}`;
    default: return `linear-gradient(${ang}deg, ${a}, ${b}, ${c})`;
  }
}

function buildBackground(cfg) {
  const bg = cfg.bg;
  const layer = h('div', { class: 'bg-layer' });
  const move = h('div', { class: 'bg-move' });
  const inner = h('div', { class: 'bg-inner' + (bg.zoom && !calm() ? ' kenburns' : '') });
  inner.style.filter = `blur(${bg.blur}px) brightness(${bg.brightness}%) saturate(${bg.saturation}%)`;
  if (bg.blur) inner.style.inset = `-${bg.blur * 2}px`;
  let video = null;
  let slideTimer = null;
  const fit = bg.fit === 'contain' ? 'contain' : 'cover';
  const image = (url) => { inner.style.background = `${cssUrl(url)} center / ${fit} no-repeat, #000`; };

  const type = bg.type === 'image' && isVideo(bg.image) ? 'video' : bg.type;
  if (type === 'color') inner.style.background = bg.color;
  else if (type === 'gradient') {
    inner.style.background = gradientCss(bg);
    if (bg.gradAnimate && !calm()) inner.classList.add(bg.gradType === 'conic' ? 'grad-spin' : 'grad-drift');
  } else if (type === 'image' && bg.image) image(bg.image);
  else if (type === 'video' && (bg.video || bg.image)) {
    inner.style.background = '#000';
    video = h('video', { src: bg.video || bg.image, autoplay: true, muted: true, loop: true, playsinline: true, preload: 'auto' });
    video.muted = true;
    video.style.objectFit = fit;
    inner.append(video);
  } else if (type === 'slideshow' && bg.slides?.length) {
    const slides = bg.slides.filter(Boolean).map((u, i) => h('div', { class: 'slide' + (i === 0 ? ' on' : ''), style: { background: `${cssUrl(u)} center / ${fit} no-repeat` } }));
    inner.append(...slides);
    let i = 0;
    if (slides.length > 1) slideTimer = setInterval(() => { slides[i].classList.remove('on'); i = (i + 1) % slides.length; slides[i].classList.add('on'); }, Math.max(2, bg.slideInterval) * 1000);
  } else if (type === 'discord') {
    const p = state.dprofile;
    const url = p ? bannerUrl(p.id, p.banner) : null;
    if (url) image(url);
    else inner.style.background = p?.bannerColor ? `linear-gradient(180deg, ${p.bannerColor}, #000)` : '#050507';
  } else inner.style.background = '#050507';

  move.append(inner);
  layer.append(move, h('div', { class: 'bg-overlay', style: { background: rgba(bg.overlayColor, bg.overlayOpacity / 100) } }));

  let onMove = null;
  if (bg.parallax && !isTouch() && !calm()) {
    const s = bg.parallaxStrength;
    move.style.transform = 'scale(1.06)';
    onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * -s;
      const y = (e.clientY / window.innerHeight - 0.5) * -s;
      move.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.06)`;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
  }
  return {
    el: layer,
    video,
    destroy() { clearInterval(slideTimer); if (onMove) window.removeEventListener('pointermove', onMove); video?.pause(); },
  };
}

// ---------- screen filters ----------
const TINTS = {
  night: 'brightness(.78) saturate(.75) hue-rotate(-12deg) contrast(1.05)', mono: 'grayscale(1) contrast(1.05)', sepia: 'sepia(.7) contrast(1.05)',
  warm: 'sepia(.25) saturate(1.25) hue-rotate(-8deg)', cold: 'saturate(1.1) hue-rotate(12deg) brightness(.97)', vivid: 'saturate(1.5) contrast(1.1)',
  dream: 'saturate(1.25) brightness(1.06) contrast(.95)',
};

function buildFilters(cfg) {
  const fx = cfg.fx;
  const el = h('div', { class: 'filters' });
  // The color filter lives in its own layer: blend modes inside .filters would stop its backdrop-filter.
  let tint = null;
  if (fx.tint !== 'none' && TINTS[fx.tint]) {
    tint = h('div', { class: `tint tint-${fx.tint}` });
    tint.style.backdropFilter = TINTS[fx.tint];
    tint.style.webkitBackdropFilter = TINTS[fx.tint];
  }
  if (fx.vignette > 0) el.append(h('div', { class: 'vignette', style: { opacity: fx.vignette / 100 } }));
  if (fx.scanlines) el.append(h('div', { class: 'scanlines' + (calm() ? '' : ' flicker') }));
  if (fx.grain) el.append(h('div', { class: 'grain' + (calm() ? '' : ' moving'), style: { backgroundImage: cssUrl(grainTexture()) } }));
  if (fx.vhs && !calm()) el.append(h('div', { class: 'vhs' }, h('div', { class: 'vhs-band' })));
  return { el: h('div', { class: 'slot' }, tint, el) };
}

// ---------- name ----------
function buildName(cfg, text) {
  const n = cfg.name;
  const shown = n.uppercase ? text.toUpperCase() : text;
  const el = h('h1', { class: `name fx-${n.effect}${n.glow ? ' glow' : ''}`, 'data-text': shown });
  const fx = calm() ? 'none' : n.effect;
  if (fx === 'wave' || fx === 'bounce') {
    [...shown].forEach((ch, i) => el.append(h('span', { class: 'ch', style: { animationDelay: `${i * 0.07}s` } }, ch === ' ' ? ' ' : ch)));
  } else if (fx === 'typewriter') {
    el.textContent = '';
    el.classList.add('typing');
    later(() => {
      let i = 0;
      const id = every(110, () => { el.textContent = shown.slice(0, ++i); if (i >= shown.length) clearInterval(id); });
    });
  } else if (fx === 'scramble') {
    el.textContent = shown;
    const glyphs = '!<>-_\\/[]{}—=+*^?#________';
    const run = () => {
      let frame = 0;
      const total = 24;
      const id = setInterval(() => {
        frame++;
        el.textContent = [...shown].map((ch, i) => (ch === ' ' || i < (frame / total) * shown.length ? ch : glyphs[Math.floor(Math.random() * glyphs.length)])).join('');
        if (frame >= total) { clearInterval(id); el.textContent = shown; }
      }, 40);
      cleanup.push(() => clearInterval(id));
    };
    later(() => { run(); every(7000, run); });
  } else {
    el.textContent = shown;
  }
  if (n.gradientAnimate && n.effect === 'gradient') el.classList.add('animated');
  return el;
}

function addSparkles(host, color) {
  if (calm()) return;
  const spawn = () => {
    if (!host.isConnected) return;
    const r = host.getBoundingClientRect();
    const s = h('span', { class: 'spark', style: { left: Math.random() * 100 + '%', top: Math.random() * 100 + '%', color, width: 6 + Math.random() * 8 + 'px' } });
    s.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z"/></svg>';
    if (r.width) host.append(s);
    setTimeout(() => s.remove(), 1200);
  };
  every(260, spawn);
}

// ---------- badges ----------
function buildBadges(cfg) {
  const out = [];
  const p = state.dprofile;
  if (cfg.discord.showBadges && p?.badges?.length) {
    for (const b of p.badges) {
      const img = h('img', { src: badgeIconUrl(b.icon), alt: b.description, loading: 'lazy' });
      out.push(b.link ? h('a', { class: 'badge discord-badge', href: b.link, target: '_blank', rel: 'noopener', 'data-tip': b.description }, img) : h('span', { class: 'badge discord-badge', 'data-tip': b.description }, img));
    }
  }
  for (const b of cfg.badges.items || []) {
    const preset = badgePreset(b.preset);
    const label = b.label || preset?.label || 'Badge';
    const color = cfg.badges.mono ? 'var(--icon)' : b.color || preset?.color || 'var(--accent)';
    const glyph = b.image ? h('img', { src: b.image, alt: label, loading: 'lazy' }) : icon(preset?.icon || 'lu:star');
    out.push(h('span', { class: 'badge', 'data-tip': cfg.badges.style === 'pill' ? null : label, style: { color, '--bc': color } }, glyph, cfg.badges.style === 'pill' ? h('span', { class: 'badge-label' }, label) : null));
  }
  if (!out.length) return null;
  return h('div', { class: `badges badges-${cfg.badges.style}${cfg.badges.glow ? ' glow' : ''}` }, out);
}

function clanTag(cfg) {
  if (!cfg.discord.showClan) return null;
  const lg = lanyardUser()?.primary_guild;
  const tag = lg?.tag ? { tag: lg.tag, badge: lg.badge, guildId: lg.identity_guild_id } : state.dprofile?.clan;
  if (!tag?.tag) return null;
  const url = clanBadgeUrl(tag.guildId, tag.badge);
  return h('span', { class: 'clan', 'data-tip': 'Server tag' }, url ? h('img', { src: url, alt: '' }) : null, tag.tag);
}

// ---------- blocks ----------
function buildAvatar(cfg) {
  const src = currentAvatar(cfg);
  if (!src) return null;
  const A = cfg.avatar;
  const wrap = h('div', { class: `avatar-wrap shape-${A.shape} anim-${calm() ? 'none' : A.animation} hover-${A.hover}` });
  if (A.animation === 'rgb') wrap.append(h('div', { class: 'rgb-ring' }));
  const img = h('img', { class: 'avatar', src, alt: '', draggable: 'false' });
  img.onerror = () => { if (img.src !== discordProfileAvatar() && discordProfileAvatar()) img.src = discordProfileAvatar(); };
  wrap.append(img);
  const deco = currentDecoration(cfg);
  const decoEl = h('img', { class: 'decoration', src: deco || '', alt: '', hidden: !deco });
  wrap.append(decoEl);
  let dot = null;
  if (A.statusDot && cfg.discord.userId && !['hexagon', 'diamond'].includes(A.shape)) {
    dot = h('span', { class: 'status-dot', 'data-tip': 'offline' });
    wrap.append(dot);
  }
  if (cfg.audio.visualizer === 'ring') wrap.append(h('canvas', { class: 'viz-ring' }));
  const sync = (data) => {
    if (!data) return;
    if (cfg.profile.avatarSource === 'discord' || (!cfg.profile.avatar && cfg.profile.avatarSource !== 'none')) {
      const u = discordAvatar(data.discord_user, 512);
      if (u && img.src !== u) img.src = u;
    }
    const d = currentDecoration(cfg);
    decoEl.hidden = !d;
    if (d && decoEl.src !== d) decoEl.src = d;
    if (dot) {
      dot.style.background = STATUS_COLORS[data.discord_status] || STATUS_COLORS.offline;
      dot.dataset.tip = data.discord_status === 'dnd' ? 'do not disturb' : data.discord_status;
    }
  };
  cleanup.push(live.on(sync));
  return wrap;
}

function buildHeader(cfg) {
  const row = cfg.look.layout === 'split';
  const header = h('div', { class: `block block-header ${row ? 'header-row' : 'header-col'}` });
  const avatar = buildAvatar(cfg);
  const nameWrap = h('div', { class: 'name-wrap' });
  const name = buildName(cfg, currentName(cfg) || '');
  const nameLine = h('div', { class: 'name-line' }, name);
  const badges = buildBadges(cfg);
  if (badges && cfg.badges.position === 'name') nameLine.append(badges);
  const clan = clanTag(cfg);
  if (clan) nameLine.append(clan);
  nameWrap.append(nameLine);
  if (cfg.name.sparkles) addSparkles(nameLine, cfg.name.sparkleColor);
  const pronouns = cfg.profile.pronouns || (cfg.discord.useBio ? state.dprofile?.pronouns : '');
  const sub = [cfg.profile.showHandle && cfg.profile.username ? `@${cfg.profile.username.replace(/^@/, '')}` : null, pronouns || null].filter(Boolean);
  if (sub.length) nameWrap.append(h('div', { class: 'handle' }, sub.join(' • ')));
  if (badges && cfg.badges.position === 'below') nameWrap.append(badges);
  header.append(...[avatar, nameWrap].filter(Boolean));
  if (cfg.name.effect === 'gradient' || cfg.name.effect === 'rainbow' || cfg.name.effect === 'shine') name.classList.add('clip');
  return header;
}

function buildBanner(cfg) {
  const src = cfg.profile.bannerSource;
  if (src === 'none') return null;
  let url = null;
  if (src === 'custom') url = cfg.profile.banner;
  if (src === 'discord') url = state.dprofile ? bannerUrl(state.dprofile.id, state.dprofile.banner) : null;
  const el = h('div', { class: 'banner' });
  if (url && isVideo(url)) {
    const v = h('video', { src: url, autoplay: true, muted: true, loop: true, playsinline: true });
    v.muted = true;
    el.append(v);
  } else if (url) el.style.backgroundImage = cssUrl(url);
  else el.style.background = state.dprofile?.bannerColor || `linear-gradient(135deg, ${cfg.look.accent}, ${rgba(cfg.look.accent, 0.2)})`;
  return el;
}

function bioLines(cfg) {
  const main = (cfg.discord.useBio && state.dprofile?.bio) || cfg.profile.bio || '';
  return [main, ...(cfg.profile.bioLines || [])].map((s) => String(s || '').trim()).filter(Boolean);
}

function buildBio(cfg) {
  const lines = bioLines(cfg);
  if (!lines.length) return null;
  const P = cfg.profile;
  const el = h('div', { class: 'block block-bio bio' });
  const mode = calm() && P.bioMode !== 'static' ? 'static' : P.bioMode;
  if (mode === 'typewriter') {
    const text = h('span', { class: 'tw-text' });
    el.append(text);
    if (P.typeCursor) el.append(h('span', { class: 'tw-cursor' }, '|'));
    const plain = lines.map(stripMd);
    later(() => {
      let li = 0; let ci = 0; let deleting = false; let wait = 0;
      every(Math.max(15, P.typeSpeed), () => {
        if (wait > 0) { wait -= P.typeSpeed; return; }
        const line = plain[li];
        if (!deleting) {
          text.textContent = line.slice(0, ++ci);
          if (ci >= line.length) { if (plain.length === 1) return; deleting = true; wait = P.typeHold; }
        } else {
          text.textContent = line.slice(0, --ci);
          if (ci <= 0) { deleting = false; li = (li + 1) % plain.length; wait = 300; }
        }
      });
    });
  } else if (mode === 'rotate' && lines.length > 1) {
    let i = 0;
    const span = h('span', { class: 'rotator', html: md(lines[0]) });
    el.append(span);
    every(Math.max(800, P.typeHold), () => {
      span.classList.add('out');
      setTimeout(() => { i = (i + 1) % lines.length; span.innerHTML = md(lines[i]); span.classList.remove('out'); }, 350);
    });
  } else {
    el.innerHTML = md(lines[0]);
    if (mode === 'fade') el.classList.add('fade-once');
  }
  return el;
}

function viewsChip(cfg, cls = '') {
  const label = cfg.views.label;
  const animateFromZero = cfg.views.animate && !state.countedUp && !calm();
  const num = h('span', { class: 'view-count' }, animateFromZero ? '0' : fmtNum(state.views, cfg.views.format === 'compact'));
  return h('span', { class: `chip views-chip ${cls}`, 'data-tip': label ? null : 'profile views' }, icon('lu:eye'), num, label ? h('span', { class: 'muted' }, ' ' + label) : null);
}

function buildMeta(cfg) {
  const P = cfg.profile;
  const items = [];
  if (P.location) items.push(h('span', { class: 'chip' }, icon('lu:map-pin'), P.location));
  if (cfg.views.show && cfg.views.position === 'card') items.push(viewsChip(cfg));
  if (P.joinDate) {
    const d = new Date(P.joinDate + 'T12:00:00');
    if (!Number.isNaN(d.getTime())) items.push(h('span', { class: 'chip', 'data-tip': d.toLocaleDateString('en-US', { dateStyle: 'long' }) }, icon('lu:calendar'), 'joined ' + d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })));
  }
  if (P.uid) items.push(h('span', { class: 'chip' }, icon('lu:hash'), 'UID ' + P.uid));
  const tags = (P.tags || []).filter(Boolean);
  if (!items.length && !tags.length) return null;
  return h('div', { class: 'block block-meta' },
    items.length ? h('div', { class: 'meta-row' }, items) : null,
    tags.length ? h('div', { class: 'tags' }, tags.map((t) => h('span', { class: 'tag' }, t))) : null);
}

function buildPresence(cfg) {
  if (!cfg.discord.presence || !cfg.discord.userId) return null;
  const w = presenceWidget(cfg, live, state.dprofile);
  cleanup.push(() => w.destroy());
  return h('div', { class: 'block block-presence' }, w.el);
}

function trackClick(id) {
  if (!id || state.preview) return;
  const body = JSON.stringify({ id });
  if (!navigator.sendBeacon?.('/api/click', new Blob([body], { type: 'application/json' }))) {
    fetch('/api/click', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }
}

function linkColor(cfg, item, platform, i, n) {
  if (item.color) return item.color;
  switch (cfg.links.colorMode) {
    case 'brand': return platform.color;
    case 'accent': return 'var(--accent)';
    case 'gradient': {
      const k = n > 1 ? i / (n - 1) : 0;
      return `color-mix(in srgb, ${cfg.look.accent} ${Math.round((1 - k) * 100)}%, ${cfg.name.gradientTo} ${Math.round(k * 100)}%)`;
    }
    default: return 'var(--icon)';
  }
}

function buildLinks(cfg) {
  const items = [...(cfg.links.items || [])];
  if (cfg.discord.showConnections) {
    for (const c of connectionLinks(state.dprofile)) if (!items.some((l) => l.platform === c.platform && l.value === c.value)) items.push(c);
  }
  const L = cfg.links;
  const els = [];
  items.forEach((item, i) => {
    const r = resolveLink(item);
    if (!r) return;
    const p = platformById(item.platform);
    const label = item.label || p.name;
    const color = linkColor(cfg, item, p, i, items.length);
    const glyph = item.icon ? h('img', { class: 'ico ico-img', src: item.icon, alt: '' }) : icon(p.icon);
    const showText = ['pills', 'buttons', 'grid'].includes(L.style);
    const content = [h('span', { class: 'link-ico' }, glyph), showText ? h('span', { class: 'link-label' }, label) : null, L.style === 'buttons' ? h('span', { class: 'link-go' }, icon(r.copy ? 'lu:copy' : 'lu:arrow-up-right')) : null];
    const attrs = {
      class: `link hover-${L.hover}`,
      style: { '--c': color, '--brand': p.color },
      'data-tip': L.tooltip && !showText ? (r.copy ? `${label}: ${r.copy}` : label) : null,
      'aria-label': label,
    };
    if (r.href) {
      els.push(h('a', { ...attrs, href: r.href, target: L.newTab ? '_blank' : null, rel: 'noopener me', onclick: () => trackClick(item.id) }, content));
    } else {
      els.push(h('button', { ...attrs, type: 'button', onclick: async () => { trackClick(item.id); if (await copyText(r.copy)) toast(`copied ${label}: ${r.copy}`); } }, content));
    }
  });
  if (!els.length) return null;
  return h('div', { class: `block block-links links links-${L.style}${L.glow ? ' glow' : ''}` }, els);
}

function buildButtons(cfg) {
  const list = (cfg.links.buttons || []).filter((b) => b.url && b.label);
  if (!list.length) return null;
  return h('div', { class: `block block-buttons buttons btn-${cfg.links.buttonStyle}` }, list.map((b) => {
    const href = resolveLink({ platform: 'link', value: b.url })?.href;
    if (!href) return null;
    const p = platformById(b.platform);
    return h('a', { class: 'lbtn' + (b.highlight ? ' hl' : ''), href, target: cfg.links.newTab ? '_blank' : null, rel: 'noopener', onclick: () => trackClick(b.id) },
      h('span', { class: 'lbtn-ico', style: { color: b.highlight ? null : p.color === '#ffffff' ? null : p.color } }, icon(p.icon)), h('span', { class: 'lbtn-label' }, b.label), h('span', { class: 'lbtn-go' }, icon('lu:arrow-up-right')));
  }));
}

// ---------- widgets ----------
function spotifyEmbed(url) {
  const m = String(url).match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/);
  return m ? { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`, height: m[1] === 'track' || m[1] === 'episode' ? 152 : 352 } : null;
}

function youtubeId(url) {
  const m = String(url).match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : /^[\w-]{11}$/.test(url) ? url : null;
}

function widget(cfg, w) {
  const tile = h('div', { class: `widget w-${w.type}` });
  if (w.title) tile.append(h('div', { class: 'w-title' }, w.title));
  switch (w.type) {
    case 'discord_server': {
      const code = String(w.invite || '').trim().replace(/^https?:\/\/(www\.)?(discord\.gg|discord(app)?\.com\/invite)\//i, '').replace(/[/?#].*$/, '');
      if (!code) return null;
      const body = h('div', { class: 'dserver loading' }, h('div', { class: 'ds-icon' }), h('div', { class: 'ds-info' }, h('div', { class: 'ds-name' }, 'loading server…')));
      tile.append(body);
      fetch(`/api/discord/invite/${encodeURIComponent(code)}`).then((r) => (r.ok ? r.json() : null)).then((g) => {
        body.classList.remove('loading');
        if (!g) { body.querySelector('.ds-name').textContent = 'invite expired'; return; }
        body.replaceChildren(
          h('div', { class: 'ds-icon' }, g.icon ? h('img', { src: g.icon, alt: '' }) : h('span', {}, (g.name || '?').slice(0, 2))),
          h('div', { class: 'ds-info' },
            h('div', { class: 'ds-name ell' }, g.name),
            h('div', { class: 'ds-counts' },
              g.online != null ? h('span', {}, h('i', { class: 'dot on' }), fmtNum(g.online, true) + ' online') : null,
              g.members != null ? h('span', {}, h('i', { class: 'dot' }), fmtNum(g.members, true) + ' members') : null)),
          h('a', { class: 'ds-join', href: `https://discord.gg/${g.code}`, target: '_blank', rel: 'noopener' }, 'Join'));
        if (g.banner) body.style.setProperty('--ds-banner', cssUrl(g.banner));
      }).catch(() => {});
      return tile;
    }
    case 'spotify': {
      const e = spotifyEmbed(w.url);
      if (!e) return null;
      tile.append(h('iframe', { src: e.src, height: e.height, loading: 'lazy', allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture', frameborder: '0' }));
      return tile;
    }
    case 'youtube': {
      const id = youtubeId(w.url || '');
      if (!id) return null;
      tile.append(h('div', { class: 'ratio' }, h('iframe', { src: `https://www.youtube-nocookie.com/embed/${id}?rel=0`, loading: 'lazy', allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture', allowfullscreen: true, frameborder: '0' })));
      return tile;
    }
    case 'soundcloud':
      if (!/soundcloud\.com\//.test(w.url || '')) return null;
      tile.append(h('iframe', { src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(w.url)}&color=${encodeURIComponent(cfg.look.accent)}&auto_play=false&hide_related=true&show_comments=false&visual=false`, height: 120, loading: 'lazy', frameborder: '0', allow: 'autoplay' }));
      return tile;
    case 'github': {
      const user = String(w.github || '').trim().replace(/^@/, '');
      if (!/^[\w-]{1,39}$/.test(user)) return null;
      const body = h('a', { class: 'gh', href: `https://github.com/${user}`, target: '_blank', rel: 'noopener' }, icon('si:github'), h('span', {}, user));
      tile.append(body);
      fetch(`https://api.github.com/users/${user}`).then((r) => (r.ok ? r.json() : null)).then((g) => {
        if (!g) return;
        body.replaceChildren(
          h('img', { src: g.avatar_url, alt: '' }),
          h('div', { class: 'gh-info' }, h('div', { class: 'gh-name ell' }, g.name || g.login), h('div', { class: 'gh-bio ell muted' }, g.bio || '@' + g.login),
            h('div', { class: 'gh-stats' }, h('span', {}, icon('lu:book-open'), fmtNum(g.public_repos, true), ' repos'), h('span', {}, icon('lu:users'), fmtNum(g.followers, true), ' followers'))),
          h('span', { class: 'gh-logo' }, icon('si:github')));
      }).catch(() => {});
      return tile;
    }
    case 'text':
      if (!w.text) return null;
      tile.append(h('div', { class: 'w-text', html: md(w.text) }));
      return tile;
    case 'image': {
      if (!w.image) return null;
      const img = h('img', { src: w.image, alt: w.title || '', loading: 'lazy' });
      const href = safeUrl(w.href);
      tile.append(href ? h('a', { href, target: '_blank', rel: 'noopener' }, img) : img);
      return tile;
    }
    case 'countdown': {
      const target = new Date(w.date).getTime();
      if (!Number.isFinite(target)) return null;
      const units = ['d', 'h', 'm', 's'].map((u) => h('div', { class: 'cd-unit' }, h('b', {}, '0'), h('span', {}, u)));
      const done = h('div', { class: 'cd-done', hidden: true }, w.done || '');
      tile.append(h('div', { class: 'countdown' }, units), done);
      const tick = () => {
        const left = target - Date.now();
        if (left <= 0) { units.forEach((u) => (u.hidden = true)); done.hidden = false; return; }
        const parts = [Math.floor(left / 864e5), Math.floor(left / 36e5) % 24, Math.floor(left / 6e4) % 60, Math.floor(left / 1e3) % 60];
        parts.forEach((v, i) => { units[i].firstChild.textContent = String(v).padStart(i ? 2 : 1, '0'); });
      };
      tick();
      every(1000, tick);
      return tile;
    }
    case 'clock': {
      const tz = String(w.tz || '').trim() || undefined;
      let fmt;
      try { fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', second: '2-digit' }); } catch { fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }); }
      const time = h('div', { class: 'clock-time' });
      tile.append(h('div', { class: 'clock' }, icon('lu:clock'), time, h('div', { class: 'clock-tz muted' }, tz ? tz.split('/').pop().replace(/_/g, ' ') : 'local time')));
      const tick = () => { time.textContent = fmt.format(new Date()); };
      tick();
      every(1000, tick);
      return tile;
    }
    case 'html':
      if (!w.html) return null;
      tile.append(h('div', { class: 'w-html', html: w.html }));
      return tile;
    default: return null;
  }
}

function buildWidgets(cfg) {
  const els = (cfg.widgets.items || []).map((w) => widget(cfg, w)).filter(Boolean);
  if (!els.length) return null;
  return h('div', { class: `block block-widgets widgets widgets-${cfg.widgets.style}` }, els);
}

// ---------- music player UI ----------
function buildPlayerUi(cfg, mode) {
  const A = cfg.audio;
  if (!A.tracks?.length || A.player === 'hidden') return null;
  const el = h('div', { class: `player player-${mode}` });
  const cover = h('div', { class: 'pl-cover' });
  const title = h('div', { class: 'pl-title ell' });
  const artist = h('div', { class: 'pl-artist ell muted' });
  const playBtn = h('button', { class: 'pl-btn pl-play', type: 'button', 'aria-label': 'play' });
  const prev = h('button', { class: 'pl-btn', type: 'button', 'aria-label': 'previous', onclick: () => player.prev() }, icon('lu:skip-back'));
  const next = h('button', { class: 'pl-btn', type: 'button', 'aria-label': 'next', onclick: () => player.next() }, icon('lu:skip-forward'));
  const fill = h('div', { class: 'pl-fill' });
  const bar = h('div', { class: 'pl-bar', onclick: (e) => { const r = bar.getBoundingClientRect(); player.seek((e.clientX - r.left) / r.width); } }, fill);
  const cur = h('span', {});
  const dur = h('span', {});
  const volIcon = h('button', { class: 'pl-btn pl-vol-btn', type: 'button', 'aria-label': 'mute', onclick: () => player.toggleMute() });
  const vol = h('input', { class: 'pl-vol', type: 'range', min: 0, max: 100, value: Math.round(player.volume * 100), 'aria-label': 'volume', oninput: (e) => player.setVolume(e.target.value / 100) });
  playBtn.addEventListener('click', () => { if (!player.started) { player.started = true; player.ensureGraph(); } player.toggle(); });
  const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');

  let lastCover = null;
  const sync = () => {
    const t = player.current || {};
    title.textContent = t.title || 'untitled';
    artist.textContent = t.artist || '';
    if (t.cover !== lastCover) {
      lastCover = t.cover;
      cover.replaceChildren(t.cover ? h('img', { src: t.cover, alt: '' }) : icon('lu:music'));
    }
    playBtn.replaceChildren(icon(player.playing ? 'lu:pause' : 'lu:play'));
    el.classList.toggle('is-playing', player.playing);
    const e = player.el;
    fill.style.width = e.duration ? (e.currentTime / e.duration) * 100 + '%' : '0%';
    cur.textContent = fmt(e.currentTime);
    dur.textContent = fmt(e.duration);
    volIcon.replaceChildren(icon(player.muted || player.volume === 0 ? 'lu:volume-x' : player.volume < 0.5 ? 'lu:volume-1' : 'lu:volume-2'));
    if (document.activeElement !== vol) vol.value = Math.round((player.muted ? 0 : player.volume) * 100);
  };
  cleanup.push(player.on(sync));
  sync();

  const volume = A.showVolume ? h('div', { class: 'pl-volume' }, volIcon, vol) : null;
  if (mode === 'mini') {
    el.append(...[playBtn, h('div', { class: 'pl-meta' }, h('div', { class: 'marquee' }, title)), player.tracks.length > 1 ? next : null, volume].filter(Boolean));
  } else {
    el.append(
      h('div', { class: 'pl-top' }, cover, h('div', { class: 'pl-meta' }, title, artist)),
      h('div', { class: 'pl-progress' }, bar, h('div', { class: 'pl-times' }, cur, dur)),
      h('div', { class: 'pl-controls' }, player.tracks.length > 1 ? prev : h('span'), playBtn, player.tracks.length > 1 ? next : h('span'), volume),
    );
  }
  return el;
}

// ---------- profile effect (Discord-style overlay) ----------
async function effectDef(cfg) {
  const d = cfg.discord;
  if (d.effect === 'discord') return state.dprofile?.effect && !state.dprofile.effect.unknown ? state.dprofile.effect : null;
  if (d.effect === 'custom') return d.effectUrl ? { id: 'custom', layers: [{ src: d.effectUrl, loop: true, start: 0, duration: 0 }] } : null;
  if (d.effect === 'pick' && d.effectId) {
    if (BOOT.effect?.id === d.effectId) return BOOT.effect;
    if (!state.effects[d.effectId]) {
      state.effects[d.effectId] = fetch(`/api/effects/${d.effectId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    }
    return state.effects[d.effectId];
  }
  return null;
}

function mountEffect(host, def, repeat) {
  const layers = (def.layers || []).slice().sort((a, b) => a.z - b.z);
  const box = h('div', { class: 'effect-layers' });
  host.append(box);
  const timers = [];
  const play = () => {
    timers.splice(0).forEach(clearTimeout);
    box.replaceChildren();
    const bust = repeat ? `${layers[0]?.src?.includes('?') ? '&' : '?'}r=${Date.now()}` : '';
    for (const l of layers) {
      const img = h('img', { src: l.src + (l.loop ? '' : bust), alt: '', style: { zIndex: l.z || 0 } });
      img.style.opacity = l.start ? '0' : '1';
      box.append(img);
      if (l.start) timers.push(setTimeout(() => { img.style.opacity = '1'; }, l.start));
      if (!l.loop && l.duration) timers.push(setTimeout(() => img.remove(), (l.start || 0) + l.duration));
    }
  };
  later(play);
  if (repeat) {
    const longest = Math.max(4000, ...layers.map((l) => (l.start || 0) + (l.duration || 0)));
    every(longest + 6000, play);
  }
  cleanup.push(() => timers.forEach(clearTimeout));
}

// ---------- stage ----------
function card(children, cls = '') {
  const el = h('section', { class: `card ${cls}` }, h('div', { class: 'card-glare' }));
  for (const c of children) if (c) el.append(c);
  return el;
}

function normalizeOrder(order) {
  const all = BLOCKS.map((b) => b[0]);
  const list = (Array.isArray(order) ? order : []).filter((x) => all.includes(x));
  return [...new Set([...list, ...all])];
}

function buildStage(cfg) {
  const L = cfg.look;
  const stage = h('main', { class: `stage v-${L.vAlign}` });
  const blocks = {
    header: buildHeader(cfg), bio: buildBio(cfg), meta: buildMeta(cfg), presence: buildPresence(cfg),
    links: buildLinks(cfg), buttons: buildButtons(cfg), widgets: buildWidgets(cfg),
    player: cfg.audio.player === 'card' ? buildPlayerUi(cfg, 'card') : null,
  };
  for (const [k, el] of Object.entries(blocks)) if (el && !el.classList.contains('block')) el.classList.add('block', `block-${k}`);
  const order = normalizeOrder(L.order).filter((k) => blocks[k]);
  const banner = buildBanner(cfg);

  let cards = [];
  if (L.layout === 'stacked') {
    const intro = order.filter((k) => ['header', 'bio', 'meta'].includes(k));
    cards.push(card([banner, ...intro.map((k) => blocks[k])], 'card-main'));
    for (const k of order) if (!intro.includes(k)) cards.push(card([blocks[k]], `card-${k}`));
  } else {
    cards.push(card([banner, ...order.map((k) => blocks[k])], 'card-main'));
  }
  if (banner) cards[0].classList.add('has-banner');
  cards.forEach((c, ci) => {
    if (L.entrance !== 'none' && !calm()) c.classList.add('enter', `enter-${L.entrance}`);
    c.style.setProperty('--ci', ci);
    if (L.stagger) [...c.querySelectorAll(':scope > .block, :scope > .banner')].forEach((b, bi) => b.style.setProperty('--bi', bi + ci * 2));
    if (L.float && !calm()) c.classList.add('floating');
  });
  const wrap = h('div', { class: 'cards' }, cards);
  stage.append(wrap);
  if (cfg.page.footer) stage.append(h('footer', { class: 'page-footer' }, cfg.page.footer));

  // Discord-style profile effect pinned to the main card.
  effectDef(cfg).then((def) => {
    if (!def || !cards[0].isConnected) return;
    if (cfg.discord.effectPlacement === 'card') {
      const host = h('div', { class: 'card-effect' });
      cards[0].append(host);
      mountEffect(host, def, cfg.discord.effectRepeat);
    }
  });

  if (L.tilt && !isTouch() && !calm()) enableTilt(cards, L.tiltStrength, L.tiltGlare);
  return stage;
}

function enableTilt(cards, strength, glare) {
  const onMove = (e) => {
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2);
      const y = (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2);
      c.style.setProperty('--tilt-x', `${(-y * strength).toFixed(2)}deg`);
      c.style.setProperty('--tilt-y', `${(x * strength).toFixed(2)}deg`);
      if (glare) {
        c.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
        c.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
        c.classList.add('glaring');
      }
    }
  };
  const onLeave = () => cards.forEach((c) => { c.style.setProperty('--tilt-x', '0deg'); c.style.setProperty('--tilt-y', '0deg'); c.classList.remove('glaring'); });
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  cards.forEach((c) => c.classList.add('tilt'));
  cleanup.push(() => { window.removeEventListener('pointermove', onMove); document.removeEventListener('pointerleave', onLeave); });
}

// ---------- overlays: corner views, dock player, owner button ----------
function buildOverlay(cfg) {
  const el = h('div', { class: 'overlay' });
  if (cfg.views.show && cfg.views.position !== 'card') el.append(h('div', { class: `corner corner-${cfg.views.position}` }, viewsChip(cfg, 'corner-chip')));
  if (['mini', 'full'].includes(cfg.audio.player)) {
    const ui = buildPlayerUi(cfg, cfg.audio.player);
    if (ui) el.append(h('div', { class: `corner dock corner-${cfg.audio.position}` }, ui));
  }
  if (BOOT.authed && !state.preview) el.append(h('a', { class: 'owner-edit', href: BOOT.dashboard, 'data-tip': 'open dashboard' }, icon('lu:settings')));
  return el;
}

// ---------- visualizer ----------
function buildViz(cfg) {
  const mode = cfg.audio.visualizer;
  let canvas = null;
  if (mode === 'bars' || mode === 'wave') canvas = h('canvas', { class: `viz viz-${mode}` });
  let raf = 0;
  let running = true;
  const draw = () => {
    if (!running) return;
    raf = requestAnimationFrame(draw);
    const s = player.sample();
    root.style.setProperty('--beat', (player.beat || 0).toFixed(3));
    const color = getComputedStyle(root).getPropertyValue('--viz').trim() || '#a855f7';
    if (canvas) {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth; const hh = 140;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = hh * dpr; }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, hh);
      if (!s) return;
      if (mode === 'bars') {
        const n = 64; const bw = w / n;
        const grad = ctx.createLinearGradient(0, hh, 0, 0);
        grad.addColorStop(0, rgba(color, 0.9)); grad.addColorStop(1, rgba(color, 0.05));
        ctx.fillStyle = grad;
        for (let i = 0; i < n; i++) {
          const v = s.freq[Math.floor((i / n) * s.freq.length * 0.75)] / 255;
          const bh = v ** 1.4 * hh;
          ctx.fillRect(i * bw + 1, hh - bh, bw - 2, bh);
        }
      } else {
        ctx.strokeStyle = rgba(color, 0.85); ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < s.wave.length; i++) {
          const x = (i / (s.wave.length - 1)) * w;
          const y = hh / 2 + ((s.wave[i] - 128) / 128) * (hh / 2.2);
          if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
    }
    if (mode === 'ring') {
      const ring = document.querySelector('.viz-ring');
      if (!ring) return;
      const size = ring.clientWidth; const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (ring.width !== size * dpr) { ring.width = ring.height = size * dpr; }
      const ctx = ring.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      if (!s) return;
      const c = size / 2; const r0 = size * 0.36; const n = 72;
      ctx.strokeStyle = rgba(color, 0.9); ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const v = s.freq[Math.floor((i / n) * s.freq.length * 0.7)] / 255;
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const len = 2 + v ** 1.3 * size * 0.13;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
        ctx.lineTo(c + Math.cos(a) * (r0 + len), c + Math.sin(a) * (r0 + len));
        ctx.stroke();
      }
    }
  };
  const needsLoop = mode !== 'none' || cfg.avatar.animation === 'beat';
  if (needsLoop) draw();
  return { el: canvas, destroy() { running = false; cancelAnimationFrame(raf); } };
}

// ---------- cursor ----------
function buildCursor(cfg) {
  const C = cfg.cursor;
  const el = h('div', { class: 'cursor-layer' });
  let fx = null;
  if (!calm() && (C.trail !== 'none' || ['burst', 'hearts'].includes(cfg.fx.click))) {
    const canvas = h('canvas', { class: 'cursor-canvas' });
    el.append(canvas);
    fx = new CursorFx(canvas, { trail: C.trail, trailColor: C.trailColor, trailEmoji: C.trailEmoji, trailSize: C.trailSize, click: cfg.fx.click, clickColor: cfg.fx.clickColor });
  }
  let onMove = null; let raf = 0;
  if (C.type === 'dot' && !isTouch()) {
    const dot = h('div', { class: 'cur-dot', style: { background: C.color } });
    const ring = h('div', { class: 'cur-ring', style: { borderColor: C.color } });
    el.append(dot, ring);
    const pos = { x: -100, y: -100 }; const rpos = { x: -100, y: -100 };
    onMove = (e) => {
      pos.x = e.clientX; pos.y = e.clientY;
      const hot = e.target.closest?.('a,button,[role=button],input,.clickable');
      ring.classList.toggle('hot', Boolean(hot));
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    const step = () => {
      rpos.x += (pos.x - rpos.x) * 0.18; rpos.y += (pos.y - rpos.y) * 0.18;
      dot.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      ring.style.transform = `translate(${rpos.x}px, ${rpos.y}px)`;
      raf = requestAnimationFrame(step);
    };
    step();
  }
  // DOM click effects (ripple / floating text / emoji)
  let onClick = null;
  if (['ripple', 'text', 'emoji'].includes(cfg.fx.click) && !calm()) {
    onClick = (e) => {
      if (e.target.closest?.('.splash')) return;
      const k = cfg.fx.click;
      const node = k === 'ripple'
        ? h('span', { class: 'click-ripple', style: { left: e.clientX + 'px', top: e.clientY + 'px', borderColor: cfg.fx.clickColor } })
        : h('span', { class: 'click-text', style: { left: e.clientX + 'px', top: e.clientY + 'px', color: cfg.fx.clickColor } }, k === 'emoji' ? (cfg.fx.clickText || '✨') : (cfg.fx.clickText || '+1'));
      el.append(node);
      setTimeout(() => node.remove(), 1000);
    };
    window.addEventListener('pointerdown', onClick, { passive: true });
  }
  return {
    el,
    destroy() {
      fx?.destroy();
      cancelAnimationFrame(raf);
      if (onMove) window.removeEventListener('pointermove', onMove);
      if (onClick) window.removeEventListener('pointerdown', onClick);
    },
  };
}

// ---------- splash ----------
function buildSplash(cfg) {
  const S = cfg.splash;
  const text = S.text || 'click to enter';
  const label = h('div', { class: `splash-text anim-${calm() ? 'none' : S.animation}`, 'data-text': text }, S.animation === 'typewriter' ? '' : text);
  const el = h('div', { class: `splash splash-${S.style} exit-${S.exit}`, role: 'button', tabindex: '0', 'aria-label': text },
    S.showAvatar && currentAvatar(cfg) ? h('img', { class: 'splash-avatar', src: currentAvatar(cfg), alt: '' }) : null,
    label,
    S.subtext ? h('div', { class: 'splash-sub' }, S.subtext) : null);
  if (S.style === 'color') el.style.background = S.color;
  if (S.animation === 'typewriter' && !calm()) {
    let i = 0;
    const id = setInterval(() => { label.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(id); }, 80);
    cleanup.push(() => clearInterval(id));
  }
  const go = () => enter();
  el.addEventListener('click', go);
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') go(); });
  setTimeout(() => el.focus({ preventScroll: true }), 50);
  return { el };
}

function enter() {
  if (state.entered) return;
  state.entered = true;
  const splash = slots.splash.firstElementChild;
  if (splash) {
    splash.classList.add('leaving');
    setTimeout(() => slots.splash.replaceChildren(), 700);
  }
  persist.splash = null;
  document.body.classList.remove('waiting');
  document.body.classList.add('entered');
  player.start();
  const v = persist.bg?.video;
  if (v && state.cfg.bg.videoSound) { v.muted = false; v.volume = Math.max(0.05, player.volume); v.play().catch(() => {}); }
  const hooks = onEnter;
  onEnter = [];
  hooks.forEach((fn) => fn());
  countUpViews();
  if (!state.settleTimer) state.settleTimer = setTimeout(() => { state.settled = true; document.body.classList.add('settled'); }, 2600);
}

// ---------- views ----------
function countUpViews() {
  const cfg = state.cfg;
  const first = !state.countedUp;
  state.countedUp = true;
  for (const el of document.querySelectorAll('.view-count')) {
    const target = state.views;
    const from = first ? 0 : Number(String(el.textContent).replace(/[^\d]/g, '')) || 0;
    if (!cfg.views.animate || calm() || cfg.views.format === 'compact' && !first) { el.textContent = fmtNum(target, cfg.views.format === 'compact'); continue; }
    const t0 = performance.now();
    const dur = 1400;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      const eased = 1 - (1 - k) ** 3;
      el.textContent = fmtNum(Math.round(from + (target - from) * eased), cfg.views.format === 'compact');
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

async function registerView() {
  if (state.preview) return;
  try {
    const res = await fetch('/api/view', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ referrer: document.referrer }) });
    const d = await res.json();
    if (Number.isFinite(d.views)) {
      state.views = d.views;
      if (state.entered) countUpViews();
    }
  } catch { /* offline */ }
}

// ---------- tab title ----------
let titleTimer = null;
let titleKey = null;
function animateTitle(cfg) {
  const base = cfg.page.title || currentName(cfg) || 'trap.larp';
  const key = cfg.page.titleAnimation + '|' + base;
  if (key === titleKey) return;
  titleKey = key;
  clearInterval(titleTimer);
  document.title = base;
  const mode = cfg.page.titleAnimation;
  if (mode === 'typewriter') {
    let i = 0; let dir = 1; let hold = 0;
    titleTimer = setInterval(() => {
      if (hold > 0) { hold--; return; }
      i += dir;
      document.title = base.slice(0, Math.max(1, i)) + (dir > 0 && i < base.length ? '|' : '');
      if (i >= base.length) { dir = -1; hold = 8; } else if (i <= 1) { dir = 1; hold = 3; }
    }, 220);
  } else if (mode === 'scroll') {
    let s = base + '  •  ';
    titleTimer = setInterval(() => { s = s.slice(1) + s[0]; document.title = s; }, 260);
  } else if (mode === 'blink') {
    let on = true;
    titleTimer = setInterval(() => { on = !on; document.title = on ? base : '​'; }, 900);
  }
}

// ---------- page effect (whole page placement) ----------
function buildPageEffect(cfg) {
  if (cfg.discord.effect === 'none' || cfg.discord.effectPlacement !== 'page') return { el: null };
  const host = h('div', { class: 'page-effect' });
  effectDef(cfg).then((def) => { if (def && host.isConnected) mountEffect(host, def, cfg.discord.effectRepeat); });
  return { el: host };
}

// ---------- render ----------
function render() {
  for (const fn of cleanup) { try { fn(); } catch { /* ignore */ } }
  cleanup = [];
  onEnter = [];
  const cfg = state.cfg;
  applyVars(cfg);
  live.watch(cfg.discord.userId);
  if (cfg.discord.userId && state.dprofileFor !== cfg.discord.userId) refreshDiscordProfile();

  const bgKey = JSON.stringify(cfg.bg) + (cfg.bg.type === 'discord' ? state.dprofile?.banner : '') + calm();
  keep('bg', bgKey, () => buildBackground(cfg));
  const fxKeyObj = { ...cfg.fx };
  delete fxKeyObj.vignette; delete fxKeyObj.scanlines; delete fxKeyObj.grain; delete fxKeyObj.vhs; delete fxKeyObj.tint; delete fxKeyObj.click; delete fxKeyObj.clickText; delete fxKeyObj.clickColor;
  keep('fx', JSON.stringify(fxKeyObj) + calm(), () => {
    if (cfg.fx.particles === 'none' || calm()) return { el: null };
    const canvas = h('canvas', { class: 'fx-canvas' + (cfg.fx.front ? ' front' : '') });
    const p = new Particles(canvas, { type: cfg.fx.particles, color: cfg.fx.color, density: cfg.fx.density, speed: cfg.fx.speed, size: cfg.fx.size, opacity: cfg.fx.opacity, interactive: cfg.fx.interactive, emoji: cfg.fx.emoji, image: cfg.fx.image });
    return { el: canvas, destroy: () => p.destroy() };
  });
  keep('filters', JSON.stringify([cfg.fx.vignette, cfg.fx.scanlines, cfg.fx.grain, cfg.fx.vhs, cfg.fx.tint, calm()]), () => buildFilters(cfg));
  keep('cursor', JSON.stringify([cfg.cursor, cfg.fx.click, cfg.fx.clickText, cfg.fx.clickColor, calm()]), () => buildCursor(cfg));
  keep('effect', JSON.stringify([cfg.discord.effect, cfg.discord.effectId, cfg.discord.effectUrl, cfg.discord.effectPlacement, cfg.discord.effectRepeat, state.dprofile?.effect?.id]), () => buildPageEffect(cfg));
  keep('viz', JSON.stringify([cfg.audio.visualizer, cfg.avatar.animation]), () => buildViz(cfg));

  player.configure(cfg.audio.tracks, cfg.audio);
  slots.stage.replaceChildren(buildStage(cfg));
  slots.overlay.replaceChildren(buildOverlay(cfg));
  if (!state.entered && cfg.splash.enabled) {
    if (!slots.splash.firstElementChild) slots.splash.replaceChildren(buildSplash(cfg).el);
  } else if (!state.entered) {
    enter();
  } else {
    slots.splash.replaceChildren();
  }
  if (state.entered) { onEnter.splice(0).forEach((fn) => fn()); if (!state.countedUp) countUpViews(); }
  animateTitle(cfg);
  document.body.classList.remove('booting');
  // Once the entrance has played, later re-renders (live preview, late Discord data) shouldn't replay it.
  if (state.entered && !state.settleTimer) {
    state.settleTimer = setTimeout(() => { state.settled = true; document.body.classList.add('settled'); }, 2600);
  }
}

// Page-level protections.
document.addEventListener('contextmenu', (e) => { if (state.cfg.page.noRightClick) e.preventDefault(); });
document.addEventListener('keydown', (e) => {
  if (e.key !== ' ' || state.entered || e.target !== document.body) return;
  e.preventDefault();
  enter();
});

// Live preview: the dashboard sends unsaved settings here.
if (state.preview) {
  let pendingCfg = null;
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || typeof e.data !== 'object') return;
    if (e.data.type === 'traplarp:config') {
      pendingCfg = e.data.config;
      requestAnimationFrame(() => {
        if (!pendingCfg) return;
        state.cfg = withDefaults(pendingCfg);
        pendingCfg = null;
        render();
      });
    } else if (e.data.type === 'traplarp:replay') {
      state.entered = false;
      state.settled = false;
      clearTimeout(state.settleTimer);
      state.settleTimer = null;
      state.countedUp = false;
      slots.splash.replaceChildren();
      render();
    }
  });
  window.parent?.postMessage({ type: 'traplarp:preview-ready' }, location.origin);
}

render();
registerView();

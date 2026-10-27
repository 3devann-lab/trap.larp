// Theme presets. Applying one resets the visual settings to defaults and layers the
// theme on top; your text, links, media, badges and layout choices are left alone.

import { buildDefaults, merge, getPath, setPath } from './schema.js';

const t = (id, name, swatch, patch) => ({ id, name, swatch, patch });

export const THEMES = [
  t('midnight', 'Midnight', ['#1b0533', '#a855f7'], {
    look: { cardStyle: 'glass', cardColor: '#0c0c12', cardOpacity: 45, accent: '#a855f7', textColor: '#f5f5f7', mutedColor: '#a1a1aa', iconColor: '#ffffff', font: 'Inter', borderOpacity: 12, cardGlow: 0 },
    bg: { type: 'gradient', gradFrom: '#1b0533', gradVia: '#07020d', gradTo: '#000000', gradType: 'linear', gradAnimate: true, overlayOpacity: 25 },
    name: { effect: 'none', glow: true, glowColor: '#a855f7', color: '#ffffff', font: '' },
    fx: { particles: 'stars', color: '#ffffff', vignette: 35, scanlines: false, grain: false, vhs: false, tint: 'none', clickColor: '#a855f7' },
  }),
  t('neon-tokyo', 'Neon Tokyo', ['#ff2bd6', '#00f0ff'], {
    look: { cardStyle: 'neon', cardColor: '#08000f', cardOpacity: 55, accent: '#ff2bd6', textColor: '#ffffff', mutedColor: '#ffb3f0', iconColor: '#00f0ff', font: 'Outfit', borderColor: '#ff2bd6', borderOpacity: 90, borderWidth: 2, cardGlow: 40 },
    bg: { type: 'gradient', gradFrom: '#2b0040', gradVia: '#05000f', gradTo: '#00242b', gradType: 'mesh', gradAnimate: true, overlayOpacity: 10 },
    name: { effect: 'gradient', gradientFrom: '#ff2bd6', gradientTo: '#00f0ff', gradientAnimate: true, glow: true, glowColor: '#ff2bd6', font: 'Orbitron' },
    fx: { particles: 'network', color: '#00f0ff', vignette: 40, scanlines: false, tint: 'none', clickColor: '#ff2bd6' },
    links: { colorMode: 'gradient', glow: true },
  }),
  t('blood-moon', 'Blood Moon', ['#3a0000', '#ff1f1f'], {
    look: { cardStyle: 'glass', cardColor: '#0d0000', cardOpacity: 55, accent: '#ff1f1f', textColor: '#ffe5e5', mutedColor: '#d99a9a', iconColor: '#ff4d4d', font: 'Cinzel', borderColor: '#ff1f1f', borderOpacity: 25, cardGlow: 18 },
    bg: { type: 'gradient', gradFrom: '#3a0000', gradVia: '#120000', gradTo: '#000000', gradType: 'radial', gradAnimate: false, overlayOpacity: 20 },
    name: { effect: 'none', glow: true, glowColor: '#ff1f1f', color: '#ffffff', font: 'Cinzel' },
    fx: { particles: 'embers', color: '#ff5a1f', vignette: 60, grain: true, tint: 'none', clickColor: '#ff1f1f' },
  }),
  t('matrix', 'Matrix', ['#001a00', '#00ff41'], {
    look: { cardStyle: 'solid', cardColor: '#000000', cardOpacity: 70, accent: '#00ff41', textColor: '#b6ffc5', mutedColor: '#3ddc63', iconColor: '#00ff41', font: 'Share Tech Mono', borderColor: '#00ff41', borderOpacity: 40, cardRadius: 6, cardGlow: 12 },
    bg: { type: 'color', color: '#000000', overlayOpacity: 0 },
    name: { effect: 'scramble', glow: true, glowColor: '#00ff41', color: '#00ff41', font: 'VT323' },
    fx: { particles: 'matrix', color: '#00ff41', vignette: 50, scanlines: true, tint: 'none', clickColor: '#00ff41' },
    profile: { bioMode: 'typewriter' },
  }),
  t('sakura', 'Sakura', ['#ffd1e8', '#ff7eb6'], {
    look: { cardStyle: 'glass', cardColor: '#2a0d1c', cardOpacity: 35, accent: '#ff7eb6', textColor: '#fff0f6', mutedColor: '#ffc2dc', iconColor: '#ffd1e8', font: 'Quicksand', borderColor: '#ffc2dc', borderOpacity: 30, cardGlow: 0 },
    bg: { type: 'gradient', gradFrom: '#5c1a3b', gradVia: '#2b0b1d', gradTo: '#120008', gradType: 'radial', gradAnimate: true, overlayOpacity: 10 },
    name: { effect: 'gradient', gradientFrom: '#ffd1e8', gradientTo: '#ff7eb6', glow: true, glowColor: '#ff7eb6', font: 'Pacifico' },
    fx: { particles: 'sakura', color: '#ffb7d5', vignette: 25, tint: 'none', click: 'hearts', clickColor: '#ff7eb6' },
  }),
  t('ocean', 'Deep Ocean', ['#001d3d', '#00b4d8'], {
    look: { cardStyle: 'glass', cardColor: '#00111f', cardOpacity: 40, accent: '#00b4d8', textColor: '#e0f7ff', mutedColor: '#90cfe0', iconColor: '#caf0f8', font: 'Lexend', borderColor: '#90e0ef', borderOpacity: 20 },
    bg: { type: 'gradient', gradFrom: '#003566', gradVia: '#001d3d', gradTo: '#000814', gradType: 'linear', gradAngle: 180, gradAnimate: true },
    name: { effect: 'none', glow: true, glowColor: '#00b4d8', font: '' },
    fx: { particles: 'bubbles', color: '#90e0ef', vignette: 40, tint: 'none', click: 'ripple', clickColor: '#00b4d8' },
  }),
  t('vaporwave', 'Vaporwave', ['#ff71ce', '#01cdfe'], {
    look: { cardStyle: 'gradient', cardColor: '#2d0b4e', cardColor2: '#0b3a5e', cardOpacity: 55, accent: '#ff71ce', textColor: '#fffb96', mutedColor: '#b967ff', iconColor: '#01cdfe', font: 'VT323', fontScale: 120, borderColor: '#ff71ce', borderOpacity: 60, cardRadius: 4 },
    bg: { type: 'gradient', gradFrom: '#ff71ce', gradVia: '#b967ff', gradTo: '#01cdfe', gradType: 'linear', gradAngle: 180, gradAnimate: true, overlayOpacity: 35 },
    name: { effect: 'chromatic', glow: false, font: 'Monoton', color: '#fffb96' },
    fx: { particles: 'none', vignette: 30, scanlines: true, vhs: true, tint: 'none', clickColor: '#ff71ce' },
  }),
  t('void', 'Void', ['#000000', '#ffffff'], {
    look: { cardStyle: 'transparent', cardOpacity: 0, accent: '#ffffff', textColor: '#ffffff', mutedColor: '#8a8a8a', iconColor: '#ffffff', font: 'Space Grotesk', borderOpacity: 0, cardGlow: 0, layout: 'minimal' },
    bg: { type: 'color', color: '#000000', overlayOpacity: 0 },
    name: { effect: 'none', glow: true, glowColor: '#ffffff', glowStrength: 10, font: '' },
    fx: { particles: 'stars', color: '#ffffff', vignette: 0, tint: 'none', click: 'ripple', clickColor: '#ffffff' },
  }),
  t('frost', 'Frost', ['#cfe9ff', '#7dd3fc'], {
    look: { cardStyle: 'glass', cardColor: '#0b1622', cardOpacity: 30, accent: '#7dd3fc', textColor: '#f0f9ff', mutedColor: '#bae6fd', iconColor: '#e0f2fe', font: 'Nunito', borderColor: '#e0f2fe', borderOpacity: 35 },
    bg: { type: 'gradient', gradFrom: '#1e3a5f', gradVia: '#0f1e33', gradTo: '#050b14', gradType: 'linear', gradAngle: 200, gradAnimate: false },
    name: { effect: 'shine', glow: true, glowColor: '#7dd3fc', font: '' },
    fx: { particles: 'snow', color: '#ffffff', vignette: 30, tint: 'cold', clickColor: '#7dd3fc' },
  }),
  t('gold', 'Gold Rush', ['#1a1300', '#facc15'], {
    look: { cardStyle: 'solid', cardColor: '#0a0800', cardOpacity: 75, accent: '#facc15', textColor: '#fff7d6', mutedColor: '#d6b85a', iconColor: '#facc15', font: 'Cinzel', borderColor: '#facc15', borderOpacity: 45, cardGlow: 24 },
    bg: { type: 'gradient', gradFrom: '#2b2000', gradVia: '#0a0800', gradTo: '#000000', gradType: 'radial', gradAnimate: false },
    name: { effect: 'gradient', gradientFrom: '#fde68a', gradientTo: '#b45309', gradientAnimate: true, glow: true, glowColor: '#facc15', font: 'Cinzel', sparkles: true, sparkleColor: '#fde68a' },
    fx: { particles: 'fireflies', color: '#facc15', vignette: 50, tint: 'none', clickColor: '#facc15' },
    badges: { glow: true },
  }),
  t('toxic', 'Toxic', ['#0a1a00', '#a3ff12'], {
    look: { cardStyle: 'neon', cardColor: '#050a00', cardOpacity: 60, accent: '#a3ff12', textColor: '#efffd6', mutedColor: '#a3c776', iconColor: '#a3ff12', font: 'Kode Mono', borderColor: '#a3ff12', borderOpacity: 80, borderWidth: 2, cardGlow: 30 },
    bg: { type: 'gradient', gradFrom: '#1a3300', gradVia: '#050a00', gradTo: '#000000', gradType: 'mesh', gradAnimate: true },
    name: { effect: 'glitch', glow: true, glowColor: '#a3ff12', font: 'Rubik Glitch', color: '#d9ff9e' },
    fx: { particles: 'orbs', color: '#a3ff12', vignette: 45, grain: true, tint: 'none', clickColor: '#a3ff12' },
  }),
  t('synthwave', 'Synthwave', ['#ff6c11', '#7b2cbf'], {
    look: { cardStyle: 'gradient', cardColor: '#240046', cardColor2: '#3c096c', cardOpacity: 50, accent: '#ff6c11', textColor: '#ffedd8', mutedColor: '#f2a65a', iconColor: '#ff9e00', font: 'Orbitron', borderColor: '#ff6c11', borderOpacity: 50, cardGlow: 20 },
    bg: { type: 'gradient', gradFrom: '#ff6c11', gradVia: '#7b2cbf', gradTo: '#10002b', gradType: 'linear', gradAngle: 180, gradAnimate: true, overlayOpacity: 30 },
    name: { effect: 'gradient', gradientFrom: '#ff9e00', gradientTo: '#ff006e', glow: true, glowColor: '#ff006e', font: 'Audiowide' },
    fx: { particles: 'shooting', color: '#ffd6a5', vignette: 40, scanlines: true, tint: 'none', clickColor: '#ff6c11' },
  }),
  t('pastel', 'Pastel Dream', ['#fde2ff', '#b8c0ff'], {
    look: { cardStyle: 'solid', cardColor: '#ffffff', cardOpacity: 70, accent: '#9b5de5', textColor: '#2b2140', mutedColor: '#6f6390', iconColor: '#7b61c4', font: 'Fredoka', borderColor: '#ffffff', borderOpacity: 80, cardGlow: 0 },
    bg: { type: 'gradient', gradFrom: '#fde2ff', gradVia: '#cdb4db', gradTo: '#b8c0ff', gradType: 'mesh', gradAnimate: true, overlayOpacity: 0 },
    name: { effect: 'none', glow: false, color: '#2b2140', font: 'Fredoka' },
    fx: { particles: 'bubbles', color: '#ffffff', vignette: 0, tint: 'none', click: 'hearts', clickColor: '#9b5de5' },
  }),
  t('ghost', 'Ghost', ['#1c1c1c', '#d4d4d4'], {
    look: { cardStyle: 'outline', cardColor: '#000000', cardOpacity: 10, accent: '#d4d4d4', textColor: '#e5e5e5', mutedColor: '#8f8f8f', iconColor: '#e5e5e5', font: 'Space Mono', borderColor: '#ffffff', borderOpacity: 25, cardRadius: 2 },
    bg: { type: 'color', color: '#0a0a0a' },
    name: { effect: 'blur', glow: false, color: '#ffffff', font: 'Space Mono' },
    fx: { particles: 'fireflies', color: '#ffffff', vignette: 65, grain: true, tint: 'mono', clickColor: '#ffffff' },
  }),
  t('cyberpunk', 'Cyberpunk', ['#fcee0a', '#00f0ff'], {
    look: { cardStyle: 'solid', cardColor: '#0d0d0d', cardOpacity: 80, accent: '#fcee0a', textColor: '#f8f8f2', mutedColor: '#00f0ff', iconColor: '#fcee0a', font: 'Kode Mono', borderColor: '#fcee0a', borderOpacity: 90, borderWidth: 2, cardRadius: 0, cardGlow: 16 },
    bg: { type: 'gradient', gradFrom: '#1a1a00', gradVia: '#000000', gradTo: '#001a1d', gradType: 'linear', gradAngle: 135, gradAnimate: false },
    name: { effect: 'glitch', glow: true, glowColor: '#00f0ff', color: '#fcee0a', font: 'Orbitron', uppercase: true },
    fx: { particles: 'network', color: '#fcee0a', vignette: 35, scanlines: true, vhs: true, tint: 'none', clickColor: '#fcee0a' },
  }),
  t('forest', 'Enchanted Forest', ['#0b2e13', '#7ae582'], {
    look: { cardStyle: 'glass', cardColor: '#04140a', cardOpacity: 45, accent: '#7ae582', textColor: '#ecfdf0', mutedColor: '#9ccfa8', iconColor: '#b7efc5', font: 'Cormorant Garamond', fontScale: 112, borderColor: '#7ae582', borderOpacity: 20 },
    bg: { type: 'gradient', gradFrom: '#14532d', gradVia: '#052e16', gradTo: '#010a04', gradType: 'radial', gradAnimate: true },
    name: { effect: 'none', glow: true, glowColor: '#7ae582', font: 'Cinzel' },
    fx: { particles: 'fireflies', color: '#d9f99d', vignette: 55, tint: 'none', clickColor: '#7ae582' },
  }),
  t('lavender', 'Lavender Haze', ['#3c2a5a', '#c4b5fd'], {
    look: { cardStyle: 'glass', cardColor: '#160f24', cardOpacity: 40, accent: '#c4b5fd', textColor: '#f5f3ff', mutedColor: '#c7bde6', iconColor: '#ddd6fe', font: 'Urbanist', borderColor: '#ddd6fe', borderOpacity: 25 },
    bg: { type: 'gradient', gradFrom: '#4c3575', gradVia: '#251a3d', gradTo: '#0d0817', gradType: 'mesh', gradAnimate: true },
    name: { effect: 'gradient', gradientFrom: '#f5d0fe', gradientTo: '#a5b4fc', glow: true, glowColor: '#c4b5fd', font: '' },
    fx: { particles: 'orbs', color: '#c4b5fd', vignette: 30, tint: 'dream', clickColor: '#c4b5fd' },
  }),
  t('sunset', 'Sunset Drive', ['#ff7e5f', '#feb47b'], {
    look: { cardStyle: 'glass', cardColor: '#1f0a0a', cardOpacity: 35, accent: '#ff7e5f', textColor: '#fff4eb', mutedColor: '#ffc9a8', iconColor: '#ffe0cc', font: 'Poppins', borderColor: '#ffd8bf', borderOpacity: 25 },
    bg: { type: 'gradient', gradFrom: '#ff7e5f', gradVia: '#c2416b', gradTo: '#2b1055', gradType: 'linear', gradAngle: 180, gradAnimate: true, overlayOpacity: 35 },
    name: { effect: 'none', glow: true, glowColor: '#ff7e5f', font: '' },
    fx: { particles: 'leaves', color: '#ffb38a', vignette: 30, tint: 'warm', clickColor: '#ff7e5f' },
  }),
  t('terminal', 'Retro Terminal', ['#1a1000', '#ffb000'], {
    look: { cardStyle: 'outline', cardColor: '#0a0700', cardOpacity: 60, accent: '#ffb000', textColor: '#ffcc66', mutedColor: '#cc8a00', iconColor: '#ffb000', font: 'VT323', fontScale: 125, borderColor: '#ffb000', borderOpacity: 60, cardRadius: 0, cardGlow: 10 },
    bg: { type: 'color', color: '#0a0700' },
    name: { effect: 'typewriter', glow: true, glowColor: '#ffb000', color: '#ffb000', font: 'VT323' },
    fx: { particles: 'none', vignette: 70, scanlines: true, grain: true, tint: 'none', click: 'text', clickText: '>_', clickColor: '#ffb000' },
    profile: { bioMode: 'typewriter' },
    splash: { animation: 'typewriter', font: 'VT323' },
  }),
  t('hellfire', 'Hellfire', ['#ff4d00', '#1a0000'], {
    look: { cardStyle: 'gradient', cardColor: '#1a0000', cardColor2: '#3d0c00', cardOpacity: 65, accent: '#ff4d00', textColor: '#fff1e6', mutedColor: '#ff9a6b', iconColor: '#ff6a00', font: 'Russo One', borderColor: '#ff4d00', borderOpacity: 50, cardGlow: 35 },
    bg: { type: 'gradient', gradFrom: '#4d0f00', gradVia: '#1a0000', gradTo: '#000000', gradType: 'radial', gradAnimate: true },
    name: { effect: 'gradient', gradientFrom: '#ffd000', gradientTo: '#ff1e00', glow: true, glowColor: '#ff4d00', font: 'Nosifer' },
    fx: { particles: 'embers', color: '#ff7b00', vignette: 60, tint: 'warm', clickColor: '#ff4d00' },
  }),
  t('mono', 'Monochrome', ['#ffffff', '#000000'], {
    look: { cardStyle: 'glass', cardColor: '#000000', cardOpacity: 50, accent: '#ffffff', textColor: '#ffffff', mutedColor: '#9a9a9a', iconColor: '#ffffff', font: 'Syne', borderColor: '#ffffff', borderOpacity: 20 },
    bg: { saturation: 0 },
    name: { effect: 'outline', glow: false, color: '#ffffff', font: 'Syne' },
    fx: { particles: 'rain', color: '#ffffff', vignette: 45, grain: true, tint: 'mono', clickColor: '#ffffff' },
    links: { colorMode: 'mono' },
  }),
  t('galaxy', 'Galaxy', ['#240b36', '#4facfe'], {
    look: { cardStyle: 'glass', cardColor: '#070014', cardOpacity: 40, accent: '#8b5cf6', textColor: '#f3e8ff', mutedColor: '#b9a6e6', iconColor: '#e9d5ff', font: 'Sora', borderColor: '#c4b5fd', borderOpacity: 18 },
    bg: { type: 'gradient', gradFrom: '#240b36', gradVia: '#0f0c29', gradTo: '#000000', gradType: 'mesh', gradAnimate: true },
    name: { effect: 'gradient', gradientFrom: '#c084fc', gradientTo: '#4facfe', glow: true, glowColor: '#8b5cf6', sparkles: true, sparkleColor: '#ffffff' },
    fx: { particles: 'shooting', color: '#ffffff', vignette: 40, tint: 'none', clickColor: '#8b5cf6' },
  }),
  t('discord', 'Discord', ['#5865f2', '#1e1f22'], {
    look: { layout: 'discord', align: 'left', cardStyle: 'solid', cardColor: '#111214', cardOpacity: 92, accent: '#5865f2', textColor: '#f2f3f5', mutedColor: '#b5bac1', iconColor: '#dbdee1', font: 'Inter', borderOpacity: 6, cardRadius: 14, tilt: false },
    bg: { type: 'gradient', gradFrom: '#313338', gradVia: '#1e1f22', gradTo: '#111214', gradType: 'linear', gradAnimate: false },
    name: { effect: 'none', glow: false, color: '#ffffff', size: 26, font: '' },
    fx: { particles: 'none', vignette: 15, tint: 'none', clickColor: '#5865f2' },
    profile: { bannerSource: 'discord', showHandle: true },
    discord: { presenceStyle: 'card', showBadges: true },
  }),
  t('love', 'Lovesick', ['#ff4d6d', '#2b0010'], {
    look: { cardStyle: 'glass', cardColor: '#1f0010', cardOpacity: 45, accent: '#ff4d6d', textColor: '#ffe5ec', mutedColor: '#ffb3c1', iconColor: '#ff8fa3', font: 'Dancing Script', fontScale: 115, borderColor: '#ff8fa3', borderOpacity: 30, cardGlow: 20 },
    bg: { type: 'gradient', gradFrom: '#590d22', gradVia: '#2b0010', gradTo: '#0d0005', gradType: 'radial', gradAnimate: true },
    name: { effect: 'none', glow: true, glowColor: '#ff4d6d', font: 'Great Vibes', size: 46 },
    fx: { particles: 'hearts', color: '#ff4d6d', vignette: 40, tint: 'none', click: 'hearts', clickColor: '#ff4d6d' },
    cursor: { trail: 'sparkle', trailColor: '#ffb3c1' },
  }),
  t('y2k', 'Y2K Chrome', ['#c0c0c0', '#00e1ff'], {
    look: { cardStyle: 'gradient', cardColor: '#2e3440', cardColor2: '#5e6b80', cardOpacity: 55, accent: '#00e1ff', textColor: '#ffffff', mutedColor: '#d8dee9', iconColor: '#ffffff', font: 'Bungee', fontScale: 90, borderColor: '#ffffff', borderOpacity: 60, borderWidth: 2, cardRadius: 30 },
    bg: { type: 'gradient', gradFrom: '#89f7fe', gradVia: '#a18cd1', gradTo: '#fbc2eb', gradType: 'conic', gradAnimate: true, overlayOpacity: 30 },
    name: { effect: 'rainbow', glow: true, glowColor: '#00e1ff', font: 'Bungee' },
    fx: { particles: 'confetti', vignette: 20, tint: 'vivid', clickColor: '#00e1ff' },
    cursor: { trail: 'rainbow' },
  }),
  t('abyss', 'Abyss', ['#000814', '#2ec4b6'], {
    look: { cardStyle: 'transparent', cardOpacity: 0, accent: '#2ec4b6', textColor: '#e0fbfc', mutedColor: '#7fb7be', iconColor: '#e0fbfc', font: 'Major Mono Display', layout: 'minimal', borderOpacity: 0 },
    bg: { type: 'gradient', gradFrom: '#003049', gradVia: '#000814', gradTo: '#000000', gradType: 'radial', gradAnimate: true },
    name: { effect: 'scramble', glow: true, glowColor: '#2ec4b6', font: 'Major Mono Display' },
    fx: { particles: 'fireflies', color: '#2ec4b6', vignette: 70, tint: 'none', click: 'ripple', clickColor: '#2ec4b6' },
  }),
];

export const themeById = (id) => THEMES.find((th) => th.id === id) || null;

const VISUAL_SECTIONS = ['look', 'bg', 'name', 'fx'];
const KEEP = ['look.layout', 'look.align', 'look.cardWidth', 'look.cardPadding', 'look.gap', 'look.order', 'look.vAlign',
  'look.customFont', 'look.useDiscordTheme', 'bg.image', 'bg.video', 'bg.slides', 'bg.slideInterval', 'bg.videoSound', 'fx.image', 'fx.emoji', 'name.size'];

export function applyTheme(cfg, theme, { keepBackground = false } = {}) {
  const defaults = buildDefaults();
  let out = JSON.parse(JSON.stringify(cfg));
  for (const sec of VISUAL_SECTIONS) {
    const kept = {};
    for (const k of KEEP) if (k.startsWith(sec + '.')) kept[k] = getPath(out, k);
    if (keepBackground && sec === 'bg') continue;
    out[sec] = JSON.parse(JSON.stringify(defaults[sec]));
    for (const [k, v] of Object.entries(kept)) setPath(out, k, v);
  }
  const patch = JSON.parse(JSON.stringify(theme.patch));
  if (keepBackground) delete patch.bg;
  out = merge(out, patch);
  out.meta = { ...(out.meta || {}), theme: theme.id };
  return out;
}

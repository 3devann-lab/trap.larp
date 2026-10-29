// Single source of truth for every setting: the dashboard builds its UI from this,
// and the server/profile derive defaults from it.

import { PLATFORMS } from './platforms.js';
import { FONTS } from './fonts.js';
import { BADGE_PRESETS } from './badges.js';

const opts = (...pairs) => pairs.map((p) => (Array.isArray(p) ? { value: p[0], label: p[1] } : { value: p, label: p }));
const fontOptions = (inheritLabel) => [{ value: '', label: inheritLabel }, ...FONTS.map((f) => ({ value: f.name, label: f.name, group: f.cat }))];

export const BLOCKS = [
  ['header', 'Avatar, name & badges'],
  ['bio', 'Bio'],
  ['meta', 'Location, views, tags'],
  ['presence', 'Discord presence'],
  ['links', 'Social icons'],
  ['buttons', 'Link buttons'],
  ['widgets', 'Widgets'],
  ['player', 'Music player (in card)'],
];

export const WIDGET_TYPES = opts(
  ['discord_server', 'Discord server invite'], ['spotify', 'Spotify embed'], ['youtube', 'YouTube video'],
  ['soundcloud', 'SoundCloud embed'], ['github', 'GitHub stats'], ['text', 'Text block'], ['image', 'Image'],
  ['countdown', 'Countdown'], ['clock', 'Local time'], ['html', 'Custom HTML'],
);

export const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: 'lu:chart-line', custom: 'overview' },
  {
    id: 'profile', label: 'Profile', icon: 'lu:user', groups: [
      {
        title: 'Identity', fields: [
          { key: 'profile.displayName', type: 'text', label: 'Display name', default: 'trap.larp' },
          { key: 'profile.username', type: 'text', label: 'Handle', default: 'trap', help: 'Shown as @handle when enabled.' },
          { key: 'profile.showHandle', type: 'toggle', label: 'Show @handle under name', default: false },
          { key: 'profile.pronouns', type: 'text', label: 'Pronouns', default: '', placeholder: 'they/them' },
          { key: 'profile.avatarSource', type: 'select', label: 'Avatar source', default: 'custom', options: opts(['custom', 'Uploaded / URL'], ['discord', 'Live Discord avatar'], ['none', 'No avatar']) },
          { key: 'profile.avatar', type: 'media', accept: 'image', label: 'Avatar image', default: '', show: (c) => c.profile.avatarSource === 'custom' },
        ],
      },
      {
        title: 'Bio', fields: [
          { key: 'profile.bio', type: 'textarea', label: 'Bio', default: 'welcome to my page ✦', help: 'Supports **bold**, *italic*, `code`, ~~strike~~, [links](https://…) and :emoji: from Discord (<:name:id>).' },
          { key: 'profile.bioMode', type: 'select', label: 'Bio animation', default: 'static', options: opts(['static', 'Static'], ['typewriter', 'Typewriter (cycles lines)'], ['rotate', 'Fade between lines'], ['fade', 'Fade in once']) },
          { key: 'profile.bioLines', type: 'lines', label: 'Extra bio lines', default: [], help: 'One per line. Typewriter/fade modes cycle through the bio and these lines.', show: (c) => ['typewriter', 'rotate'].includes(c.profile.bioMode) },
          { key: 'profile.typeSpeed', type: 'range', label: 'Typing speed', default: 65, min: 15, max: 200, unit: 'ms', show: (c) => c.profile.bioMode === 'typewriter' },
          { key: 'profile.typeHold', type: 'range', label: 'Pause between lines', default: 2200, min: 400, max: 8000, step: 100, unit: 'ms', show: (c) => ['typewriter', 'rotate'].includes(c.profile.bioMode) },
          { key: 'profile.typeCursor', type: 'toggle', label: 'Blinking cursor', default: true, show: (c) => c.profile.bioMode === 'typewriter' },
        ],
      },
      {
        title: 'Details', fields: [
          { key: 'profile.location', type: 'text', label: 'Location', default: '', placeholder: 'the void' },
          { key: 'profile.joinDate', type: 'date', label: 'Member since', default: '' },
          { key: 'profile.uid', type: 'text', label: 'UID', default: '', placeholder: '1' },
          { key: 'profile.tags', type: 'lines', label: 'Tags', default: [], help: 'Little pills under your bio. One per line.' },
          { key: 'profile.bannerSource', type: 'select', label: 'Card banner', default: 'none', options: opts(['none', 'None'], ['custom', 'Uploaded / URL'], ['discord', 'Discord banner']), help: 'Used by the Discord-style layout, or at the top of any card.' },
          { key: 'profile.banner', type: 'media', accept: 'image,video', label: 'Banner image/video', default: '', show: (c) => c.profile.bannerSource === 'custom' },
          { key: 'profile.bannerHeight', type: 'range', label: 'Banner height', default: 130, min: 60, max: 300, unit: 'px', show: (c) => c.profile.bannerSource !== 'none' },
        ],
      },
    ],
  },
  { id: 'themes', label: 'Themes', icon: 'lu:paintbrush', custom: 'themes' },
  {
    id: 'look', label: 'Layout & card', icon: 'lu:layers', groups: [
      {
        title: 'Layout', fields: [
          { key: 'look.layout', type: 'select', label: 'Layout', default: 'classic', options: opts(['classic', 'Classic (centered card)'], ['discord', 'Discord profile'], ['split', 'Split (avatar left)'], ['stacked', 'Stacked cards'], ['minimal', 'Minimal (no card)']) },
          { key: 'look.align', type: 'select', label: 'Text alignment', default: 'center', options: opts('center', 'left') },
          { key: 'look.cardWidth', type: 'range', label: 'Card width', default: 540, min: 320, max: 960, unit: 'px' },
          { key: 'look.cardPadding', type: 'range', label: 'Padding', default: 32, min: 8, max: 72, unit: 'px' },
          { key: 'look.gap', type: 'range', label: 'Spacing between sections', default: 16, min: 4, max: 48, unit: 'px' },
          { key: 'look.vAlign', type: 'select', label: 'Vertical position', default: 'center', options: opts('center', 'top', 'bottom') },
          { key: 'look.order', type: 'order', label: 'Section order', default: BLOCKS.map((b) => b[0]), options: BLOCKS.map(([value, label]) => ({ value, label })) },
        ],
      },
      {
        title: 'Card', fields: [
          { key: 'look.cardStyle', type: 'select', label: 'Card style', default: 'glass', options: opts(['glass', 'Frosted glass'], ['solid', 'Solid'], ['gradient', 'Gradient'], ['outline', 'Outline only'], ['neon', 'Neon border'], ['transparent', 'Transparent']) },
          { key: 'look.cardColor', type: 'color', label: 'Card color', default: '#0c0c12' },
          { key: 'look.cardColor2', type: 'color', label: 'Gradient color 2', default: '#2a0f45', show: (c) => c.look.cardStyle === 'gradient' },
          { key: 'look.cardOpacity', type: 'range', label: 'Card opacity', default: 45, min: 0, max: 100, unit: '%' },
          { key: 'look.cardBlur', type: 'range', label: 'Background blur', default: 16, min: 0, max: 40, unit: 'px' },
          { key: 'look.cardRadius', type: 'range', label: 'Corner radius', default: 24, min: 0, max: 48, unit: 'px' },
          { key: 'look.borderWidth', type: 'range', label: 'Border width', default: 1, min: 0, max: 6, unit: 'px' },
          { key: 'look.borderColor', type: 'color', label: 'Border color', default: '#ffffff' },
          { key: 'look.borderOpacity', type: 'range', label: 'Border opacity', default: 12, min: 0, max: 100, unit: '%' },
          { key: 'look.cardGlow', type: 'range', label: 'Card glow', default: 0, min: 0, max: 80, unit: 'px' },
          { key: 'look.shadow', type: 'toggle', label: 'Drop shadow', default: true },
          { key: 'look.useDiscordTheme', type: 'toggle', label: 'Use my Discord Nitro profile theme colors', default: false, help: 'Paints the card with your Discord profile theme gradient (needs Discord user ID).' },
        ],
      },
      {
        title: 'Motion', fields: [
          { key: 'look.entrance', type: 'select', label: 'Entrance animation', default: 'fade-up', options: opts(['none', 'None'], ['fade-up', 'Fade up'], ['fade', 'Fade'], ['zoom', 'Zoom'], ['blur', 'Blur in'], ['flip', 'Flip'], ['slide', 'Slide'], ['drop', 'Drop & bounce']) },
          { key: 'look.stagger', type: 'toggle', label: 'Stagger sections in one by one', default: true },
          { key: 'look.tilt', type: 'toggle', label: '3D tilt on hover', default: true },
          { key: 'look.tiltStrength', type: 'range', label: 'Tilt strength', default: 10, min: 2, max: 30, unit: '°', show: (c) => c.look.tilt },
          { key: 'look.tiltGlare', type: 'toggle', label: 'Glare highlight', default: true, show: (c) => c.look.tilt },
          { key: 'look.float', type: 'toggle', label: 'Gentle floating', default: false },
        ],
      },
    ],
  },
  {
    id: 'colors', label: 'Colors & text', icon: 'lu:palette', groups: [
      {
        title: 'Colors', fields: [
          { key: 'look.accent', type: 'color', label: 'Accent', default: '#a855f7' },
          { key: 'look.textColor', type: 'color', label: 'Text', default: '#f5f5f7' },
          { key: 'look.mutedColor', type: 'color', label: 'Secondary text', default: '#a1a1aa' },
          { key: 'look.iconColor', type: 'color', label: 'Icons', default: '#ffffff' },
        ],
      },
      {
        title: 'Typography', fields: [
          { key: 'look.font', type: 'select', label: 'Font', default: 'Inter', options: fontOptions('System default') },
          { key: 'look.customFont', type: 'media', accept: 'font', label: 'Custom font file', default: '', help: 'Upload a .ttf/.otf/.woff2 to override the font above.' },
          { key: 'look.fontScale', type: 'range', label: 'Text size', default: 100, min: 70, max: 150, unit: '%' },
          { key: 'look.bioSize', type: 'range', label: 'Bio size', default: 15, min: 10, max: 28, unit: 'px' },
          { key: 'look.textGlow', type: 'range', label: 'Glow on all text', default: 0, min: 0, max: 30, unit: 'px' },
        ],
      },
      {
        title: 'Username', fields: [
          { key: 'name.font', type: 'select', label: 'Username font', default: '', options: fontOptions('Same as page') },
          { key: 'name.size', type: 'range', label: 'Size', default: 34, min: 16, max: 80, unit: 'px' },
          { key: 'name.weight', type: 'select', label: 'Weight', default: '800', options: opts(['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black']) },
          { key: 'name.color', type: 'color', label: 'Color', default: '#ffffff' },
          { key: 'name.effect', type: 'select', label: 'Effect', default: 'none', options: opts(['none', 'None'], ['rainbow', 'Rainbow'], ['gradient', 'Gradient'], ['glitch', 'Glitch'], ['chromatic', 'Chromatic split'], ['typewriter', 'Typewriter'], ['wave', 'Wave'], ['bounce', 'Bouncy letters'], ['neon', 'Neon flicker'], ['shine', 'Shine sweep'], ['shake', 'Shake'], ['blur', 'Blur reveal'], ['scramble', 'Hacker scramble'], ['outline', 'Outline']) },
          { key: 'name.gradientFrom', type: 'color', label: 'Gradient from', default: '#a855f7', show: (c) => c.name.effect === 'gradient' },
          { key: 'name.gradientTo', type: 'color', label: 'Gradient to', default: '#22d3ee', show: (c) => c.name.effect === 'gradient' },
          { key: 'name.gradientAnimate', type: 'toggle', label: 'Animate gradient', default: true, show: (c) => c.name.effect === 'gradient' },
          { key: 'name.glow', type: 'toggle', label: 'Glow', default: true },
          { key: 'name.glowColor', type: 'color', label: 'Glow color', default: '#a855f7', show: (c) => c.name.glow },
          { key: 'name.glowStrength', type: 'range', label: 'Glow strength', default: 14, min: 2, max: 40, unit: 'px', show: (c) => c.name.glow },
          { key: 'name.sparkles', type: 'toggle', label: 'Sparkles', default: false },
          { key: 'name.sparkleColor', type: 'color', label: 'Sparkle color', default: '#ffffff', show: (c) => c.name.sparkles },
          { key: 'name.letterSpacing', type: 'range', label: 'Letter spacing', default: 0, min: -4, max: 16, step: 0.5, unit: 'px' },
          { key: 'name.uppercase', type: 'toggle', label: 'UPPERCASE', default: false },
        ],
      },
    ],
  },
  {
    id: 'avatar', label: 'Avatar', icon: 'lu:circle-user', groups: [
      {
        title: 'Avatar', fields: [
          { key: 'avatar.size', type: 'range', label: 'Size', default: 118, min: 48, max: 240, unit: 'px' },
          { key: 'avatar.shape', type: 'select', label: 'Shape', default: 'circle', options: opts('circle', ['rounded', 'Rounded square'], 'square', 'squircle', 'hexagon', 'diamond') },
          { key: 'avatar.borderWidth', type: 'range', label: 'Border width', default: 0, min: 0, max: 12, unit: 'px' },
          { key: 'avatar.borderColor', type: 'color', label: 'Border color', default: '#ffffff' },
          { key: 'avatar.glow', type: 'range', label: 'Glow', default: 0, min: 0, max: 60, unit: 'px' },
          { key: 'avatar.glowColor', type: 'color', label: 'Glow color', default: '#a855f7', show: (c) => c.avatar.glow > 0 },
          { key: 'avatar.animation', type: 'select', label: 'Idle animation', default: 'none', options: opts(['none', 'None'], ['float', 'Float'], ['pulse', 'Pulse'], ['spin', 'Slow spin'], ['beat', 'Pulse to the music'], ['rgb', 'RGB ring']) },
          { key: 'avatar.hover', type: 'select', label: 'Hover effect', default: 'zoom', options: opts(['none', 'None'], ['zoom', 'Zoom'], ['spin', 'Spin'], ['wobble', 'Wobble'], ['grayscale', 'Color on hover']) },
          { key: 'avatar.statusDot', type: 'toggle', label: 'Discord status dot', default: true },
        ],
      },
      {
        title: 'Decoration', fields: [
          { key: 'avatar.decoration', type: 'select', label: 'Avatar decoration', default: 'none', options: opts(['none', 'None'], ['discord', 'My Discord decoration'], ['custom', 'Custom image / any decoration URL']) },
          { key: 'avatar.decorationUrl', type: 'media', accept: 'image', label: 'Decoration image', default: '', show: (c) => c.avatar.decoration === 'custom', help: 'APNG/GIF/PNG. Discord decorations live at cdn.discordapp.com/avatar-decoration-presets/<asset>.png' },
        ],
      },
    ],
  },
  {
    id: 'background', label: 'Background', icon: 'lu:image', groups: [
      {
        title: 'Background', fields: [
          { key: 'bg.type', type: 'select', label: 'Type', default: 'gradient', options: opts(['color', 'Solid color'], ['gradient', 'Gradient'], ['image', 'Image / GIF'], ['video', 'Video'], ['slideshow', 'Image slideshow'], ['discord', 'Discord banner']) },
          { key: 'bg.color', type: 'color', label: 'Color', default: '#050507', show: (c) => c.bg.type === 'color' },
          { key: 'bg.gradFrom', type: 'color', label: 'Gradient from', default: '#1b0533', show: (c) => c.bg.type === 'gradient' },
          { key: 'bg.gradVia', type: 'color', label: 'Gradient middle', default: '#07020d', show: (c) => c.bg.type === 'gradient' },
          { key: 'bg.gradTo', type: 'color', label: 'Gradient to', default: '#000000', show: (c) => c.bg.type === 'gradient' },
          { key: 'bg.gradAngle', type: 'range', label: 'Angle', default: 160, min: 0, max: 360, unit: '°', show: (c) => c.bg.type === 'gradient' },
          { key: 'bg.gradType', type: 'select', label: 'Gradient shape', default: 'linear', options: opts('linear', 'radial', 'conic', ['mesh', 'Mesh / aurora']), show: (c) => c.bg.type === 'gradient' },
          { key: 'bg.gradAnimate', type: 'toggle', label: 'Animate gradient', default: true, show: (c) => c.bg.type === 'gradient' },
          { key: 'bg.image', type: 'media', accept: 'image', label: 'Image', default: '', show: (c) => c.bg.type === 'image' },
          { key: 'bg.video', type: 'media', accept: 'video', label: 'Video', default: '', show: (c) => c.bg.type === 'video' },
          { key: 'bg.videoSound', type: 'toggle', label: 'Play the video\'s own audio after entering', default: false, show: (c) => c.bg.type === 'video' },
          { key: 'bg.slides', type: 'media-list', accept: 'image', label: 'Slides', default: [], show: (c) => c.bg.type === 'slideshow' },
          { key: 'bg.slideInterval', type: 'range', label: 'Seconds per slide', default: 8, min: 2, max: 60, unit: 's', show: (c) => c.bg.type === 'slideshow' },
          { key: 'bg.fit', type: 'select', label: 'Fit', default: 'cover', options: opts('cover', 'contain'), show: (c) => ['image', 'video', 'slideshow', 'discord'].includes(c.bg.type) },
        ],
      },
      {
        title: 'Adjustments', fields: [
          { key: 'bg.blur', type: 'range', label: 'Blur', default: 0, min: 0, max: 40, unit: 'px' },
          { key: 'bg.brightness', type: 'range', label: 'Brightness', default: 100, min: 10, max: 160, unit: '%' },
          { key: 'bg.saturation', type: 'range', label: 'Saturation', default: 100, min: 0, max: 200, unit: '%' },
          { key: 'bg.overlayColor', type: 'color', label: 'Overlay color', default: '#000000' },
          { key: 'bg.overlayOpacity', type: 'range', label: 'Overlay opacity', default: 25, min: 0, max: 100, unit: '%' },
          { key: 'bg.parallax', type: 'toggle', label: 'Parallax with mouse', default: true },
          { key: 'bg.parallaxStrength', type: 'range', label: 'Parallax strength', default: 18, min: 4, max: 60, unit: 'px', show: (c) => c.bg.parallax },
          { key: 'bg.zoom', type: 'toggle', label: 'Slow zoom (Ken Burns)', default: false },
        ],
      },
    ],
  },
  {
    id: 'effects', label: 'Effects', icon: 'lu:sparkles', groups: [
      {
        title: 'Particles', fields: [
          { key: 'fx.particles', type: 'select', label: 'Particles', default: 'stars', options: opts(['none', 'None'], ['snow', 'Snow'], ['rain', 'Rain'], ['stars', 'Twinkling stars'], ['shooting', 'Shooting stars'], ['fireflies', 'Fireflies'], ['bubbles', 'Bubbles'], ['hearts', 'Hearts'], ['sakura', 'Sakura petals'], ['leaves', 'Falling leaves'], ['confetti', 'Confetti'], ['embers', 'Embers'], ['matrix', 'Matrix rain'], ['network', 'Network lines'], ['orbs', 'Glowing orbs'], ['emoji', 'Emoji rain'], ['image', 'Custom image']) },
          { key: 'fx.color', type: 'color', label: 'Color', default: '#ffffff', show: (c) => !['none', 'confetti', 'emoji', 'image'].includes(c.fx.particles) },
          { key: 'fx.emoji', type: 'text', label: 'Emoji', default: '✨ 💜 🦋', help: 'Space separated.', show: (c) => c.fx.particles === 'emoji' },
          { key: 'fx.image', type: 'media', accept: 'image', label: 'Particle image', default: '', show: (c) => c.fx.particles === 'image' },
          { key: 'fx.density', type: 'range', label: 'Amount', default: 50, min: 5, max: 100, unit: '%', show: (c) => c.fx.particles !== 'none' },
          { key: 'fx.speed', type: 'range', label: 'Speed', default: 50, min: 5, max: 100, unit: '%', show: (c) => c.fx.particles !== 'none' },
          { key: 'fx.size', type: 'range', label: 'Size', default: 50, min: 10, max: 100, unit: '%', show: (c) => c.fx.particles !== 'none' },
          { key: 'fx.opacity', type: 'range', label: 'Opacity', default: 80, min: 10, max: 100, unit: '%', show: (c) => c.fx.particles !== 'none' },
          { key: 'fx.interactive', type: 'toggle', label: 'React to mouse', default: true, show: (c) => c.fx.particles !== 'none' },
          { key: 'fx.front', type: 'toggle', label: 'Draw in front of the card', default: false, show: (c) => c.fx.particles !== 'none' },
        ],
      },
      {
        title: 'Screen filters', fields: [
          { key: 'fx.vignette', type: 'range', label: 'Vignette', default: 35, min: 0, max: 100, unit: '%' },
          { key: 'fx.scanlines', type: 'toggle', label: 'CRT scanlines', default: false },
          { key: 'fx.grain', type: 'toggle', label: 'Film grain', default: false },
          { key: 'fx.vhs', type: 'toggle', label: 'VHS / old TV glitch', default: false },
          { key: 'fx.tint', type: 'select', label: 'Color filter', default: 'none', options: opts(['none', 'None'], ['night', 'Night time'], ['mono', 'Black & white'], ['sepia', 'Sepia'], ['warm', 'Warm'], ['cold', 'Cold'], ['vivid', 'Vivid'], ['dream', 'Dreamy']) },
        ],
      },
      {
        title: 'Clicks', fields: [
          { key: 'fx.click', type: 'select', label: 'Click effect', default: 'burst', options: opts(['none', 'None'], ['burst', 'Particle burst'], ['ripple', 'Ripple'], ['hearts', 'Hearts'], ['text', 'Floating text'], ['emoji', 'Emoji pop']) },
          { key: 'fx.clickText', type: 'text', label: 'Click text', default: '+1', show: (c) => ['text', 'emoji'].includes(c.fx.click) },
          { key: 'fx.clickColor', type: 'color', label: 'Click color', default: '#a855f7', show: (c) => !['none', 'emoji'].includes(c.fx.click) },
        ],
      },
      {
        title: 'Performance', fields: [
          { key: 'fx.quality', type: 'select', label: 'On slow phones and computers', default: 'auto', options: opts(['auto', 'Lighten effects automatically'], ['full', 'Always full quality']), help: 'Lighter effects: particles at 30 fps with fewer of them, and a softer card blur. Used on low-memory devices and whenever the page starts to stutter.' },
        ],
      },
    ],
  },
  {
    id: 'cursor', label: 'Cursor', icon: 'lu:mouse-pointer-2', groups: [
      {
        title: 'Cursor', fields: [
          { key: 'cursor.type', type: 'select', label: 'Cursor', default: 'default', options: opts(['default', 'System default'], ['custom', 'Custom image'], ['dot', 'Glowing dot + ring'], ['crosshair', 'Crosshair'], ['none', 'Hidden']) },
          { key: 'cursor.image', type: 'media', accept: 'image,cursor', label: 'Cursor image', default: '', help: 'PNG/GIF/.cur, ideally 32×32.', show: (c) => c.cursor.type === 'custom' },
          { key: 'cursor.hotX', type: 'number', label: 'Hotspot X', default: 0, show: (c) => c.cursor.type === 'custom' },
          { key: 'cursor.hotY', type: 'number', label: 'Hotspot Y', default: 0, show: (c) => c.cursor.type === 'custom' },
          { key: 'cursor.color', type: 'color', label: 'Dot color', default: '#ffffff', show: (c) => c.cursor.type === 'dot' },
        ],
      },
      {
        title: 'Trail', fields: [
          { key: 'cursor.trail', type: 'select', label: 'Trail', default: 'none', options: opts(['none', 'None'], ['sparkle', 'Sparkles'], ['fairy', 'Fairy dust'], ['ghost', 'Ghost dots'], ['line', 'Smooth line'], ['rainbow', 'Rainbow'], ['bubbles', 'Bubbles'], ['stars', 'Stars'], ['emoji', 'Emoji'], ['snake', 'Snake']) },
          { key: 'cursor.trailColor', type: 'color', label: 'Trail color', default: '#ffffff', show: (c) => !['none', 'rainbow', 'emoji'].includes(c.cursor.trail) },
          { key: 'cursor.trailEmoji', type: 'text', label: 'Trail emoji', default: '✨', show: (c) => c.cursor.trail === 'emoji' },
          { key: 'cursor.trailSize', type: 'range', label: 'Trail size', default: 50, min: 10, max: 100, unit: '%', show: (c) => c.cursor.trail !== 'none' },
        ],
      },
    ],
  },
  {
    id: 'splash', label: 'Enter screen', icon: 'lu:door-open', groups: [
      {
        title: 'Click to enter', fields: [
          { key: 'splash.enabled', type: 'toggle', label: 'Show enter screen', default: true, help: 'Browsers only allow autoplaying music after a click, so this is what lets your audio start.' },
          { key: 'splash.text', type: 'text', label: 'Text', default: 'click to enter', show: (c) => c.splash.enabled },
          { key: 'splash.subtext', type: 'text', label: 'Small text', default: '', show: (c) => c.splash.enabled },
          { key: 'splash.font', type: 'select', label: 'Font', default: '', options: fontOptions('Same as page'), show: (c) => c.splash.enabled },
          { key: 'splash.size', type: 'range', label: 'Text size', default: 22, min: 12, max: 72, unit: 'px', show: (c) => c.splash.enabled },
          { key: 'splash.animation', type: 'select', label: 'Text animation', default: 'pulse', options: opts(['none', 'None'], ['pulse', 'Pulse'], ['typewriter', 'Typewriter'], ['glitch', 'Glitch'], ['float', 'Float'], ['shimmer', 'Shimmer']), show: (c) => c.splash.enabled },
          { key: 'splash.style', type: 'select', label: 'Backdrop', default: 'blur', options: opts(['blur', 'Blurred page'], ['dark', 'Dark'], ['color', 'Solid color'], ['transparent', 'Transparent']), show: (c) => c.splash.enabled },
          { key: 'splash.color', type: 'color', label: 'Backdrop color', default: '#000000', show: (c) => c.splash.enabled && c.splash.style === 'color' },
          { key: 'splash.showAvatar', type: 'toggle', label: 'Show avatar on enter screen', default: false, show: (c) => c.splash.enabled },
          { key: 'splash.exit', type: 'select', label: 'Exit animation', default: 'fade', options: opts('fade', 'zoom', ['slide', 'Slide up'], 'blur', ['shutter', 'Shutter']), show: (c) => c.splash.enabled },
        ],
      },
    ],
  },
  {
    id: 'audio', label: 'Music', icon: 'lu:music', groups: [
      {
        title: 'Tracks', fields: [
          {
            key: 'audio.tracks', type: 'list', label: 'Playlist', default: [], addLabel: 'Add track', itemTitle: (t) => t.title || (/youtu\.?be/i.test(t.url || '') ? 'YouTube track' : t.url?.split('/').pop()) || 'Untitled track',
            item: [
              { key: 'url', type: 'media', accept: 'audio', label: 'Audio file or YouTube link', default: '', placeholder: 'Upload an MP3 or paste a YouTube link', help: 'YouTube links play through YouTube\'s own player: title and cover fill in by themselves, but they can\'t drive the visualizer.' },
              { key: 'title', type: 'text', label: 'Title', default: '' },
              { key: 'artist', type: 'text', label: 'Artist', default: '' },
              { key: 'cover', type: 'media', accept: 'image', label: 'Cover art', default: '' },
            ],
          },
        ],
      },
      {
        title: 'Playback', fields: [
          { key: 'audio.autoplay', type: 'toggle', label: 'Autoplay after entering', default: true },
          { key: 'audio.shuffle', type: 'toggle', label: 'Shuffle', default: false },
          { key: 'audio.repeat', type: 'select', label: 'Repeat', default: 'all', options: opts(['all', 'Playlist'], ['one', 'One track'], ['none', 'Off']) },
          { key: 'audio.volume', type: 'range', label: 'Default volume', default: 40, min: 0, max: 100, unit: '%' },
          { key: 'audio.fadeIn', type: 'toggle', label: 'Fade in', default: true },
        ],
      },
      {
        title: 'Player', fields: [
          { key: 'audio.player', type: 'select', label: 'Player style', default: 'mini', options: opts(['hidden', 'Hidden'], ['mini', 'Mini (corner)'], ['full', 'Full (corner)'], ['card', 'Inside the card']) },
          { key: 'audio.position', type: 'select', label: 'Corner', default: 'bottom-left', options: opts('top-left', 'top-right', 'bottom-left', 'bottom-right'), show: (c) => ['mini', 'full'].includes(c.audio.player) },
          { key: 'audio.showVolume', type: 'toggle', label: 'Volume slider', default: true },
          { key: 'audio.visualizer', type: 'select', label: 'Visualizer', default: 'none', options: opts(['none', 'None'], ['bars', 'Bars (bottom of screen)'], ['wave', 'Waveform'], ['ring', 'Ring around avatar'], ['glow', 'Card glow pulse']), help: 'Visualizers work for uploaded audio (same-site files), not YouTube links.' },
          { key: 'audio.visualizerColor', type: 'color', label: 'Visualizer color', default: '#a855f7', show: (c) => c.audio.visualizer !== 'none' },
        ],
      },
    ],
  },
  {
    id: 'discord', label: 'Discord', icon: 'si:discord', groups: [
      {
        title: 'Connection', fields: [
          { key: 'discord.userId', type: 'text', label: 'Discord user ID', default: '', placeholder: '123456789012345678', help: 'Right-click yourself in Discord (Developer Mode on) → Copy User ID. For live status, join discord.gg/lanyard once.' },
          { key: 'discord.check', type: 'discord-check', label: '' },
        ],
      },
      {
        title: 'Presence', fields: [
          { key: 'discord.presence', type: 'toggle', label: 'Show presence card', default: true },
          { key: 'discord.presenceStyle', type: 'select', label: 'Card style', default: 'card', options: opts(['card', 'Card'], ['compact', 'Compact'], ['minimal', 'Status line only']), show: (c) => c.discord.presence },
          { key: 'discord.showActivity', type: 'toggle', label: 'Games & apps', default: true, show: (c) => c.discord.presence },
          { key: 'discord.showSpotify', type: 'toggle', label: 'Spotify (with progress bar)', default: true, show: (c) => c.discord.presence },
          { key: 'discord.showCustomStatus', type: 'toggle', label: 'Custom status', default: true, show: (c) => c.discord.presence },
          { key: 'discord.showPlatform', type: 'toggle', label: 'Desktop / mobile / web icons', default: true, show: (c) => c.discord.presence },
          { key: 'discord.showNameplate', type: 'toggle', label: 'Nameplate background', default: true, show: (c) => c.discord.presence },
          { key: 'discord.offlineText', type: 'text', label: 'Text when offline', default: 'currently offline', show: (c) => c.discord.presence },
          { key: 'discord.linkProfile', type: 'toggle', label: 'Click card to open Discord profile', default: true, show: (c) => c.discord.presence },
        ],
      },
      {
        title: 'Profile sync', fields: [
          { key: 'discord.useBio', type: 'toggle', label: 'Use my Discord "About me" as bio', default: false },
          { key: 'discord.useName', type: 'toggle', label: 'Use my Discord display name', default: false },
          { key: 'discord.showBadges', type: 'toggle', label: 'Show my Discord badges', default: true },
          { key: 'discord.showClan', type: 'toggle', label: 'Show server tag', default: true },
          { key: 'discord.showConnections', type: 'toggle', label: 'Add my Discord connections as links', default: false },
        ],
      },
      {
        title: 'Profile effect', fields: [
          { key: 'discord.effect', type: 'select', label: 'Profile effect', default: 'none', options: opts(['none', 'None'], ['discord', 'My Discord profile effect'], ['pick', 'Pick any effect (free)'], ['custom', 'Custom image URL']) },
          { key: 'discord.effectId', type: 'effect-picker', label: 'Effect', default: '', show: (c) => c.discord.effect === 'pick' },
          { key: 'discord.effectUrl', type: 'media', accept: 'image', label: 'Effect image (APNG/GIF)', default: '', show: (c) => c.discord.effect === 'custom' },
          { key: 'discord.effectPlacement', type: 'select', label: 'Placement', default: 'card', options: opts(['card', 'Over the card'], ['page', 'Whole page']), show: (c) => c.discord.effect !== 'none' },
          { key: 'discord.effectRepeat', type: 'toggle', label: 'Replay intro every few seconds', default: false, show: (c) => c.discord.effect !== 'none' },
        ],
      },
    ],
  },
  {
    id: 'links', label: 'Links', icon: 'lu:link', groups: [
      {
        title: 'Social icons', fields: [
          {
            key: 'links.items', type: 'list', label: 'Socials', default: [], addLabel: 'Add social', itemTitle: (l) => `${(PLATFORMS.find((p) => p.id === l.platform) || {}).name || 'Link'}${l.value ? ' — ' + l.value : ''}`,
            item: [
              { key: 'platform', type: 'platform', label: 'Platform', default: 'discord' },
              { key: 'value', type: 'text', label: 'Username / URL', default: '' },
              { key: 'label', type: 'text', label: 'Tooltip / label', default: '', placeholder: 'defaults to platform name' },
              { key: 'icon', type: 'media', accept: 'image', label: 'Custom icon (optional)', default: '' },
              { key: 'color', type: 'color', label: 'Icon color override', default: '', allowEmpty: true },
            ],
          },
        ],
      },
      {
        title: 'Icon style', fields: [
          { key: 'links.style', type: 'select', label: 'Style', default: 'icons', options: opts(['icons', 'Icons'], ['circles', 'Icons in circles'], ['pills', 'Pills with names'], ['buttons', 'Full-width buttons'], ['grid', 'Grid tiles']) },
          { key: 'links.colorMode', type: 'select', label: 'Icon color', default: 'mono', options: opts(['mono', 'Single color'], ['brand', 'Brand colors'], ['accent', 'Accent color'], ['gradient', 'Gradient (accent → name)']) },
          { key: 'links.size', type: 'range', label: 'Icon size', default: 28, min: 14, max: 64, unit: 'px' },
          { key: 'links.gap', type: 'range', label: 'Spacing', default: 14, min: 0, max: 40, unit: 'px' },
          { key: 'links.glow', type: 'toggle', label: 'Glow', default: true },
          { key: 'links.hover', type: 'select', label: 'Hover', default: 'lift', options: opts(['lift', 'Lift'], ['scale', 'Grow'], ['spin', 'Spin'], ['shake', 'Shake'], ['color', 'Reveal brand color'], ['none', 'None']) },
          { key: 'links.tooltip', type: 'toggle', label: 'Tooltips', default: true },
          { key: 'links.newTab', type: 'toggle', label: 'Open in new tab', default: true },
        ],
      },
      {
        title: 'Link buttons', fields: [
          {
            key: 'links.buttons', type: 'list', label: 'Buttons', default: [], addLabel: 'Add button', itemTitle: (b) => b.label || b.url || 'Button',
            item: [
              { key: 'label', type: 'text', label: 'Label', default: '' },
              { key: 'url', type: 'text', label: 'URL', default: '' },
              { key: 'platform', type: 'platform', label: 'Icon', default: 'link' },
              { key: 'highlight', type: 'toggle', label: 'Highlight', default: false },
            ],
          },
          { key: 'links.buttonStyle', type: 'select', label: 'Button style', default: 'glass', options: opts(['glass', 'Glass'], ['solid', 'Solid accent'], ['outline', 'Outline'], ['neon', 'Neon']) },
        ],
      },
    ],
  },
  {
    id: 'badges', label: 'Badges', icon: 'lu:award', groups: [
      {
        title: 'Badges', fields: [
          {
            key: 'badges.items', type: 'list', label: 'Badges', default: [], addLabel: 'Add badge', itemTitle: (b) => b.label || 'Badge',
            item: [
              { key: 'preset', type: 'badge', label: 'Icon', default: 'verified' },
              { key: 'label', type: 'text', label: 'Tooltip', default: '' },
              { key: 'color', type: 'color', label: 'Color', default: '', allowEmpty: true },
              { key: 'image', type: 'media', accept: 'image', label: 'Custom image (optional)', default: '' },
            ],
          },
          { key: 'badges.position', type: 'select', label: 'Position', default: 'name', options: opts(['name', 'Next to name'], ['below', 'Below name']) },
          { key: 'badges.style', type: 'select', label: 'Style', default: 'plain', options: opts(['plain', 'Plain icons'], ['chip', 'Chip container'], ['pill', 'Pills with labels']) },
          { key: 'badges.size', type: 'range', label: 'Size', default: 20, min: 12, max: 40, unit: 'px' },
          { key: 'badges.glow', type: 'toggle', label: 'Glow', default: true },
          { key: 'badges.mono', type: 'toggle', label: 'Monochrome (use icon color)', default: false },
        ],
      },
    ],
  },
  {
    id: 'widgets', label: 'Widgets', icon: 'lu:layout-grid', groups: [
      {
        title: 'Widgets', fields: [
          {
            key: 'widgets.items', type: 'list', label: 'Widgets', default: [], addLabel: 'Add widget', itemTitle: (w) => (WIDGET_TYPES.find((t) => t.value === w.type) || {}).label || 'Widget',
            item: [
              { key: 'type', type: 'select', label: 'Type', default: 'discord_server', options: WIDGET_TYPES },
              { key: 'title', type: 'text', label: 'Title (optional)', default: '' },
              { key: 'invite', type: 'text', label: 'Invite code or link', default: '', show: (w) => w.type === 'discord_server' },
              { key: 'url', type: 'text', label: 'URL', default: '', show: (w) => ['spotify', 'youtube', 'soundcloud'].includes(w.type) },
              { key: 'image', type: 'media', accept: 'image', label: 'Image', default: '', show: (w) => w.type === 'image' },
              { key: 'href', type: 'text', label: 'Link when clicked', default: '', show: (w) => w.type === 'image' },
              { key: 'github', type: 'text', label: 'GitHub username', default: '', show: (w) => w.type === 'github' },
              { key: 'text', type: 'textarea', label: 'Text', default: '', show: (w) => w.type === 'text' },
              { key: 'date', type: 'datetime', label: 'Count down to', default: '', show: (w) => w.type === 'countdown' },
              { key: 'done', type: 'text', label: 'Text when finished', default: 'it\'s here!', show: (w) => w.type === 'countdown' },
              { key: 'tz', type: 'text', label: 'Time zone', default: '', placeholder: 'America/New_York', show: (w) => w.type === 'clock' },
              { key: 'html', type: 'code', label: 'HTML', default: '', show: (w) => w.type === 'html' },
            ],
          },
          { key: 'widgets.style', type: 'select', label: 'Widget style', default: 'glass', options: opts(['glass', 'Glass tiles'], ['plain', 'Plain']) },
        ],
      },
    ],
  },
  {
    id: 'views', label: 'View counter', icon: 'lu:eye', groups: [
      {
        title: 'Views', fields: [
          { key: 'views.show', type: 'toggle', label: 'Show view counter', default: true },
          { key: 'views.position', type: 'select', label: 'Position', default: 'card', options: opts(['card', 'In the card'], ['top-left', 'Top-left corner'], ['top-right', 'Top-right corner'], ['bottom-left', 'Bottom-left corner'], ['bottom-right', 'Bottom-right corner']), show: (c) => c.views.show },
          { key: 'views.mode', type: 'select', label: 'Count', default: 'unique', options: opts(['unique', 'Unique visitors'], ['total', 'Every visit']) },
          { key: 'views.cooldown', type: 'select', label: 'Count the same IP again after', default: '30', options: opts(['15', '15 minutes'], ['30', '30 minutes'], ['60', '1 hour'], ['360', '6 hours'], ['1440', '24 hours']), help: 'Each IP address counts once per this window, so reloading, clearing cookies or switching browsers won\'t add views.', show: (c) => c.views.mode === 'total' },
          { key: 'views.format', type: 'select', label: 'Format', default: 'full', options: opts(['full', '12,345'], ['compact', '12.3K']), show: (c) => c.views.show },
          { key: 'views.label', type: 'text', label: 'Label', default: '', placeholder: 'views', show: (c) => c.views.show },
          { key: 'views.animate', type: 'toggle', label: 'Count-up animation', default: true, show: (c) => c.views.show },
          { key: 'views.offset', type: 'number', label: 'Starting views (carry over from guns.lol)', default: 0 },
          { key: 'views.countOwner', type: 'toggle', label: 'Count my own visits while logged in', default: false },
        ],
      },
    ],
  },
  {
    id: 'page', label: 'Page & embed', icon: 'lu:share-2', groups: [
      {
        title: 'Browser tab', fields: [
          { key: 'page.title', type: 'text', label: 'Tab title', default: '', placeholder: 'defaults to display name' },
          { key: 'page.titleAnimation', type: 'select', label: 'Title animation', default: 'none', options: opts(['none', 'None'], ['typewriter', 'Typewriter'], ['scroll', 'Scrolling marquee'], ['blink', 'Blink']) },
          { key: 'page.favicon', type: 'media', accept: 'image', label: 'Favicon', default: '', help: 'Defaults to your avatar.' },
        ],
      },
      {
        title: 'Link embed (Discord, Twitter, iMessage…)', fields: [
          { key: 'page.embedTitle', type: 'text', label: 'Embed title', default: '' },
          { key: 'page.embedDescription', type: 'textarea', label: 'Embed description', default: '' },
          { key: 'page.embedImage', type: 'media', accept: 'image', label: 'Embed image', default: '', help: 'Defaults to your avatar.' },
          { key: 'page.embedLarge', type: 'toggle', label: 'Large image card', default: false },
          { key: 'page.embedColor', type: 'color', label: 'Embed color', default: '#a855f7' },
          { key: 'page.siteName', type: 'text', label: 'Site name', default: 'trap.larp' },
        ],
      },
      {
        title: 'Behavior', fields: [
          { key: 'page.noIndex', type: 'toggle', label: 'Hide from search engines', default: false },
          { key: 'page.noRightClick', type: 'toggle', label: 'Disable right-click', default: false },
          { key: 'page.noSelect', type: 'toggle', label: 'Disable text selection', default: false },
          { key: 'page.reduceMotion', type: 'toggle', label: 'Respect visitors\' reduced-motion setting', default: true },
          { key: 'page.footer', type: 'text', label: 'Footer text', default: '' },
        ],
      },
    ],
  },
  {
    id: 'comments', label: 'Comments', icon: 'lu:message-square', custom: 'comments', groups: [
      {
        title: 'Comments', desc: 'Visitors can leave one comment each (one per IP address), up to 200 characters, with an optional PNG, JPEG or WebP picture up to 3 MB.', fields: [
          { key: 'comments.enabled', type: 'toggle', label: 'Show a comments section on my page', default: false },
          { key: 'comments.title', type: 'text', label: 'Section title', default: 'Comments', show: (c) => c.comments.enabled },
        ],
      },
    ],
  },
  { id: 'media', label: 'Media library', icon: 'lu:folder-open', custom: 'media' },
  { id: 'import', label: 'Import / backup', icon: 'lu:import', custom: 'import' },
  {
    id: 'advanced', label: 'Custom code', icon: 'lu:code-xml', groups: [
      {
        title: 'Custom code', desc: 'Runs on your public page. Only you can edit it.', fields: [
          { key: 'custom.css', type: 'code', label: 'Custom CSS', default: '', lang: 'css' },
          { key: 'custom.head', type: 'code', label: 'Extra <head> HTML', default: '', lang: 'html' },
          { key: 'custom.body', type: 'code', label: 'Extra HTML at end of <body>', default: '', lang: 'html' },
          { key: 'custom.js', type: 'code', label: 'Custom JavaScript', default: '', lang: 'js' },
        ],
      },
    ],
  },
];

export const BADGE_OPTIONS = BADGE_PRESETS.map((b) => ({ value: b.id, label: b.label }));

export function allFields() {
  const out = [];
  for (const s of SECTIONS) for (const g of s.groups || []) for (const f of g.fields) if (f.key && f.type !== 'discord-check') out.push(f);
  return out;
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
    o = o[keys[i]];
  }
  o[keys[keys.length - 1]] = value;
}

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

export function buildDefaults() {
  const cfg = {};
  for (const f of allFields()) setPath(cfg, f.key, clone(f.default));
  return cfg;
}

export function itemDefaults(field) {
  const item = {};
  for (const f of field.item) item[f.key] = clone(f.default);
  return item;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Deep-merge `patch` onto `base` (arrays and scalars replace). Returns a new object.
export function merge(base, patch) {
  if (!isObj(base) || !isObj(patch)) return clone(patch === undefined ? base : patch);
  const out = clone(base);
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
    out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : clone(v);
  }
  return out;
}

// Fill in any missing settings (e.g. after an update adds new options).
export function withDefaults(cfg) {
  return merge(buildDefaults(), isObj(cfg) ? cfg : {});
}

// Google Fonts offered in the dashboard. w = weights to request (null = the family's single weight).
const MULTI = '400;700';

export const FONTS = [
  // Clean
  { name: 'Inter', cat: 'Clean', w: '400;500;600;700;800' },
  { name: 'Poppins', cat: 'Clean', w: '400;500;600;700;800' },
  { name: 'Montserrat', cat: 'Clean', w: '400;500;600;700;800' },
  { name: 'Outfit', cat: 'Clean', w: '400;500;600;700;800' },
  { name: 'Space Grotesk', cat: 'Clean', w: MULTI },
  { name: 'Sora', cat: 'Clean', w: '400;600;800' },
  { name: 'Manrope', cat: 'Clean', w: '400;600;800' },
  { name: 'DM Sans', cat: 'Clean', w: MULTI },
  { name: 'Rubik', cat: 'Clean', w: '400;600;800' },
  { name: 'Nunito', cat: 'Clean', w: '400;700;900' },
  { name: 'Quicksand', cat: 'Clean', w: MULTI },
  { name: 'Lexend', cat: 'Clean', w: '400;600;800' },
  { name: 'Urbanist', cat: 'Clean', w: '400;600;800' },
  { name: 'Plus Jakarta Sans', cat: 'Clean', w: '400;600;800' },
  { name: 'Syne', cat: 'Clean', w: '400;600;800' },
  { name: 'Unbounded', cat: 'Clean', w: '400;600;800' },
  { name: 'Fredoka', cat: 'Clean', w: MULTI },
  { name: 'Comfortaa', cat: 'Clean', w: MULTI },
  // Mono / pixel
  { name: 'JetBrains Mono', cat: 'Mono & Pixel', w: '400;700;800' },
  { name: 'Fira Code', cat: 'Mono & Pixel', w: MULTI },
  { name: 'Space Mono', cat: 'Mono & Pixel', w: MULTI },
  { name: 'IBM Plex Mono', cat: 'Mono & Pixel', w: MULTI },
  { name: 'Kode Mono', cat: 'Mono & Pixel', w: MULTI },
  { name: 'Share Tech Mono', cat: 'Mono & Pixel', w: null },
  { name: 'Major Mono Display', cat: 'Mono & Pixel', w: null },
  { name: 'VT323', cat: 'Mono & Pixel', w: null },
  { name: 'Press Start 2P', cat: 'Mono & Pixel', w: null },
  { name: 'Silkscreen', cat: 'Mono & Pixel', w: MULTI },
  { name: 'Pixelify Sans', cat: 'Mono & Pixel', w: MULTI },
  // Display
  { name: 'Orbitron', cat: 'Display', w: '400;700;900' },
  { name: 'Audiowide', cat: 'Display', w: null },
  { name: 'Righteous', cat: 'Display', w: null },
  { name: 'Bebas Neue', cat: 'Display', w: null },
  { name: 'Anton', cat: 'Display', w: null },
  { name: 'Oswald', cat: 'Display', w: MULTI },
  { name: 'Russo One', cat: 'Display', w: null },
  { name: 'Black Ops One', cat: 'Display', w: null },
  { name: 'Bungee', cat: 'Display', w: null },
  { name: 'Monoton', cat: 'Display', w: null },
  { name: 'Rubik Glitch', cat: 'Display', w: null },
  { name: 'Rubik Wet Paint', cat: 'Display', w: null },
  { name: 'Creepster', cat: 'Display', w: null },
  { name: 'Nosifer', cat: 'Display', w: null },
  { name: 'UnifrakturMaguntia', cat: 'Display', w: null },
  // Script / serif
  { name: 'Pacifico', cat: 'Script & Serif', w: null },
  { name: 'Lobster', cat: 'Script & Serif', w: null },
  { name: 'Dancing Script', cat: 'Script & Serif', w: MULTI },
  { name: 'Great Vibes', cat: 'Script & Serif', w: null },
  { name: 'Satisfy', cat: 'Script & Serif', w: null },
  { name: 'Caveat', cat: 'Script & Serif', w: MULTI },
  { name: 'Permanent Marker', cat: 'Script & Serif', w: null },
  { name: 'Shadows Into Light', cat: 'Script & Serif', w: null },
  { name: 'Playfair Display', cat: 'Script & Serif', w: '400;700;900' },
  { name: 'Cinzel', cat: 'Script & Serif', w: '400;700;900' },
  { name: 'Cormorant Garamond', cat: 'Script & Serif', w: MULTI },
];

const BY_NAME = new Map(FONTS.map((f) => [f.name, f]));

export function fontHref(name) {
  const f = BY_NAME.get(name);
  if (!f) return null;
  const fam = f.name.replace(/ /g, '+') + (f.w ? `:wght@${f.w}` : '');
  return `https://fonts.googleapis.com/css2?family=${fam}&display=swap`;
}

export function fontStack(name) {
  if (!name) return null;
  const mono = BY_NAME.get(name)?.cat === 'Mono & Pixel';
  return `'${name.replace(/'/g, '')}', ${mono ? 'ui-monospace, monospace' : 'system-ui, sans-serif'}`;
}

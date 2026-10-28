// Media file naming and types, shared by the upload routes, the importer and both storage backends.
import crypto from 'node:crypto';
import path from 'node:path';

export const EXT_BY_TYPE = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp', 'image/avif': '.avif', 'image/svg+xml': '.svg',
  'image/apng': '.png', 'image/x-icon': '.ico', 'image/vnd.microsoft.icon': '.ico', 'video/mp4': '.mp4', 'video/webm': '.webm',
  'video/quicktime': '.mov', 'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'audio/x-wav': '.wav',
  'audio/mp4': '.m4a', 'audio/aac': '.aac', 'audio/flac': '.flac', 'audio/webm': '.weba', 'font/woff2': '.woff2', 'font/woff': '.woff',
  'font/ttf': '.ttf', 'font/otf': '.otf',
};
export const ALLOWED_EXT = new Set([...Object.values(EXT_BY_TYPE), '.jpeg', '.cur', '.ani', '.ogv', '.m4v', '.opus']);

const TYPE_BY_EXT = {
  ...Object.fromEntries(Object.entries(EXT_BY_TYPE).reverse().map(([type, ext]) => [ext, type])),
  '.png': 'image/png', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.cur': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogv': 'video/ogg', '.m4v': 'video/mp4', '.opus': 'audio/ogg',
};
export const typeOf = (name) => TYPE_BY_EXT[path.extname(name).toLowerCase()] || 'application/octet-stream';

// Uploads travel in parts small enough for Vercel's 4.5 MB request limit. Each part is four
// chunks, and a chunk fits in one Firestore document (1 MiB max).
export const CHUNK_SIZE = 960 * 1024;
export const PART_SIZE = 4 * CHUNK_SIZE;

export function newName(originalName) {
  let ext = path.extname(String(originalName || '')).toLowerCase();
  if (ext === '.jpeg') ext = '.jpg';
  if (!ALLOWED_EXT.has(ext)) return null;
  return `${crypto.randomBytes(9).toString('base64url')}${ext}`;
}

// Names this app generates; anything else is refused so it can't be used as a path.
export const validName = (name) => /^[\w-]{12}\.[a-z0-9]{2,5}$/.test(String(name || ''));

export function mediaKind(name) {
  const ext = path.extname(name).toLowerCase();
  if (['.mp4', '.webm', '.mov', '.m4v', '.ogv'].includes(ext)) return 'video';
  if (['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.weba', '.opus'].includes(ext)) return 'audio';
  if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) return 'font';
  if (['.cur', '.ani'].includes(ext)) return 'cursor';
  return 'image';
}

export const fileInfo = ({ name, size, mtime, label }) => ({ name, url: `/uploads/${name}`, size, mtime, kind: mediaKind(name), label: label || name });

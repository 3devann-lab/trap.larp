import path from 'node:path';

const normPath = (p) => {
  const clean = '/' + String(p || '').trim().replace(/^\/+|\/+$/g, '');
  return clean === '/' ? '/dashboard' : clean;
};

// Variables people type by hand are matched in any capitalization (USEVERCEL, usevercel...).
const anyCase = (name) => {
  const key = Object.keys(process.env).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? process.env[key] : undefined;
};

// Vercel mode keeps everything in Firebase Firestore instead of on disk.
export const USE_VERCEL = /^(1|true|yes|on)$/i.test(String(anyCase('USEVERCEL') || '').trim());
export const FIREBASE_CONFIG = anyCase('GOOGLEFIREBASECONFIG') || '';
// The Firebase user the server signs in as, when GOOGLEFIREBASECONFIG is the web app config.
export const FIREBASE_EMAIL = (anyCase('FIREBASE_EMAIL') || '').trim();
export const FIREBASE_PASSWORD = anyCase('FIREBASE_PASSWORD') || '';
export const ON_VERCEL = Boolean(process.env.VERCEL);

export const PORT = Number(process.env.PORT) || 3000;
export const DATA_DIR = path.resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
export const DASHBOARD_PATH = normPath(process.env.DASHBOARD_PATH || '/dashboard');
export const SESSION_SECRET = process.env.SESSION_SECRET || '';
export const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;
// Firestore's free tier holds 1 GB in total, so Vercel mode defaults to a smaller cap.
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || (USE_VERCEL ? 25 : 150);
const autoDomain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const PUBLIC_URL = (process.env.PUBLIC_URL || (autoDomain ? `https://${autoDomain}` : '')).replace(/\/+$/, '');
// True when running on Railway without a volume attached: data would be lost on every deploy.
export const EPHEMERAL_WARNING = !USE_VERCEL && Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID)
  && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR;

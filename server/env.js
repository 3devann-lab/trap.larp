import path from 'node:path';

const normPath = (p) => {
  const clean = '/' + String(p || '').trim().replace(/^\/+|\/+$/g, '');
  return clean === '/' ? '/dashboard' : clean;
};

export const PORT = Number(process.env.PORT) || 3000;
export const DATA_DIR = path.resolve(process.env.DATA_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || './data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || '';
export const DASHBOARD_PATH = normPath(process.env.DASHBOARD_PATH || '/dashboard');
export const SESSION_SECRET = process.env.SESSION_SECRET || '';
export const SESSION_DAYS = Number(process.env.SESSION_DAYS) || 30;
export const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 150;
export const PUBLIC_URL = (process.env.PUBLIC_URL || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : '')).replace(/\/+$/, '');
// True when running on Railway without a volume attached: data would be lost on every deploy.
export const EPHEMERAL_WARNING = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID)
  && !process.env.RAILWAY_VOLUME_MOUNT_PATH && !process.env.DATA_DIR;

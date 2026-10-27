import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, UPLOAD_DIR } from './env.js';
import { withDefaults } from '../shared/schema.js';

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error(`[store] could not read ${file}:`, err.message);
    return fallback;
  }
}

function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, file);
}

const emptyStats = () => ({
  total: 0, unique: 0, visitors: {}, daily: {}, referrers: {}, clicks: {}, devices: {}, browsers: {}, countries: {}, recent: [],
});

let config = withDefaults(readJson(CONFIG_FILE, {}));
let stats = { ...emptyStats(), ...readJson(STATS_FILE, {}) };
let statsDirty = false;

export const getConfig = () => config;

export function setConfig(next) {
  config = withDefaults(next);
  config.meta = { ...(config.meta || {}), updatedAt: new Date().toISOString() };
  writeJsonAtomic(CONFIG_FILE, config);
  snapshot();
  return config;
}

// Keep a rolling set of daily config snapshots so a bad save can be undone.
function snapshot() {
  const day = new Date().toISOString().slice(0, 10);
  const file = path.join(BACKUP_DIR, `config-${day}.json`);
  try {
    writeJsonAtomic(file, config);
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('config-')).sort();
    for (const old of files.slice(0, Math.max(0, files.length - 14))) fs.unlinkSync(path.join(BACKUP_DIR, old));
  } catch (err) {
    console.error('[store] snapshot failed:', err.message);
  }
}

export function listSnapshots() {
  try {
    return fs.readdirSync(BACKUP_DIR).filter((f) => /^config-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
  } catch {
    return [];
  }
}

export function readSnapshot(name) {
  if (!/^config-\d{4}-\d{2}-\d{2}\.json$/.test(name)) return null;
  return readJson(path.join(BACKUP_DIR, name), null);
}

export const getStats = () => stats;

export function updateStats(fn) {
  fn(stats);
  statsDirty = true;
}

export function resetStats() {
  stats = emptyStats();
  statsDirty = true;
  flushStats();
}

export function flushStats() {
  if (!statsDirty) return;
  statsDirty = false;
  try {
    writeJsonAtomic(STATS_FILE, stats);
  } catch (err) {
    console.error('[store] failed to save stats:', err.message);
  }
}

setInterval(flushStats, 5000).unref();
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    flushStats();
    process.exit(0);
  });
}

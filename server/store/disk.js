// Disk storage (Railway, local): JSON files and uploads under DATA_DIR.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { DATA_DIR, UPLOAD_DIR } from '../env.js';
import { withDefaults } from '../../shared/schema.js';
import { PART_SIZE, fileInfo } from '../media.js';

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const META_FILE = path.join(DATA_DIR, 'media.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

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

const partialPath = (name) => path.join(UPLOAD_DIR, `.partial-${path.basename(name)}`);

export function createStore() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  let config = withDefaults(readJson(CONFIG_FILE, {}));
  let stats = { ...emptyStats(), ...readJson(STATS_FILE, {}) };
  let statsDirty = false;
  // When each visitor was last counted. Kept in insertion order (oldest first) so expired
  // entries can be dropped from the front; no cooldown option is longer than a day.
  const lastCounted = new Map();
  const logins = new Map();

  function flushStats() {
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

  const readMeta = () => readJson(META_FILE, {});
  const writeMeta = (m) => fs.writeFileSync(META_FILE, JSON.stringify(m));

  return {
    async getConfig() { return config; },

    async setConfig(next) {
      config = withDefaults(next);
      config.meta = { ...(config.meta || {}), updatedAt: new Date().toISOString() };
      writeJsonAtomic(CONFIG_FILE, config);
      snapshot();
      return config;
    },

    async listSnapshots() {
      try {
        return fs.readdirSync(BACKUP_DIR).filter((f) => /^config-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse();
      } catch {
        return [];
      }
    },

    async readSnapshot(name) {
      if (!/^config-\d{4}-\d{2}-\d{2}\.json$/.test(name)) return null;
      return readJson(path.join(BACKUP_DIR, name), null);
    },

    async getStats() { return stats; },

    async updateStats(fn) {
      fn(stats);
      statsDirty = true;
    },

    async resetStats() {
      stats = emptyStats();
      statsDirty = true;
      flushStats();
    },

    // Runs one page view against the stats. `fn` gets the stats plus lookups for visitor records
    // ({ day, at }) and returns { counted }; nothing is saved unless it counted. The result
    // carries the stats so callers don't need to read them again.
    async visit(fn) {
      const tx = {
        stats,
        async getVisitor(id, legacyId) {
          let day = stats.visitors[id];
          // Visitors used to be keyed by IP + user agent; carry those over instead of counting them again.
          if (!day && legacyId && stats.visitors[legacyId]) {
            day = stats.visitors[legacyId];
            delete stats.visitors[legacyId];
          }
          return day ? { day, at: lastCounted.get(id) } : null;
        },
        setVisitor(id, { day, at }) {
          stats.visitors[id] = day;
          lastCounted.delete(id);
          lastCounted.set(id, at);
          for (const [k, t] of lastCounted) {
            if (at - t < 864e5) break;
            lastCounted.delete(k);
          }
        },
      };
      const result = await fn(tx);
      if (result.counted) statsDirty = true;
      return { ...result, stats };
    },

    async getLogin(key) { return logins.get(key) || null; },
    async setLogin(key, rec) {
      if (rec) logins.set(key, rec);
      else logins.delete(key);
      if (logins.size > 5000) for (const [k, r] of logins) if (Date.now() - r.first > 864e5) logins.delete(k);
    },

    // ---------- media ----------
    async writePart(name, index, buf) {
      const fh = await fs.promises.open(partialPath(name), index === 0 ? 'w' : 'r+');
      try {
        await fh.write(buf, 0, buf.length, index * PART_SIZE);
      } finally {
        await fh.close();
      }
    },

    async finishFile(name, { label, size }) {
      const partial = partialPath(name);
      const st = await fs.promises.stat(partial).catch(() => null);
      if (!st || st.size !== size) {
        await fs.promises.rm(partial, { force: true });
        throw new Error('Upload was incomplete, try again.');
      }
      await fs.promises.rename(partial, path.join(UPLOAD_DIR, path.basename(name)));
      const meta = readMeta();
      meta[name] = label;
      writeMeta(meta);
      return fileInfo({ name, size, mtime: Date.now(), label });
    },

    async abortFile(name) {
      await fs.promises.rm(partialPath(name), { force: true });
    },

    async listFiles() {
      const meta = readMeta();
      return fs.readdirSync(UPLOAD_DIR)
        .filter((n) => !n.startsWith('.'))
        .map((name) => {
          const st = fs.statSync(path.join(UPLOAD_DIR, name));
          return fileInfo({ name, size: st.size, mtime: st.mtimeMs, label: meta[name] });
        })
        .sort((a, b) => b.mtime - a.mtime);
    },

    async removeFile(name) {
      name = path.basename(name);
      await fs.promises.rm(path.join(UPLOAD_DIR, name), { force: true });
      const meta = readMeta();
      delete meta[name];
      writeMeta(meta);
    },

    serveUploads: express.static(UPLOAD_DIR, { maxAge: '30d', immutable: true, dotfiles: 'ignore' }),
  };
}

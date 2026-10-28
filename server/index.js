// Runs the site as a normal long-lived server (Railway, local). Vercel uses api/index.js instead.
import app from './app.js';
import { PORT, DATA_DIR, DASHBOARD_PATH, DASHBOARD_PASSWORD, EPHEMERAL_WARNING, USE_VERCEL } from './env.js';

app.listen(PORT, () => {
  console.log(`trap.larp running on :${PORT}`);
  console.log(`  profile:   /`);
  console.log(`  dashboard: ${DASHBOARD_PATH}`);
  console.log(`  storage:   ${USE_VERCEL ? 'Firebase Firestore' : DATA_DIR}`);
  if (!DASHBOARD_PASSWORD) console.warn('  ! DASHBOARD_PASSWORD is not set — the dashboard is locked until you set it.');
  if (EPHEMERAL_WARNING) console.warn('  ! No Railway volume attached — settings and uploads will be lost on redeploy. Attach a volume (mount path /data).');
});

// Where settings, analytics and uploads live: files on disk by default (Railway, local), or
// Firebase Firestore when USEVERCEL=true, since Vercel's servers can't keep files.
import { USE_VERCEL, ON_VERCEL } from '../env.js';

let store = null;
// Shown in place of the site when the storage settings are wrong, so the fix is obvious.
let setupError = '';

if (USE_VERCEL) {
  try {
    store = (await import('./firestore.js')).createStore();
  } catch (err) {
    setupError = err.message;
  }
} else if (ON_VERCEL) {
  setupError = 'This is running on Vercel, which can\'t keep files. Add the environment variables USEVERCEL=true and GOOGLEFIREBASECONFIG (see "Deploy on Vercel" in the README), then redeploy.';
} else {
  store = (await import('./disk.js')).createStore();
}

export { store, setupError };

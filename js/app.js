import { state, onChange } from './store.js';
import { $, $$ } from './ui.js';
import * as today from './views/today.js';
import * as read from './views/read.js';
import * as prayers from './views/prayers.js';
import * as reflect from './views/reflect.js';
import * as progress from './views/progress.js';
import * as notes from './views/notes.js';
import * as settings from './views/settings.js';
import * as planView from './views/plan.js';

const ROUTES = { today, read, prayers, reflect, progress, notes, settings, plan: planView };
const main = $('#main');

export function applyLook() {
  const root = document.documentElement;
  root.style.setProperty('--text-size', `${state.settings.textSize}px`);
  if (state.settings.theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = state.settings.theme;
}

let current = '';
async function route() {
  const [name = 'today', ...params] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  const view = ROUTES[name] ?? today;
  const key = location.hash;
  const sameView = current === key;
  current = key;
  $$('.tabbar a').forEach(a => a.classList.toggle('active', a.dataset.tab === (view.tab ?? name)));
  if (!sameView) {
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  await view.render(main, params);
}

window.addEventListener('hashchange', route);
onChange(applyLook);
applyLook();
route();

// When the date rolls over while the app is open in the background, show
// the new day when it comes back.
let shownDate = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== shownDate) {
    shownDate = new Date().toDateString();
    route();
  }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Offline support unavailable', e));
}
if (navigator.storage?.persist) navigator.storage.persist();

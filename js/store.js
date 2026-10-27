// All personal data lives in this one object, saved to the phone's browser
// storage. Nothing here is ever sent over the network.
const KEY = 'meditations:v1';
const VERSION = 1;

export function today(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function blank() {
  return {
    version: VERSION,
    settings: {
      translation: 'BSB',
      esvKey: '',
      commentary: 'matthew-henry',
      theme: 'system',
      textSize: 19,
    },
    // nextDay is the index of the next unread plan day. Missing a day never
    // moves it, so the plan waits for you.
    plan: { nextDay: 0, startedOn: null, completed: {} },
    // Per calendar day: { plan: [dayIndex...], verse: bool, reflected: bool }
    days: {},
    reminders: [],
    prayers: [],
    notes: {},
    lastBackup: null,
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
  } catch (e) {
    console.error('Could not read saved data', e);
  }
  return blank();
}

function migrate(data) {
  const base = blank();
  return { ...base, ...data, settings: { ...base.settings, ...data.settings }, plan: { ...base.plan, ...data.plan } };
}

export const state = load();
const listeners = new Set();

export function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach(fn => fn());
}

export function onChange(fn) {
  listeners.add(fn);
}

export function day(date = today()) {
  return (state.days[date] ??= { plan: [], verse: false, reflected: false });
}

// 'full' = plan reading + reflection, 'light' = quick verse + reflection,
// 'partial' = one of the two, null = nothing.
export function dayStatus(date) {
  const d = state.days[date];
  if (!d) return null;
  const read = d.plan.length > 0;
  if (read && d.reflected) return 'full';
  if (d.verse && d.reflected) return 'light';
  if (read || d.verse || d.reflected) return 'partial';
  return null;
}

export function completePlanDay() {
  const idx = state.plan.nextDay;
  const date = today();
  state.plan.startedOn ??= date;
  state.plan.completed[idx] = date;
  state.plan.nextDay = idx + 1;
  day(date).plan.push(idx);
  save();
}

export function undoPlanDay() {
  const idx = state.plan.nextDay - 1;
  if (idx < 0) return;
  const date = state.plan.completed[idx];
  delete state.plan.completed[idx];
  state.plan.nextDay = idx;
  if (date && state.days[date]) state.days[date].plan = state.days[date].plan.filter(i => i !== idx);
  save();
}

export function exportData() {
  state.lastBackup = today();
  save();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `meditations-backup-${today()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importData(file) {
  const data = JSON.parse(await file.text());
  if (!data || typeof data !== 'object' || data.version !== VERSION || !data.plan || !data.days) {
    throw new Error('This file does not look like a Meditations backup.');
  }
  const next = migrate(data);
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, next);
  save();
}

export function resetAll() {
  localStorage.removeItem(KEY);
  location.reload();
}

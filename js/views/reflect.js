import { state, save, today, day, uid } from '../store.js';
import { pickForDay, markDone, undoDone, scheduleLabel, INTRO_DAYS } from '../reflections.js';
import { esc, sheet } from '../ui.js';

export const tab = 'reflect';
let showArchived = false;

// Today's reminders, picked once per day and then kept.
export function todaysReflections() {
  const date = today();
  const d = day(date);
  if (!d.reflections) {
    d.reflections = pickForDay(state.reminders, date);
    d.doneReflections = {};
    save();
  }
  const byId = new Map(state.reminders.map(r => [r.id, r]));
  return d.reflections.map(id => byId.get(id)).filter(r => r && !r.archived);
}

function syncReflected(d) {
  const list = todaysReflections();
  if (list.length) d.reflected = list.every(r => r.id in (d.doneReflections ?? {}));
}

export function toggleReflection(id) {
  const date = today();
  const d = day(date);
  const r = state.reminders.find(r => r.id === id);
  if (!r) return;
  d.doneReflections ??= {};
  if (id in d.doneReflections) {
    undoDone(r, d.doneReflections[id]);
    delete d.doneReflections[id];
  } else {
    d.doneReflections[id] = markDone(r, date);
  }
  syncReflected(d);
  save();
}

// The tap-to-gray list shared by Today and Reflect.
export function reflectionListHtml() {
  const list = todaysReflections();
  const done = day(today()).doneReflections ?? {};
  if (!list.length) return '';
  const count = list.filter(r => r.id in done).length;
  return `
    <ul class="reflections">${list.map(r => `
      <li><button class="reflection ${r.id in done ? 'done' : ''}" data-reflection="${r.id}" aria-pressed="${r.id in done}">
        <span class="reflection-text">${esc(r.text)}</span>
        <span class="reflection-mark" aria-hidden="true">${r.id in done ? '✓' : ''}</span>
      </button></li>`).join('')}
    </ul>
    <p class="small muted">${count === list.length ? '✓ All reflected on today' : `Tap each one after you've reflected on it · ${count} of ${list.length}`}</p>`;
}

export async function render(main) {
  const date = today();
  const d = day(date);
  const todays = todaysReflections();
  const active = state.reminders.filter(r => !r.archived);
  const archived = state.reminders.filter(r => r.archived);

  main.innerHTML = `
    <div class="page-head">
      <h1>Reflect</h1>
    </div>

    ${todays.length ? `<section class="card"><h2>Today</h2>${reflectionListHtml()}</section>` : ''}

    <form class="add-reminder card">
      <textarea name="text" rows="2" placeholder="e.g. Stay calm. Listen before answering." required></textarea>
      <button class="btn primary" type="submit">Add reminder</button>
    </form>
    <p class="small muted">A new reminder shows every day for ${INTRO_DAYS} days. After that, each one you reflect on comes back at random in 3 to 7 days. You'll see at least 3 a day. Pin a reminder to see it every day.</p>

    ${active.length ? `<h2 class="section">All reminders</h2><ul class="list reminders-edit">${active.map((r, i) => `
      <li class="card reminder">
        <p class="pre">${esc(r.text)}</p>
        <p class="small muted">${esc(scheduleLabel(r, date))}</p>
        <div class="row">
          <button class="icon-btn" data-act="up" data-id="${r.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="icon-btn" data-act="down" data-id="${r.id}" ${i === active.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <span class="spacer"></span>
          <button class="btn ghost small" data-act="pin" data-id="${r.id}" aria-pressed="${!!r.pinned}">${r.pinned ? 'Unpin' : 'Pin'}</button>
          <button class="btn ghost small" data-act="edit" data-id="${r.id}">Edit</button>
          <button class="btn ghost small" data-act="archive" data-id="${r.id}">Put away</button>
        </div>
      </li>`).join('')}</ul>` : `
      <p class="empty">No reminders yet.</p>
      <label class="check big card"><input type="checkbox" data-act="reflected" ${d.reflected ? 'checked' : ''}> I've reflected today</label>`}

    ${archived.length ? `
      <button class="btn ghost" data-act="toggle-archived">${showArchived ? 'Hide' : 'Show'} put-away reminders (${archived.length})</button>
      ${showArchived ? `<ul class="list">${archived.map(r => `
        <li class="card reminder muted">
          <p class="pre">${esc(r.text)}</p>
          <div class="row">
            <button class="btn ghost small" data-act="restore" data-id="${r.id}">Bring back</button>
            <button class="btn ghost small danger" data-act="delete" data-id="${r.id}">Delete</button>
          </div>
        </li>`).join('')}</ul>` : ''}` : ''}
  `;

  main.querySelector('.add-reminder').onsubmit = e => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    if (!text) return;
    const r = { id: uid(), text, created: date, archived: false, introLeft: INTRO_DAYS, nextDue: date, pinned: false };
    state.reminders.push(r);
    todaysReflections();
    d.reflections.push(r.id);
    syncReflected(d);
    save();
    render(main);
  };

  main.onchange = e => {
    if (e.target.dataset.act !== 'reflected') return;
    d.reflected = e.target.checked;
    save();
  };

  main.onclick = e => {
    const tap = e.target.closest('[data-reflection]');
    if (tap) {
      toggleReflection(tap.dataset.reflection);
      return render(main);
    }
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const r = state.reminders.find(r => r.id === b.dataset.id);
    switch (b.dataset.act) {
      case 'up':
      case 'down': {
        const list = state.reminders;
        const i = list.indexOf(r);
        const step = b.dataset.act === 'up' ? -1 : 1;
        let j = i + step;
        while (list[j]?.archived) j += step;
        if (!list[j]) return;
        [list[i], list[j]] = [list[j], list[i]];
        break;
      }
      case 'pin':
        r.pinned = !r.pinned;
        if (r.pinned && !d.reflections.includes(r.id)) d.reflections.push(r.id);
        if (!r.pinned) r.nextDue = date;
        syncReflected(d);
        break;
      case 'archive':
        r.archived = true;
        syncReflected(d);
        break;
      case 'restore':
        r.archived = false;
        r.nextDue = date;
        break;
      case 'delete':
        if (!confirm('Delete this reminder for good?')) return;
        state.reminders = state.reminders.filter(x => x !== r);
        break;
      case 'toggle-archived': showArchived = !showArchived; return render(main);
      case 'edit': return edit(r, main);
      default: return;
    }
    save();
    render(main);
  };
}

function edit(r, main) {
  const d = sheet('Edit reminder', `
    <form class="form">
      <textarea name="text" rows="5" required>${esc(r.text)}</textarea>
      <button class="btn primary" type="submit">Save</button>
    </form>`);
  const form = d.querySelector('form');
  form.onsubmit = e => {
    e.preventDefault();
    r.text = form.text.value.trim();
    save();
    d.close();
    render(main);
  };
}

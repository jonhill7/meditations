import { state, save, today, day, uid } from '../store.js';
import { esc, sheet } from '../ui.js';

export const tab = 'reflect';
let showArchived = false;

export async function render(main) {
  const active = state.reminders.filter(r => !r.archived);
  const archived = state.reminders.filter(r => r.archived);
  const d = day(today());

  main.innerHTML = `
    <div class="page-head">
      <h1>Reflect</h1>
    </div>
    <p class="muted">Reminders you want to read over each morning. Write them in your own words.</p>

    <form class="add-reminder card">
      <textarea name="text" rows="2" placeholder="e.g. Stay calm. Listen before answering." required></textarea>
      <button class="btn primary" type="submit">Add reminder</button>
    </form>

    ${active.length ? `<ul class="list reminders-edit">${active.map((r, i) => `
      <li class="card reminder">
        <p class="pre">${esc(r.text)}</p>
        <div class="row">
          <button class="icon-btn" data-act="up" data-id="${r.id}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button>
          <button class="icon-btn" data-act="down" data-id="${r.id}" ${i === active.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button>
          <span class="spacer"></span>
          <button class="btn ghost small" data-act="edit" data-id="${r.id}">Edit</button>
          <button class="btn ghost small" data-act="archive" data-id="${r.id}">Put away</button>
        </div>
      </li>`).join('')}</ul>` : '<p class="empty">No reminders yet.</p>'}

    <label class="check big card"><input type="checkbox" data-act="reflected" ${d.reflected ? 'checked' : ''}> I've reflected on these today</label>

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
    state.reminders.push({ id: uid(), text, created: today(), archived: false });
    save();
    render(main);
  };

  main.onchange = e => {
    if (e.target.dataset.act !== 'reflected') return;
    d.reflected = e.target.checked;
    save();
  };

  main.onclick = e => {
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
      case 'archive': r.archived = true; break;
      case 'restore': r.archived = false; break;
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

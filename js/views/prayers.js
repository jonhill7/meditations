import { state, save, today, uid } from '../store.js';
import { esc, sheet, shortDate, daysBetween, toast } from '../ui.js';

export const tab = 'prayers';
const DEFAULT_CATEGORIES = ['Family', 'Friends', 'Health', 'Work', 'Church', 'World', 'Personal', 'Thanksgiving'];

export function prayedToday(p) {
  return (p.prayed ?? []).includes(today());
}

function lastPrayed(p, before = null) {
  const list = (p.prayed ?? []).filter(d => !before || d < before);
  return list.length ? list[list.length - 1] : null;
}

// Active prayers you have gone longest without praying for. Ordering ignores
// today's taps so the list stays put while you work through it.
export function prayersDue(n) {
  const t = today();
  return state.prayers
    .filter(p => p.status === 'active')
    .sort((a, b) => (lastPrayed(a, t) ?? '').localeCompare(lastPrayed(b, t) ?? '') || a.created.localeCompare(b.created))
    .slice(0, n);
}

function categories() {
  return [...new Set([...DEFAULT_CATEGORIES, ...state.prayers.map(p => p.category).filter(Boolean)])];
}

let filter = { status: 'active', category: '' };

export async function render(main) {
  const list = state.prayers
    .filter(p => p.status === filter.status && (!filter.category || p.category === filter.category))
    .sort((a, b) => filter.status === 'answered'
      ? (b.answeredOn ?? '').localeCompare(a.answeredOn ?? '')
      : (lastPrayed(a) ?? '').localeCompare(lastPrayed(b) ?? ''));
  const counts = {
    active: state.prayers.filter(p => p.status === 'active').length,
    answered: state.prayers.filter(p => p.status === 'answered').length,
  };
  const usedCats = [...new Set(state.prayers.filter(p => p.status === filter.status).map(p => p.category).filter(Boolean))];

  main.innerHTML = `
    <div class="page-head">
      <h1>Prayers</h1>
      <button class="btn primary" data-act="add">Add</button>
    </div>
    <div class="segmented" role="tablist">
      <button role="tab" aria-selected="${filter.status === 'active'}" data-status="active">Praying (${counts.active})</button>
      <button role="tab" aria-selected="${filter.status === 'answered'}" data-status="answered">Answered (${counts.answered})</button>
    </div>
    ${usedCats.length > 1 ? `<div class="chips">
      <button class="chip ${filter.category ? '' : 'on'}" data-cat="">All</button>
      ${usedCats.map(c => `<button class="chip ${filter.category === c ? 'on' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>` : ''}
    ${list.length ? `<ul class="list">${list.map(item).join('')}</ul>` : `<p class="empty">${filter.status === 'active' ? 'Nothing here yet. Tap Add to write a prayer.' : 'Answered prayers will be kept here as a record of God\'s faithfulness.'}</p>`}
  `;

  main.onclick = e => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.status) {
      filter = { status: t.dataset.status, category: '' };
      return render(main);
    }
    if ('cat' in t.dataset) {
      filter.category = t.dataset.cat;
      return render(main);
    }
    const p = state.prayers.find(p => p.id === t.dataset.id);
    switch (t.dataset.act) {
      case 'add': return edit(null, main);
      case 'edit': return edit(p, main);
      case 'answered': return answer(p, main);
      case 'prayed':
        if (!prayedToday(p)) p.prayed = [...(p.prayed ?? []), today()];
        save();
        return render(main);
      case 'reopen':
        p.status = 'active';
        delete p.answeredOn;
        save();
        return render(main);
    }
  };
}

function item(p) {
  const last = lastPrayed(p);
  const ago = last ? daysBetween(last, today()) : null;
  return `
    <li class="card prayer">
      <div class="card-head">
        <h3>${esc(p.title)}</h3>
        ${p.category ? `<span class="tag">${esc(p.category)}</span>` : ''}
      </div>
      ${p.details ? `<p class="pre">${esc(p.details)}</p>` : ''}
      ${p.status === 'answered' ? `
        <p class="answered">Answered ${esc(shortDate(p.answeredOn))}</p>
        ${p.answerNote ? `<p class="pre muted">${esc(p.answerNote)}</p>` : ''}
        <p class="small muted">Prayed for ${(p.prayed ?? []).length} times since ${esc(shortDate(p.created))}</p>
        <div class="row"><button class="btn ghost small" data-act="edit" data-id="${p.id}">Edit</button><button class="btn ghost small" data-act="reopen" data-id="${p.id}">Keep praying</button></div>
      ` : `
        <p class="small muted">${last ? (ago === 0 ? 'Prayed today' : `Last prayed ${ago === 1 ? 'yesterday' : `${ago} days ago`}`) : 'Not prayed for yet'} · since ${esc(shortDate(p.created))}</p>
        <div class="row">
          ${prayedToday(p) ? '<span class="done-line">✓ Prayed today</span>' : `<button class="btn small" data-act="prayed" data-id="${p.id}">Prayed</button>`}
          <button class="btn ghost small" data-act="answered" data-id="${p.id}">Answered</button>
          <button class="btn ghost small" data-act="edit" data-id="${p.id}">Edit</button>
        </div>
      `}
    </li>`;
}

function edit(p, main) {
  const d = sheet(p ? 'Edit prayer' : 'New prayer', `
    <form class="form">
      <label>Prayer<input name="title" required maxlength="140" value="${esc(p?.title)}" placeholder="Who or what you are praying for"></label>
      <label>Details<textarea name="details" rows="4" placeholder="Optional">${esc(p?.details)}</textarea></label>
      <label>Category<input name="category" list="prayer-cats" value="${esc(p?.category)}" placeholder="Optional"></label>
      <datalist id="prayer-cats">${categories().map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      ${p?.status === 'answered' ? `
        <label>Answered on<input type="date" name="answeredOn" value="${esc(p.answeredOn)}"></label>
        <label>How it was answered<textarea name="answerNote" rows="3">${esc(p.answerNote)}</textarea></label>` : ''}
      <div class="row">
        <button class="btn primary" type="submit">Save</button>
        ${p ? '<button class="btn danger" type="button" data-del>Delete</button>' : ''}
      </div>
    </form>`);
  const form = d.querySelector('form');
  form.onsubmit = e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    const target = p ?? { id: uid(), created: today(), status: 'active', prayed: [] };
    Object.assign(target, { title: f.title.trim(), details: f.details.trim(), category: f.category.trim() });
    if (p?.status === 'answered') Object.assign(target, { answeredOn: f.answeredOn || today(), answerNote: f.answerNote.trim() });
    if (!p) state.prayers.push(target);
    save();
    d.close();
    render(main);
  };
  d.querySelector('[data-del]')?.addEventListener('click', () => {
    if (!confirm('Delete this prayer for good?')) return;
    state.prayers = state.prayers.filter(x => x !== p);
    save();
    d.close();
    render(main);
  });
  if (!p) form.title.focus();
}

function answer(p, main) {
  const d = sheet('Answered prayer', `
    <form class="form">
      <p><strong>${esc(p.title)}</strong></p>
      <label>Answered on<input type="date" name="answeredOn" value="${today()}" required></label>
      <label>How was it answered?<textarea name="answerNote" rows="4" placeholder="Optional, but worth remembering"></textarea></label>
      <button class="btn primary" type="submit">Mark answered</button>
    </form>`);
  const form = d.querySelector('form');
  form.onsubmit = e => {
    e.preventDefault();
    Object.assign(p, { status: 'answered', answeredOn: form.answeredOn.value, answerNote: form.answerNote.value.trim() });
    save();
    d.close();
    toast('Praise God');
    render(main);
  };
}

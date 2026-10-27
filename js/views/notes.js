import { state } from '../store.js';
import { formatRef, parseRef, refKey } from '../books.js';
import { esc } from '../ui.js';

export const tab = 'read';
let query = '';
let order = 'bible';

export async function render(main) {
  main.innerHTML = `
    <div class="page-head"><a class="back" href="#/read">‹ Bible</a><h1>My notes</h1></div>
    <div class="row">
      <input type="search" class="search" placeholder="Search notes" value="${esc(query)}" aria-label="Search notes">
      <select class="order" aria-label="Sort">
        <option value="bible" ${order === 'bible' ? 'selected' : ''}>Bible order</option>
        <option value="recent" ${order === 'recent' ? 'selected' : ''}>Most recent</option>
      </select>
    </div>
    <ul class="list notes-list"></ul>
  `;
  const listEl = main.querySelector('.notes-list');
  const draw = () => {
    const q = query.toLowerCase();
    const items = Object.entries(state.notes)
      .filter(([ref, n]) => !q || n.text.toLowerCase().includes(q) || formatRef(ref).toLowerCase().includes(q))
      .sort(order === 'bible' ? ([a], [b]) => refKey(a) - refKey(b) : ([, a], [, b]) => b.updated - a.updated);
    listEl.innerHTML = items.length ? items.map(([ref, n]) => {
      const r = parseRef(ref);
      return `<li class="card">
        <a class="note-ref" href="#/read/${r.book}/${r.chapter}/v${r.verse}">${esc(formatRef(ref))}</a>
        <p class="pre">${esc(n.text)}</p>
        <p class="small muted">${esc(new Date(n.updated).toLocaleDateString())}</p>
      </li>`;
    }).join('') : `<p class="empty">${Object.keys(state.notes).length ? 'No notes match.' : 'Tap any verse while reading to write a note on it.'}</p>`;
  };
  draw();
  main.querySelector('.search').oninput = e => { query = e.target.value; draw(); };
  main.querySelector('.order').onchange = e => { order = e.target.value; draw(); };
  main.onclick = null;
}

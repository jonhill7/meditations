import { state, today, dayStatus } from '../store.js';
import { buildPlan } from '../plan.js';
import { bookName } from '../books.js';
import { esc, sheet, longDate, daysBetween } from '../ui.js';

export const tab = 'progress';
let shown = null; // [year, monthIndex]

const LABELS = {
  full: 'Read the plan and reflected',
  light: 'Quick verse and reflected',
  partial: 'Part of the practice',
};

export async function render(main) {
  const t = today();
  const [ty, tm] = t.split('-').map(Number);
  shown ??= [ty, tm - 1];
  const [y, m] = shown;
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const lead = first.getDay();
  const pad = n => String(n).padStart(2, '0');
  const dateOf = n => `${y}-${pad(m + 1)}-${pad(n)}`;

  const counts = { full: 0, light: 0, partial: 0 };
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell empty"></span>');
  for (let n = 1; n <= daysInMonth; n++) {
    const date = dateOf(n);
    const s = dayStatus(date);
    if (s) counts[s]++;
    cells.push(`<button class="cal-cell ${s ?? ''} ${date === t ? 'today' : ''}" data-date="${date}" ${date > t ? 'disabled' : ''} aria-label="${esc(longDate(date))}${s ? `: ${LABELS[s]}` : ''}">${n}</button>`);
  }
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: 'narrow' }));
  const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const isCurrent = y === ty && m === tm - 1;

  const plan = buildPlan();
  const done = state.plan.nextDay;
  const pct = Math.round((done / plan.length) * 100);
  const chaptersRead = plan.slice(0, done).reduce((n, d) => n + d.length, 0);
  // Project a finish date once there's at least a week or so of history.
  let finish = '';
  if (state.plan.startedOn && done < plan.length) {
    const window = Math.min(30, daysBetween(state.plan.startedOn, t) + 1);
    const recent = Object.values(state.plan.completed).filter(d => daysBetween(d, t) < window).length;
    if (window >= 7 && recent > 0) {
      const f = new Date();
      f.setDate(f.getDate() + Math.ceil((plan.length - done) * window / recent));
      finish = `At your recent pace, you'll finish around ${f.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.`;
    }
  }
  const practiced = Object.keys(state.days).filter(d => d.startsWith(String(ty)) && ['full', 'light'].includes(dayStatus(d))).length;
  const answered = state.prayers.filter(p => p.status === 'answered').length;

  main.innerHTML = `
    <div class="page-head"><h1>Progress</h1></div>

    <section class="card">
      <div class="cal-nav">
        <button class="icon-btn" data-nav="-1" aria-label="Previous month">‹</button>
        <h2>${esc(monthLabel)}</h2>
        <button class="icon-btn" data-nav="1" aria-label="Next month" ${isCurrent ? 'disabled' : ''}>›</button>
      </div>
      <div class="cal">
        ${weekdays.map(w => `<span class="cal-wd">${esc(w)}</span>`).join('')}
        ${cells.join('')}
      </div>
      <ul class="legend">
        <li><span class="cal-dot full"></span>${LABELS.full} <b>${counts.full}</b></li>
        <li><span class="cal-dot light"></span>${LABELS.light} <b>${counts.light}</b></li>
        <li><span class="cal-dot partial"></span>${LABELS.partial} <b>${counts.partial}</b></li>
      </ul>
    </section>

    <section class="card">
      <h2>Reading plan</h2>
      <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>
      <p>${done} of ${plan.length} days · ${chaptersRead} chapters · ${pct}%</p>
      ${finish ? `<p class="muted">${finish}</p>` : ''}
    </section>

    <section class="card stats">
      <div><b>${practiced}</b><span>mornings this year</span></div>
      <div><b>${answered}</b><span>answered prayers</span></div>
      <div><b>${Object.keys(state.notes).length}</b><span>verse notes</span></div>
    </section>
  `;

  main.onclick = e => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      const d = new Date(y, m + Number(nav.dataset.nav), 1);
      shown = [d.getFullYear(), d.getMonth()];
      return render(main);
    }
    const cell = e.target.closest('[data-date]');
    if (cell) detail(cell.dataset.date);
  };
}

function detail(date) {
  const d = state.days[date];
  const plan = buildPlan();
  const lines = [];
  if (d?.plan.length) {
    for (const idx of d.plan) {
      lines.push(`<li>✓ Plan day ${idx + 1}: ${plan[idx].map(([b, c]) => `${esc(bookName(b))} ${c}`).join(', ')}</li>`);
    }
  } else if (d?.verse) lines.push('<li>✓ Read the verse of the day</li>');
  else lines.push('<li class="muted">No reading recorded</li>');
  lines.push(d?.reflected ? '<li>✓ Reflected</li>' : '<li class="muted">No reflection recorded</li>');
  const prayed = state.prayers.filter(p => (p.prayed ?? []).includes(date));
  if (prayed.length) lines.push(`<li>✓ Prayed for ${prayed.map(p => esc(p.title)).join(', ')}</li>`);
  sheet(longDate(date), `<ul class="detail">${lines.join('')}</ul>`);
}

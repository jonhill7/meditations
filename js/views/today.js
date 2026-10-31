import { state, save, today, day, dayStatus, completePlanDay, undoPlanDay } from '../store.js';
import { buildPlan, PLAN_NAME } from '../plan.js';
import { bookName, formatRef } from '../books.js';
import { getPassage } from '../bible.js';
import { verseForDate } from '../votd.js';
import { esc, longDate, daysBetween, toast } from '../ui.js';
import { prayedToday, prayersDue } from './prayers.js';
import { todaysReflections, toggleReflection, reflectionListHtml } from './reflect.js';

export function planDayHtml(idx) {
  const plan = buildPlan();
  if (idx >= plan.length) return '';
  return plan[idx]
    .map(([b, c]) => `<a class="chapter-link" href="#/read/${b}/${c}/plan">${esc(bookName(b))} ${c}</a>`)
    .join('');
}

export async function render(main) {
  const date = today();
  const d = day(date);
  const plan = buildPlan();
  const { nextDay } = state.plan;
  const doneToday = d.plan.length > 0;
  const finished = nextDay >= plan.length;
  const status = dayStatus(date);
  const reflections = todaysReflections();
  const due = prayersDue(3);
  const verseRef = verseForDate(date);

  const hasData = state.reminders.length || state.prayers.length || Object.keys(state.notes).length || nextDay > 0;
  const backupAge = state.lastBackup ? daysBetween(state.lastBackup, date) : Infinity;
  const nudge = hasData && backupAge > 14;

  const shownIdx = doneToday ? d.plan[d.plan.length - 1] : nextDay;

  main.innerHTML = `
    <section class="hero">
      <p class="eyebrow">${esc(longDate(date))}</p>
      <h1>${status === 'full' || status === 'light' ? 'Today is complete' : 'Good morning'}</h1>
      <p class="muted">${statusLine(status, d)}</p>
    </section>

    ${nudge ? `<a class="banner" href="#/settings">Your notes live only on this phone. ${state.lastBackup ? `Last backup ${backupAge} days ago.` : 'You have not made a backup yet.'} Tap to export one.</a>` : ''}

    <section class="card">
      <div class="card-head">
        <h2>Today's reading</h2>
        <a class="small" href="#/plan">${esc(PLAN_NAME)} · Day ${Math.min(shownIdx + 1, plan.length)} of ${plan.length}</a>
      </div>
      ${finished && !doneToday ? `<p>You have finished the whole plan. Well done. You can start again from Settings.</p>` : `
        <div class="chapters">${planDayHtml(shownIdx)}</div>
        ${doneToday
          ? `<p class="done-line">✓ Read today${d.plan.length > 1 ? ` (${d.plan.length} days of the plan)` : ''}</p>
             <div class="row">
               ${finished ? '' : `<button class="btn ghost" data-act="ahead">Read ahead: Day ${nextDay + 1}</button>`}
               <button class="btn ghost" data-act="undo">Undo</button>
             </div>
             ${finished ? '' : `<div class="ahead hidden">${planDayHtml(nextDay)}<button class="btn" data-act="done">Mark Day ${nextDay + 1} read</button></div>`}`
          : `<button class="btn primary" data-act="done">Mark Day ${nextDay + 1} read</button>`}
      `}
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Verse for a hurried morning</h2>
        <a class="small" href="#/read/${verseRef.split(' ')[0]}/${verseRef.split(' ')[1].split(':')[0]}">${esc(formatRef(verseRef))}</a>
      </div>
      <blockquote class="votd" id="votd">…</blockquote>
      ${doneToday ? '' : `<label class="check"><input type="checkbox" data-act="verse" ${d.verse ? 'checked' : ''}> Count this as today's reading</label>`}
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Reflect</h2>
        <a class="small" href="#/reflect">Edit reminders</a>
      </div>
      ${reflections.length
        ? reflectionListHtml()
        : `<p class="muted">Add a few short reminders, like "Stay calm," to read over each morning.</p>
           <label class="check big"><input type="checkbox" data-act="reflected" ${d.reflected ? 'checked' : ''}> I've reflected today</label>`}
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Pray</h2>
        <a class="small" href="#/prayers">All prayers</a>
      </div>
      ${due.length
        ? `<ul class="prayer-mini">${due.map(p => `
            <li>
              <div><strong>${esc(p.title)}</strong>${p.category ? ` <span class="tag">${esc(p.category)}</span>` : ''}</div>
              ${prayedToday(p)
                ? '<span class="done-line">✓ Prayed</span>'
                : `<button class="btn small" data-act="prayed" data-id="${p.id}">Prayed</button>`}
            </li>`).join('')}</ul>`
        : `<p class="muted">No active prayers yet. <a href="#/prayers">Add one.</a></p>`}
    </section>
  `;

  getPassage(verseRef).then(vs => {
    const el = main.querySelector('#votd');
    if (el) el.innerHTML = vs.map(v => esc(v.text)).join(' ') + ` <cite>${esc(vs[0]?.translation ?? '')}</cite>`;
  }).catch(() => {
    const el = main.querySelector('#votd');
    if (el) el.textContent = 'Could not load this verse.';
  });

  main.onclick = e => {
    const tap = e.target.closest('[data-reflection]');
    if (tap) {
      toggleReflection(tap.dataset.reflection);
      return render(main);
    }
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.tagName === 'INPUT') return;
    const act = btn.dataset.act;
    if (act === 'done') {
      completePlanDay();
      toast('Reading marked done');
    } else if (act === 'undo') {
      undoPlanDay();
    } else if (act === 'ahead') {
      main.querySelector('.ahead').classList.toggle('hidden');
      return;
    } else if (act === 'prayed') {
      const p = state.prayers.find(p => p.id === btn.dataset.id);
      p.prayed = [...(p.prayed ?? []), date];
      save();
    } else return;
    render(main);
  };
  main.onchange = e => {
    const act = e.target.dataset.act;
    if (act === 'verse') d.verse = e.target.checked;
    else if (act === 'reflected') d.reflected = e.target.checked;
    else return;
    save();
    render(main);
  };
}

function statusLine(status, d) {
  if (status === 'full') return 'You read your plan and reflected. See you tomorrow.';
  if (status === 'light') return 'Short on time, but you showed up. That counts.';
  const read = d.plan.length > 0 || d.verse;
  if (read) return 'Reading done. Take a moment to reflect.';
  if (d.reflected) return 'Reflection done. Read when you can.';
  return 'Read, reflect, and pray.';
}

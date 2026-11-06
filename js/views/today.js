import { state, save, today, day, dayStatus, completePlanDay, undoPlanDay } from '../store.js';
import { buildPlan, PLAN_NAME } from '../plan.js';
import { bookName, formatRef } from '../books.js';
import { getPassage } from '../bible.js';
import { verseForDate } from '../votd.js';
import { esc, longDate, daysBetween, toast } from '../ui.js';
import { prayedToday, prayersDue, versesHtml, toggleVerse } from './prayers.js';
import { inMemory, addToMemory } from './memory.js';
import { widgetPicks, widgetSettings, widgetUrl, mergeVerseRefs, toggle, schedulePublish } from '../widget.js';
import { cardLabel } from '../memory.js';
import { parseRef as parseVerseRef } from '../books.js';
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
  const picks = widgetPicks(date);

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
      <div class="row">
        <button class="btn ghost small pin ${picks.votd ? 'on' : ''}" data-act="pin-votd" aria-pressed="${picks.votd}">${picks.votd ? '✓ On your widget' : 'Pin to widget'}</button>
        ${inMemory([verseRef])
          ? '<span class="small muted">✓ In your memory verses</span>'
          : '<button class="btn ghost small" data-act="memorize">Memorize this verse</button>'}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <h2>Pray</h2>
        <a class="small" href="#/prayers">All prayers</a>
      </div>
      ${due.length
        ? `<ul class="prayer-mini">${due.map(p => `
            <li>
              <div class="grow"><strong>${esc(p.title)}</strong>${p.category ? ` <span class="tag">${esc(p.category)}</span>` : ''}${versesHtml(p)}</div>
              ${prayedToday(p)
                ? '<span class="done-line">✓ Prayed</span>'
                : `<button class="btn small" data-act="prayed" data-id="${p.id}">Prayed</button>`}
            </li>`).join('')}</ul>`
        : `<p class="muted">No active prayers yet. <a href="#/prayers">Add one.</a></p>`}
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

    ${widgetCardHtml(date, verseRef)}
  `;

  getPassage(verseRef).then(vs => {
    const el = main.querySelector('#votd');
    if (el) el.innerHTML = vs.map(v => esc(v.text)).join(' ') + ` <cite>${esc(vs[0]?.translation ?? '')}</cite>`;
  }).catch(() => {
    const el = main.querySelector('#votd');
    if (el) el.textContent = 'Could not load this verse.';
  });

  main.onclick = e => {
    if (toggleVerse(e)) return;
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
    } else if (act === 'memorize') {
      addToMemory([verseRef]);
      toast('Added to your memory verses');
    } else if (act === 'prayed') {
      const p = state.prayers.find(p => p.id === btn.dataset.id);
      p.prayed = [...(p.prayed ?? []), date];
      save();
      if (widgetSettings().prayers) schedulePublish();
    } else if (act === 'pin-votd') {
      picks.votd = !picks.votd;
      save();
      schedulePublish();
    } else if (act === 'unpin') {
      const [kind, value] = btn.dataset.pin.split('::');
      if (kind === 'votd') picks.votd = false;
      if (kind === 'memory') picks.memory = picks.memory.filter(id => id !== value);
      if (kind === 'verse') {
        const r = parseVerseRef(value);
        picks.verses = picks.verses.filter(v => {
          const x = parseVerseRef(v);
          return !(x.book === r.book && x.chapter === r.chapter && x.verse >= r.verse && x.verse <= r.endVerse);
        });
      }
      save();
      schedulePublish();
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

// What today's widget will show, with a way to take things off it.
function widgetCardHtml(date, verseRef) {
  const picks = widgetPicks(date);
  const ws = widgetSettings();
  const d = state.days[date] ?? {};
  const rows = [];
  if (picks.votd) rows.push([formatRef(verseRef), 'votd::']);
  for (const ref of mergeVerseRefs(picks.verses)) rows.push([formatRef(ref), `verse::${ref}`]);
  for (const id of picks.memory) {
    const c = state.memory.cards[id];
    if (c) rows.push([`${cardLabel(c)} (memory)`, `memory::${id}`]);
  }
  const extras = [];
  const nReflections = Object.keys(d.doneReflections ?? {}).length;
  if (ws.reflections && nReflections) extras.push(`${nReflections} selected reflection${nReflections === 1 ? '' : 's'}`);
  const nPrayers = state.prayers.filter(p => p.status === 'active' && (p.prayed ?? []).includes(date)).length;
  if (ws.prayers && nPrayers) extras.push(`${nPrayers} prayer${nPrayers === 1 ? '' : 's'} you prayed`);
  if (!rows.length && !extras.length && !ws.lastPublished) return '';
  const time = ws.lastPublished && ws.lastPublished.slice(0, 10) === new Date().toISOString().slice(0, 10)
    ? new Date(ws.lastPublished).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;
  const status = !widgetUrl() ? 'The widget isn\'t set up yet. See Settings.'
    : ws.lastError ? `Couldn't update the widget (${esc(ws.lastError)}). It will try again on your next change.`
    : time ? `Widget updated at ${time}.` : '';
  return `
    <section class="card">
      <div class="card-head">
        <h2>On your widget</h2>
        <a class="small" href="#/settings">Widget settings</a>
      </div>
      ${rows.length ? `<ul class="widget-list">${rows.map(([label, pin]) => `
        <li><span>${esc(label)}</span><button class="icon-btn" data-act="unpin" data-pin="${esc(pin)}" aria-label="Take ${esc(label)} off the widget">✕</button></li>`).join('')}</ul>` : ''}
      ${extras.length ? `<p class="small">Also: ${extras.join(' and ')}.</p>` : ''}
      ${!rows.length && !extras.length ? '<p class="muted small">Nothing pinned yet. Pin the verse above, or tap any verse while reading or in Memory.</p>' : ''}
      ${status ? `<p class="small muted">${status}</p>` : ''}
    </section>`;
}

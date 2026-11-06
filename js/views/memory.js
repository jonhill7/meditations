import { state, save, today } from '../store.js';
import { parseTypedRef, formatRef } from '../books.js';
import { getPassage, availableTranslations } from '../bible.js';
import { TMS, TMS_VERSES } from '../tms.js';
import { newCard, cardId, cardLabel, finishLearning, grade, preview, isDue, verseKeys, maskWords, seedFor, LEARN_STAGES } from '../memory.js';
import { esc, sheet, toast, shortDate, daysBetween } from '../ui.js';
import { widgetPicks, toggle, schedulePublish } from '../widget.js';

export const tab = 'memory';
let view = 'mine';

const cards = () => state.memory.cards;

export function memoryTranslation() {
  const available = availableTranslations();
  if (!state.memory.translationPicked && available.includes('NIV')) return 'NIV';
  const t = state.memory.translation;
  return available.includes(t) ? t : 'BSB';
}

export function inMemory(refs) {
  return !!cards()[cardId(refs)];
}

export function addToMemory(refs, extra = {}) {
  const id = cardId(refs);
  if (cards()[id]) return false;
  const tms = TMS_VERSES.find(v => cardId(v.refs) === id);
  cards()[id] = newCard(refs, today(), tms ? { pack: tms.pack, topic: tms.topic } : extra);
  save();
  return true;
}

// 'BOOK c:v' keys of verses that have moved past learning.
export function memorizedKeys() {
  const keys = new Set();
  for (const c of Object.values(cards())) if (c.status === 'review') verseKeys(c).forEach(k => keys.add(k));
  return keys;
}

export async function cardText(card, translation = memoryTranslation()) {
  const parts = [];
  let shown = translation;
  for (const ref of card.refs) {
    const vs = await getPassage(ref, translation);
    shown = vs[0]?.translation ?? shown;
    parts.push(vs.map(v => v.text).join(' '));
  }
  // `shown` differs from `translation` when the ESV couldn't load.
  return { text: parts.join(' … '), translation: shown };
}

function statusHtml(c, date) {
  if (c.status === 'learning') return '<span class="tag learning">Learning</span>';
  if (isDue(c, date)) return '<span class="tag due">Due</span>';
  const n = daysBetween(date, c.due);
  return `<span class="tag memorized">Memorized · next ${n === 1 ? 'tomorrow' : `in ${n} days`}</span>`;
}

export async function render(main, [mode, arg]) {
  if (mode === 'review') return renderReview(main);
  if (mode === 'learn') return renderLearn(main, decodeURIComponent(arg ?? ''));
  return renderHome(main);
}

function renderHome(main) {
  const date = today();
  const all = Object.values(cards());
  const due = all.filter(c => isDue(c, date));
  const learning = all.filter(c => c.status === 'learning');
  const memorized = all.filter(c => c.status === 'review');
  const upcoming = memorized.filter(c => !isDue(c, date)).map(c => c.due).sort()[0];
  const tr = memoryTranslation();

  main.innerHTML = `
    <div class="page-head"><h1>Memory</h1></div>
    <div class="segmented" role="radiogroup" aria-label="Translation">
      ${availableTranslations().map(t => `<button role="radio" aria-checked="${t === tr}" data-tr="${t}">${t}</button>`).join('')}
    </div>

    <section class="card">
      ${due.length
        ? `<h2>${due.length} verse${due.length === 1 ? '' : 's'} to review</h2>
           <p class="muted">Say each one from memory, reference first and last, then check yourself.</p>
           <a class="btn primary wide" href="#/memory/review">Start review</a>`
        : `<h2>${memorized.length ? 'All caught up' : 'Start memorizing'}</h2>
           <p class="muted">${memorized.length ? `Next review ${upcoming ? esc(shortDate(upcoming)) : ''}.` : 'Add verses from the Topical Memory System below, or any verse you like.'}</p>`}
      ${learning.length ? `<a class="btn ghost wide" href="#/memory/learn/${encodeURIComponent(learning[0].id)}">Keep learning (${learning.length})</a>` : ''}
      <p class="small muted">${memorized.length} memorized · ${learning.length} learning</p>
    </section>

    <div class="segmented" role="tablist">
      <button role="tab" aria-selected="${view === 'mine'}" data-view="mine">My verses (${all.length})</button>
      <button role="tab" aria-selected="${view === 'tms'}" data-view="tms">Topical Memory System</button>
    </div>
    <div id="memory-body">${view === 'mine' ? mineHtml(all, date) : tmsHtml(date)}</div>
  `;

  main.onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.tr) {
      state.memory.translation = b.dataset.tr;
      state.memory.translationPicked = true;
      save();
      return renderHome(main);
    }
    if (b.dataset.view) {
      view = b.dataset.view;
      return renderHome(main);
    }
    if (b.dataset.addRefs) {
      addToMemory(b.dataset.addRefs.split('|'));
      return renderHome(main);
    }
    if (b.dataset.addPack) {
      const n = TMS_VERSES.filter(v => v.pack === b.dataset.addPack && addToMemory(v.refs)).length;
      toast(n ? `Added ${n} verses` : 'Already added');
      return renderHome(main);
    }
    if (b.dataset.card) return detail(cards()[b.dataset.card], main);
  };

  const form = main.querySelector('.add-memory');
  if (form) form.onsubmit = e => {
    e.preventDefault();
    const ref = parseTypedRef(form.ref.value);
    const err = form.querySelector('.error');
    if (!ref || !ref.includes(':')) {
      err.hidden = false;
      err.textContent = `Couldn't read "${form.ref.value}". Try something like John 3:16 or Phil 4:6-7.`;
      return;
    }
    const added = addToMemory([ref], { topic: form.topic.value.trim() || undefined });
    toast(added ? `Added ${formatRef(ref)}` : 'Already in your verses');
    renderHome(main);
  };
}

function rowHtml(c, date) {
  return `<li><button class="mem-row" data-card="${esc(c.id)}">
    <strong>${esc(cardLabel(c))}</strong>
    ${statusHtml(c, date)}
  </button></li>`;
}

function mineHtml(all, date) {
  const add = `
    <form class="card add-memory">
      <h2>Add a verse</h2>
      <div class="row">
        <input name="ref" class="grow" placeholder="e.g. Romans 8:28" autocomplete="off" required>
        <input name="topic" class="grow" placeholder="Topic (optional)" autocomplete="off">
        <button class="btn primary" type="submit">Add</button>
      </div>
      <p class="small error" hidden></p>
      <p class="small muted">You can also tap any verse while reading, or use the verse of the day.</p>
    </form>`;
  if (!all.length) return add;
  const groups = [];
  for (const p of TMS) {
    const inPack = all.filter(c => c.pack === p.pack);
    if (!inPack.length) continue;
    const topics = p.topics.map(([t]) => t).filter(t => inPack.some(c => c.topic === t));
    groups.push(`<section class="card"><h2>Pack ${p.pack}: ${esc(p.title)}</h2>${topics.map(t => `
      <h3 class="topic">${esc(t)}</h3>
      <ul class="list">${inPack.filter(c => c.topic === t).map(c => rowHtml(c, date)).join('')}</ul>`).join('')}</section>`);
  }
  const own = all.filter(c => !c.pack);
  if (own.length) {
    const topics = [...new Set(own.map(c => c.topic ?? ''))].sort((a, b) => (a === '') - (b === '') || a.localeCompare(b));
    groups.push(`<section class="card"><h2>My own verses</h2>${topics.map(t => `
      ${t ? `<h3 class="topic">${esc(t)}</h3>` : (topics.length > 1 ? '<h3 class="topic">No topic</h3>' : '')}
      <ul class="list">${own.filter(c => (c.topic ?? '') === t).map(c => rowHtml(c, date)).join('')}</ul>`).join('')}</section>`);
  }
  return groups.join('') + add;
}

function tmsHtml(date) {
  return `<p class="small muted">The Navigators' Topical Memory System: 60 verses in 5 packs, two verses on each of 6 topics per pack. It's usually learned a pack at a time, about two verses a week.</p>` +
    TMS.map(p => `
    <section class="card">
      <div class="card-head">
        <h2>Pack ${p.pack}: ${esc(p.title)}</h2>
        <button class="btn ghost small" data-add-pack="${p.pack}">Add all</button>
      </div>
      ${p.topics.map(([topic, ...verses]) => `
        <h3 class="topic">${esc(topic)}</h3>
        <ul class="list">${verses.map(refs => {
          const c = cards()[cardId(refs)];
          return c ? rowHtml(c, date) : `<li><div class="mem-row">
            <strong>${esc(cardLabel({ refs }))}</strong>
            <button class="btn ghost small" data-add-refs="${esc(refs.join('|'))}">Add</button>
          </div></li>`;
        }).join('')}</ul>`).join('')}
    </section>`).join('');
}

function detail(c, main) {
  const date = today();
  const d = sheet(cardLabel(c), `
    <blockquote class="study-verse mem-text">…</blockquote>
    <p>${statusHtml(c, date)}${c.topic ? ` <span class="tag">${esc(c.topic)}</span>` : ''}</p>
    ${c.status === 'review' ? `<p class="small muted">Reviewed ${c.reps} time${c.reps === 1 ? '' : 's'}${c.last ? `, last on ${esc(shortDate(c.last))}` : ''}. Next review ${esc(shortDate(c.due))}.</p>` : ''}
    <div class="row">
      <a class="btn primary" href="#/memory/learn/${encodeURIComponent(c.id)}">${c.status === 'learning' ? 'Learn' : 'Practice'}</a>
      <a class="btn ghost" href="#/read/${c.refs[0].split(' ')[0]}/${c.refs[0].split(' ')[1].split(':')[0]}/v${c.refs[0].split(':')[1].split('-')[0]}">Open in Bible</a>
      <button class="btn ghost pin ${widgetPicks().memory.includes(c.id) ? 'on' : ''}" data-pin>${widgetPicks().memory.includes(c.id) ? '✓ On today\'s widget' : 'Pin to widget'}</button>
      <button class="btn danger" data-remove>Remove</button>
    </div>`);
  d.querySelector('[data-pin]').onclick = e => {
    const on = toggle(widgetPicks().memory, c.id);
    save();
    schedulePublish();
    e.target.classList.toggle('on', on);
    e.target.textContent = on ? '✓ On today\'s widget' : 'Pin to widget';
  };
  cardText(c).then(({ text, translation }) => {
    d.querySelector('.mem-text').innerHTML = `${esc(text)} <cite>${esc(translation)}</cite>`;
  });
  d.querySelector('[data-remove]').onclick = () => {
    if (!confirm(`Remove ${cardLabel(c)} and its review history?`)) return;
    delete cards()[c.id];
    save();
    d.close();
    renderHome(main);
  };
}

// Guided learning: read it, then say it with more and more words hidden.
const STAGE_HELP = [
  'Read it aloud three times. Say the reference before and after: it anchors the verse.',
  'Some words are hidden. Say the whole verse; tap a blank if you need to peek.',
  'Most words are hidden now. Say it again, reference first and last.',
  'Only first letters. Say it through.',
  'From memory. Say it, then reveal to check.',
];

async function renderLearn(main, id) {
  const c = cards()[id];
  if (!c) return renderHome(main);
  const practice = c.status === 'review';
  let stage = practice ? 0 : Math.min(c.stage ?? 0, LEARN_STAGES - 1);
  let revealed = false;
  main.innerHTML = '<p class="muted">Loading…</p>';
  const { text, translation } = await cardText(c);
  const seed = seedFor(c.id);

  const draw = () => {
    const words = maskWords(text, stage, seed);
    const body = stage === LEARN_STAGES - 1 && !revealed
      ? '<p class="muted center">Say it from memory.</p>'
      : words.map((w, i) => {
          if (!w.hidden || revealed) return `<span>${esc(w.word)}</span>`;
          const m = /^(.*?)([.,;:!?"”’')\]]*)$/.exec(w.word);
          const core = m[1] || w.word;
          const tail = m[1] ? m[2] : '';
          const lead = w.firstLetter ? esc(core[0]) : '';
          const gap = `<span class="gap">${esc(w.firstLetter ? core.slice(1) : core)}</span>`;
          return `<button class="blank" data-i="${i}" aria-label="Show hidden word">${lead}${gap}</button>${esc(tail)}`;
        }).join(' ');
    main.innerHTML = `
      <div class="page-head"><a class="back" href="#/memory">‹ Memory</a></div>
      <p class="eyebrow">${practice ? 'Practice' : `Learning · step ${stage + 1} of ${LEARN_STAGES}`}${c.topic ? ` · ${esc(c.topic)}` : ''}</p>
      <h1>${esc(cardLabel(c))}</h1>
      <div class="dots">${Array.from({ length: LEARN_STAGES }, (_, i) => `<span class="${i <= stage ? 'on' : ''}"></span>`).join('')}</div>
      <p class="muted">${STAGE_HELP[stage]}</p>
      <article class="card recall">${body}</article>
      <p class="small muted">${esc(translation)}</p>
      <div class="row">
        ${stage > 0 ? '<button class="btn ghost" data-step="-1">Back</button>' : ''}
        <span class="spacer"></span>
        ${stage < LEARN_STAGES - 1
          ? '<button class="btn primary" data-step="1">Next</button>'
          : !revealed
            ? '<button class="btn primary" data-reveal>Reveal</button>'
            : practice
              ? '<button class="btn ghost" data-again>Again</button><a class="btn primary" href="#/memory">Done</a>'
              : '<button class="btn ghost" data-again>Practice again</button><button class="btn primary" data-got>I can say it</button>'}
      </div>
      ${!practice && stage === LEARN_STAGES - 1 && revealed ? '<p class="small muted">"I can say it" moves the verse into review: tomorrow first, then at growing gaps.</p>' : ''}
    `;
  };
  draw();

  main.onclick = e => {
    const blank = e.target.closest('.blank');
    if (blank) {
      blank.outerHTML = `<span class="peeked">${esc(maskWords(text, stage, seed)[blank.dataset.i].word)}</span>`;
      return;
    }
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.step) {
      stage = Math.max(0, Math.min(LEARN_STAGES - 1, stage + Number(b.dataset.step)));
      revealed = false;
      if (!practice) { c.stage = stage; save(); }
    } else if ('reveal' in b.dataset) revealed = true;
    else if ('again' in b.dataset) { stage = 1; revealed = false; }
    else if ('got' in b.dataset) {
      finishLearning(c, today());
      save();
      toast('Moved to review. See you tomorrow.');
      location.hash = '#/memory';
      return;
    } else return;
    draw();
    window.scrollTo(0, 0);
  };
}

// Spaced review of every verse that is due.
async function renderReview(main) {
  const date = today();
  const queue = Object.values(cards()).filter(c => isDue(c, date)).sort((a, b) => a.due.localeCompare(b.due));
  let i = 0;
  let done = 0;

  const showCard = async () => {
    const c = queue[i];
    if (!c) {
      main.innerHTML = `
        <div class="page-head"><a class="back" href="#/memory">‹ Memory</a></div>
        <section class="card center">
          <h1>Review done</h1>
          <p>${done} verse${done === 1 ? '' : 's'} reviewed today. Well done.</p>
          <a class="btn primary" href="#/memory">Back to Memory</a>
        </section>`;
      return;
    }
    let hint = false;
    let revealed = false;
    const { text, translation } = await cardText(c);
    const words = maskWords(text, 3, 1);
    const draw = () => {
      const g = ['again', 'hard', 'good', 'easy'].map(k => [k, preview(c, k).interval]);
      main.innerHTML = `
        <div class="page-head"><a class="back" href="#/memory">‹ Memory</a><span class="small muted">${i + 1} of ${queue.length}</span></div>
        ${c.topic ? `<p class="eyebrow">${esc(c.topic)}</p>` : ''}
        <h1>${esc(cardLabel(c))}</h1>
        <p class="muted">${revealed ? 'How did you do?' : 'Say the reference, the verse, then the reference again.'}</p>
        <article class="card recall">
          ${revealed ? esc(text) : hint ? words.map(w => {
            const m = /^(.*?)([.,;:!?"”’')\]]*)$/.exec(w.word);
            return esc((m[1] || w.word)[0] + (m[1] ? m[2] : ''));
          }).join(' ') : '<p class="muted center">…</p>'}
        </article>
        <p class="small muted">${esc(translation)}</p>
        ${revealed ? `
          <div class="grades">
            ${g.map(([k, n]) => `<button class="btn grade ${k}" data-grade="${k}"><span>${{ again: 'Missed it', hard: 'Hard', good: 'Good', easy: 'Easy' }[k]}</span><small>${n === 1 ? '1 day' : `${n} days`}</small></button>`).join('')}
          </div>` : `
          <div class="row">
            ${hint ? '' : '<button class="btn ghost" data-hint>First letters</button>'}
            <span class="spacer"></span>
            <button class="btn primary" data-reveal>Show verse</button>
          </div>`}
      `;
    };
    draw();
    main.onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if ('hint' in b.dataset) { hint = true; return draw(); }
      if ('reveal' in b.dataset) { revealed = true; return draw(); }
      if (b.dataset.grade) {
        grade(c, b.dataset.grade, date);
        state.memory.log[date] = (state.memory.log[date] ?? 0) + 1;
        save();
        done++;
        i++;
        window.scrollTo(0, 0);
        showCard();
      }
    };
  };
  showCard();
}

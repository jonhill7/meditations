import { state, save } from '../store.js';
import { BOOKS, BOOK, bookName, formatRef, parseRef } from '../books.js';
import { getChapter, getPassage, crossRefs, getCommentary, COMMENTARIES } from '../bible.js';
import { esc, sheet, toast } from '../ui.js';

export const tab = 'read';

const COPYRIGHT = {
  ESV: 'Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.',
  BSB: 'Berean Standard Bible. Public domain.',
};

export async function render(main, [book, chapter, extra]) {
  if (!book || !BOOK[book]) return renderBooks(main);
  if (!chapter) return renderChapters(main, book);
  return renderChapter(main, book, Number(chapter), extra);
}

function renderBooks(main) {
  const last = state.lastRead;
  const grid = t => BOOKS.filter(b => b.testament === t)
    .map(b => `<a class="book" href="#/read/${b.code}${b.chapters === 1 ? '/1' : ''}">${esc(b.name)}</a>`).join('');
  main.innerHTML = `
    <div class="page-head">
      <h1>Bible</h1>
      <a class="btn ghost" href="#/notes">My notes</a>
    </div>
    ${last ? `<a class="banner" href="#/read/${last.book}/${last.chapter}">Continue ${esc(bookName(last.book))} ${last.chapter}</a>` : ''}
    <h2 class="section">Old Testament</h2>
    <div class="books">${grid('OT')}</div>
    <h2 class="section">New Testament</h2>
    <div class="books">${grid('NT')}</div>
  `;
  main.onclick = null;
}

function renderChapters(main, book) {
  const b = BOOK[book];
  main.innerHTML = `
    <div class="page-head"><a class="back" href="#/read">‹ Books</a><h1>${esc(b.name)}</h1></div>
    <div class="chapters-grid">${Array.from({ length: b.chapters }, (_, i) => `<a href="#/read/${book}/${i + 1}">${i + 1}</a>`).join('')}</div>
  `;
  main.onclick = null;
}

function neighbour(book, chapter, step) {
  const b = BOOK[book];
  if (step < 0 && chapter > 1) return [book, chapter - 1];
  if (step > 0 && chapter < b.chapters) return [book, chapter + 1];
  const nb = BOOKS[b.index + step];
  if (!nb) return null;
  return [nb.code, step > 0 ? 1 : nb.chapters];
}

async function renderChapter(main, book, chapter, extra) {
  const b = BOOK[book];
  if (chapter < 1 || chapter > b.chapters) return renderChapters(main, book);
  const fromPlan = extra === 'plan';
  const focusVerse = extra?.startsWith('v') ? Number(extra.slice(1)) : null;

  state.lastRead = { book, chapter };
  save();

  const prev = neighbour(book, chapter, -1);
  const next = neighbour(book, chapter, 1);
  main.innerHTML = `
    <div class="reader-head">
      <a class="back" href="${fromPlan ? '#/today' : `#/read/${book}`}">‹ ${fromPlan ? 'Today' : esc(b.name)}</a>
      <button class="btn ghost small" data-act="chapter-commentary">Commentary</button>
    </div>
    <h1 class="chapter-title">${esc(b.name)} ${chapter}</h1>
    <p class="muted small" id="translation"></p>
    <article class="scripture" id="text"><p class="muted">Loading…</p></article>
    <p class="hint">Tap a verse for notes, cross references, and commentary.</p>
    <nav class="pager">
      ${prev ? `<a class="btn ghost" href="#/read/${prev[0]}/${prev[1]}">‹ ${esc(bookName(prev[0]))} ${prev[1]}</a>` : '<span></span>'}
      ${next ? `<a class="btn ghost" href="#/read/${next[0]}/${next[1]}">${esc(bookName(next[0]))} ${next[1]} ›</a>` : '<span></span>'}
    </nav>
    ${fromPlan ? '<a class="btn primary wide" href="#/today">Back to today</a>' : ''}
    <p class="copyright" id="copyright"></p>
  `;

  let result;
  try {
    result = await getChapter(book, chapter);
  } catch (e) {
    main.querySelector('#text').innerHTML = `<p class="error">${esc(e.message)}</p>`;
    return;
  }
  // The person may have navigated away while this loaded.
  if (!location.hash.startsWith(`#/read/${book}/${chapter}`)) return;

  const { verses, translation, note } = result;
  main.querySelector('#translation').textContent = translation === 'ESV' ? 'English Standard Version' : 'Berean Standard Bible';
  if (note) main.querySelector('#translation').textContent += ` · ${note}`;
  main.querySelector('#copyright').textContent = COPYRIGHT[translation];
  main.querySelector('#text').innerHTML = verses.map((t, i) => {
    const ref = `${book} ${chapter}:${i + 1}`;
    if (!t) return '';
    return `<span class="verse ${state.notes[ref] ? 'has-note' : ''}" data-v="${i + 1}" role="button" tabindex="0"><sup>${i + 1}</sup>${esc(t)} </span>`;
  }).join('');

  if (focusVerse) {
    const el = main.querySelector(`[data-v="${focusVerse}"]`);
    if (el) {
      el.classList.add('flash');
      el.scrollIntoView({ block: 'center' });
    }
  }

  const open = el => study(book, chapter, Number(el.dataset.v), verses[el.dataset.v - 1], translation, el);
  main.onclick = e => {
    const v = e.target.closest('.verse');
    if (v) return open(v);
    if (e.target.closest('[data-act="chapter-commentary"]')) chapterCommentary(book, chapter);
  };
  main.onkeydown = e => {
    const v = e.target.closest('.verse');
    if (v && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      open(v);
    }
  };
}

function study(book, chapter, verse, text, translation, verseEl) {
  const ref = `${book} ${chapter}:${verse}`;
  const note = state.notes[ref];
  const d = sheet(formatRef(ref), `
    <blockquote class="study-verse">${esc(text)} <cite>${esc(translation)}</cite></blockquote>
    <section>
      <h3>My note</h3>
      <textarea class="note" rows="4" placeholder="What stands out to you?">${esc(note?.text)}</textarea>
      <p class="small muted saved-line">${note ? `Saved ${esc(new Date(note.updated).toLocaleDateString())}` : 'Saves as you type, on this phone only.'}</p>
    </section>
    <section>
      <h3>Cross references</h3>
      <div class="xrefs"><p class="muted">Loading…</p></div>
    </section>
    <section>
      <h3>Commentary <span class="small muted">${esc(COMMENTARIES[state.settings.commentary] ?? '')}</span></h3>
      <div class="commentary"><p class="muted">Loading…</p></div>
    </section>
  `);

  const ta = d.querySelector('.note');
  let timer = null;
  const commit = () => {
    timer = null;
    const value = ta.value.trim();
    if (value) state.notes[ref] = { text: ta.value, updated: Date.now() };
    else delete state.notes[ref];
    save();
    verseEl.classList.toggle('has-note', !!value);
    return value;
  };
  ta.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      d.querySelector('.saved-line').textContent = commit() ? 'Saved' : 'Note removed';
    }, 400);
  });
  d.addEventListener('close', () => {
    if (timer) {
      clearTimeout(timer);
      commit();
    }
  });

  crossRefs(book, chapter, verse).then(list => {
    const box = d.querySelector('.xrefs');
    if (!list.length) {
      box.innerHTML = '<p class="muted">None for this verse.</p>';
      return;
    }
    box.innerHTML = `<ul class="xref-list">${list.map(r => `
      <li>
        <button class="xref" data-ref="${esc(r)}" aria-expanded="false">${esc(formatRef(r))}</button>
        <div class="xref-text" hidden></div>
      </li>`).join('')}</ul>`;
    box.onclick = async e => {
      const btn = e.target.closest('.xref');
      if (!btn) return;
      const out = btn.nextElementSibling;
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      out.hidden = open;
      if (open || out.dataset.loaded) return;
      const r = parseRef(btn.dataset.ref);
      try {
        const vs = await getPassage(r);
        out.innerHTML = vs.map(v => `<sup>${v.verse}</sup>${esc(v.text)}`).join(' ') +
          ` <a class="small" href="#/read/${r.book}/${r.chapter}/v${r.verse}">Open chapter ›</a>`;
        out.dataset.loaded = '1';
      } catch (err) {
        out.textContent = err.message;
      }
    };
    box.addEventListener('click', e => {
      if (e.target.closest('a')) d.close();
    });
  });

  getCommentary(book, chapter).then(({ verses }) => {
    const box = d.querySelector('.commentary');
    // Commentaries often cover a run of verses under its first verse.
    let at = verse;
    while (at > 0 && !verses.has(at)) at--;
    const paras = verses.get(at);
    if (!paras) {
      box.innerHTML = '<p class="muted">No comment on this verse. Try the chapter commentary.</p>';
      return;
    }
    box.innerHTML = (at !== verse ? `<p class="small muted">From the comment on verse ${at}:</p>` : '') +
      paras.map(p => `<p>${esc(p)}</p>`).join('');
  }).catch(e => {
    d.querySelector('.commentary').innerHTML = `<p class="muted">${esc(e.message)}</p>`;
  });
}

function chapterCommentary(book, chapter) {
  const name = COMMENTARIES[state.settings.commentary] ?? state.settings.commentary;
  const d = sheet(`${bookName(book)} ${chapter}: ${name}`, '<div class="commentary"><p class="muted">Loading…</p></div>');
  getCommentary(book, chapter).then(({ introduction, verses }) => {
    const parts = [];
    if (introduction) parts.push(`<p>${esc(introduction)}</p>`);
    for (const [v, paras] of [...verses].sort((a, b) => a[0] - b[0])) {
      parts.push(`<h4>Verse ${v}</h4>${paras.map(p => `<p>${esc(p)}</p>`).join('')}`);
    }
    d.querySelector('.commentary').innerHTML = parts.join('') || '<p class="muted">Nothing for this chapter.</p>';
  }).catch(e => {
    d.querySelector('.commentary').innerHTML = `<p class="muted">${esc(e.message)}</p>`;
    toast(e.message);
  });
}

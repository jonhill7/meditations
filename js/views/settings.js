import { state, save, exportData, importData, resetAll, today } from '../store.js';
import { buildPlan } from '../plan.js';
import { COMMENTARIES, getChapter, prefetchCommentary } from '../bible.js';
import { esc, toast, shortDate } from '../ui.js';

export const tab = 'settings';

export async function render(main) {
  const s = state.settings;
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  const plan = buildPlan();

  main.innerHTML = `
    <div class="page-head"><h1>Settings</h1></div>

    <section class="card">
      <h2>Look</h2>
      <div class="segmented" role="radiogroup" aria-label="Theme">
        ${['system', 'light', 'dark'].map(t => `<button role="radio" aria-checked="${s.theme === t}" data-theme="${t}">${t === 'system' ? 'Match phone' : t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
      </div>
      <label class="range">Text size
        <input type="range" min="15" max="28" step="1" value="${s.textSize}" name="textSize">
      </label>
      <p class="scripture sample">In the beginning God created the heavens and the earth.</p>
    </section>

    <section class="card">
      <h2>Bible text</h2>
      <label class="check"><input type="radio" name="translation" value="BSB" ${s.translation === 'BSB' ? 'checked' : ''}> Berean Standard Bible (on the phone, works offline)</label>
      <label class="check"><input type="radio" name="translation" value="ESV" ${s.translation === 'ESV' ? 'checked' : ''}> English Standard Version (needs a free key and a connection)</label>
      <div class="esv ${s.translation === 'ESV' ? '' : 'hidden'}">
        <label>ESV API key<input name="esvKey" value="${esc(s.esvKey)}" autocomplete="off" spellcheck="false" placeholder="Paste your key"></label>
        <p class="small muted">Get a free personal key at <a href="https://api.esv.org/account/create-application/" target="_blank" rel="noopener">api.esv.org</a>. Only the passage you open (like "John 3") is sent to Crossway. When the ESV can't load, the app shows the BSB instead.</p>
        <button class="btn ghost small" data-act="test-esv">Test key</button>
      </div>
    </section>

    <section class="card">
      <h2>Commentary</h2>
      <select name="commentary" aria-label="Commentary">
        ${Object.entries(COMMENTARIES).map(([id, name]) => `<option value="${id}" ${s.commentary === id ? 'selected' : ''}>${esc(name)}</option>`).join('')}
      </select>
      <p class="small muted">Public domain commentaries from the Free Use Bible API. Each chapter downloads the first time you open it and is kept on the phone. Only the book and chapter are sent.</p>
      <button class="btn ghost small" data-act="prefetch">Save the next 14 days for offline</button>
    </section>

    <section class="card">
      <h2>Reading plan</h2>
      <p>You're on day ${Math.min(state.plan.nextDay + 1, plan.length)} of ${plan.length}${state.plan.startedOn ? `, started ${esc(shortDate(state.plan.startedOn))}` : ''}.</p>
      <form class="row jump">
        <label class="grow">Jump to day<input type="number" name="day" min="1" max="${plan.length}" value="${state.plan.nextDay + 1}"></label>
        <button class="btn ghost small" type="submit">Go</button>
      </form>
      <p class="small muted">Use this if you were already partway through. Days you skip past are not marked as read on the calendar.</p>
    </section>

    <section class="card">
      <h2>Backup</h2>
      <p>Your notes, prayers, reminders and progress are stored only in this phone's browser. Clearing Chrome's site data or changing phones erases them, so export a backup now and then and keep the file somewhere safe.</p>
      <p class="small muted">${state.lastBackup ? `Last export: ${esc(shortDate(state.lastBackup))}` : 'No export yet.'} ${persisted ? 'The browser has agreed to keep this data.' : ''}</p>
      <div class="row">
        <button class="btn primary" data-act="export">Export backup</button>
        <label class="btn ghost file">Import backup<input type="file" accept="application/json,.json" name="import" hidden></label>
      </div>
    </section>

    <section class="card">
      <h2>Privacy</h2>
      <p class="small">There are no accounts, analytics or trackers. The only network requests this app makes are for the app itself, ESV passages if you turn them on, and commentary chapters. None include anything you write.</p>
      <button class="btn danger small" data-act="reset">Erase everything on this phone</button>
    </section>
  `;

  main.onclick = async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.theme) {
      s.theme = b.dataset.theme;
      save();
      return render(main);
    }
    switch (b.dataset.act) {
      case 'export':
        exportData();
        return render(main);
      case 'test-esv':
        try {
          const r = await getChapter('JHN', 1);
          toast(r.translation === 'ESV' ? 'ESV key works' : r.note);
        } catch (err) {
          toast(err.message);
        }
        return;
      case 'prefetch': {
        b.disabled = true;
        b.textContent = 'Saving…';
        const chapters = plan.slice(state.plan.nextDay, state.plan.nextDay + 14).flat();
        const n = await prefetchCommentary(chapters);
        toast(n ? `Saved commentary for ${n} chapters` : 'Could not reach the commentary service');
        b.disabled = false;
        b.textContent = 'Save the next 14 days for offline';
        return;
      }
      case 'reset':
        if (confirm('Erase all notes, prayers, reminders and progress from this phone? Export a backup first if you might want them.') && confirm('Are you sure? This cannot be undone.')) resetAll();
        return;
    }
  };

  main.onchange = async e => {
    const t = e.target;
    if (t.name === 'translation') {
      s.translation = t.value;
      main.querySelector('.esv').classList.toggle('hidden', t.value !== 'ESV');
    } else if (t.name === 'esvKey') s.esvKey = t.value.trim();
    else if (t.name === 'commentary') s.commentary = t.value;
    else if (t.name === 'import' && t.files[0]) {
      if (!confirm('Replace everything on this phone with this backup?')) return;
      try {
        await importData(t.files[0]);
        toast('Backup restored');
        return render(main);
      } catch (err) {
        toast(err.message);
      }
      return;
    } else return;
    save();
  };

  main.oninput = e => {
    if (e.target.name !== 'textSize') return;
    s.textSize = Number(e.target.value);
    save();
  };

  main.querySelector('.jump').onsubmit = e => {
    e.preventDefault();
    const n = Math.max(1, Math.min(plan.length, Number(e.target.day.value) || 1));
    state.plan.nextDay = n - 1;
    state.plan.startedOn ??= today();
    save();
    toast(`Next reading is day ${n}`);
    render(main);
  };
}

import { state, save, exportData, importData, resetAll, today } from '../store.js';
import { buildPlan } from '../plan.js';
import { COMMENTARIES, getChapter, prefetchCommentary, availableTranslations, translationName, listApiBibles, hasApiBibleKey } from '../bible.js';
import { esc, toast, shortDate } from '../ui.js';
import { widgetSettings, widgetUrl, publishWidget, kwgtFormula } from '../widget.js';

export const tab = 'settings';

export async function render(main) {
  const s = state.settings;
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  const plan = buildPlan();
  const ws = widgetSettings();
  const wurl = widgetUrl();

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
      ${availableTranslations().map(t => `<label class="check"><input type="radio" name="translation" value="${esc(t)}" ${s.translation === t ? 'checked' : ''}> ${esc(translationName(t))}${{ BSB: ' (offline)', KJV: ' (offline)' }[t] ?? ''}</label>`).join('')}
      <details class="key-setup">
        <summary>ESV key</summary>
      <div class="esv">
        <label>ESV API key<input name="esvKey" value="${esc(s.esvKey)}" autocomplete="off" spellcheck="false" placeholder="Paste your key"></label>
        <p class="small muted">Get a free personal key at <a href="https://api.esv.org/account/create-application/" target="_blank" rel="noopener">api.esv.org</a>. Only the passage you open (like "John 3") is sent to Crossway. When the ESV can't load, the app shows the BSB instead.</p>
        <button class="btn ghost small" data-act="test-esv">Test key</button>
      </div>
      </details>
      <details class="key-setup apibible" ${hasApiBibleKey() && !(s.apiBibles ?? []).length ? 'open' : ''}>
        <summary>Your own API.Bible key (optional)</summary>
        <label>API.Bible key<input name="apiBibleKey" value="${esc(s.apiBibleKey)}" autocomplete="off" spellcheck="false" placeholder="Paste your key"></label>
        <p class="small muted">Your key is saved only on this phone, never in the app's code. Only the passage you open is sent to API.Bible, which also receives an anonymous display count its license requires.</p>
        <button class="btn ghost small" data-act="find-bibles">Find my translations</button>
        <div class="bible-list"></div>
      </details>
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
      <h2>Home screen widget</h2>
      <p class="small">The widget shows only what you pin for today: the verse of the day, verses you tap while reading, and memory verses. It uses the free KWGT app on Android.</p>
      ${wurl ? `
        <label class="check"><input type="checkbox" name="widgetReflections" ${ws.reflections ? 'checked' : ''}> Also show the reflections I select each day</label>
        <label class="check"><input type="checkbox" name="widgetPrayers" ${ws.prayers ? 'checked' : ''}> Also show the titles of prayers I prayed today</label>
        <p class="small muted">To reach the widget, today's picks are copied to the app's server under a private link and deleted after 3 days. Scripture is always fine to send. Reflections and prayers are your own words, so they're only sent if you turn them on above.</p>
        <label>Your private widget link<input readonly value="${esc(wurl)}" class="widget-link"></label>
        <div class="row">
          <button class="btn ghost small" data-act="copy-widget">Copy link</button>
          <button class="btn ghost small" data-act="publish-widget">Update widget now</button>
        </div>
        <p class="small muted">${ws.lastError ? `Last update failed: ${esc(ws.lastError)}` : ws.lastPublished ? `Last updated ${esc(new Date(ws.lastPublished).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }))}.` : 'Not updated yet.'}</p>
        <details class="key-setup">
          <summary>How to set up KWGT</summary>
          <ol class="small steps">
            <li>Install <strong>KWGT Kustom Widget Maker</strong> from the Play Store.</li>
            <li>Long-press your home screen, tap Widgets, and add a KWGT widget (4×2 works well). Tap it to open the editor.</li>
            <li>Start empty, tap <strong>+</strong> and add a <strong>Text</strong> module.</li>
            <li>Tap the Text field, then the formula button, and paste:<br><code class="formula">${esc(kwgtFormula(wurl))}</code></li>
            <li>Set the font size, and in the widget's Layer settings turn on scrolling if you pin a lot.</li>
            <li>Save (the disk icon). KWGT checks for changes about every 30 minutes; it updates sooner when the screen turns on.</li>
          </ol>
          <button class="btn ghost small" data-act="copy-formula">Copy formula</button>
        </details>
      ` : '<p class="small muted">The widget needs the app\'s shared server, which isn\'t set up yet.</p>'}
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
      <p class="small">There are no accounts, analytics or trackers. The only network requests this app makes are for the app itself, ESV or API.Bible passages if you add a key (API.Bible also gets the anonymous display count its license requires), and commentary chapters. None include anything you write, except reflections or prayer titles if you choose to show them on the widget.</p>
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
          const r = await getChapter('JHN', 1, 'ESV');
          toast(r.translation === 'ESV' ? 'ESV key works' : r.note);
        } catch (err) {
          toast(err.message);
        }
        return;
      case 'find-bibles': {
        const box = main.querySelector('.bible-list');
        box.innerHTML = '<p class="muted small">Asking API.Bible…</p>';
        try {
          const list = (await listApiBibles()).filter(x => !['BSB', 'KJV', 'ESV'].includes(x.abbr));
          const picked = new Set((s.apiBibles ?? []).map(x => x.id));
          const niv = list.some(x => x.abbr === 'NIV');
          box.innerHTML = `
            ${niv ? '' : '<p class="small"><strong>The NIV isn\'t available to this key.</strong> Licensed translations like the NIV need the publisher\'s approval for your key; you can request access from your API.Bible account.</p>'}
            ${list.length ? list.map(x => `<label class="check"><input type="checkbox" data-bible="${esc(x.id)}" ${picked.has(x.id) ? 'checked' : ''}> ${esc(x.abbr)}: ${esc(x.name)}</label>`).join('') : '<p class="small muted">No English translations came back for this key.</p>'}`;
          box._list = list;
        } catch (err) {
          box.innerHTML = `<p class="small error">${esc(navigator.onLine ? err.message : 'You are offline.')}</p>`;
        }
        return;
      }
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
      case 'copy-widget':
      case 'copy-formula': {
        const text = b.dataset.act === 'copy-widget' ? wurl : kwgtFormula(wurl);
        try {
          await navigator.clipboard.writeText(text);
          toast('Copied');
        } catch {
          toast('Could not copy. Press and hold the link to copy it.');
        }
        return;
      }
      case 'publish-widget':
        b.disabled = true;
        b.textContent = 'Updating…';
        await publishWidget();
        toast(ws.lastError ? `Couldn't update: ${ws.lastError}` : 'Widget updated');
        return render(main);
      case 'reset':
        if (confirm('Erase all notes, prayers, reminders and progress from this phone? Export a backup first if you might want them.') && confirm('Are you sure? This cannot be undone.')) resetAll();
        return;
    }
  };

  main.onchange = async e => {
    const t = e.target;
    if (t.name === 'translation') {
      s.translation = t.value;
      s.translationPicked = true;
    } else if (t.name === 'esvKey' || t.name === 'apiBibleKey') {
      s[t.name] = t.value.trim();
      save();
      return render(main);
    }
    else if (t.dataset.bible) {
      const list = main.querySelector('.bible-list')._list ?? [];
      const ids = new Set((s.apiBibles ?? []).map(x => x.id));
      if (t.checked) ids.add(t.dataset.bible);
      else ids.delete(t.dataset.bible);
      s.apiBibles = [...(s.apiBibles ?? []).filter(x => ids.has(x.id)), ...list.filter(x => ids.has(x.id) && !(s.apiBibles ?? []).some(y => y.id === x.id))];
      save();
      return render(main);
    }
    else if (t.name === 'widgetReflections' || t.name === 'widgetPrayers') {
      ws[t.name === 'widgetReflections' ? 'reflections' : 'prayers'] = t.checked;
      save();
      await publishWidget();
      return render(main);
    }
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

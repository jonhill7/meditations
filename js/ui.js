export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = message;
  document.body.append(el);
  setTimeout(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

// Bottom sheet dialog. Returns the <dialog> so callers can fill it.
export function sheet(title, bodyHtml) {
  document.querySelector('dialog.sheet')?.remove();
  const d = document.createElement('dialog');
  d.className = 'sheet';
  d.innerHTML = `
    <div class="sheet-head">
      <h2>${esc(title)}</h2>
      <button class="icon-btn" data-close aria-label="Close">✕</button>
    </div>
    <div class="sheet-body">${bodyHtml}</div>`;
  document.body.append(d);
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('[data-close]')) d.close();
  });
  d.addEventListener('close', () => d.remove());
  d.showModal();
  return d;
}

export function longDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function shortDate(date) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function daysBetween(a, b) {
  const t = s => {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((t(b) - t(a)) / 86400000);
}

import { state } from '../store.js';
import { buildPlan, PLAN_NAME } from '../plan.js';
import { bookName } from '../books.js';
import { esc, shortDate } from '../ui.js';

export const tab = 'today';

export async function render(main) {
  const plan = buildPlan();
  const { nextDay, completed } = state.plan;
  main.innerHTML = `
    <div class="page-head"><a class="back" href="#/today">‹ Today</a><h1>${esc(PLAN_NAME)}</h1></div>
    <p class="muted">Two chapters a day for about two years. One track walks the Old Testament, with Leviticus, Numbers, Deuteronomy, Chronicles and the prophets broken up by lighter books. The other reads the New Testament twice, first with the Psalms and then with Proverbs. Missed days never pile up: the plan waits for you.</p>
    <ol class="plan-list">
      ${plan.map((d, i) => `
        <li class="${i < nextDay ? 'done' : ''} ${i === nextDay ? 'current' : ''}" ${i === nextDay ? 'id="current"' : ''}>
          <span class="plan-day">Day ${i + 1}</span>
          <span class="plan-chs">${d.map(([b, c]) => `<a href="#/read/${b}/${c}">${esc(bookName(b))} ${c}</a>`).join(' · ')}</span>
          ${completed[i] ? `<span class="small muted">${esc(shortDate(completed[i]))}</span>` : ''}
        </li>`).join('')}
    </ol>
  `;
  main.querySelector('#current')?.scrollIntoView({ block: 'center' });
  main.onclick = null;
}

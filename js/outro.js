// End of the book: when the back cover closes, a red bolt strikes the
// Thunderbird logo (the deck's closing slide). Also the smaller strikes that
// mark the start of each section, if the PDF has bookmarks.
import { $, esc, rand, reducedMotion } from './util.js';
import { icons } from './icons.js';
import { book } from './book.js';
import { strike } from './lightning.js';

let M = null;
let root, mark, chip;
let lastFocus = null;
let lastStrike = 0;
let chipTimer = 0;
const sectionStarts = new Map(); // book page -> section title

function init(manifest) {
  M = manifest;
  root = $('#outro');
  chip = $('#section-chip');
  const where = [M.organization, M.university].filter(Boolean).join(' · ');
  root.innerHTML = `
    <div class="outro-card">
      <button type="button" class="ic on-light outro-close" data-o="close" aria-label="Close" title="Close (Esc)">${icons.close}</button>
      <div class="outro-mark"><img src="assets/suu-logo.png" alt="Southern Utah University Thunderbirds"></div>
      <span class="eyebrow">${esc([M.shortName, M.title, M.year].filter(Boolean).join(' · '))}</span>
      <h2>${esc(M.outroTitle)}</h2>
      ${where ? `<p>${esc(where)}</p>` : ''}
      <div class="outro-actions">
        <button type="button" class="btn" data-o="again">${icons.replay}Read again</button>
        <a class="btn ghost" href="${book.url.pdf()}" download="${esc(M.downloadName)}">${icons.download}Download PDF</a>
      </div>
    </div>`;
  mark = $('.outro-mark', root);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-o]');
    if (b?.dataset.o === 'close') hide();
    else if (b?.dataset.o === 'again') {
      hide();
      setTimeout(() => book.first(), 250);
    } else if (e.target === root) hide();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !root.hidden) {
      e.preventDefault();
      hide();
    }
  });

  if (M.sectionStrikes) {
    (M.outline || []).filter(o => o.level === 1 && o.page > 1).forEach(o => {
      const i = book.bookOf(o.page);
      if (i > 0 && !sectionStarts.has(i)) sectionStarts.set(i, o.title);
    });
  }

  book.events.addEventListener('change', e => {
    const { index, prev, cause } = e.detail;
    if (cause !== 'flip' || index === prev) return;
    const last = book.count - 1;
    if (index === last && last > 0) setTimeout(show, 500);
    else sectionStrike(index);
  });
}

function show() {
  if (book.current !== book.count - 1 || !root.hidden || document.body.classList.contains('zooming')) return;
  lastFocus = document.activeElement;
  root.hidden = false;
  document.body.classList.add('outro-open');
  mark.classList.remove('jolt');
  void root.offsetWidth; // restart the CSS transitions
  root.classList.add('show');
  $('[data-o="again"]', root).focus({ preventScroll: true });
  if (reducedMotion()) {
    mark.classList.add('jolt');
    return;
  }
  // Wait for the card to settle, then strike the top of the middle "U".
  setTimeout(() => {
    if (root.hidden) return;
    const r = mark.getBoundingClientRect();
    const to = { x: r.left + r.width * 0.49, y: r.top + r.height * 0.06 };
    strike({ from: { x: to.x + rand(-70, 70), y: -20 }, to, width: 5, branches: 3, onImpact: () => mark.classList.add('jolt') });
  }, 420);
}

function hide() {
  if (root.hidden) return;
  root.classList.remove('show');
  document.body.classList.remove('outro-open');
  setTimeout(() => { root.hidden = true; }, 450);
  lastFocus?.focus?.({ preventScroll: true });
}

function sectionStrike(index) {
  if (!sectionStarts.size) return;
  const start = book.spreads()[book.spreadIndexOf(index)]?.find(i => sectionStarts.has(i));
  if (start === undefined) return;
  const title = sectionStarts.get(start);
  chip.textContent = title;
  chip.classList.add('show');
  clearTimeout(chipTimer);
  chipTimer = setTimeout(() => chip.classList.remove('show'), 2600);
  if (reducedMotion() || performance.now() - lastStrike < 1500) return;
  lastStrike = performance.now();
  const r = book.pageRect(start);
  const to = { x: r.left + r.width * rand(0.35, 0.65), y: r.top + 2 };
  strike({ from: { x: to.x + rand(-90, 90), y: -20 }, to, width: 3.5, branches: 2, power: 0.55 });
}

export const outro = { init };

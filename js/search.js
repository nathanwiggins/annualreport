// Search panel. The build step writes every page's words and their boxes to
// book/search.json, so results are instant and highlights land on the exact
// words; nothing has to parse the PDF in the browser.
import { $, esc, coarsePointer } from './util.js';
import { icons } from './icons.js';
import { book } from './book.js';
import { nav } from './nav.js';

const LIMIT = 500;
let M = null;
let panel, input, count, list, stepPrev, stepNext;
let index = null;
let loading = null;
let isOpen = false;
let results = [];
let hitMap = null;
let cursor = -1;
let timer = 0;

// Case, accents, ligatures, and curly quotes shouldn't matter.
const norm = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').toLowerCase();

function init(manifest) {
  M = manifest;
  panel = $('#search');
  panel.innerHTML = `
    <div class="search-head">
      <span class="search-icon">${icons.search}</span>
      <input class="search-input" type="search" placeholder="Search the report" aria-label="Search the report" autocomplete="off" spellcheck="false">
      <button type="button" class="ic on-light sm" data-s="close" aria-label="Close search" title="Close (Esc)">${icons.close}</button>
    </div>
    <div class="search-meta">
      <span class="search-count" aria-live="polite">Type at least 2 letters</span>
      <span class="search-steps">
        <button type="button" class="ic on-light sm" data-s="prev" aria-label="Previous match" title="Previous match (Shift+Enter)" disabled>${icons.up}</button>
        <button type="button" class="ic on-light sm" data-s="next" aria-label="Next match" title="Next match (Enter)" disabled>${icons.down}</button>
      </span>
    </div>
    <ol class="search-results"></ol>`;
  input = $('.search-input', panel);
  count = $('.search-count', panel);
  list = $('.search-results', panel);
  stepPrev = $('[data-s="prev"]', panel);
  stepNext = $('[data-s="next"]', panel);

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 140);
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(timer);
      if (!results.length) run();
      step(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      list.querySelector('.search-hit')?.focus();
    }
  });
  panel.addEventListener('click', e => {
    const hit = e.target.closest('.search-hit');
    if (hit) return go(+hit.dataset.k);
    const b = e.target.closest('[data-s]');
    if (!b) return;
    if (b.dataset.s === 'close') close();
    if (b.dataset.s === 'prev') step(-1);
    if (b.dataset.s === 'next') step(1);
  });
  list.addEventListener('keydown', e => {
    const hit = e.target.closest('.search-hit');
    if (!hit) return;
    const li = hit.parentElement;
    if (e.key === 'ArrowDown') { e.preventDefault(); li.nextElementSibling?.querySelector('.search-hit')?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); (li.previousElementSibling?.querySelector('.search-hit') || input).focus(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });
}

function loadIndex() {
  if (index) return Promise.resolve(index);
  loading ||= fetch(`book/search.json?v=${M.version}`)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(raw => {
      index = raw.map((pg, i) => {
        let text = '';
        const starts = [];
        pg.w.forEach(w => {
          starts.push(text.length);
          text += `${norm(w)} `;
        });
        return { pdf: i + 1, words: pg.w, boxes: pg.b, text, starts };
      });
      return index;
    })
    .catch(err => {
      loading = null;
      throw err;
    });
  return loading;
}

// Word indexes that overlap characters [a, b) of a page's text
function wordsIn(pg, a, b) {
  let lo = 0;
  let hi = pg.starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (pg.starts[mid] <= a) lo = mid;
    else hi = mid - 1;
  }
  const out = [];
  for (let k = lo; k < pg.starts.length && pg.starts[k] < b; k++) out.push(k);
  return out;
}

async function run() {
  const raw = input.value.trim();
  const q = norm(raw).replace(/\s+/g, ' ');
  results = [];
  hitMap = null;
  cursor = -1;
  if (q.length < 2) {
    book.setHits(null);
    render(raw);
    return;
  }
  try {
    await loadIndex();
  } catch {
    count.textContent = 'Search is unavailable';
    list.innerHTML = '<li class="search-empty">The search index didn\'t load. Try reloading the page.</li>';
    return;
  }
  if (input.value.trim() !== raw) return; // typed again while the index loaded
  hitMap = new Map();
  for (const pg of index) {
    let from = 0;
    let at;
    while (results.length < LIMIT && (at = pg.text.indexOf(q, from)) !== -1) {
      const ws = wordsIn(pg, at, at + q.length);
      if (!hitMap.has(pg.pdf)) hitMap.set(pg.pdf, []);
      const matches = hitMap.get(pg.pdf);
      results.push({ pdf: pg.pdf, ws, m: matches.length });
      matches.push(ws.map(k => pg.boxes[k].map(v => v / 10000)));
      from = at + q.length;
    }
  }
  book.setHits(hitMap.size ? hitMap : null);
  render(raw);
}

function snippet(pg, ws) {
  const a = Math.max(0, ws[0] - 6);
  const b = Math.min(pg.words.length, ws[ws.length - 1] + 10);
  const on = new Set(ws);
  let out = a > 0 ? '… ' : '';
  for (let k = a; k < b; k++) out += `${on.has(k) ? `<mark>${esc(pg.words[k])}</mark>` : esc(pg.words[k])} `;
  return out + (b < pg.words.length ? '…' : '');
}

function render(raw) {
  stepPrev.disabled = stepNext.disabled = results.length === 0;
  if (!raw || raw.length < 2) {
    count.textContent = 'Type at least 2 letters';
    list.innerHTML = '';
    return;
  }
  if (!results.length) {
    const hasText = index?.some(pg => pg.words.length);
    count.textContent = 'No matches';
    list.innerHTML = hasText
      ? `<li class="search-empty">Nothing found for “${esc(raw)}”.</li>`
      : '<li class="search-empty">This PDF has no searchable text (its pages are images).</li>';
    return;
  }
  const byPage = new Map();
  results.forEach((r, k) => {
    if (!byPage.has(r.pdf)) byPage.set(r.pdf, []);
    byPage.get(r.pdf).push(k);
  });
  const more = results.length >= LIMIT ? '+' : '';
  count.textContent = `${results.length}${more} match${results.length === 1 ? '' : 'es'} · ${byPage.size} page${byPage.size === 1 ? '' : 's'}`;
  const h = 64;
  const w = Math.round(h * book.ratio);
  list.innerHTML = [...byPage].map(([pdf, ks]) => `
    <li><button type="button" class="search-hit" data-k="${ks[0]}" data-pdf="${pdf}">
      <img src="${book.url.thumb(pdf)}" width="${w}" height="${h}" alt="" loading="lazy">
      <span><b>Page ${pdf}${ks.length > 1 ? ` · ${ks.length} matches` : ''}</b><span class="snip">${snippet(index[pdf - 1], results[ks[0]].ws)}</span></span>
    </button></li>`).join('');
}

function go(k) {
  const r = results[k];
  if (!r) return;
  cursor = k;
  book.jumpTo(book.bookOf(r.pdf));
  book.setHits(hitMap, { pdf: r.pdf, m: r.m });
  list.querySelectorAll('.search-hit.active').forEach(el => el.classList.remove('active'));
  const row = list.querySelector(`.search-hit[data-pdf="${r.pdf}"]`);
  row?.classList.add('active');
  row?.scrollIntoView({ block: 'nearest' });
  count.textContent = `Match ${k + 1} of ${results.length}${results.length >= LIMIT ? '+' : ''}`;
  // On phones the panel covers the book; tuck it away and keep the highlights.
  if (matchMedia('(max-width: 720px)').matches) close({ keepHits: true });
}

function step(dir) {
  if (!results.length) return;
  go((cursor + dir + results.length) % results.length);
}

function open() {
  if (isOpen) {
    input.focus();
    input.select();
    return;
  }
  isOpen = true;
  nav.closeFilm();
  panel.classList.add('open');
  document.body.classList.add('search-open');
  nav.setPressed('search', true);
  if (!coarsePointer()) input.focus({ preventScroll: true });
  else setTimeout(() => input.focus({ preventScroll: true }), 350);
  loadIndex().catch(() => {});
  if (input.value.trim().length >= 2 && !results.length) run();
}

function close({ keepHits = false } = {}) {
  if (!isOpen) return;
  isOpen = false;
  panel.classList.remove('open');
  document.body.classList.remove('search-open');
  nav.setPressed('search', false);
  if (!keepHits) {
    book.setHits(null);
    results = [];
    hitMap = null;
    cursor = -1;
    input.value = '';
    render('');
  }
  if (panel.contains(document.activeElement)) document.activeElement.blur();
}

export const search = {
  init,
  open,
  close,
  toggle: () => (isOpen ? close() : open()),
  preload: () => loadIndex().catch(() => {}),
};

// The bottom dock: arrows, scrubber with a page preview, counter (click to go
// to a page), thumbnail filmstrip, and tool buttons (search, zoom, share,
// sound, fullscreen, download). Also owns keyboard shortcuts and wheel flipping.
import { $, clamp, esc, toast, announce, coarsePointer } from './util.js';
import { icons } from './icons.js';
import { book } from './book.js';
import { sound } from './sound.js';

let M = null;
let dock, bar, scrub, knob, fill, tip, tipThumbs, tipLabel, ticks, counterWrap, film, strip;
let dragging = false;
let tipFor = -1;
let tipTimer = 0;
let filmOpen = false;
let filmStale = true;
let sections = [];
const tools = {}; // search and zoom register here (main.js)

const btn = (act, label, key, icon, extra = '') =>
  `<button type="button" class="ic" data-act="${act}" aria-label="${label}" title="${label}${key ? ` (${key})` : ''}" ${extra}>${icon}</button>`;

function markup() {
  const canFs = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  return `
  <div class="film" aria-label="Page thumbnails"><div class="film-strip"></div></div>
  <div class="dock-bar">
    <div class="dock-main">
      ${btn('prev', 'Previous page', '←', icons.prev)}
      <div class="scrub" role="slider" tabindex="0" aria-label="Scrub through the report">
        <div class="scrub-track"><div class="scrub-fill"></div></div>
        <div class="scrub-ticks"></div>
        <div class="scrub-knob"></div>
        <div class="scrub-tip" aria-hidden="true"><div class="tip-thumbs"></div><div class="tip-label"></div></div>
      </div>
      ${btn('next', 'Next page', '→', icons.next)}
    </div>
    <div class="dock-tools">
      <div class="counter-wrap"><button type="button" class="counter" data-act="goto" title="Go to page"><b>Cover</b><span></span></button></div>
      <span class="dock-sep" aria-hidden="true"></span>
      ${btn('film', 'Thumbnails', 'T', icons.film, 'aria-pressed="false"')}
      ${btn('search', 'Search', '/', icons.search, 'aria-pressed="false"')}
      ${btn('zoom', 'Zoom in on this page', 'Z', icons.zoomIn)}
      ${btn('share', 'Copy a link to this page', '', icons.share)}
      ${btn('sound', 'Sound', '', sound.on ? icons.soundOn : icons.soundOff, `aria-pressed="${sound.on}"`)}
      ${canFs ? btn('fullscreen', 'Fullscreen', 'F', icons.expand) : ''}
      <a class="ic" data-act="download" href="${book.url.pdf()}" download="${esc(M.downloadName)}" aria-label="Download the PDF" title="Download the PDF">${icons.download}</a>
    </div>
  </div>`;
}

function init(manifest) {
  M = manifest;
  sections = (M.outline || []).filter(o => o.level === 1).sort((a, b) => a.page - b.page);
  dock = $('#dock');
  dock.innerHTML = markup();
  bar = $('.dock-bar', dock);
  scrub = $('.scrub', dock);
  knob = $('.scrub-knob', dock);
  fill = $('.scrub-fill', dock);
  tip = $('.scrub-tip', dock);
  tipThumbs = $('.tip-thumbs', dock);
  tipLabel = $('.tip-label', dock);
  ticks = $('.scrub-ticks', dock);
  counterWrap = $('.counter-wrap', dock);
  film = $('.film', dock);
  strip = $('.film-strip', dock);

  dock.addEventListener('click', onClick);
  wireScrub();
  wireFilm();
  wireKeys();
  wireWheel();
  wireDim();

  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--dock-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
  }).observe(bar);

  book.events.addEventListener('change', sync);
  book.events.addEventListener('layout', () => {
    filmStale = true;
    if (filmOpen) buildFilm();
    buildTicks();
    tipFor = -1;
    sync();
  });
  sound.onChange(on => {
    const b = $('[data-act="sound"]', dock);
    b.innerHTML = on ? icons.soundOn : icons.soundOff;
    b.setAttribute('aria-pressed', String(on));
    toast(on ? 'Sound on' : 'Sound off');
  });
  document.addEventListener('fullscreenchange', onFullscreen);
  document.addEventListener('webkitfullscreenchange', onFullscreen);

  buildTicks();
  sync();
}

function onClick(e) {
  const item = e.target.closest('.film-item');
  if (item) {
    book.jumpTo(+item.dataset.page);
    return;
  }
  const b = e.target.closest('[data-act]');
  if (!b) return;
  switch (b.dataset.act) {
    case 'prev': book.prev(); break;
    case 'next': book.next(); break;
    case 'goto': startGoto(); break;
    case 'film': toggleFilm(); break;
    case 'search': tools.search?.toggle(); break;
    case 'zoom': tools.zoom?.open(book.visiblePdf()); break;
    case 'share': share(); break;
    case 'sound': sound.toggle(); break;
    case 'fullscreen': toggleFullscreen(); break;
    default: break; // download is a plain link
  }
}

// ---------- state ----------
const spreadCount = () => book.spreads().length;
const fraction = s => (spreadCount() > 1 ? s / (spreadCount() - 1) : 0);

function longLabel(s) {
  const l = book.label(s);
  if (l === 'Cover' || l === 'Back cover' || l === 'Blank page') return l;
  return l.includes('–') ? `Pages ${l}` : `Page ${l}`;
}

function sectionFor(s) {
  const nums = (book.spreads()[s] || []).map(book.pdfOfBook).filter(Boolean);
  const p = nums.length ? Math.max(...nums) : 0;
  let hit = null;
  for (const sec of sections) if (sec.page <= p) hit = sec;
  return hit?.title || '';
}

function setKnob(s) {
  const f = fraction(s) * 100;
  knob.style.left = `${f}%`;
  fill.style.width = `${f}%`;
}

function sync() {
  if (!dock) return;
  const s = book.spreadIndexOf(book.current);
  const S = spreadCount();
  if (!dragging) setKnob(s);
  const counter = $('.counter', counterWrap);
  if (counter) {
    counter.querySelector('b').textContent = book.label(s);
    counter.querySelector('span').textContent = ` / ${M.pageCount}`;
  }
  scrub.setAttribute('aria-valuemin', '1');
  scrub.setAttribute('aria-valuemax', String(S));
  scrub.setAttribute('aria-valuenow', String(s + 1));
  scrub.setAttribute('aria-valuetext', longLabel(s));
  $('[data-act="prev"]', dock).disabled = s === 0;
  $('[data-act="next"]', dock).disabled = s >= S - 1;
  markFilm(true);
  announce(`${longLabel(s)} of ${M.pageCount}`);
}

function buildTicks() {
  ticks.innerHTML = sections
    .map(sec => book.spreadIndexOf(book.bookOf(sec.page)))
    .filter((s, k, all) => s > 0 && all.indexOf(s) === k)
    .map(s => `<span class="scrub-tick" style="left:${fraction(s) * 100}%"></span>`)
    .join('');
}

// ---------- page thumbnails (filmstrip, scrubber preview) ----------
function thumbs(s, h) {
  const w = Math.round(h * book.ratio);
  return (book.spreads()[s] || []).map(i => {
    const pdf = book.pdfOfBook(i);
    return pdf
      ? `<img src="${book.url.thumb(pdf)}" width="${w}" height="${h}" alt="" loading="lazy" decoding="async">`
      : `<i style="width:${w}px;height:${h}px"></i>`;
  }).join('');
}

// ---------- scrubber ----------
function wireScrub() {
  const at = x => {
    const r = scrub.getBoundingClientRect();
    return Math.round(clamp((x - r.left) / r.width, 0, 1) * (spreadCount() - 1));
  };
  scrub.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true;
    scrub.setPointerCapture(e.pointerId);
    scrub.classList.add('dragging');
    const s = at(e.clientX);
    setKnob(s);
    showTip(s);
  });
  scrub.addEventListener('pointermove', e => {
    if (dragging) {
      const s = at(e.clientX);
      setKnob(s);
      showTip(s);
    } else if (e.pointerType === 'mouse') {
      showTip(at(e.clientX));
    }
  });
  const end = e => {
    if (!dragging) return;
    dragging = false;
    scrub.classList.remove('dragging');
    const s = at(e.clientX);
    hideTip(e.pointerType === 'mouse' ? 0 : 700);
    if (s !== book.spreadIndexOf(book.current)) book.jumpTo(book.spreads()[s][0]);
    else setKnob(s);
  };
  scrub.addEventListener('pointerup', end);
  scrub.addEventListener('pointercancel', () => {
    dragging = false;
    scrub.classList.remove('dragging');
    hideTip(0);
    sync();
  });
  scrub.addEventListener('pointerleave', () => { if (!dragging) hideTip(0); });
}

function showTip(s) {
  clearTimeout(tipTimer);
  if (s !== tipFor) {
    tipFor = s;
    tipThumbs.innerHTML = thumbs(s, coarsePointer() ? 96 : 120);
    const sec = sectionFor(s);
    tipLabel.innerHTML = `${esc(longLabel(s))}${sec ? `<em>${esc(sec)}</em>` : ''}`;
  }
  const r = scrub.getBoundingClientRect();
  const half = tip.offsetWidth / 2;
  const x = clamp(fraction(s) * r.width, 12 + half - r.left, innerWidth - 12 - half - r.left);
  tip.style.left = `${x}px`;
  tip.classList.add('show');
}

function hideTip(delay) {
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => tip.classList.remove('show'), delay);
}

// ---------- filmstrip ----------
function buildFilm() {
  filmStale = false;
  strip.innerHTML = book.spreads().map((_, s) =>
    `<button type="button" class="film-item" data-page="${book.spreads()[s][0]}" data-s="${s}" aria-label="${esc(longLabel(s))}">
      <span class="film-pages">${thumbs(s, 110)}</span><span class="film-label">${esc(book.label(s))}</span>
    </button>`).join('');
  markFilm(false);
}

function markFilm(smooth) {
  if (!filmOpen) return;
  const s = book.spreadIndexOf(book.current);
  strip.querySelectorAll('.film-item.current').forEach(el => el.classList.remove('current'));
  const item = strip.querySelector(`.film-item[data-s="${s}"]`);
  if (!item) return;
  item.classList.add('current');
  const left = item.offsetLeft - strip.clientWidth / 2 + item.offsetWidth / 2;
  strip.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
}

function toggleFilm(open = !filmOpen) {
  filmOpen = open;
  if (open) {
    tools.search?.close({ keepHits: true });
    if (filmStale) buildFilm();
  }
  film.classList.toggle('open', open);
  setPressed('film', open);
  if (open) requestAnimationFrame(() => markFilm(false));
}

function wireFilm() {
  strip.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    strip.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
}

// ---------- counter: click to type a page number ----------
function startGoto() {
  const counter = $('.counter', counterWrap);
  if (!counter) return;
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.min = '1';
  input.max = String(M.pageCount);
  input.placeholder = `1–${M.pageCount}`;
  input.className = 'counter-input';
  input.setAttribute('aria-label', `Go to page (1 to ${M.pageCount})`);
  counter.replaceWith(input);
  input.focus();
  let done = false;
  const finish = go => {
    if (done) return;
    done = true;
    const n = parseInt(input.value, 10);
    const restored = document.createElement('button');
    restored.type = 'button';
    restored.className = 'counter';
    restored.dataset.act = 'goto';
    restored.title = 'Go to page';
    restored.innerHTML = '<b></b><span></span>';
    input.replaceWith(restored);
    sync();
    if (go && n >= 1 && n <= M.pageCount) book.jumpTo(book.bookOf(n));
    else if (go) toast(`Pages run from 1 to ${M.pageCount}`);
    return restored;
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finish(e.key === 'Enter')?.focus();
    }
  });
  input.addEventListener('blur', () => finish(false));
}

// ---------- share, fullscreen ----------
async function share() {
  const p = book.visiblePdf();
  const link = new URL(location.href);
  link.hash = p > 1 ? `p=${p}` : '';
  const title = [M.shortName, M.title, M.year].filter(Boolean).join(' ');
  if (navigator.share && coarsePointer()) {
    try {
      await navigator.share({ title, url: link.href });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(link.href);
    toast(p > 1 ? `Link to page ${p} copied` : 'Link copied');
  } catch {
    toast(link.href);
  }
}

function toggleFullscreen() {
  const el = document.documentElement;
  const isFs = document.fullscreenElement || document.webkitFullscreenElement;
  const fn = isFs ? (document.exitFullscreen || document.webkitExitFullscreen) : (el.requestFullscreen || el.webkitRequestFullscreen);
  if (!fn) return;
  try {
    Promise.resolve(fn.call(isFs ? document : el)).catch(() => {});
  } catch { /* not allowed here */ }
}

function onFullscreen() {
  const b = $('[data-act="fullscreen"]', dock);
  if (!b) return;
  const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
  b.innerHTML = isFs ? icons.shrink : icons.expand;
  b.setAttribute('aria-label', isFs ? 'Exit fullscreen' : 'Fullscreen');
}

// ---------- keyboard ----------
function wireKeys() {
  document.addEventListener('keydown', e => {
    const body = document.body.classList;
    if (!body.contains('reading') || body.contains('zooming') || body.contains('outro-open')) return;
    const target = e.target;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault(); // the pages are images, so the browser's find can't see them
      tools.search?.open();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if ((e.key === ' ' || e.key === 'Enter') && target.closest?.('button, a')) return;
    switch (e.key) {
      case 'ArrowRight': case 'PageDown': book.next(); break;
      case 'ArrowLeft': case 'PageUp': book.prev(); break;
      case ' ': e.shiftKey ? book.prev() : book.next(); break;
      case 'Home': book.first(); break;
      case 'End': book.last(); break;
      case '/': tools.search?.open(); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'z': case 'Z': tools.zoom?.open(book.visiblePdf()); break;
      case 't': case 'T': toggleFilm(); break;
      case 'Escape': closePanels(); break;
      default: return;
    }
    e.preventDefault();
  });
}

// Mouse wheel / two-finger swipe over the book turns pages.
function wireWheel() {
  let acc = 0;
  let lockedUntil = 0;
  let last = 0;
  $('#stage').addEventListener('wheel', e => {
    if (e.ctrlKey) return; // trackpad pinch: zoom.js opens the zoom view
    e.preventDefault();
    const now = performance.now();
    if (now - last > 220) acc = 0;
    last = now;
    if (now < lockedUntil) return;
    acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(acc) < 90) return;
    acc > 0 ? book.next() : book.prev();
    acc = 0;
    lockedUntil = now + 800;
  }, { passive: false });
}

// The dock fades back while you read; any movement brings it back.
function wireDim() {
  if (coarsePointer()) return;
  let timer = 0;
  const wake = () => {
    dock.classList.remove('dim');
    clearTimeout(timer);
    timer = setTimeout(() => {
      const busy = dock.matches(':hover, :focus-within') || filmOpen || document.body.classList.contains('search-open');
      if (!busy) dock.classList.add('dim');
    }, 3500);
  };
  ['pointermove', 'pointerdown', 'keydown'].forEach(t => addEventListener(t, wake, { passive: true }));
  dock.addEventListener('focusin', wake);
  wake();
}

function closePanels() {
  if (filmOpen) toggleFilm(false);
  tools.search?.close();
}

function setPressed(act, on) {
  $(`[data-act="${act}"]`, dock)?.setAttribute('aria-pressed', String(!!on));
}

export const nav = {
  init,
  setPressed,
  closeFilm: () => filmOpen && toggleFilm(false),
  registerTool: (name, api) => { tools[name] = api; },
};

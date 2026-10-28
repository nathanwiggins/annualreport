// The flipbook. Wraps StPageFlip (vendor/page-flip), sizes it to the stage,
// lazy-loads page images, and turns long jumps into a quick page riffle.
//
// Book pages vs. PDF pages: the PDF's first page is the front cover and its
// last page the back cover. If the PDF has an odd page count, a blank page is
// slipped in before the back cover so the inside pages pair into spreads.
//
// Events on `book.events`:
//   change     { index, prev, cause }  cause: 'flip' (user or jump), 'riffle' (a jump's in-between page), 'layout'
//   layout     { mode }                'landscape' (two-page spreads) or 'portrait' (one page)
//   flipstart  a page has started turning
import { $, clamp, esc, reducedMotion } from './util.js';
import { icons } from './icons.js';

const FLIP_MS = 850;
const RIFFLE_MS = 140;

const events = new EventTarget();
let M = null;
let pages = [];      // { pdf, el, img, thumb, hits, level, thumbed }; pdf is null for the blank page
let spreads = [];
let pf = null;
let mode = '';
let current = 0;     // first book page of the current spread
let ratio = 8.5 / 11;
let res = 'md';
let heights = { md: 1100, lg: 1800 };
let stage = null;
let frame = null;
let building = false;
let relayout = false;
let riffling = false;
let jumpToken = 0;
let hits = null;
let activeHit = null;

const pad3 = n => String(n).padStart(3, '0');
const ver = () => `?v=${M.version}`;
const url = {
  page: (pdf, size = res) => `book/pages/${size}/${pad3(pdf)}.webp${ver()}`,
  thumb: pdf => `book/thumbs/${pad3(pdf)}.webp${ver()}`,
  pdf: () => `book/${M.pdf}`,
};

const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));
const flipTime = () => (reducedMotion() ? 420 : FLIP_MS);

function preload(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = img.onerror = resolve;
    img.src = src;
  });
}

async function init(manifest, startPdf = 1) {
  M = manifest;
  heights = M.sizes || heights;
  stage = $('#stage');
  frame = $('#frame');
  ratio = M.pages[0].w / M.pages[0].h;
  pages = [];
  for (let p = 1; p <= M.pageCount; p++) pages.push({ pdf: p });
  if (M.pageCount > 2 && M.pageCount % 2 === 1) pages.splice(M.pageCount - 1, 0, { pdf: null });
  current = bookOf(startPdf);

  const p = plan();
  res = p.res;
  await preload(url.page(1));
  await apply(p, true);

  let queued = false;
  new ResizeObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply(plan());
    });
  }).observe(stage);
}

// Pick one page or a two-page spread, whichever shows the pages bigger
// (two-up wins unless it shrinks pages by more than 20%).
function plan() {
  const cs = getComputedStyle(stage);
  const W = Math.max(120, stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  const H = Math.max(120, stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
  const twoUp = Math.min(H, W / (2 * ratio));
  const oneUp = Math.min(H, W / ratio);
  const m = pages.length > 1 && twoUp >= 0.8 * oneUp ? 'landscape' : 'portrait';
  const h = Math.floor(m === 'landscape' ? twoUp : oneUp);
  const pw = Math.floor(h * ratio);
  const dpr = window.devicePixelRatio || 1;
  return { mode: m, w: m === 'landscape' ? pw * 2 : pw, h, res: h * dpr > heights.md * 1.1 ? 'lg' : 'md' };
}

function apply(p, force = false) {
  frame.style.width = `${p.w}px`;
  frame.style.height = `${p.h}px`;
  if (p.res !== res) {
    res = p.res;
    pages.forEach(pg => { pg.level = null; });
  }
  if (force || p.mode !== mode) return build(p.mode);
  relayout = true;
  pf.update();
  relayout = false;
  loadNear();
  return Promise.resolve();
}

// StPageFlip can't switch between one-up and two-up in place, so each switch
// builds a fresh instance on the current page.
function build(m) {
  building = true;
  mode = m;
  frame.dataset.mode = m;
  if (pf) {
    try { pf.destroy(); } catch { /* already detached */ }
  }
  frame.querySelectorAll('.book-root').forEach(el => el.remove());
  const root = document.createElement('div');
  root.className = 'book-root';
  frame.appendChild(root);
  spreads = computeSpreads();
  const els = pages.map(makePage);

  pf = new window.St.PageFlip(root, {
    width: 1000 * ratio,
    height: 1000,
    size: 'stretch',
    // Portrait is forced with a huge minWidth, landscape with usePortrait off.
    minWidth: m === 'portrait' ? 100000 : 10,
    maxWidth: 100000,
    minHeight: 10,
    maxHeight: 100000,
    usePortrait: m === 'portrait',
    showCover: true,
    autoSize: true,
    drawShadow: true,
    maxShadowOpacity: 0.5,
    flippingTime: flipTime(),
    startPage: current,
    mobileScrollSupport: false,
    swipeDistance: 30,
    showPageCorners: true,
    disableFlipByClick: false,
    clickEventForward: true,
    useMouseEvents: true,
  });
  pf.on('flip', e => onFlip(e.data));
  pf.on('changeState', e => {
    if (e.data === 'flipping') emit('flipstart');
  });
  return new Promise(resolve => {
    pf.on('init', () => {
      building = false;
      loadNear();
      placeShadow();
      emit('layout', { mode });
      emit('change', { index: current, prev: current, cause: 'layout' });
      resolve();
    });
    pf.loadFromHTML(els);
  });
}

function computeSpreads() {
  if (mode === 'portrait') return pages.map((_, i) => [i]);
  const out = [[0]];
  for (let i = 1; i < pages.length; i += 2) out.push(i < pages.length - 1 ? [i, i + 1] : [i]);
  return out;
}

function spreadIndexOf(i) {
  if (mode === 'portrait') return i;
  return i === 0 ? 0 : Math.floor((i + 1) / 2);
}

function linkEl(link) {
  const a = document.createElement('a');
  a.className = 'pg-link';
  const [x, y, w, h] = link.box;
  a.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%`;
  if (link.url) {
    a.href = link.url;
    if (/^https?:/i.test(link.url)) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    a.title = link.url;
  } else {
    a.href = `#p=${link.page}`;
    a.title = `Go to page ${link.page}`;
  }
  a.setAttribute('aria-label', a.title);
  return a;
}

function makePage(pg, i) {
  const el = document.createElement('div');
  el.className = 'page';
  if (i === 0 || i === pages.length - 1) el.dataset.density = 'hard';
  Object.assign(pg, { el, img: null, thumb: null, hits: null, level: null, thumbed: false });
  if (!pg.pdf) {
    el.classList.add('blank');
    el.innerHTML = `<div class="blank-mark">${icons.bolt}<span>${esc(M.shortName)}</span></div>`;
    return el;
  }
  pg.thumb = document.createElement('div');
  pg.thumb.className = 'pg-thumb';
  pg.img = document.createElement('img');
  pg.img.className = 'pg-img';
  pg.img.alt = `Page ${pg.pdf}`;
  pg.img.decoding = 'async';
  pg.img.draggable = false;
  pg.img.addEventListener('load', () => pg.img.classList.add('loaded'));
  el.append(pg.thumb, pg.img);
  const links = M.pages[pg.pdf - 1]?.links || [];
  if (links.length) {
    const box = document.createElement('div');
    box.className = 'pg-links';
    links.forEach(l => box.appendChild(linkEl(l)));
    el.appendChild(box);
  }
  pg.hits = document.createElement('div');
  pg.hits.className = 'pg-hits';
  el.appendChild(pg.hits);
  paintHits(pg);
  return el;
}

// Thumbnail first (instant, blurry), then the full page image.
function load(i, thumbOnly = false) {
  const pg = pages[i];
  if (!pg?.img) return;
  if (!pg.thumbed) {
    pg.thumb.style.backgroundImage = `url("${url.thumb(pg.pdf)}")`;
    pg.thumbed = true;
  }
  if (thumbOnly || pg.level === res) return;
  pg.level = res;
  pg.img.src = url.page(pg.pdf, res);
}

function loadNear() {
  const s = spreadIndexOf(current);
  const reach = mode === 'landscape' ? 3 : 4;
  for (let k = s - reach; k <= s + reach; k++) (spreads[k] || []).forEach(i => load(i));
}

function onFlip(index) {
  const prev = current;
  current = index;
  if (building) return; // the init handler reports the starting state
  loadNear();
  placeShadow();
  syncHash();
  emit('change', { index, prev, cause: relayout ? 'layout' : riffling ? 'riffle' : 'flip' });
}

function placeShadow() {
  const sp = spreads[spreadIndexOf(current)] || [0];
  frame.dataset.view = mode === 'portrait' ? 'single' : sp.length === 2 ? 'spread' : sp[0] === 0 ? 'cover' : 'back';
}

function syncHash() {
  const p = pdfAt(current);
  const hash = p > 1 ? `#p=${p}` : '';
  if (location.hash !== hash) history.replaceState(null, '', hash || location.pathname + location.search);
}

function setFlipTime(ms = flipTime()) {
  if (pf) pf.getSettings().flippingTime = ms;
}

function flipAndWait(i) {
  return new Promise(resolve => {
    let timer = 0;
    const done = () => {
      clearTimeout(timer);
      events.removeEventListener('change', done);
      resolve();
    };
    events.addEventListener('change', done);
    timer = setTimeout(done, RIFFLE_MS * 6 + 300);
    pf.flip(i);
  });
}

// Animated jump to book page i. Far jumps riffle through a few pages on the way.
async function jumpTo(i, { animate = true } = {}) {
  if (!pf || building) return;
  i = clamp(i, 0, pages.length - 1);
  const from = spreadIndexOf(current);
  const to = spreadIndexOf(i);
  if (from === to) return;
  const token = ++jumpToken;
  spreads[to].forEach(k => load(k));
  if (!animate) {
    pf.turnToPage(i);
    return;
  }
  const dist = Math.abs(to - from);
  if (dist > 2 && !reducedMotion()) {
    const steps = Math.min(3, dist - 1);
    riffling = true;
    try {
      for (let k = 1; k <= steps; k++) {
        const s = Math.round(from + ((to - from) * k) / (steps + 1));
        spreads[s].forEach(j => load(j, true));
        setFlipTime(RIFFLE_MS);
        await flipAndWait(spreads[s][0]);
        if (token !== jumpToken) return;
      }
    } finally {
      if (token === jumpToken) {
        riffling = false;
        setFlipTime();
      }
    }
  }
  pf.flip(i);
}

function next() {
  if (!pf || building) return;
  jumpToken++;
  riffling = false;
  setFlipTime();
  pf.flipNext();
}

function prev() {
  if (!pf || building) return;
  jumpToken++;
  riffling = false;
  setFlipTime();
  pf.flipPrev();
}

// PDF page shown at book page i (the blank page borrows the page before it)
function pdfAt(i) {
  for (let k = clamp(i, 0, pages.length - 1); k >= 0; k--) if (pages[k].pdf) return pages[k].pdf;
  return 1;
}

function bookOf(pdf) {
  const p = clamp(Math.round(pdf) || 1, 1, M.pageCount);
  return pages.findIndex(pg => pg.pdf === p);
}

// "Cover", "Back cover", "12–13", or "12"
function label(s) {
  const sp = spreads[s] || [];
  if (sp.length === 1 && sp[0] === 0) return 'Cover';
  if (sp.length === 1 && sp[0] === pages.length - 1 && pages.length > 1) return 'Back cover';
  const nums = sp.map(i => pages[i].pdf).filter(Boolean);
  if (!nums.length) return 'Blank page';
  return nums.length === 2 ? `${nums[0]}–${nums[1]}` : String(nums[0]);
}

function coverRect() {
  const r = frame.getBoundingClientRect();
  return mode === 'landscape' ? new DOMRect(r.left + r.width / 2, r.top, r.width / 2, r.height) : r;
}

// Where book page i sits on screen while it's showing
function pageRect(i) {
  const r = frame.getBoundingClientRect();
  if (mode === 'portrait') return r;
  return i % 2 === 1 ? new DOMRect(r.left, r.top, r.width / 2, r.height) : new DOMRect(r.left + r.width / 2, r.top, r.width / 2, r.height);
}

// map: Map(pdfPage -> [match -> [[x, y, w, h], ...]]) in 0..1 page units; active: { pdf, m }
function setHits(map, active = null) {
  hits = map;
  activeHit = active;
  pages.forEach(paintHits);
}

function paintHits(pg) {
  if (!pg.hits) return;
  pg.hits.textContent = '';
  const matches = hits?.get(pg.pdf);
  if (!matches) return;
  matches.forEach((boxes, m) => {
    const on = activeHit && activeHit.pdf === pg.pdf && activeHit.m === m;
    boxes.forEach(([x, y, w, h]) => {
      const d = document.createElement('div');
      d.className = on ? 'pg-hit active' : 'pg-hit';
      d.style.cssText = `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%`;
      pg.hits.appendChild(d);
    });
  });
}

export const book = {
  events,
  url,
  init,
  jumpTo,
  next,
  prev,
  first: () => jumpTo(0),
  last: () => jumpTo(pages.length - 1),
  spreads: () => spreads,
  spreadIndexOf,
  label,
  pdfAt,
  bookOf,
  visiblePdf: () => pdfAt((spreads[spreadIndexOf(current)] || [current])[0]),
  pdfOfBook: i => pages[i]?.pdf ?? null,
  coverRect,
  pageRect,
  setHits,
  linkEl,
  get current() { return current; },
  get count() { return pages.length; },
  get mode() { return mode; },
  get ratio() { return ratio; },
};

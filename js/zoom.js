// Zoom viewer. Opens on the big pre-rendered page image right away, then
// lazily loads PDF.js (vendor/pdfjs) and redraws the real vector page at
// whatever zoom you settle on, so small print stays sharp.
import { $, clamp } from './util.js';
import { icons } from './icons.js';
import { book } from './book.js';

const MAX = 6;
let M = null;
let root, view, pageEl, img, canvasBox, linksEl, label, pct, status;
let isOpen = false;
let pdfPage = 1;
let s = 1;        // zoom relative to "fit"
let tx = 0;       // page offset inside the view, px
let ty = 0;
let fitW = 0;
let fitH = 0;
let pdfDoc = null;
let pdfLoading = null;
let renderSeq = 0;
let renderTimer = 0;
let task = null;
let lastFocus = null;

function init(manifest) {
  M = manifest;
  root = $('#zoom');
  root.innerHTML = `
    <div class="zoom-bar">
      <div class="zoom-title"><span class="eyebrow">Zoom</span><span class="zoom-label"></span></div>
      <div class="zoom-tools">
        <button type="button" class="ic" data-z="prev" aria-label="Previous page" title="Previous page (←)">${icons.prev}</button>
        <button type="button" class="ic" data-z="next" aria-label="Next page" title="Next page (→)">${icons.next}</button>
        <span class="dock-sep" aria-hidden="true"></span>
        <button type="button" class="ic" data-z="out" aria-label="Zoom out" title="Zoom out (−)">${icons.zoomOut}</button>
        <span class="zoom-pct">100%</span>
        <button type="button" class="ic" data-z="in" aria-label="Zoom in" title="Zoom in (+)">${icons.zoomIn}</button>
        <button type="button" class="ic" data-z="fit" aria-label="Fit page" title="Fit page (0)">${icons.fit}</button>
        <span class="dock-sep" aria-hidden="true"></span>
        <button type="button" class="ic" data-z="close" aria-label="Close zoom" title="Close (Esc)">${icons.close}</button>
      </div>
    </div>
    <div class="zoom-view" tabindex="-1">
      <div class="zoom-page"><img alt=""><div class="zoom-canvas"></div><div class="pg-links"></div></div>
      <div class="zoom-status"></div>
    </div>
    <p class="zoom-hint">Scroll or pinch to zoom · drag to pan · double-click to zoom in or out · ← → for pages</p>`;
  view = $('.zoom-view', root);
  pageEl = $('.zoom-page', root);
  img = $('img', pageEl);
  canvasBox = $('.zoom-canvas', root);
  linksEl = $('.pg-links', root);
  label = $('.zoom-label', root);
  pct = $('.zoom-pct', root);
  status = $('.zoom-status', root);

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-z]');
    if (!b) return;
    const r = view.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    switch (b.dataset.z) {
      case 'prev': show(pdfPage - 1); break;
      case 'next': show(pdfPage + 1); break;
      case 'in': zoomAt(s * 1.5, cx, cy, true); break;
      case 'out': zoomAt(s / 1.5, cx, cy, true); break;
      case 'fit': fit(true); break;
      case 'close': close(); break;
    }
  });
  linksEl.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (a && a.getAttribute('href').startsWith('#p=')) {
      e.preventDefault();
      show(parseInt(a.getAttribute('href').slice(3), 10));
    }
  });
  wirePointer();
  document.addEventListener('keydown', onKey);
  addEventListener('resize', () => isOpen && fit(false));

  // Pinch on the book (touch) or trackpad pinch (ctrl+wheel) opens the zoom view.
  const stage = $('#stage');
  stage.addEventListener('touchstart', e => {
    if (e.touches.length === 2 && document.body.classList.contains('reading')) {
      e.preventDefault();
      open(book.visiblePdf());
    }
  }, { passive: false });
  stage.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (e.deltaY < 0 && document.body.classList.contains('reading')) open(book.visiblePdf());
  }, { passive: false });
}

function open(p) {
  if (isOpen) return;
  isOpen = true;
  lastFocus = document.activeElement;
  root.hidden = false;
  document.body.classList.add('zooming');
  requestAnimationFrame(() => root.classList.add('open'));
  show(p);
  view.focus({ preventScroll: true });
}

function close() {
  if (!isOpen) return;
  isOpen = false;
  clearTimeout(renderTimer);
  task?.cancel();
  root.classList.remove('open');
  document.body.classList.remove('zooming');
  setTimeout(() => { if (!isOpen) root.hidden = true; }, 320);
  // Leave the book on the page you were reading.
  const target = book.bookOf(pdfPage);
  if (book.spreadIndexOf(target) !== book.spreadIndexOf(book.current)) book.jumpTo(target);
  lastFocus?.focus?.({ preventScroll: true });
}

function show(p) {
  pdfPage = clamp(p, 1, M.pageCount);
  img.src = book.url.page(pdfPage, 'lg');
  img.alt = `Page ${pdfPage}`;
  canvasBox.replaceChildren();
  canvasBox.dataset.w = '0';
  linksEl.replaceChildren(...(M.pages[pdfPage - 1]?.links || []).map(book.linkEl));
  label.textContent = `Page ${pdfPage} of ${M.pageCount}`;
  $('[data-z="prev"]', root).disabled = pdfPage <= 1;
  $('[data-z="next"]', root).disabled = pdfPage >= M.pageCount;
  fit(false);
}

function fit(animate) {
  const r = view.getBoundingClientRect();
  const pg = M.pages[pdfPage - 1];
  const ar = pg.w / pg.h;
  const pad = r.width < 600 ? 12 : 28;
  fitH = Math.max(50, Math.min(r.height - pad * 2, (r.width - pad * 2) / ar));
  fitW = fitH * ar;
  pageEl.style.width = `${fitW}px`;
  pageEl.style.height = `${fitH}px`;
  s = 1;
  tx = (r.width - fitW) / 2;
  ty = (r.height - fitH) / 2;
  paint(animate);
  scheduleRender(animate ? 320 : 60);
}

function paint(animate) {
  pageEl.style.transition = animate ? 'transform .3s cubic-bezier(.22,.61,.36,1)' : 'none';
  pageEl.style.transform = `translate(${tx}px, ${ty}px) scale(${s})`;
  pct.textContent = `${Math.round(s * 100)}%`;
  $('[data-z="out"]', root).disabled = s <= 1.001;
  $('[data-z="in"]', root).disabled = s >= MAX - 0.001;
}

// Keep the page centered while it's smaller than the view, otherwise keep it from drifting away.
function constrain() {
  const r = view.getBoundingClientRect();
  const w = fitW * s;
  const h = fitH * s;
  const slack = 60;
  tx = w <= r.width ? (r.width - w) / 2 : clamp(tx, r.width - w - slack, slack);
  ty = h <= r.height ? (r.height - h) / 2 : clamp(ty, r.height - h - slack, slack);
}

// Zoom to `next`, keeping the point under (cx, cy) in place.
function zoomAt(next, cx, cy, animate) {
  const r = view.getBoundingClientRect();
  const x = cx - r.left;
  const y = cy - r.top;
  const px = (x - tx) / s;
  const py = (y - ty) / s;
  s = clamp(next, 1, MAX);
  tx = x - px * s;
  ty = y - py * s;
  constrain();
  paint(animate);
  scheduleRender();
}

function wirePointer() {
  const pts = new Map();
  let pinch = null;
  const mid = () => {
    const [a, b] = [...pts.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 };
  };
  view.addEventListener('pointerdown', e => {
    if (e.target.closest('a')) return; // let PDF links click through
    view.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    view.classList.add('grabbing');
    if (pts.size === 2) {
      const m = mid();
      const r = view.getBoundingClientRect();
      pinch = { s, d: m.d, px: (m.x - r.left - tx) / s, py: (m.y - r.top - ty) / s };
    }
  });
  view.addEventListener('pointermove', e => {
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) {
      tx += e.clientX - prev.x;
      ty += e.clientY - prev.y;
      constrain();
      paint(false);
    } else if (pts.size === 2 && pinch) {
      const m = mid();
      const r = view.getBoundingClientRect();
      s = clamp(pinch.s * (m.d / pinch.d), 1, MAX);
      tx = m.x - r.left - pinch.px * s;
      ty = m.y - r.top - pinch.py * s;
      constrain();
      paint(false);
      scheduleRender();
    }
  });
  const up = e => {
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (!pts.size) view.classList.remove('grabbing');
  };
  view.addEventListener('pointerup', up);
  view.addEventListener('pointercancel', up);
  view.addEventListener('wheel', e => {
    e.preventDefault();
    const k = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0016));
    zoomAt(s * k, e.clientX, e.clientY, false);
  }, { passive: false });
  view.addEventListener('dblclick', e => {
    if (e.target.closest('a')) return;
    zoomAt(s > 1.4 ? 1 : 2.5, e.clientX, e.clientY, true);
  });
}

function onKey(e) {
  if (!isOpen) return;
  const handled = {
    Escape: close,
    ArrowLeft: () => show(pdfPage - 1),
    ArrowRight: () => show(pdfPage + 1),
    PageUp: () => show(pdfPage - 1),
    PageDown: () => show(pdfPage + 1),
    '+': () => zoomIn(),
    '=': () => zoomIn(),
    '-': () => zoomOut(),
    _: () => zoomOut(),
    0: () => fit(true),
  }[e.key];
  if (!handled) return;
  e.preventDefault();
  e.stopPropagation();
  handled();
}

function zoomIn() {
  const r = view.getBoundingClientRect();
  zoomAt(s * 1.5, r.left + r.width / 2, r.top + r.height / 2, true);
}

function zoomOut() {
  const r = view.getBoundingClientRect();
  zoomAt(s / 1.5, r.left + r.width / 2, r.top + r.height / 2, true);
}

function setStatus(text) {
  status.textContent = text;
  status.classList.toggle('show', !!text);
}

// ---------- PDF.js ----------
function getPdf() {
  if (pdfDoc) return Promise.resolve(pdfDoc);
  pdfLoading ||= (async () => {
    const lib = await import('../vendor/pdfjs/pdf.min.js');
    lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;
    pdfDoc = await lib.getDocument({ url: book.url.pdf() }).promise;
    return pdfDoc;
  })().catch(err => {
    pdfLoading = null;
    throw err;
  });
  return pdfLoading;
}

function scheduleRender(delay = 200) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderNow, delay);
}

async function renderNow() {
  if (!isOpen) return;
  const seq = ++renderSeq;
  const want = pdfPage;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  // Stay under ~16 megapixels per canvas (Safari's limit).
  const maxW = Math.sqrt(16e6 * (fitW / fitH));
  const targetW = Math.min(fitW * s * dpr, maxW, 8192);
  if (+canvasBox.dataset.w >= targetW * 0.95) return;
  if (!pdfDoc) setStatus('Loading the full-resolution PDF…');
  try {
    const doc = await getPdf();
    if (seq !== renderSeq) return;
    const page = await doc.getPage(want);
    if (seq !== renderSeq) return;
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: targetW / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    task?.cancel();
    task = page.render({ canvasContext: canvas.getContext('2d'), viewport });
    await task.promise;
    task = null;
    if (seq !== renderSeq || want !== pdfPage || !isOpen) return;
    canvasBox.replaceChildren(canvas);
    canvasBox.dataset.w = String(targetW);
    setStatus('');
  } catch (err) {
    if (err?.name === 'RenderingCancelledException') return;
    console.warn('Zoom: PDF.js could not render; showing the high-resolution image instead.', err);
    setStatus('');
  }
}

export const zoom = { init, open, close, get isOpen() { return isOpen; } };

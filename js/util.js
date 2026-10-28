// Small helpers shared by every module.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const coarsePointer = () => matchMedia('(pointer: coarse)').matches;

// Storage can throw (private mode, blocked cookies); settings then just don't persist.
function storage(area, key, value) {
  try {
    if (value === undefined) return window[area].getItem(key);
    window[area].setItem(key, value);
  } catch { /* ignore */ }
  return null;
}
export const store = (key, value) => storage('localStorage', key, value);
export const session = (key, value) => storage('sessionStorage', key, value);

let toastTimer = 0;
export function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

let liveTimer = 0;
export function announce(msg) {
  clearTimeout(liveTimer);
  liveTimer = setTimeout(() => { $('#live').textContent = msg; }, 300);
}

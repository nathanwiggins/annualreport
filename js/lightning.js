// SUU red lightning, in the style of the supervisor deck's closing strike.
// drawBolt() animates one bolt inside any SVG (the intro draws into its window).
// strike() is the whole effect on the page-wide #fx layer: bolt, flash,
// shock ring, optional shake, and thunder.
import { $, rand } from './util.js';
import { sound } from './sound.js';

const NS = 'http://www.w3.org/2000/svg';
let fx = null;
let svg = null;
let live = 0;

function layer() {
  if (!svg) {
    fx = $('#fx');
    svg = document.createElementNS(NS, 'svg');
    fx.appendChild(svg);
  }
  svg.setAttribute('viewBox', `0 0 ${innerWidth} ${innerHeight}`);
  return svg;
}

// Midpoint displacement: split every segment and push its midpoint sideways,
// halving the push each round.
export function boltPoints(a, b, rough = 0.18, depth = 7) {
  let pts = [a, b];
  let push = Math.hypot(b.x - a.x, b.y - a.y) * rough;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const q = pts[i];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const off = rand(-push, push);
      next.push({ x: (p.x + q.x) / 2 - (dy / len) * off, y: (p.y + q.y) / 2 + (dx / len) * off }, q);
    }
    pts = next;
    push /= 2;
  }
  return pts;
}

function polyline(parent, cls, pts, width) {
  const el = document.createElementNS(NS, 'polyline');
  el.setAttribute('class', cls);
  el.setAttribute('points', pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '));
  el.setAttribute('pathLength', '1');
  el.style.strokeWidth = width;
  el.style.strokeDasharray = '1 1';
  el.style.strokeDashoffset = '1';
  parent.appendChild(el);
  return el;
}

// The deck's bolt-life flicker
const LIFE = [
  { opacity: 1, offset: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0.15, offset: 0.36 }, { opacity: 1, offset: 0.42 },
  { opacity: 0.4, offset: 0.5 }, { opacity: 1, offset: 0.56 }, { opacity: 1, offset: 0.78 }, { opacity: 0, offset: 1 },
];
const DRAW = [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }];

// One bolt from a to b inside `parent` (any SVG element, in its own units).
// Resolves once it has flickered out.
export function drawBolt(parent, a, b, { width = 5, branches = 3, core = '#ff9a9a', delay = 0 } = {}) {
  const g = document.createElementNS(NS, 'g');
  g.style.opacity = '0';
  parent.appendChild(g);
  const main = boltPoints(a, b);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const dir = Math.atan2(b.y - a.y, b.x - a.x);
  const forks = [];
  for (let i = 0; i < branches; i++) {
    const p = main[Math.floor(main.length * rand(0.2, 0.7))];
    const ang = dir + (Math.random() < 0.5 ? -1 : 1) * rand(0.35, 0.85);
    const l = len * rand(0.12, 0.3);
    const end = { x: p.x + Math.cos(ang) * l, y: p.y + Math.sin(ang) * l };
    forks.push(polyline(g, 'bolt-branch', boltPoints(p, end, 0.22, 5), width * 0.5));
  }
  const bolt = polyline(g, 'bolt-main', main, width);
  const hot = polyline(g, 'bolt-core', main, Math.max(1, width * 0.32));
  hot.style.stroke = core;
  [bolt, hot].forEach(el => el.animate(DRAW, { duration: 160, delay, fill: 'forwards' }));
  forks.forEach(el => el.animate(DRAW, { duration: 100, delay: delay + 100, fill: 'forwards' }));
  const life = g.animate(LIFE, { duration: 1300, delay, fill: 'forwards' });
  const remove = () => g.remove();
  return life.finished.then(remove, remove);
}

export function flashAt(p, power = 1) {
  layer();
  const f = document.createElement('div');
  f.className = 'flash';
  f.style.background = `radial-gradient(circle at ${p.x}px ${p.y}px, rgba(255,236,236,${0.5 * power}) 0, rgba(219,0,0,${0.3 * power}) 16%, rgba(219,0,0,${0.1 * power}) 34%, transparent 62%)`;
  fx.appendChild(f);
  const remove = () => f.remove();
  f.animate([
    { opacity: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 0.25, offset: 0.2 },
    { opacity: 0.85, offset: 0.28 }, { opacity: 0, offset: 0.6 }, { opacity: 0 },
  ], { duration: 1100 }).finished.then(remove, remove);
}

export function ringAt(p) {
  const root = layer();
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('class', 'bolt-ring');
  c.setAttribute('cx', p.x);
  c.setAttribute('cy', p.y);
  c.setAttribute('r', 32);
  root.appendChild(c);
  const remove = () => c.remove();
  c.animate([{ opacity: 0.85, transform: 'scale(.2)' }, { opacity: 0, transform: 'scale(5)' }],
    { duration: 750, easing: 'cubic-bezier(.22,.61,.36,1)' }).finished.then(remove, remove);
}

export function shake(el, power = 1) {
  const a = 7 * power;
  el.animate([
    { transform: 'translate(0,0)' }, { transform: `translate(${-a}px,${a / 2}px)` }, { transform: `translate(${a}px,${-a / 2}px)` },
    { transform: `translate(${-a * 0.6}px,${a * 0.3}px)` }, { transform: `translate(${a * 0.35}px,0)` }, { transform: 'translate(0,0)' },
  ], { duration: 420, easing: 'ease-out', composite: 'add' });
}

// Full strike on the page-wide layer. `from` and `to` are viewport pixels.
export function strike({ from, to, width = 5, branches = 3, core, delay = 0, power = 1, flash = true, ring = true, shakeEl = null, onImpact } = {}) {
  const root = layer();
  live++;
  fx.classList.add('live');
  const done = drawBolt(root, from, to, { width, branches, core, delay });
  setTimeout(() => {
    if (flash) flashAt(to, power);
    if (ring) ringAt(to);
    if (shakeEl) shake(shakeEl, power);
    sound.thunder(power);
    onImpact?.();
  }, delay + 150);
  return done.then(() => {
    if (--live === 0) fx.classList.remove('live');
  });
}

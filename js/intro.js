// The opening, about six seconds:
//   1. fade up on an SUU office at night, storm over the red cliffs
//   2. a red strike outside the window; the Thunderbird bursts out of the flash, carrying the report
//   3. it swoops in and drops the book on the desk, then climbs away trailing lightning
//   4. title card
//   5. the camera pushes in on the book until it becomes the reader's cover
// Skippable any time (button, Esc, Enter, Space, →).
import { $, clamp, esc, rand } from './util.js';
import { book } from './book.js';
import { drawBolt, ringAt } from './lightning.js';
import { sound } from './sound.js';
import { sceneSVG, birdSVG, SCENE, BIRD } from './scene.js';

const SKIP = Symbol('skip');
const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const easeInQuad = t => t * t;

function bezier(a, b, c, d, t) {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}

function tangent(a, b, c, d, t) {
  const u = 1 - t;
  return {
    x: 3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
    y: 3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y),
  };
}

function template(M) {
  return `
  <div class="intro-scene">${sceneSVG()}</div>
  <div class="intro-roomflash"></div>
  <div class="intro-title">
    <span class="eyebrow">${esc([M.shortName, M.university].filter(Boolean).join(' · '))}</span>
    <h1>${esc(M.title)}</h1>
    ${M.year ? `<p>${esc(M.year)}</p>` : ''}
  </div>
  <div class="intro-actors">
    <svg class="intro-trail"></svg>
    <div class="ibook"><img class="ibook-cover" src="${book.url.page(1)}" alt=""><div class="ibook-spine"></div><div class="ibook-sheen"></div></div>
    <div class="tbird"><div class="tbird-art">${birdSVG()}</div></div>
  </div>
  <button type="button" class="intro-skip">Skip intro <kbd>Esc</kbd></button>
  <div class="intro-black"></div>`;
}

export async function playIntro(M) {
  const root = $('#intro');
  root.className = 'intro';
  root.innerHTML = template(M);
  root.hidden = false;
  const el = {
    scene: $('.intro-scene', root),
    svg: $('svg.scene', root),
    skyFx: $('.sky-fx', root),
    skyFlash: $('.sky-flash', root),
    roomFlash: $('.intro-roomflash', root),
    title: $('.intro-title', root),
    actors: $('.intro-actors', root),
    trail: $('.intro-trail', root),
    bird: $('.tbird', root),
    art: $('.tbird-art', root),
    book: $('.ibook', root),
    skip: $('.intro-skip', root),
  };

  // ---------- skipping ----------
  const running = new Set();
  let skipped = false;
  let wake = null;
  let raf = 0;
  const track = anim => {
    running.add(anim);
    const done = () => running.delete(anim);
    anim.finished.then(done, done);
    return anim;
  };
  const settle = anim => anim.finished.catch(() => { throw SKIP; });
  const pause = ms => new Promise((resolve, reject) => {
    if (skipped) return reject(SKIP);
    const timer = setTimeout(() => { wake = null; resolve(); }, ms);
    wake = () => { clearTimeout(timer); reject(SKIP); };
  });
  const skip = () => {
    if (skipped) return;
    skipped = true;
    cancelAnimationFrame(raf);
    running.forEach(a => a.cancel());
    wake?.();
  };
  const onKey = e => {
    if (['Escape', 'Enter', ' ', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      skip();
    }
  };
  el.skip.addEventListener('click', skip);
  document.addEventListener('keydown', onKey);

  // ---------- geometry ----------
  const C = book.coverRect();                 // where the cover sits in the reader
  const ctm = el.svg.getScreenCTM();
  const k = ctm.a;                            // screen px per scene unit
  const P = p => ({ x: ctm.a * p.x + ctm.e, y: ctm.d * p.y + ctm.f });
  const emerge = P(SCENE.emerge);
  const drop = P(SCENE.drop);
  const land = P(SCENE.land);
  const exit = P(SCENE.exit);
  const deskW = SCENE.bookWidth * k;
  const deskScale = deskW / C.width;

  // The bird art is offset so its talons sit on the wrapper's origin.
  const birdW = Math.min(BIRD.w * k * 0.95, innerWidth * 0.82);
  const u = birdW / BIRD.w;
  Object.assign(el.art.style, {
    width: `${birdW}px`, height: `${BIRD.h * u}px`,
    left: `${-BIRD.talon.x * u}px`, top: `${-BIRD.talon.y * u}px`,
  });

  // The book is laid out at its final (reader) size and scaled down, so it's crisp when it arrives.
  Object.assign(el.book.style, { left: `${C.left}px`, top: `${C.top}px`, width: `${C.width}px`, height: `${C.height}px` });
  const cx0 = C.left + C.width / 2;
  const cy0 = C.top + C.height / 2;
  const persp = C.width * 2.2;
  const bookT = (x, y, s, rx = 0, rz = 0) =>
    `translate(${x - cx0}px, ${y - cy0}px) scale(${s}) perspective(${persp}px) rotateX(${rx}deg) rotateZ(${rz}deg)`;

  // ---------- the lightning trail behind the bird ----------
  const trailPts = [];
  function drawTrail(now, s) {
    while (trailPts.length && now - trailPts[0].t > 320) trailPts.shift();
    if (trailPts.length < 2) {
      el.trail.innerHTML = '';
      return;
    }
    const pts = trailPts.map((p, i) => {
      const j = i === trailPts.length - 1 ? 0 : rand(-7, 7) * s;
      return `${(p.x + rand(-2, 2)).toFixed(1)},${(p.y + j).toFixed(1)}`;
    }).join(' ');
    el.trail.innerHTML = `<polyline points="${pts}" stroke="#DB0000" stroke-width="${(5 * s + 1).toFixed(1)}"/>`
      + `<polyline points="${pts}" stroke="#ffd6d6" stroke-width="${(1.6 * s + 0.6).toFixed(1)}"/>`;
  }
  function fadeTrail() {
    const step = now => {
      if (skipped) return;
      drawTrail(now, 1);
      if (trailPts.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }

  // ---------- flight ----------
  function carry(pos, s, ang) {
    const sc = deskScale * s;
    el.book.style.transform = bookT(pos.x, pos.y + (C.height * sc) / 2 + 3 * s, sc, 0, ang * 0.25);
  }
  function fly({ path: [a, b, c, d], duration, s0, s1, sEase = t => t, ease = t => t, carrying = false }) {
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      const frame = now => {
        if (skipped) return reject(SKIP);
        const lt = clamp((now - t0) / duration, 0, 1);
        const t = ease(lt);
        const pos = bezier(a, b, c, d, t);
        const tan = tangent(a, b, c, d, t);
        const ang = clamp((Math.atan2(tan.y, tan.x) * 180) / Math.PI, -32, 38) * 0.6;
        const s = s0 + (s1 - s0) * sEase(lt);
        el.bird.style.transform = `translate(${pos.x}px, ${pos.y}px) rotate(${ang}deg) scale(${s})`;
        if (carrying) carry(pos, s, ang);
        trailPts.push({ x: pos.x - 150 * u * s, y: pos.y - 40 * u * s, t: now });
        drawTrail(now, s);
        if (lt < 1) raf = requestAnimationFrame(frame);
        else resolve(ang);
      };
      raf = requestAnimationFrame(frame);
    });
  }

  function shakeScene(power) {
    const a = 7 * power;
    track(el.scene.animate([
      { transform: 'translate(0,0)' }, { transform: `translate(${-a}px,${a / 2}px)` }, { transform: `translate(${a}px,${-a / 2}px)` },
      { transform: `translate(${-a * 0.5}px,${a * 0.3}px)` }, { transform: 'translate(0,0)' },
    ], { duration: 420, easing: 'ease-out', composite: 'add' }));
  }

  function landing() {
    for (let i = 0; i < 12; i++) {
      const puff = document.createElement('div');
      puff.className = 'puff';
      el.actors.appendChild(puff);
      const ang = rand(Math.PI * 1.05, Math.PI * 1.95);
      const dist = rand(40, 110) * k;
      const x = land.x + rand(-0.45, 0.45) * deskW;
      const y = land.y + rand(-6, 10) * k;
      const remove = () => puff.remove();
      track(puff.animate([
        { transform: `translate(${x}px, ${y}px) rotate(0deg) scale(${k})`, opacity: 1 },
        { transform: `translate(${x + Math.cos(ang) * dist}px, ${y + Math.sin(ang) * dist * 0.6}px) rotate(${rand(-200, 200)}deg) scale(${k * 0.7})`, opacity: 0 },
      ], { duration: rand(500, 820), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' })).finished.then(remove, remove);
    }
    shakeScene(0.35);
    el.svg.classList.remove('flicker');
    void el.svg.getBoundingClientRect();
    el.svg.classList.add('flicker');
    sound.rustle();
  }

  // ---------- the sequence ----------
  try {
    // 1. fade up
    root.classList.add('on');
    await pause(300);
    el.skip.classList.add('show');
    await pause(700);

    // 2. strike outside the window
    drawBolt(el.skyFx, SCENE.boltFrom, SCENE.boltTo, { width: 6, branches: 4, core: '#fff' });
    await pause(150);
    const FLASH = [{ opacity: 0 }, { opacity: 0.75, offset: 0.08 }, { opacity: 0.15, offset: 0.25 }, { opacity: 0.55, offset: 0.32 }, { opacity: 0 }];
    track(el.skyFlash.animate(FLASH, { duration: 1100 }));
    track(el.roomFlash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 0.2, offset: 0.25 }, { opacity: 0.7, offset: 0.32 }, { opacity: 0 }], { duration: 1100 }));
    shakeScene(1);
    sound.thunder(1);
    ringAt(emerge);

    // 3. the Thunderbird bursts out of the flash with the report
    el.bird.style.opacity = '1';
    el.book.style.opacity = '1';
    track(el.bird.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }));
    await fly({
      path: [emerge, { x: emerge.x + 40 * k, y: emerge.y + 120 * k }, { x: drop.x - 150 * k, y: drop.y + 30 * k }, drop],
      duration: 1350, s0: 0.12, s1: 1, sEase: easeInQuad, ease: easeInOutSine, carrying: true,
    });

    // 4. let go: the book drops to the desk while the bird climbs away
    el.bird.classList.add('glide');
    const landed = bookT(land.x, land.y, deskScale, 54, -7);
    const fall = track(el.book.animate([
      { transform: el.book.style.transform, easing: 'cubic-bezier(.5,0,.9,.6)' },
      { transform: bookT(land.x, land.y - 14 * k, deskScale, 46, -9), offset: 0.82, easing: 'ease-out' },
      { transform: landed },
    ], { duration: 560, fill: 'forwards' }));
    const away = fly({
      // first control point continues the swoop's final heading, so the turn upward is smooth
      path: [drop, { x: drop.x + 180 * k, y: drop.y - 36 * k }, { x: drop.x + 420 * k, y: drop.y - 240 * k }, exit],
      duration: 950, s0: 1, s1: 1.35, ease: easeInQuad,
    });
    away.catch(() => {});
    await pause(460);
    landing();
    await Promise.all([away, settle(fall)]);
    el.book.style.transform = landed;
    fall.cancel();
    el.bird.style.opacity = '0';
    fadeTrail();

    // 5. title card
    await pause(250);
    el.title.classList.add('show');
    await pause(1250);

    // 6. push in: the scene grows around the book, the book flattens into the cover
    document.body.classList.add('backdrop');
    el.title.classList.remove('show');
    el.book.classList.add('flat');
    const grow = C.width / deskW;
    const ZOOM = { duration: 1500, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' };
    track(el.scene.animate([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: `translate(${cx0 - grow * land.x}px, ${cy0 - grow * land.y}px) scale(${grow})` },
    ], ZOOM));
    track(el.scene.animate([{ opacity: 1 }, { opacity: 1, offset: 0.35 }, { opacity: 0 }], { duration: 1500, fill: 'forwards' }));
    await settle(track(el.book.animate([{ transform: landed }, { transform: bookT(cx0, cy0, 1, 0, 0) }], ZOOM)));

    // 7. hand off to the real book underneath
    document.body.classList.add('reading');
  } catch (err) {
    if (err !== SKIP) console.error(err);
    document.body.classList.add('backdrop', 'reading');
    root.classList.add('out');
    await new Promise(r => setTimeout(r, 460));
  } finally {
    skipped = true;
    cancelAnimationFrame(raf);
    running.forEach(a => a.cancel());
    document.removeEventListener('keydown', onKey);
    root.hidden = true;
    root.innerHTML = '';
    root.className = 'intro';
  }
}

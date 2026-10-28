// Boot: read the manifest scripts/build_pages.py wrote, build the book, wire
// up navigation, then play the intro (or go straight to reading).
//
// URL options:  #p=12      open on page 12 (skips the intro; share links use this)
//               ?intro=1   always play the intro      ?intro=0   never play it
import { $, esc, session, reducedMotion } from './util.js';
import { book } from './book.js';
import { nav } from './nav.js';
import { search } from './search.js';
import { zoom } from './zoom.js';
import { outro } from './outro.js';
import { sound } from './sound.js';
import { playIntro } from './intro.js';

function deepLink(count) {
  const m = /^#p=(\d+)$/.exec(location.hash);
  return m ? Math.min(Math.max(+m[1], 1), count) : 0;
}

function fatal(heading, detail) {
  $('#loader').innerHTML = `<div class="fatal"><span class="eyebrow">SPARC annual report</span><h1>${heading}</h1><p>${detail}</p></div>`;
}

async function boot() {
  let M;
  try {
    const res = await fetch('book/manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    M = await res.json();
  } catch {
    fatal('The report isn’t built yet', 'Run <code>scripts/preview.sh</code> to preview it locally, or push to <code>main</code> and the GitHub Action will publish it.');
    return;
  }
  if (!window.St?.PageFlip) {
    fatal('Something didn’t load', 'The page-flip library is missing. Try reloading the page.');
    return;
  }

  document.title = [M.shortName, M.title, M.year].filter(Boolean).join(' ');
  $('#top-title').innerHTML = `${esc(M.title)}${M.year ? ` <b>${esc(M.year)}</b>` : ''}`;

  const deep = deepLink(M.pageCount);
  await book.init(M, deep || 1);
  nav.init(M);
  search.init(M);
  zoom.init(M);
  outro.init(M);
  nav.registerTool('search', search);
  nav.registerTool('zoom', zoom);
  book.events.addEventListener('flipstart', () => sound.rustle());

  // In-page links (#p=N) and the back button move the book.
  addEventListener('hashchange', () => {
    const p = deepLink(M.pageCount);
    book.jumpTo(p ? book.bookOf(p) : 0);
  });

  const param = new URLSearchParams(location.search).get('intro');
  const playIt = param === '1' || (param !== '0' && !deep && !reducedMotion() && !document.hidden && !session('ar-intro-seen'));
  document.body.classList.remove('booting');
  if (playIt) {
    session('ar-intro-seen', '1');
    await playIntro(M);
  } else {
    document.body.classList.add('backdrop', 'reading');
  }

  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
  idle(() => search.preload());
}

boot();

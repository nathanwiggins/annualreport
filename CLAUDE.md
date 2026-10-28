## Project
SUU-themed flipbook shell for the SPARC annual report, hosted on GitHub Pages (https://nathanwiggins.github.io/annualreport/). Whatever single PDF is in `report/` becomes the book. Vanilla HTML/CSS/ES modules, no framework and no JS build step; the only build is PDF → images, done by `scripts/build_pages.py` (locally via `scripts/preview.sh`, in CI via `.github/workflows/deploy.yml` on push to `main`).

## Files
- `report/`: the one PDF plus `config.json` (title, year, download name, outro title, `sectionStrikes`). The only thing that changes year to year. `scripts/make_sample_pdf.py` regenerates the placeholder sample.
- `scripts/build_pages.py`: writes `book/` (page images `pages/md|lg`, `thumbs/`, `manifest.json`, `search.json` with word boxes, `og.jpg`, `report.pdf`). `--site _site` copies the shell too and rewrites the `<!-- meta:start -->…<!-- meta:end -->` block in `index.html` with real title and link-preview tags.
- `index.html`: markup shell only; every panel is filled in by its JS module.
- `css/theme.css` tokens and shared bits (icon buttons, loader, toast, lightning) · `book.css` reader, pages, outro · `nav.css` dock, scrubber, filmstrip, search panel, zoom · `intro.css`.
- `js/main.js`: boot, deep links (`#p=N`), `?intro=0|1`.
- `js/book.js`: wraps StPageFlip. Book pages ≠ PDF pages (blank page padded before the back cover when the count is odd); use `bookOf()` / `pdfAt()`. Emits `change` (`cause`: `flip` | `riffle` | `layout`), `layout`, `flipstart`.
- `js/nav.js` dock + keyboard + wheel · `search.js` (uses `book/search.json`, not PDF.js) · `zoom.js` (lazy-loads PDF.js for sharp zoom; falls back to the `lg` image) · `outro.js` (back-cover strike + section strikes from top-level bookmarks) · `intro.js` choreography · `scene.js` intro art and key points · `lightning.js` · `sound.js` (Web Audio synth, off by default) · `icons.js` · `util.js`.
- `vendor/`: page-flip 2.0.7 and pdfjs-dist 4.10.38. PDF.js files are renamed `.mjs` → `.js` so `python3 -m http.server` serves them with a JavaScript MIME type.
- `book/`, `_site/`: build output, gitignored.

## Gotchas
- StPageFlip rewrites each `.page` element's inline style (`cssText`), so never put inline styles on `.page`; style or fill its children instead (see `.pg-thumb`).
- StPageFlip can't switch one-up ↔ two-up in place; `book.js build()` destroys and rebuilds it on the current page. Portrait is forced with a huge `minWidth`; CSS overrides the inline min sizes it writes.
- Intro art is in 1600×900 scene units, cropped with `xMidYMax slice`; on phones only about x 550–1050 is visible, so keep anything important in that band. Key points live in `SCENE` in `scene.js`.
- The deployed site is only `main`. Past years live on their own branches (`2025-2026`, …).

## Style
Matches the student-supervising deck (`../../document/student-supervising`): SUU red `#DB0000`, dotted paper, mono uppercase eyebrows, serif display headings, SVG lightning that jolts the logo. Branding: SPARC wordmark leads; the Thunderbird appears in the intro and outro.

# SPARC Annual Report flipbook

An SUU-themed flipbook for the SPARC annual report. Drop a PDF into `report/`, push to `main`, and GitHub Pages serves it at **https://nathanwiggins.github.io/annualreport/**: a Thunderbird delivers the book in a lightning strike, pages turn like paper, and a bolt strikes the logo on the back cover.

## Swap in a new report

1. Replace the PDF in `report/` (keep exactly one PDF there).
2. Update `report/config.json` (title, year, download file name, sections).
3. Push to `main`. The GitHub Action renders the pages and publishes the site in a couple of minutes.

The PDF's **first page is the front cover** and its **last page is the back cover**, unless `addBackCover` is on: then the last page stays an inside page and the flipbook adds the SPARC back cover after it (Download still gives the original PDF). If the page count is odd, a blank page is added before the back cover so spreads line up. Each **section** gets a small lightning strike when you reach it, a tick on the scrubber, and its name in the scrubber preview. Sections come from `sections` in `report/config.json`, copied from the report's table of contents. Without that list, the PDF's top-level bookmarks are used instead, but Canva exports a bookmark for nearly every heading, so keep the list.

### `report/config.json`

| Field | Used for |
|---|---|
| `title`, `year` | Intro title card, browser tab, top bar, link previews |
| `shortName`, `organization`, `university` | Eyebrow labels, outro card |
| `description` | Link-preview text |
| `downloadName` | File name when someone downloads the PDF |
| `outroTitle` | Heading on the end card |
| `sectionStrikes` | `false` turns off the section lightning |
| `addBackCover` | `true` when the PDF has no back cover: adds the SPARC one (`scripts/back_cover.py`) after the last page |
| `sections` | `[{ "title": "Awards", "page": 13 }, …]`. `page` is the PDF page as a PDF viewer counts it (cover = 1), not the number printed on the page. In the FY26 report that's the table-of-contents number + 1. |

## Preview locally

```sh
pip install pymupdf pillow
scripts/preview.sh          # then open http://localhost:8000
```

Add `?intro=1` to replay the intro (it plays once per browser session), or `?intro=0` to skip it.

## One-time GitHub setup

Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Past years

Each year is kept on its own branch. At year end, freeze the current report, then swap the PDF on `main`:

```sh
git branch 2025-2026 && git push origin 2025-2026
```

Only `main` is published. To look at an older year, check out its branch and run `scripts/preview.sh`.

## For readers

- **Turn pages:** click or drag a page corner, swipe, use ← →, or scroll over the book.
- **Bottom bar:** drag the scrubber (it previews pages as you go), open thumbnails (T), search (/), zoom (Z), copy a link to the current page, toggle sound, go fullscreen (F), download the PDF. Click the page counter to type a page number.
- **Links:** `…/annualreport/#p=12` opens straight to page 12 (no intro).

#!/usr/bin/env python3
"""Turn the one PDF in report/ into the flipbook's assets.

    python3 scripts/build_pages.py               # writes book/ for local preview
    python3 scripts/build_pages.py --site _site  # whole GitHub Pages site (the Action runs this)

book/ holds:
    manifest.json         page count, sizes, links, outline, and report/config.json
    search.json           every page's words with their boxes, for search highlights
    pages/md, pages/lg    page images (1100px and 1800px tall)
    thumbs/               small page images for the filmstrip, scrubber, and search
    og.jpg                link-preview image built from page 1
    report.pdf            the PDF itself, for download and zoom

Needs PyMuPDF and Pillow: pip install pymupdf pillow
"""
import argparse
import html
import json
import re
import shutil
import sys
import time
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
REPORT = ROOT / "report"
SHELL = ["index.html", "css", "js", "assets", "vendor"]
HEIGHTS = {"md": 1100, "lg": 1800}
THUMB_H = 260
WEBP_QUALITY = 84


def fail(msg):
    sys.exit(f"build_pages: {msg}")


def find_pdf():
    pdfs = sorted(p for p in REPORT.iterdir() if p.is_file() and p.suffix.lower() == ".pdf")
    if len(pdfs) != 1:
        found = ", ".join(p.name for p in pdfs) or "none"
        fail(f"report/ must hold exactly one PDF (found: {found}).")
    return pdfs[0]


def load_config():
    path = REPORT / "config.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        fail(f"report/config.json is not valid JSON: {err}")


def render(page, height):
    zoom = height / page.rect.height
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def scaled(img, height):
    width = max(1, round(img.width * height / img.height))
    return img.resize((width, height), Image.LANCZOS)


def norm_box(rect, page):
    w, h = page.rect.width, page.rect.height
    return [rect.x0 / w, rect.y0 / h, rect.width / w, rect.height / h]


def page_links(page):
    out = []
    for link in page.get_links():
        rect = link.get("from")
        if not rect or rect.is_empty:
            continue
        box = [round(v, 4) for v in norm_box(rect, page)]
        if link.get("kind") == pymupdf.LINK_URI and link.get("uri"):
            out.append({"box": box, "url": link["uri"]})
        elif link.get("page", -1) >= 0:
            out.append({"box": box, "page": link["page"] + 1})
    return out


def page_words(page):
    # Text coordinates come from the unrotated page; rotate them to match the image.
    mat = page.rotation_matrix if page.rotation else None
    words, boxes = [], []
    for x0, y0, x1, y1, word, *_ in page.get_text("words", sort=True):
        rect = pymupdf.Rect(x0, y0, x1, y1)
        if mat:
            rect = rect * mat
        words.append(word)
        boxes.append([round(v * 10000) for v in norm_box(rect, page)])
    return {"w": words, "b": boxes}


def og_image(cover, out):
    """1200x630 preview: page 1 on ink, with the deck's red slab."""
    W, H = 1200, 630
    bg = Image.new("RGB", (W, H), (22, 21, 19))
    draw = ImageDraw.Draw(bg)
    for y in range(13, H, 26):
        for x in range(13, W, 26):
            draw.ellipse((x - 1, y - 1, x + 1, y + 1), fill=(48, 46, 43))
    draw.polygon([(W * 0.58, 0), (W, 0), (W, H), (W * 0.40, H)], fill=(219, 0, 0))
    page = scaled(cover, H - 90)
    x, y = (W - page.width) // 2, (H - page.height) // 2
    shadow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(shadow).rectangle((x + 10, y + 18, x + page.width + 10, y + page.height + 18), fill=150)
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    bg.paste((0, 0, 0), (0, 0), shadow)
    bg.paste(page, (x, y))
    bg.save(out, "JPEG", quality=88)


def build_book(out_dir):
    pdf_path = find_pdf()
    cfg = load_config()
    if out_dir.exists():
        shutil.rmtree(out_dir)
    for sub in ("pages/md", "pages/lg", "thumbs"):
        (out_dir / sub).mkdir(parents=True)

    doc = pymupdf.open(pdf_path)
    if doc.needs_pass:
        fail(f"{pdf_path.name} is password protected.")
    if doc.page_count == 0:
        fail(f"{pdf_path.name} has no pages.")

    pages, search, cover = [], [], None
    for i, page in enumerate(doc):
        name = f"{i + 1:03d}.webp"
        big = render(page, HEIGHTS["lg"])
        big.save(out_dir / "pages/lg" / name, "WEBP", quality=WEBP_QUALITY, method=5)
        scaled(big, HEIGHTS["md"]).save(out_dir / "pages/md" / name, "WEBP", quality=WEBP_QUALITY, method=5)
        scaled(big, THUMB_H).save(out_dir / "thumbs" / name, "WEBP", quality=78, method=5)
        if i == 0:
            cover = big
        pages.append({"w": round(page.rect.width, 2), "h": round(page.rect.height, 2), "links": page_links(page)})
        search.append(page_words(page))
        print(f"  page {i + 1}/{doc.page_count}", end="\r", flush=True)
    print()

    outline = [
        {"level": level, "title": title.strip(), "page": target}
        for level, title, target in doc.get_toc(simple=True)
        if target >= 1 and title.strip()
    ]
    meta = doc.metadata or {}
    doc.close()

    og_image(cover, out_dir / "og.jpg")
    shutil.copy2(pdf_path, out_dir / "report.pdf")

    manifest = {
        "version": int(time.time()),
        "source": pdf_path.name,
        "title": cfg.get("title") or meta.get("title") or "Annual Report",
        "year": cfg.get("year", ""),
        "shortName": cfg.get("shortName", "SPARC"),
        "organization": cfg.get("organization", ""),
        "university": cfg.get("university", "Southern Utah University"),
        "description": cfg.get("description", ""),
        "downloadName": cfg.get("downloadName") or pdf_path.name,
        "outroTitle": cfg.get("outroTitle", "Thanks for reading."),
        "sectionStrikes": cfg.get("sectionStrikes", True) is not False,
        "pdf": "report.pdf",
        "pageCount": len(pages),
        "sizes": {**HEIGHTS, "thumb": THUMB_H},
        "pages": pages,
        "outline": outline,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / "search.json").write_text(json.dumps(search, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Built {len(pages)} pages from {pdf_path.name} into {out_dir.relative_to(ROOT) if out_dir.is_relative_to(ROOT) else out_dir}")
    return manifest


def stamp_index(index_path, manifest, base_url):
    """Swap the <!-- meta:start -->…<!-- meta:end --> block for real title and link-preview tags."""
    title = " ".join(x for x in (manifest["shortName"], manifest["title"], manifest["year"]) if x)
    desc = manifest["description"] or f"{manifest['university']} {title}"
    image = f"{base_url.rstrip('/')}/book/og.jpg" if base_url else "book/og.jpg"
    e = lambda s: html.escape(s, quote=True)
    block = "\n".join([
        "<!-- meta:start -->",
        f"<title>{e(title)}</title>",
        f'<meta name="description" content="{e(desc)}">',
        f'<meta property="og:type" content="website">',
        f'<meta property="og:title" content="{e(title)}">',
        f'<meta property="og:description" content="{e(desc)}">',
        f'<meta property="og:image" content="{e(image)}">',
        f'<meta name="twitter:card" content="summary_large_image">',
        "<!-- meta:end -->",
    ])
    text = index_path.read_text(encoding="utf-8")
    text, n = re.subn(r"<!-- meta:start -->.*?<!-- meta:end -->", lambda _: block, text, flags=re.S)
    if n != 1:
        fail("index.html is missing its <!-- meta:start --> / <!-- meta:end --> markers.")
    index_path.write_text(text, encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--site", type=Path, help="assemble the full static site in this folder")
    ap.add_argument("--base-url", default="", help="public site URL, for absolute link-preview image URLs")
    args = ap.parse_args()

    if not args.site:
        build_book(ROOT / "book")
        return

    site = args.site if args.site.is_absolute() else ROOT / args.site
    if site.exists():
        shutil.rmtree(site)
    site.mkdir(parents=True)
    for name in SHELL:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, site / name)
        else:
            shutil.copy2(src, site / name)
    manifest = build_book(site / "book")
    stamp_index(site / "index.html", manifest, args.base_url)


if __name__ == "__main__":
    main()

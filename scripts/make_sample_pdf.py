#!/usr/bin/env python3
"""Write report/sample-annual-report.pdf: a 12-page placeholder in the SUU style.

It has bookmarks (section lightning), internal and web links, and real text
(search), so every flipbook feature works before the real report arrives.
Delete it once the real PDF is in report/.
"""
from pathlib import Path

import pymupdf

OUT = Path(__file__).resolve().parent.parent / "report" / "sample-annual-report.pdf"
W, H = 612, 792
M = 56
RED = (219 / 255, 0, 0)
RED_DARK = (156 / 255, 0, 0)
INK = (22 / 255, 21 / 255, 19 / 255)
SOFT = (74 / 255, 71 / 255, 68 / 255)
PAPER = (246 / 255, 243 / 255, 239 / 255)
LINE = (0.86, 0.84, 0.81)
WHITE = (1, 1, 1)

LOREM = (
    "This is placeholder copy so the flipbook has something to show. Replace "
    "report/sample-annual-report.pdf with the real annual report and push to main; "
    "the site rebuilds itself from whatever PDF is in that folder. "
)

# (number, eyebrow, title, layout)
SECTIONS = [
    ("01", "Leadership", "A Message from the Director", "text"),
    ("02", "By the numbers", "The Year at a Glance", "stats"),
    ("03", "Funding", "Funding by College", "bars"),
    ("04", "Research", "Research Highlights", "text"),
    ("05", "Agreements", "Agreements & Contracts", "text"),
    ("06", "Compliance", "Compliance & Training", "text"),
    ("07", "Students", "Student Researchers", "text"),
    ("08", "Our office", "The SPARC Team", "text"),
    ("09", "Next year", "Looking Ahead", "text"),
]
FIRST_SECTION = 2  # 0-based page index: cover, contents, then the sections


def dots(page, color, opacity, step=18):
    shape = page.new_shape()
    for y in range(step // 2, H, step):
        for x in range(step // 2, W, step):
            shape.draw_circle((x, y), 0.8)
    shape.finish(fill=color, color=None, fill_opacity=opacity)
    shape.commit()


def text(page, rect, body, size=10.5, font="helv", color=INK, align=0, lh=1.45):
    page.insert_textbox(pymupdf.Rect(*rect), body, fontsize=size, fontname=font, color=color, align=align, lineheight=lh)


def eyebrow(page, y, label, color=RED):
    page.draw_line((M, y - 3), (M + 20, y - 3), color=color, width=2)
    page.insert_text((M + 28, y), label.upper(), fontname="cobo", fontsize=8.5, color=color)


def frame(doc, num, label, title):
    page = doc.new_page(width=W, height=H)
    page.draw_rect(page.rect, color=None, fill=PAPER)
    dots(page, INK, 0.07)
    page.draw_rect(pymupdf.Rect(0, 0, W, 8), color=None, fill=RED)
    eyebrow(page, 74, f"{num}  ·  {label}")
    text(page, (M, 86, W - M, 186), title, size=30, font="tibo", lh=1.15)
    page.draw_line((M, H - 48), (W - M, H - 48), color=LINE, width=0.8)
    page.insert_text((M, H - 32), "SPARC ANNUAL REPORT 2025-2026  ·  SAMPLE", fontname="cour", fontsize=7.5, color=SOFT)
    page.insert_text((W - M - 12, H - 32), str(doc.page_count), fontname="cobo", fontsize=8, color=RED)
    return page


def stat(page, x, y, w, big, small):
    page.draw_rect(pymupdf.Rect(x, y, x + w, y + 92), color=LINE, fill=WHITE, width=0.8)
    page.draw_rect(pymupdf.Rect(x, y, x + 3, y + 92), color=None, fill=RED)
    text(page, (x + 16, y + 12, x + w - 8, y + 60), big, size=30, font="tibo", color=RED, lh=1.1)
    text(page, (x + 16, y + 58, x + w - 8, y + 90), small.upper(), size=7.5, font="cobo", color=SOFT)


def cover(doc):
    page = doc.new_page(width=W, height=H)
    page.draw_rect(page.rect, color=None, fill=RED)
    dots(page, WHITE, 0.18, 20)
    shape = page.new_shape()
    shape.draw_polyline([(W * 0.55, 0), (W, 0), (W, H), (W * 0.18, H)])
    shape.finish(fill=RED_DARK, color=None, closePath=True, fill_opacity=0.55)
    shape.commit()
    page.draw_line((M, 112), (M + 26, 112), color=WHITE, width=2)
    page.insert_text((M + 36, 116), "SOUTHERN UTAH UNIVERSITY  ·  SPARC", fontname="cobo", fontsize=9, color=WHITE)
    text(page, (M, 280, W - M, 500), "Annual\nReport", size=78, font="tibo", color=WHITE, lh=1.05)
    text(page, (M, 500, W - M, 540), "2025 - 2026", size=22, font="cour", color=WHITE)
    text(page, (M, 640, W - M, 700),
         "Sponsored Programs, Agreements, Research & Contracts\nSample report for the flipbook. Replace with the real PDF.",
         size=10, color=WHITE)


def contents(doc):
    """Draws the contents page; returns its link spots, added once the target pages exist."""
    page = frame(doc, "00", "Inside", "Contents")
    links = []
    y = 206
    for i, (num, _, title, _) in enumerate(SECTIONS):
        target = FIRST_SECTION + i
        page.insert_text((M, y + 4), num, fontname="cobo", fontsize=11, color=RED)
        page.insert_text((M + 40, y + 4), title, fontname="tiro", fontsize=16, color=INK)
        page.insert_text((W - M - 18, y + 4), str(target + 1), fontname="cobo", fontsize=11, color=SOFT)
        page.draw_line((M, y + 16), (W - M, y + 16), color=LINE, width=0.6)
        links.append({"kind": pymupdf.LINK_GOTO, "from": pymupdf.Rect(M, y - 14, W - M, y + 14),
                      "page": target, "to": pymupdf.Point(0, 0)})
        y += 48
    text(page, (M, y + 16, W - M, y + 60), "Every line above is a link: click one in the flipbook to jump there.", size=10, color=SOFT)
    return links


def section(doc, num, label, title, layout):
    page = frame(doc, num, label, title)
    body = LOREM * 3
    if layout == "stats":
        cw = (W - 2 * M - 24) / 3
        figures = [("142", "Proposals submitted"), ("$18.4M", "Awarded funding"), ("96", "Active awards"),
                   ("61", "Agreements executed"), ("1,240", "Training completions"), ("38", "Student researchers")]
        for i, (big, small) in enumerate(figures):
            stat(page, M + (i % 3) * (cw + 12), 200 + (i // 3) * 108, cw, big, small)
        text(page, (M, 432, W - M, 460), "Sample figures for layout only.", size=9, font="cour", color=SOFT)
        text(page, (M, 470, W - M, 720), body)
    elif layout == "bars":
        rows = [("College of Science & Engineering", 0.92), ("College of Education & Human Development", 0.64),
                ("School of Business", 0.41), ("College of Humanities & Social Sciences", 0.37),
                ("College of Performing & Visual Arts", 0.22), ("Library & Academic Support", 0.15)]
        y = 214
        for name, frac in rows:
            page.insert_text((M, y), name, fontname="helv", fontsize=10, color=INK)
            page.draw_rect(pymupdf.Rect(M, y + 8, W - M, y + 20), color=None, fill=LINE)
            page.draw_rect(pymupdf.Rect(M, y + 8, M + (W - 2 * M) * frac, y + 20), color=None, fill=RED)
            y += 46
        text(page, (M, y + 10, W - M, 720), "Sample proportions for layout only. " + body)
    else:
        text(page, (M, 200, W - M, 470), body, size=11)
        page.draw_rect(pymupdf.Rect(M, 490, W - M, 600), color=None, fill=WHITE)
        page.draw_rect(pymupdf.Rect(M, 490, M + 3, 600), color=None, fill=RED)
        text(page, (M + 22, 508, W - M - 16, 592),
             '"A pull quote sits here, set in the serif display face, to show how a highlighted line reads on the page."',
             size=15, font="tiit", lh=1.35)
        text(page, (M, 620, W - M, 730), LOREM)


def back(doc):
    page = doc.new_page(width=W, height=H)
    page.draw_rect(page.rect, color=None, fill=INK)
    dots(page, WHITE, 0.08, 20)
    page.draw_rect(pymupdf.Rect(0, H - 10, W, H), color=None, fill=RED)
    text(page, (M, 296, W - M, 360), "SPARC", size=40, font="tibo", color=WHITE, align=1, lh=1.15)
    text(page, (M, 362, W - M, 420), "Sponsored Programs, Agreements, Research & Contracts\nSouthern Utah University  ·  Cedar City, Utah",
         size=10, color=(0.8, 0.8, 0.8), align=1)
    link = pymupdf.Rect(W / 2 - 80, 450, W / 2 + 80, 476)
    page.draw_rect(link, color=RED, width=1.2)
    text(page, (link.x0, link.y0 + 7, link.x1, link.y1 + 4), "WWW.SUU.EDU", size=9, font="cobo", color=WHITE, align=1)
    page.insert_link({"kind": pymupdf.LINK_URI, "from": link, "uri": "https://www.suu.edu/"})


def main():
    doc = pymupdf.open()
    cover(doc)
    links = contents(doc)
    for num, label, title, layout in SECTIONS:
        section(doc, num, label, title, layout)
    back(doc)
    for link in links:
        doc[1].insert_link(link)
    # Three top-level parts (each gets a lightning strike in the flipbook), sections nested under them.
    parts = {0: "Our Year", 3: "Research & Agreements", 6: "People & What's Next"}
    toc = []
    for i, (_, _, title, _) in enumerate(SECTIONS):
        if i in parts:
            toc.append([1, parts[i], FIRST_SECTION + i + 1])
        toc.append([2, title, FIRST_SECTION + i + 1])
    doc.set_toc(toc)
    doc.set_metadata({"title": "SPARC Annual Report 2025-2026 (sample)", "author": "SUU SPARC"})
    OUT.parent.mkdir(exist_ok=True)
    doc.save(OUT, garbage=3, deflate=True)
    print(f"Wrote {OUT.relative_to(OUT.parent.parent)} ({doc.page_count} pages)")


if __name__ == "__main__":
    main()

"""The SPARC back cover: ink page, faint dots, red base, and a WWW.SUU.EDU link.

build_pages.py adds it after the PDF's last page when report/config.json has
"addBackCover": true (for reports whose last page is an inside page).
make_sample_pdf.py uses it as the sample's back page.
"""
import pymupdf

INK = (22 / 255, 21 / 255, 19 / 255)
RED = (219 / 255, 0, 0)
WHITE = (1, 1, 1)
GREY = (0.8, 0.8, 0.8)
MARGIN = 56


def _dots(page, color, opacity, step):
    w, h = page.rect.width, page.rect.height
    shape = page.new_shape()
    for y in range(step // 2, int(h), step):
        for x in range(step // 2, int(w), step):
            shape.draw_circle((x, y), 0.8)
    shape.finish(fill=color, color=None, fill_opacity=opacity)
    shape.commit()


def add_back_cover(doc, width=612, height=792, name="SPARC",
                   organization="Sponsored Programs, Agreements, Research & Contracts",
                   university="Southern Utah University"):
    """Append the back cover to `doc` (sized to match the report) and return the new page."""
    page = doc.new_page(width=width, height=height)
    w, h, cy = width, height, height / 2
    page.draw_rect(page.rect, color=None, fill=INK)
    _dots(page, WHITE, 0.08, 20)
    page.draw_rect(pymupdf.Rect(0, h - 10, w, h), color=None, fill=RED)
    page.insert_textbox(pymupdf.Rect(MARGIN, cy - 100, w - MARGIN, cy - 36), name,
                        fontsize=40, fontname="tibo", color=WHITE, align=1, lineheight=1.15)
    page.insert_textbox(pymupdf.Rect(MARGIN, cy - 34, w - MARGIN, cy + 24),
                        f"{organization}\n{university}  ·  Cedar City, Utah",
                        fontsize=10, fontname="helv", color=GREY, align=1, lineheight=1.45)
    link = pymupdf.Rect(w / 2 - 80, cy + 54, w / 2 + 80, cy + 80)
    page.draw_rect(link, color=RED, width=1.2)
    page.insert_textbox(pymupdf.Rect(link.x0, link.y0 + 7, link.x1, link.y1 + 4), "WWW.SUU.EDU",
                        fontsize=9, fontname="cobo", color=WHITE, align=1, lineheight=1.45)
    page.insert_link({"kind": pymupdf.LINK_URI, "from": link, "uri": "https://www.suu.edu/"})
    return page

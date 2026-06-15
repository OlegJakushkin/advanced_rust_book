# -*- coding: utf-8 -*-
"""Standalone one-off prints, reusing the three-book PDF engine:
  - Chapter 41 as its own PDF for each book (main / workbook / solutions)
  - A Contents page (parts + chapters) WITHOUT page numbers, shared across all books
Outputs land in exports/standalone/.
"""
import os, sys
import build_complete_pdf as B          # main + workbook machinery, OUTLINE, build_book
import build_solutions_pdf as S         # solutions renderer (loads solout/*.json)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "standalone")
os.makedirs(OUT, exist_ok=True)

CH = 41
AUTHOR = "O. Iakushkin"


def chapter_entry(n):
    for e in B.OUTLINE:
        if e["kind"] == "chapter" and e["num"] == n:
            return e
    raise SystemExit(f"chapter {n} not found in outline")


def emit(parts, name, running_head):
    out_pdf = os.path.join(OUT, name)
    pdf, _ = B.build_book(parts, out_pdf, book_title=running_head,
                          author=AUTHOR, extra_css=B.EXTRA_CSS)
    print("PDF:", pdf, flush=True)
    return pdf


def toc_nopage(outline):
    """The book's Contents, parts + chapters, with NO page-number column/leader.
    Same structure across Main, Workbook, and Solutions, so it stands for all three."""
    rows = []
    for e in outline:
        if e["kind"] == "part":
            rows.append(f'<div class="toc-part">{B.esc(e["title"])}</div>')
        else:
            rows.append(
                '<div class="toc-row">'
                f'<span class="toc-num">{e["num"]}</span>'
                f'<span class="toc-title">{B.esc(e["title"])}</span>'
                '</div>'
            )
    sub = ('<p class="toc-allbooks">The 56-chapter structure shared by the '
           'Main book, the Exercise Workbook, and the Answers &amp; Solutions book.</p>')
    return [
        '<section class="chapter toc-section">'
        '<h1 class="toc-h">Contents</h1>'
        '<div class="toc-rule"></div>'
        + sub + "".join(rows) +
        '</section>'
    ]


TOC_CSS = B.EXTRA_CSS + """
.toc-allbooks{ font-family:var(--serif); font-style:italic; font-size:11pt;
  color:#555; margin:0 0 16px; }
"""


def main():
    e = chapter_entry(CH)
    chap = e["chap"]
    main = chap["pages"][0]
    exercises = chap["pages"][1] if len(chap["pages"]) > 1 else None

    # 1. Chapter 41 — Main book (prose + examples, no exercises)
    items = B.PROSE.get(f"ch{CH:02d}", [])
    emit(B.render_chapter_from_prose(CH, main, items, exercises, include_exercises=False),
         f"ch{CH}-main-book.pdf", f"Advanced Rust · Chapter {CH}")

    # 2. Chapter 41 — Workbook (exercises, lab, review questions)
    emit(B.render_chapter_exercises(CH, main, exercises, B.EXERCISES.get(f"ch{CH:02d}")),
         f"ch{CH}-workbook.pdf", f"Advanced Rust Workbook · Chapter {CH}")

    # 3. Chapter 41 — Solutions (worked solutions)
    emit(S.render_chapter_solutions(CH, main),
         f"ch{CH}-solutions.pdf", f"Advanced Rust Solutions · Chapter {CH}")

    # 4. Contents (no page numbers), shared across all three books
    out_pdf = os.path.join(OUT, "contents-all-books.pdf")
    pdf, _ = B.build_book(toc_nopage(B.OUTLINE), out_pdf,
                          book_title="Advanced Rust · Contents",
                          author=AUTHOR, extra_css=TOC_CSS)
    print("PDF:", pdf, flush=True)


if __name__ == "__main__":
    main()

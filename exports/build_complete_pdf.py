# -*- coding: utf-8 -*-
"""Render the COMPLETE Advanced Rust book (chapters 1-54) as a single
O'Reilly-style PDF.

Strategy
--------
* Chapters 1 & 2 keep their hand-mapped rich prose from `build_pdf.py`.
* Chapters 3-54 are generated from the app's own metadata:
  - title / description / codeKeys from `CHAPTERS` (types.ts)
  - intro paragraph from `MAIN_PAGE_CONFIG` (fallback-generated-pages.tsx)
  - example titles from `MAIN_PAGE_CONFIG.examples`
  - code samples from `default_codes.json` (verbatim from the app)

That mirrors what the in-app renderer shows: short intro + the actual code
samples for each chapter. No prose is invented; every sentence comes from the
existing source.

Running heads use the embedded Georgia serif (bold title left, italic author
right) added in this session.
"""
import json, os, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", ".claude", "skills",
                                "oreilly-book-pdf", "scripts"))
from oreilly_pdf import (
    chapter_open, section, sub, body, lead, ulist, olist,
    example, sidebar, block, plain_block, group, admonition, CHAPTER_CLOSE,
    esc, ic, build_book,
)
# Reuse the rich ch01-02 mapping verbatim.
from build_pdf import CH01_CH02_PARTS

# --------------------------------------------------------------------------
META = json.load(open(os.path.join(HERE, "book_meta.json"), encoding="utf-8"))
CODES = json.load(open(os.path.join(HERE, "default_codes.json"), encoding="utf-8"))

INTROS = META["intros"]
EXAMPLE_TITLES = META["example_titles"]


def chapter_number(chap_id):
    m = re.match(r"ch(\d+)", chap_id)
    return int(m.group(1)) if m else None


def pretty_key(key):
    """Convert `arrays_slices_vectors_slice_api` -> `Slice-first API`-ish title."""
    return key.replace("_", " ").strip().capitalize()


def render_chapter(chap):
    n = chapter_number(chap["id"])
    if n is None or n > 54:
        return []  # skip non-chapter entries (appendices handled separately)
    main = chap["pages"][0]
    exercises = chap["pages"][1] if len(chap["pages"]) > 1 else None
    parts = []
    eyebrow = f"Chapter {n}"
    parts.append(chapter_open(eyebrow, main["title"], main["desc"]))

    # Intro
    parts.append(section("Overview"))
    parts.append(body(INTROS.get(main["id"], main["desc"])))

    # Examples (one numbered listing per codeKey)
    codes = main.get("codes") or []
    if codes:
        parts.append(section("Examples"))
        ex_titles = EXAMPLE_TITLES.get(main["id"], {})
        for i, key in enumerate(codes, start=1):
            code = CODES.get(key)
            if not code:
                # Skip missing — extractor would have logged any gap; safer to omit
                # than to invent placeholder Rust.
                continue
            title = ex_titles.get(key) or pretty_key(key)
            parts.append(example(f"{n}-{i}", f"{key}.rs", title, code))

    # Exercises pointer
    if exercises:
        parts.append(section("Exercises"))
        parts.append(body(exercises["desc"]))
        parts.append(sidebar(
            "Suggested practice",
            ulist([
                "State the boundary or invariant first, then choose the Rust feature or refactor that matches it.",
                "Keep the answer concrete enough that another engineer could review the same design quickly.",
                "Prefer explicit ownership, pacing, and versioning rules over convenience hidden in one framework surface.",
            ])
        ))

    parts.append(CHAPTER_CLOSE)
    return parts


# --------------------------------------------------------------------------
# Assemble
# --------------------------------------------------------------------------
P = list(CH01_CH02_PARTS)

for chap in META["chapters"]:
    n = chapter_number(chap["id"])
    if n is None or n <= 2 or n > 54:
        continue
    P.extend(render_chapter(chap))

OUT = os.path.join(HERE, "advanced-rust-complete.pdf")
pdf, html = build_book(
    P, OUT,
    book_title="Advanced Rust",
    author="O. Iakushkin",
)
print("PDF:", pdf)
print("HTML:", html)

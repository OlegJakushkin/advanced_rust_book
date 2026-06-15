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
    example, exercise, sidebar, block, plain_block, group, admonition,
    CHAPTER_CLOSE, esc, ic, build_book,
)
# Reuse the rich ch01-02 mapping verbatim.
from build_pdf import CH01_CH02_PARTS

# --------------------------------------------------------------------------
META = json.load(open(os.path.join(HERE, "book_meta.json"), encoding="utf-8"))
CODES = json.load(open(os.path.join(HERE, "default_codes.json"), encoding="utf-8"))
PROSE = json.load(open(os.path.join(HERE, "chapter_prose.json"), encoding="utf-8"))
EXERCISES = json.load(open(os.path.join(HERE, "chapter_exercises.json"),
                            encoding="utf-8"))

INTROS = META["intros"]
EXAMPLE_TITLES = META["example_titles"]
SVG_DIR = os.path.join(HERE, "mermaid_svgs")


def chapter_number(chap_id):
    m = re.match(r"ch(\d+)", chap_id)
    return int(m.group(1)) if m else None


def pretty_key(key):
    """Auto-titlecase a code key — used only as a fallback when no curated
    example title exists. Strip the chapter-topic prefix so the result reads as
    the *specific* example rather than the chapter name repeated."""
    s = key.replace("_", " ").strip()
    # Drop a leading topic prefix (the first 1-3 words) when it just restates the
    # chapter (e.g. "ownership structs pointer choices" -> "Pointer choices").
    parts = s.split()
    if len(parts) >= 3:
        return " ".join(parts[-2:]).capitalize()
    return s.capitalize()


def title_page(name="Advanced Rust",
               subtitle="Ownership, concurrency, performance, and production systems &mdash; 56 chapters across eight parts.",
               eyebrow="A practical handbook for senior engineers"):
    """Single-page title spread shown at the front of the book."""
    return ['<section class="chapter title-page">'
            '<div class="title-block">'
            f'<div class="title-eyebrow">{esc(eyebrow)}</div>'
            f'<h1 class="title-name">{esc(name)}</h1>'
            '<div class="title-rule"></div>'
            f'<p class="title-sub">{subtitle}</p>'
            '<div class="title-author">O. Iakushkin</div>'
            '</div>'
            '</section>']


def is_part(chap):
    return chap["id"].startswith("part-")


def is_appendix_container(chap):
    return chap["id"] == "appendices-and-integration"


def part_page(title, motivation, chapter_lines):
    """A part-divider page: eyebrow + big title + motivation + the part's chapter list."""
    if " · " in title:
        eyebrow, name = title.split(" · ", 1)
    else:
        eyebrow, name = "Part", title
    rows = "".join(
        f'<div class="part-row"><span class="part-row-num">{num}</span>'
        f'<span class="part-row-title">{esc(t)}</span></div>'
        for num, t in chapter_lines)
    return ['<section class="chapter part-divider">'
            '<div class="part-block">'
            f'<div class="part-eyebrow">{esc(eyebrow)}</div>'
            f'<h1 class="part-name">{esc(name)}</h1>'
            '<div class="part-rule"></div>'
            f'<p class="part-sub">{ic(motivation)}</p>'
            f'<div class="part-list">{rows}</div>'
            '</div>'
            '</section>']


def book_outline():
    """Ordered outline of the body: part-divider entries (each carrying the list
    of chapters that follow it) and chapter entries, in CHAPTERS order. The
    appendices container is excluded from the complete-book body."""
    outline = []
    current_part = None
    for chap in META["chapters"]:
        if is_part(chap):
            page = chap["pages"][0]
            entry = {"kind": "part", "title": chap["title"],
                     "motivation": page.get("desc") or "", "chapters": []}
            current_part = entry["chapters"]
            outline.append(entry)
        elif is_appendix_container(chap):
            continue
        else:
            n = chapter_number(chap["id"])
            if n is None or n > 56:
                continue
            t = chap["pages"][0]["title"]
            outline.append({"kind": "chapter", "num": n, "title": t, "chap": chap})
            if current_part is not None:
                current_part.append((n, t))
    return outline


# A4 content column at 17mm margins is ~665 CSS px.
COLUMN_PX = 665


def _svg_dims(svg_path):
    """Read the intrinsic (width, height) in px from an SVG's root element."""
    try:
        head = open(svg_path, encoding="utf-8").read(2000)
    except Exception:
        return None, None
    w = re.search(r'<svg[^>]*\bwidth="([\d.]+)', head)
    h = re.search(r'<svg[^>]*\bheight="([\d.]+)', head)
    return (float(w.group(1)) if w else None,
            float(h.group(1)) if h else None)


def _mermaid_html(item, allow_float=False):
    """Embed a pre-rendered Mermaid SVG.

    Wide diagrams scale down to the column width so they are never clipped at
    the page edge (`max-width:100%` in CSS). Slim, portrait diagrams float to
    the left with prose wrapping to their right — but only when `allow_float`
    (the caller passes this when the next block is prose, not a code listing)."""
    svg_path = os.path.join(SVG_DIR, f"{item['id']}.svg")
    if not os.path.exists(svg_path):
        return f'<div class="mermaid-missing"><em>(diagram missing: {item["id"]})</em></div>'
    # Use a file:// URL so Chrome reads from disk during PDF render.
    url = "file:///" + os.path.abspath(svg_path).replace("\\", "/")
    cap = ic(item["caption"]) if item.get("caption") else ""
    # All diagrams stay centered as block figures (no float / text-wrap).
    cls = "mermaid-fig"
    return (f'<figure class="{cls}">'
            f'<img class="mermaid-svg" src="{url}" alt="diagram" />'
            f'<figcaption class="mermaid-cap">{cap}</figcaption>'
            f'</figure>')


def render_chapter_from_prose(n, main, items, exercises, include_exercises=True):
    """Walk the extracted JSX items and emit a structured PDF chapter.

    When include_exercises is False (the main book, whose exercises live in the
    separate workbook), the chapter renders prose + examples only: the in-page
    "Exercises" pointer section is dropped and no exercises block is appended."""
    parts = [chapter_open(f"Chapter {n} · {main['title']}",
                          main["title"], main["desc"])]

    # Skip the main page's "Exercises" pointer section when we have full exercise
    # data (rendered below) OR when exercises are excluded from this book.
    has_rich_exercises = f"ch{n:02d}" in EXERCISES
    skip_until_next_h3 = False

    examples_seen = 0
    for i, it in enumerate(items):
        k = it["kind"]
        if k == "h3":
            heading = it["text"].strip().lower()
            if (has_rich_exercises or not include_exercises) and heading in ("exercises", "exercise"):
                skip_until_next_h3 = True
                continue
            skip_until_next_h3 = False
            parts.append(section(it["text"]))
            continue
        if skip_until_next_h3:
            # Skip body/list/mermaid/editor that belongs to the pointer block.
            # An h4 still cuts off the skip: pointer blocks don't use h4.
            if k == "h4":
                skip_until_next_h3 = False
            else:
                continue
        if k == "h4":
            parts.append(sub(it["text"]))
        elif k == "p":
            parts.append(body(it["text"]))
        elif k == "ul":
            parts.append(ulist(it["items"]))
        elif k == "ol":
            parts.append(olist(it["items"]))
        elif k == "mermaid":
            # Float a slim diagram left so prose wraps to its right — but only
            # when the next block is prose, not a code listing or a heading.
            nxt = items[i + 1]["kind"] if i + 1 < len(items) else None
            parts.append(_mermaid_html(it, allow_float=(nxt in ("p", "ul", "ol"))))
        elif k == "editor":
            ck = it["codeKey"]
            code = CODES.get(ck)
            if not code:
                continue
            examples_seen += 1
            fname = it.get("filename") or f"{ck}.rs"
            title = pretty_key(ck)
            ex_html = example(f"{n}-{examples_seen}", fname, title, code,
                              output=it.get("expected") or None)
            parts.append(ex_html)

    # Main book carries no exercises (they live in the separate workbook).
    if not include_exercises:
        parts.append(CHAPTER_CLOSE)
        return parts

    # Exercises — full content from the chapter's -exercises.tsx file when
    # available; otherwise fall back to the metadata one-liner.
    ex_data = EXERCISES.get(f"ch{n:02d}")
    if ex_data:
        parts.append(section("Exercises"))
        if exercises and exercises.get("desc"):
            parts.append(body(exercises["desc"]))
        for ex in ex_data.get("exercises", []):
            parts.append(exercise(
                number=ex.get("number", "?"),
                kind=ex.get("kind", ""),
                title=ex.get("title", ""),
                objective=ex.get("objective", ""),
                starter=ex.get("starterPrompt", ""),
                prompts=ex.get("prompts") or [],
                acceptance=ex.get("acceptanceCriteria") or [],
                hints=ex.get("hints") or [],
            ))
        lab = ex_data.get("lab")
        if lab and lab.get("initialCode"):
            parts.append(sub("Runnable lab"))
            if lab.get("helperText"):
                parts.append(body(lab["helperText"]))
            parts.append(example(
                f"{n}-L", lab.get("filename", "lab.rs"),
                lab.get("title", "Runnable lab"),
                lab["initialCode"],
                output=lab.get("expectedOutput"),
            ))
        if ex_data.get("reviewQuestions"):
            parts.append(sub("Review questions"))
            parts.append(ulist(ex_data["reviewQuestions"]))
    elif exercises:
        parts.append(section("Exercises"))
        parts.append(body(exercises["desc"]))

    parts.append(CHAPTER_CLOSE)
    return parts


def render_chapter_exercises(n, main, exercises, ex_data):
    """Workbook chapter: the exercises for one chapter. Uses the full extracted
    exercise set when available; otherwise falls back to a study-the-example
    prompt built from the chapter's first runnable code sample."""
    parts = [chapter_open(f"Chapter {n} · {main['title']}", main["title"],
                          "Exercises, labs, and review questions for this chapter.")]
    if ex_data:
        if exercises and exercises.get("desc"):
            parts.append(body(exercises["desc"]))
        for ex in ex_data.get("exercises", []):
            parts.append(exercise(
                number=ex.get("number", "?"),
                kind=ex.get("kind", ""),
                title=ex.get("title", ""),
                objective=ex.get("objective", ""),
                starter=ex.get("starterPrompt", ""),
                prompts=ex.get("prompts") or [],
                acceptance=ex.get("acceptanceCriteria") or [],
                hints=ex.get("hints") or [],
            ))
        lab = ex_data.get("lab")
        if lab and lab.get("initialCode"):
            parts.append(sub("Runnable lab"))
            if lab.get("helperText"):
                parts.append(body(lab["helperText"]))
            parts.append(example(
                f"{n}-L", lab.get("filename", "lab.rs"),
                lab.get("title", "Runnable lab"),
                lab["initialCode"], output=lab.get("expectedOutput")))
        if ex_data.get("reviewQuestions"):
            parts.append(sub("Review questions"))
            parts.append(ulist(ex_data["reviewQuestions"]))
    else:
        parts.append(body(
            (exercises.get("desc") if exercises and exercises.get("desc") else
             "Work through this chapter's runnable example: state what it owns and "
             "what it only borrows, identify the key type doing the work, then "
             "reproduce it from scratch and extend it.")))
        keys = main.get("codes") or []
        code = CODES.get(keys[0]) if keys else None
        if code:
            parts.append(sub("Worked example to study and reproduce"))
            parts.append(example(f"{n}-1", f"{keys[0]}.rs", pretty_key(keys[0]), code))
    parts.append(CHAPTER_CLOSE)
    return parts


def colophon_page():
    """A short back-matter page closing out the book."""
    return ['<section class="chapter colophon">'
            '<div class="colo-block">'
            '<div class="colo-mark">END OF BOOK</div>'
            '<div class="colo-rule"></div>'
            '<h2 class="colo-title">Advanced Rust</h2>'
            '<p class="colo-author">O. Iakushkin</p>'
            '<p class="colo-meta">Set in Georgia and Helvetica Neue; code in Consolas.<br/>'
            'Syntax highlighting by Pygments. Rendered with headless Chrome and PyMuPDF.</p>'
            '<p class="colo-thanks">Thank you for reading.</p>'
            '</div>'
            '</section>']


def find_chapter_start_pages(pdf_path):
    """Scan the rendered PDF for chapter eyebrows ("CHAPTER N") and return
    {chapter_num: first_1indexed_page}. The CSS letter-spaces the eyebrow, so
    "Chapter 17" comes back as "C H A P T E R  1 7" — we collapse whitespace
    inside both the word and the digits."""
    import fitz, re
    doc = fitz.open(pdf_path)
    # Match "CHAPTER" with any internal whitespace, then capture digits that may
    # also be whitespace-separated (e.g. "1 7" for chapter 17).
    pat = re.compile(r"C\s*H\s*A\s*P\s*T\s*E\s*R\s+([\d](?:\s*\d)*)", re.I)
    starts = {}
    for i in range(doc.page_count):
        top = fitz.Rect(0, 0, doc[i].rect.width, doc[i].rect.height * 0.20)
        txt = doc[i].get_text(clip=top)
        m = pat.search(txt)
        if m:
            n = int(re.sub(r"\s+", "", m.group(1)))
            if n not in starts:
                starts[n] = i + 1
    doc.close()
    return starts


def stamp_section_footers(pdf_path, sections):
    """Stamp the current chapter/part name centered in the footer of every page.

    `sections` is a list of (start_page_1indexed, name); each name shows from its
    start page until the next section begins. The title page is left clean."""
    import fitz, time
    doc = fitz.open(pdf_path)
    margin = 17 * 2.834645
    GRAY = (0.30, 0.30, 0.33)
    starts = sorted(sections)
    cur, idx = None, 0
    for pno in range(doc.page_count):
        page_num = pno + 1
        while idx < len(starts) and starts[idx][0] <= page_num:
            cur, idx = starts[idx][1], idx + 1
        if not cur or pno == 0:
            continue
        pg = doc[pno]
        W, H = pg.rect.width, pg.rect.height
        name = cur
        fsz = 8.5
        maxw = W - 2 * margin - 80  # keep clear of the outer-corner page numbers
        tw = fitz.get_text_length(name, fontname="tiit", fontsize=fsz)
        if tw > maxw:
            while len(name) > 8 and fitz.get_text_length(name + "…", fontname="tiit", fontsize=fsz) > maxw:
                name = name[:-1]
            name += "…"
            tw = fitz.get_text_length(name, fontname="tiit", fontsize=fsz)
        pg.insert_text(((W - tw) / 2, H - 26), name, fontname="tiit", fontsize=fsz, color=GRAY)
    tmp = pdf_path + ".tmp"
    doc.save(tmp)
    doc.close()
    for a in range(10):
        try:
            os.replace(tmp, pdf_path)
            break
        except PermissionError:
            if a == 9:
                raise
            time.sleep(0.6 * (a + 1))


def toc_html(entries):
    """Build the TOC section from outline entries (part headers + chapter rows).
    Each entry is {"kind":"part","title":..} or
    {"kind":"chapter","num":..,"title":..,"page":..}."""
    rows = []
    for e in entries:
        if e["kind"] == "part":
            rows.append(f'<div class="toc-part">{esc(e["title"])}</div>')
        else:
            rows.append(
                '<div class="toc-row">'
                f'<span class="toc-num">{e["num"]}</span>'
                f'<span class="toc-title">{esc(e["title"])}</span>'
                '<span class="toc-leader"></span>'
                f'<span class="toc-page">{e["page"]}</span>'
                '</div>'
            )
    return [
        '<section class="chapter toc-section">'
        '<h1 class="toc-h">Contents</h1>'
        '<div class="toc-rule"></div>'
        + "".join(rows) +
        '</section>'
    ]


def toc_entries_from_outline(outline, page_map):
    """TOC-ready entries from the body outline, with chapter page numbers from
    page_map = {chapter_num: page}."""
    out = []
    for e in outline:
        if e["kind"] == "part":
            out.append({"kind": "part", "title": e["title"]})
        else:
            out.append({"kind": "chapter", "num": e["num"], "title": e["title"],
                        "page": page_map.get(e["num"], 0)})
    return out


# --------------------------------------------------------------------------
# Assemble
# --------------------------------------------------------------------------
def assemble_body_parts(outline, mode="main"):
    """Build the parts list WITHOUT the TOC, in book order.

    Eight part-divider pages introduce the eight sections. In "main" mode each
    chapter is rendered from its prose (sections, paragraphs, Mermaid diagrams,
    code examples) WITHOUT exercises; in "workbook" mode each chapter renders its
    exercises instead."""
    out = []
    for e in outline:
        if e["kind"] == "part":
            out.extend(part_page(e["title"], e["motivation"], e["chapters"]))
            continue
        n, chap = e["num"], e["chap"]
        main = chap["pages"][0]
        exercises = chap["pages"][1] if len(chap["pages"]) > 1 else None
        if mode == "workbook":
            out.extend(render_chapter_exercises(n, main, exercises,
                                                EXERCISES.get(f"ch{n:02d}")))
            continue
        items = PROSE.get(f"ch{n:02d}", [])
        if items:
            out.extend(render_chapter_from_prose(n, main, items, exercises,
                                                 include_exercises=False))
        else:
            # Safety fallback: shouldn't happen since extractor covers ch01-56.
            out.append(chapter_open(f"Chapter {n} · {main['title']}",
                                    main["title"], main["desc"]))
            out.append(CHAPTER_CLOSE)
    out.extend(colophon_page())
    return out


OUTLINE = book_outline()

EXTRA_CSS = """
.title-page{ break-before:auto; height:100vh;
  display:flex; align-items:center; justify-content:center; }
.title-block{ text-align:center; max-width:34em; }
.title-eyebrow{ font-family:var(--sans); font-weight:700; font-size:9.5pt;
  letter-spacing:.22em; text-transform:uppercase; color:var(--muted);
  margin-bottom:36px; }
.title-name{ font-family:var(--sans); font-weight:700; font-size:46pt;
  line-height:1.05; letter-spacing:-.015em; color:var(--ink); margin:0; }
.title-rule{ height:4px; width:90px; background:var(--accent); margin:22px auto; }
.title-sub{ font-family:var(--serif); font-style:italic; font-size:13.5pt;
  color:#444; margin:0 0 56px; }
.title-author{ font-family:var(--serif); font-weight:700; font-size:14pt;
  color:var(--ink); letter-spacing:.02em; }

/* Colophon (back-matter close) */
.colophon{ height:100vh;
  display:flex; align-items:center; justify-content:center; }
.colo-block{ text-align:center; max-width:30em; }
.colo-mark{ font-family:var(--sans); font-weight:700; font-size:9pt;
  letter-spacing:.24em; text-transform:uppercase; color:var(--muted); }
.colo-rule{ height:3px; width:60px; background:var(--accent); margin:14px auto 22px; }
.colo-title{ font-family:var(--sans); font-weight:700; font-size:26pt;
  margin:0 0 6px; color:var(--ink); }
.colo-author{ font-family:var(--serif); font-style:italic; font-size:12pt;
  color:#444; margin:0 0 28px; }
.colo-meta{ font-family:var(--serif); font-size:10pt; color:var(--muted);
  margin:0 0 22px; line-height:1.6; }
.colo-thanks{ font-family:var(--serif); font-size:11pt; color:var(--ink); margin:0; }

/* Keep section headings with the block that follows them — no orphan headings —
   and clear any floated (slim) diagram so it never bleeds past its section. */
h2.sect, h3.sub{ break-after:avoid; page-break-after:avoid; clear:both; }
/* Code listings, labs, and exercises never sit beside a floated diagram. */
.example, .exercise, .snippet{ clear:both; }

/* Mermaid diagrams.
   SVGs render at body text size (14px = 10.6pt). A diagram wider than the
   content column is scaled down to fit (max-width:100%) so it is never clipped
   at the page edge — its text shrinks proportionally. Slim, portrait diagrams
   instead float left (.slim) so prose wraps to their right. */
.mermaid-fig{ margin:14px 0; text-align:center; break-inside:avoid; clear:both; }
.mermaid-svg{ display:inline-block; width:auto; height:auto; max-width:100%;
  max-height:none; }
.mermaid-fig.slim{ float:left; clear:left; width:auto; max-width:44%;
  text-align:left; margin:4px 22px 8px 0; }
.mermaid-fig.slim .mermaid-svg{ max-width:100%; }
.mermaid-fig.slim .mermaid-cap{ text-align:left; margin-left:0; margin-right:0;
  max-width:100%; }
.mermaid-cap{ font-family:var(--serif); font-style:italic; font-size:10.6pt;
  color:#555; margin-top:6px; max-width:38em; margin-left:auto;
  margin-right:auto; line-height:1.5; }
.mermaid-missing{ font-family:var(--serif); color:#888; font-size:10.6pt;
  text-align:center; margin:8px 0; }

/* Table of contents */
.toc-section{ padding-top:6mm; }
.toc-h{ font-family:var(--sans); font-weight:700; font-size:24pt;
  letter-spacing:-.01em; color:var(--ink); margin:0 0 4px; }
.toc-rule{ height:3px; width:54px; background:var(--accent); margin:0 0 16px; }
.toc-row{ display:flex; align-items:baseline; gap:8px; padding:3px 0;
  font-family:var(--serif); font-size:10.6pt; color:var(--ink);
  break-inside:avoid; }
.toc-num{ font-family:var(--sans); font-weight:700; font-size:9pt;
  color:var(--accent); min-width:26px; text-align:right;
  letter-spacing:.02em; }
.toc-title{ flex:0 1 auto; }
.toc-leader{ flex:1 1 auto; border-bottom:1px dotted #b5b5b5;
  transform:translateY(-3px); margin:0 6px; }
.toc-page{ font-family:var(--serif); font-size:10.6pt; color:#3a3a3a;
  min-width:24px; text-align:right; }
.toc-part{ font-family:var(--sans); font-weight:700; font-size:10pt;
  letter-spacing:.05em; color:var(--accent); margin:13px 0 3px;
  padding-top:7px; border-top:1px solid #e3e3e3; break-after:avoid; }

/* Part-divider pages */
.part-divider{ height:100vh; display:flex; align-items:center;
  justify-content:center; }
.part-block{ width:100%; max-width:34em; }
.part-eyebrow{ font-family:var(--sans); font-weight:700; font-size:11pt;
  letter-spacing:.24em; text-transform:uppercase; color:var(--accent); }
.part-name{ font-family:var(--sans); font-weight:700; font-size:33pt;
  line-height:1.07; letter-spacing:-.012em; color:var(--ink); margin:10px 0 0; }
.part-rule{ height:4px; width:80px; background:var(--accent); margin:18px 0; }
.part-sub{ font-family:var(--serif); font-style:italic; font-size:13pt;
  color:#444; margin:0 0 26px; line-height:1.5; }
.part-list{ border-top:1px solid #ddd; }
.part-row{ display:flex; gap:12px; align-items:baseline; padding:6px 0;
  border-bottom:1px solid #eee; font-family:var(--serif); font-size:11pt;
  color:var(--ink); break-inside:avoid; }
.part-row-num{ font-family:var(--sans); font-weight:700; font-size:9.5pt;
  color:var(--accent); min-width:26px; text-align:right; }
"""

def _stamp_footers(pdf):
    """Stamp the current chapter/part name in the footer of `pdf`, derived from
    the rendered chapter eyebrows + the part-before-first-chapter rule."""
    final = find_chapter_start_pages(pdf)
    num2name = {e["num"]: e["title"] for e in OUTLINE if e["kind"] == "chapter"}
    sections = [(pg, num2name[n]) for n, pg in final.items() if n in num2name]
    cur, part_first = None, {}
    for e in OUTLINE:
        if e["kind"] == "part":
            cur = e["title"]
            part_first[cur] = None
        elif e["kind"] == "chapter" and cur and part_first.get(cur) is None:
            part_first[cur] = e["num"]
    for pt, fc in part_first.items():
        if fc in final and final[fc] > 1:
            sections.append((final[fc] - 1, pt))
    stamp_section_footers(pdf, sections)


def build_variant(mode, out_name, title_name, subtitle, eyebrow, running_head):
    """Render one book variant (mode = 'main' or 'workbook') to out_name with a
    convergent TOC and chapter-name footers."""
    out_pdf = os.path.join(HERE, out_name)
    body_parts = assemble_body_parts(OUTLINE, mode=mode)
    title_parts = title_page(title_name, subtitle, eyebrow)

    def bwp(parts):
        return build_book(parts, out_pdf, book_title=running_head,
                          author="O. Iakushkin", extra_css=EXTRA_CSS)

    print(f"\n=== {out_name} ({mode}) ===", flush=True)
    print(f"Rendering pass 1/3 — {len(body_parts)} body parts (Chrome render + stamp)...",
          flush=True)
    pdf, html = bwp(title_parts + toc_html(toc_entries_from_outline(OUTLINE, {})) + body_parts)
    starts = find_chapter_start_pages(pdf)
    chap_nums = [e["num"] for e in OUTLINE if e["kind"] == "chapter"]
    missing = [n for n in chap_nums if not starts.get(n)]
    print(f"Pass 1 done: {len(chap_nums) - len(missing)}/{len(chap_nums)} "
          f"chapter starts located. Missing: {missing[:10]}", flush=True)

    real_entries = toc_entries_from_outline(OUTLINE, starts)
    for attempt in range(2):
        print(f"Rendering pass {attempt + 2}/3 — resolved TOC page numbers...", flush=True)
        pdf, html = bwp(title_parts + toc_html(real_entries) + body_parts)
        new_entries = toc_entries_from_outline(OUTLINE, find_chapter_start_pages(pdf))
        if new_entries == real_entries:
            print(f"TOC converged on pass {attempt + 2}.", flush=True)
            break
        real_entries = new_entries
    else:
        print("TOC did not fully converge; final entries used.", flush=True)

    print("Stamping chapter-name footers...", flush=True)
    _stamp_footers(pdf)
    print("PDF:", pdf, flush=True)
    return pdf


def build_main():
    # Main book — chapters (prose + examples), no exercises.
    build_variant(
        "main", "advanced-rust-book.pdf",
        "Advanced Rust",
        "Ownership, concurrency, performance, and production systems &mdash; 56 chapters across eight parts.",
        "A practical handbook for senior engineers",
        "Advanced Rust")


def build_workbook():
    # Exercise workbook — the per-chapter exercises, labs, and review questions.
    build_variant(
        "workbook", "advanced-rust-workbook.pdf",
        "Advanced Rust",
        "Exercises, labs, and review questions for all 56 chapters &mdash; the companion workbook.",
        "Exercise workbook",
        "Advanced Rust · Exercise Workbook")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else "both"
    if which in ("main", "both"):
        build_main()
    if which in ("workbook", "both"):
        build_workbook()

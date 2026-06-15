# -*- coding: utf-8 -*-
"""Render the Advanced Rust ANSWERS & SOLUTIONS book — worked solutions to every
exercise, lab, and review question in the workbook, for all 56 chapters.

Content comes from exports/solout/chNN.json (one file per chapter, produced by
the solutions workflow). Layout, parts, TOC convergence, and chapter-name
footers reuse the same machinery as the main book / workbook builders.
"""
import json, os, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, "..", ".claude", "skills",
                                "oreilly-book-pdf", "scripts"))

from oreilly_pdf import (
    chapter_open, section, sub, body, ulist, example, snippet,
    admonition, esc, ic, build_book, CHAPTER_CLOSE,
)
# Reuse the body-outline, part pages, TOC + footer machinery from the main builder.
import build_complete_pdf as B

SOL_DIR = os.path.join(HERE, "solout")
SOL = {}
for n in range(1, 57):
    p = os.path.join(SOL_DIR, f"ch{n:02d}.json")
    if os.path.exists(p):
        try:
            SOL[f"ch{n:02d}"] = json.load(open(p, encoding="utf-8"))
        except Exception as e:
            print(f"WARN: ch{n:02d} solution json failed to load: {e}")

EXERCISES = B.EXERCISES


def split_paras(text):
    if not text:
        return []
    return [p.strip() for p in re.split(r"\n\s*\n", str(text).strip()) if p.strip()]


# ---------------------------------------------------------------------------
SOL_CSS = """
/* Exercise-solution blocks */
.solx{ border-left:3px solid var(--accent); padding:2px 0 2px 16px; margin:16px 0;
  break-inside:avoid-page; }
.solx-head{ display:flex; align-items:baseline; gap:12px; margin-bottom:2px; }
.solx-num{ font-family:var(--sans); font-weight:700; font-size:9pt;
  letter-spacing:.08em; text-transform:uppercase; color:var(--accent); }
.solx-kind{ font-family:var(--sans); font-size:8.5pt; letter-spacing:.04em;
  text-transform:uppercase; color:var(--muted); }
.solx-title{ font-family:var(--sans); font-weight:700; font-size:12.5pt;
  color:var(--ink); margin:0 0 6px; line-height:1.25; }
.solx-crit{ margin:8px 0 2px; }
.solx-crit .xr-lbl{ font-family:var(--sans); font-weight:700; font-size:8.5pt;
  letter-spacing:.06em; text-transform:uppercase; color:var(--muted);
  margin-bottom:4px; }

/* Review Q&A */
.sol-qa{ margin:10px 0; break-inside:avoid; }
.sol-q{ font-family:var(--serif); font-weight:700; font-size:11pt; color:var(--ink);
  margin:0 0 3px; }
.sol-a{ font-family:var(--serif); font-size:10.6pt; color:#222; line-height:1.55;
  margin:0 0 6px; }
.sol-intro{ font-style:italic; }
"""


def render_exercise_solution(es, fallback_num):
    num = es.get("number", fallback_num)
    kind = es.get("kind", "")
    title = es.get("title", "")
    out = ['<div class="solx"><div class="solx-head">'
           f'<span class="solx-num">Exercise {esc(str(num))}</span>'
           f'<span class="solx-kind">{esc(kind)}</span></div>'
           f'<h4 class="solx-title">{ic(title)}</h4>']
    for para in split_paras(es.get("solution", "")):
        out.append(body(para))
    code = es.get("code")
    if code and str(code).strip():
        note = es.get("codeNote") or None
        out.append(snippet(str(code), note=note))
    crit = es.get("criteria") or []
    if crit:
        out.append('<div class="solx-crit"><div class="xr-lbl">How it meets the '
                   'acceptance criteria</div>' + ulist(crit, tight=True) + '</div>')
    out.append('</div>')
    return "".join(out)


def render_lab_solution(n, lab, labsol):
    parts = [section("Lab solution")]
    for para in split_paras(labsol.get("explanation", "")):
        parts.append(body(para))
    fname = (lab or {}).get("filename", f"ch{n:02d}_lab.rs")
    if not labsol.get("stdOnly", True):
        parts.append(admonition(
            "This lab depends on an external crate or toolchain (for example tokio, "
            "tracing, crossbeam, MPI, or a GPU SDK), so the listing below is a reference "
            "solution rather than a standalone rustc-only program.", kind="note"))
    parts.append(example(f"{n}-S", fname, "Reference solution",
                         labsol["solutionCode"],
                         output=labsol.get("expectedOutput") or None))
    return parts


def render_review_answers(ra):
    parts = [section("Review question answers")]
    for qa in ra:
        block = [f'<div class="sol-qa"><p class="sol-q">{ic(qa.get("question", ""))}</p>']
        for para in split_paras(qa.get("answer", "")):
            block.append(f'<p class="sol-a">{ic(para)}</p>')
        block.append('</div>')
        parts.append("".join(block))
    return parts


def render_chapter_solutions(n, main):
    key = f"ch{n:02d}"
    sol = SOL.get(key)
    parts = [chapter_open(f"Chapter {n} · {main['title']}", main["title"],
                          "Worked solutions to this chapter's exercises, lab, and review questions.")]
    if not sol:
        parts.append(body("Solutions for this chapter are not yet available."))
        parts.append(CHAPTER_CLOSE)
        return parts

    for para in split_paras(sol.get("intro", "")):
        parts.append(f'<p class="body sol-intro">{ic(para)}</p>')

    ex_sols = sol.get("exerciseSolutions", [])
    if ex_sols:
        parts.append(section("Exercise solutions"))
        for i, es in enumerate(ex_sols, 1):
            parts.append(render_exercise_solution(es, i))

    # Only render a lab solution when the workbook actually ships a lab for this
    # chapter (a couple of capstone chapters have no lab; ignore any invented one).
    lab = EXERCISES.get(key, {}).get("lab")
    has_workbook_lab = bool((lab or {}).get("initialCode"))
    labsol = sol.get("labSolution")
    if has_workbook_lab and labsol and labsol.get("solutionCode"):
        parts.extend(render_lab_solution(n, lab, labsol))

    ra = sol.get("reviewAnswers") or []
    if ra:
        parts.extend(render_review_answers(ra))

    parts.append(CHAPTER_CLOSE)
    return parts


def solutions_colophon():
    return ['<section class="chapter colophon">'
            '<div class="colo-block">'
            '<div class="colo-mark">END OF SOLUTIONS</div>'
            '<div class="colo-rule"></div>'
            '<h2 class="colo-title">Advanced Rust</h2>'
            '<p class="colo-author">Answers &amp; Solutions · O. Iakushkin</p>'
            '<p class="colo-meta">Every lab marked standalone was compiled and run with '
            'rustc (edition 2021); its printed output matches the listing.</p>'
            '<p class="colo-thanks">Now go build something.</p>'
            '</div></section>']


def assemble_body_parts(outline):
    out = []
    for e in outline:
        if e["kind"] == "part":
            out.extend(B.part_page(e["title"], e["motivation"], e["chapters"]))
            continue
        n, chap = e["num"], e["chap"]
        main = chap["pages"][0]
        out.extend(render_chapter_solutions(n, main))
    out.extend(solutions_colophon())
    return out


OUTLINE = B.OUTLINE
EXTRA_CSS = B.EXTRA_CSS + SOL_CSS


def build():
    out_pdf = os.path.join(HERE, "advanced-rust-solutions.pdf")
    body_parts = assemble_body_parts(OUTLINE)
    title_parts = B.title_page(
        "Advanced Rust",
        "Answers &amp; Solutions &mdash; worked answers to every exercise, lab, and review question across all 56 chapters.",
        "The companion solutions book")
    running_head = "Advanced Rust · Answers & Solutions"

    def bwp(parts):
        return build_book(parts, out_pdf, book_title=running_head,
                          author="O. Iakushkin", extra_css=EXTRA_CSS)

    print(f"\n=== advanced-rust-solutions.pdf ===", flush=True)
    print(f"Rendering pass 1/3 — {len(body_parts)} body parts...", flush=True)
    pdf, html = bwp(title_parts
                    + B.toc_html(B.toc_entries_from_outline(OUTLINE, {}))
                    + body_parts)
    starts = B.find_chapter_start_pages(pdf)
    chap_nums = [e["num"] for e in OUTLINE if e["kind"] == "chapter"]
    missing = [n for n in chap_nums if not starts.get(n)]
    print(f"Pass 1 done: {len(chap_nums) - len(missing)}/{len(chap_nums)} "
          f"chapter starts located. Missing: {missing[:10]}", flush=True)

    real_entries = B.toc_entries_from_outline(OUTLINE, starts)
    for attempt in range(2):
        print(f"Rendering pass {attempt + 2}/3 — resolved TOC page numbers...", flush=True)
        pdf, html = bwp(title_parts + B.toc_html(real_entries) + body_parts)
        new_entries = B.toc_entries_from_outline(OUTLINE, B.find_chapter_start_pages(pdf))
        if new_entries == real_entries:
            print(f"TOC converged on pass {attempt + 2}.", flush=True)
            break
        real_entries = new_entries
    else:
        print("TOC did not fully converge; final entries used.", flush=True)

    print("Stamping chapter-name footers...", flush=True)
    B._stamp_footers(pdf)
    print("PDF:", pdf, flush=True)
    return pdf


if __name__ == "__main__":
    build()

# -*- coding: utf-8 -*-
"""Build per-chapter context bundles for the answers-and-solutions book workers.

Each exports/solctx/chNN.json carries everything one worker needs to write
worked solutions for that chapter: the full exercise set, lab, and review
questions; a prose outline (headings + trimmed paragraphs) for voice/grounding;
the chapter's runnable code samples; and — for the 16 chapters generated in this
session — the already rustc-verified lab reference solution.
"""
import json, os, re, glob

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES_DIR = os.path.join(HERE, "..", "components", "rust-book", "pages")

EX = json.load(open(os.path.join(HERE, "chapter_exercises.json"), encoding="utf-8"))
PROSE = json.load(open(os.path.join(HERE, "chapter_prose.json"), encoding="utf-8"))
CODES = json.load(open(os.path.join(HERE, "default_codes.json"), encoding="utf-8"))
META = json.load(open(os.path.join(HERE, "book_meta.json"), encoding="utf-8"))

# num -> title
num2title = {}
for c in META["chapters"]:
    m = re.match(r"ch(\d+)", c["id"])
    if m:
        num2title[int(m.group(1))] = c["pages"][0]["title"]

# verified reference solutions for the 16 freshly-generated chapters
ref_solutions = {}
for p in glob.glob(os.path.join(HERE, "exgen_out", "ch*.json")):
    key = os.path.basename(p)[:4]
    d = json.load(open(p, encoding="utf-8"))
    sc = (d.get("lab") or {}).get("solutionCode")
    if sc:
        ref_solutions[key] = sc

os.makedirs(os.path.join(HERE, "solctx"), exist_ok=True)
count = 0
for n in range(1, 57):
    key = f"ch{n:02d}"
    exd = EX.get(key)
    if not exd:
        print(f"{key}: no exercise data — skipping")
        continue
    pr = PROSE.get(key, [])
    headings = [x["text"] for x in pr if x["kind"] in ("h3", "h4")]
    paras = [x["text"][:280] for x in pr if x["kind"] == "p"][:30]
    code_keys = [x["codeKey"] for x in pr if x["kind"] == "editor"]
    samples = {ck: CODES.get(ck, "") for ck in code_keys}
    bundle = {
        "chapterKey": key,
        "num": n,
        "title": num2title.get(n, ""),
        "exercises": exd.get("exercises", []),
        "reviewQuestions": exd.get("reviewQuestions", []),
        "lab": exd.get("lab"),
        "proseHeadings": headings,
        "proseParagraphs": paras,
        "codeSamples": samples,
        "labReferenceSolution": ref_solutions.get(key),  # None for the original 40
    }
    json.dump(bundle, open(os.path.join(HERE, "solctx", f"{key}.json"), "w",
                           encoding="utf-8"), ensure_ascii=False, indent=1)
    count += 1
    sz = os.path.getsize(os.path.join(HERE, "solctx", f"{key}.json"))
    ref = "ref" if bundle["labReferenceSolution"] else "   "
    print(f"{key}: {len(bundle['exercises'])}ex {len(bundle['reviewQuestions'])}rq "
          f"lab={'Y' if bundle['lab'] and bundle['lab'].get('initialCode') else '-'} "
          f"{ref} {sz}B")

print(f"\nWrote {count} solution-context bundles to exports/solctx/")

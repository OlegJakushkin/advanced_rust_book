# -*- coding: utf-8 -*-
"""Extract per-page metadata (id, title, description, codeKeys) from CHAPTERS in
types.ts, plus chapter intros from fallback-generated-pages.tsx. Emits one JSON
blob the complete-book PDF builder consumes.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
RB = os.path.join(HERE, "..", "components", "rust-book")

ts = open(os.path.join(RB, "types.ts"), encoding="utf-8").read()
fb = open(os.path.join(RB, "pages", "fallback-generated-pages.tsx"),
          encoding="utf-8").read()

# ----- pull CHAPTERS array -------------------------------------------------
m = re.search(r"export const CHAPTERS[^=]*=\s*\[", ts)
assert m, "CHAPTERS not found"
i, depth = m.end() - 1, 0
while True:
    c = ts[i]
    if c == "[": depth += 1
    elif c == "]":
        depth -= 1
        if depth == 0: break
    i += 1
chapters_blob = ts[m.end() - 1: i + 1]

def split_top_objects(blob):
    """Yield each top-level {…} inside `blob` (already trimmed of outer [ ])."""
    depth, start = 0, None
    for i, c in enumerate(blob):
        if c == "{":
            if depth == 0: start = i
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0 and start is not None:
                yield blob[start:i+1]; start = None

def slice_array_after(blob, label):
    """Return the content between the [ and matching ] following `label:` in blob."""
    m = re.search(rf'\b{label}:\s*\[', blob)
    if not m: return ""
    i = m.end() - 1   # position of [
    depth = 0
    while i < len(blob):
        c = blob[i]
        if c == "[":
            depth += 1
        elif c == "]":
            depth -= 1
            if depth == 0:
                return blob[m.end():i]
        i += 1
    return ""

# Each page is a brace-balanced object. Walk braces to slice them, then read fields by key.
def split_page_objects(pages_blob):
    out, depth, start = [], 0, None
    i = 0
    while i < len(pages_blob):
        c = pages_blob[i]
        if c == "{":
            if depth == 0: start = i
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                out.append(pages_blob[start:i+1]); start = None
        i += 1
    return out

FIELD_STR = lambda blob, name: (re.search(rf'\b{name}:\s*"([^"]+)"', blob) or [None, None])[1]
FIELD_ARR = lambda blob, name: re.search(rf'\b{name}:\s*\[([^\]]*)\]', blob)

def parse_codes(s):
    if not s: return []
    return re.findall(r"\"([^\"]+)\"", s)

chapters = []
# `chapters_blob` is "[...{chapter}, {chapter}, ...]" — strip the outer brackets.
inner = chapters_blob.strip()
assert inner[0] == "[" and inner[-1] == "]"
inner = inner[1:-1]
for chap_blob in split_top_objects(inner):
    pages_blob = slice_array_after(chap_blob, "pages")
    pages = []
    for page_blob in split_top_objects(pages_blob):
        codes_blob = slice_array_after(page_blob, "codeKeys")
        pages.append({
            "id": FIELD_STR(page_blob, "id"),
            "title": FIELD_STR(page_blob, "title"),
            "desc": FIELD_STR(page_blob, "description"),
            "codes": parse_codes(codes_blob),
        })
    chapters.append({
        "id": FIELD_STR(chap_blob, "id"),
        "title": FIELD_STR(chap_blob, "title"),
        "pages": pages,
    })

# ----- pull intros from MAIN_PAGE_CONFIG / EXERCISE_PAGE_CONFIG ------------
INTRO_RE = re.compile(
    r"\"(?P<id>ch[^\"]+)\":\s*\{\s*intro:\s*\"(?P<intro>[^\"]+)\"", re.DOTALL)
intros = {m.group("id"): m.group("intro") for m in INTRO_RE.finditer(fb)}

# ----- example-card titles from MAIN_PAGE_CONFIG --------------------------
EX_RE = re.compile(
    r"\"(?P<id>ch[^\"]+)\":\s*\{[^}]*?examples:\s*\[(?P<arr>[^\]]*)\]",
    re.DOTALL)
TUPLE_RE = re.compile(
    r"\[\s*\"(?P<key>[^\"]+)\"\s*,\s*\"(?P<title>[^\"]+)\"\s*\]")
example_titles = {}
for m in EX_RE.finditer(fb):
    pid = m.group("id")
    pairs = [(tm.group("key"), tm.group("title"))
             for tm in TUPLE_RE.finditer(m.group("arr"))]
    example_titles[pid] = dict(pairs)

out = {"chapters": chapters, "intros": intros, "example_titles": example_titles}
with open(os.path.join(HERE, "book_meta.json"), "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print("chapters:", len(chapters))
print("pages total:", sum(len(c["pages"]) for c in chapters))
print("intros (generic):", len(intros))
print("example-title overrides:", len(example_titles))
# spot check
ch10 = next(c for c in chapters if c["id"].startswith("ch10"))
print("ch10 main codes:", ch10["pages"][0]["codes"])

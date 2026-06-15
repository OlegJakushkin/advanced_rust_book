# -*- coding: utf-8 -*-
"""Extract structured chapter content (headings, paragraphs, Mermaid diagrams,
RustCodeEditor refs) from each rich standalone page-chNN-*.tsx file.

The PDF builder consumes the resulting JSON to render each chapter's actual
content, not just metadata.
"""
import os, re, json, glob, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES_DIR = os.path.join(HERE, "..", "components", "rust-book", "pages")

# ---------------------------------------------------------------------------
# JSX-text helpers
# ---------------------------------------------------------------------------
def clean_text(s):
    """Squash whitespace inside a JSX text run, handle &apos; and friends."""
    s = re.sub(r"\s+", " ", s).strip()
    s = (s.replace("&apos;", "’")
           .replace("&quot;", '"')
           .replace("&amp;", "&")
           .replace("&lt;", "<")
           .replace("&gt;", ">")
           .replace("&mdash;", "—")
           .replace("&ndash;", "–"))
    # Strip leading/trailing inline {expression} junk like {"..."}
    return s

# Inline JSX expressions inside text: keep their string literals when obvious.
def inline_eval(text):
    """{"..."} -> "..."; {variable} -> variable. Best-effort only."""
    def expr(m):
        e = m.group(1).strip()
        # string literal in JSX expression
        sm = re.match(r'^[\'"`](.*)[\'"`]$', e, re.DOTALL)
        if sm:
            return sm.group(1)
        # ternary like "x ? 'a' : 'b'" — give up, return blank
        return ""
    return re.sub(r"\{([^{}]+)\}", expr, text)


# ---------------------------------------------------------------------------
# JSX scanner — yield (kind, content_dict) tuples in document order
# ---------------------------------------------------------------------------
HEAD_RE = re.compile(
    r'<h([34])\b[^>]*>([\s\S]*?)</h\1>', re.DOTALL)
P_RE = re.compile(
    r'<p\b[^>]*?className="[^"]*?text-(?:muted-foreground|sm|amber-\d+)[^"]*?"[^>]*>([\s\S]*?)</p>',
    re.DOTALL)
LI_RE = re.compile(r'<li\b[^>]*>([\s\S]*?)</li>', re.DOTALL)
UL_RE = re.compile(r'<ul\b[^>]*>([\s\S]*?)</ul>', re.DOTALL)
OL_RE = re.compile(r'<ol\b[^>]*>([\s\S]*?)</ol>', re.DOTALL)
MERMAID_RE = re.compile(
    r'<MermaidDiagram\s+chart=\{`([\s\S]*?)`\}\s+caption="([^"]*)"\s*/>',
    re.DOTALL)
EDITOR_RE = re.compile(
    r'<RustCodeEditor\s+([\s\S]*?)/>', re.DOTALL)
EDITOR_ATTR_RE = re.compile(
    r'(\w+)=(?:\{([\s\S]*?)\}|"([^"]*)")', re.DOTALL)

# Card/list sections are rendered as {ident.map(...)} over a `const ident = [...]`
# array. The JSX text scanner can't see the array data (it only sees the
# {x.title}/{x.body} placeholders), so we replace each {ident.map(...)} with a
# marker and resolve the backing array separately. Without this, sections like
# "Summary", "Mental model", "Pitfalls", "Production patterns", and the
# language-background callouts render as an empty heading.
MAP_START_RE = re.compile(r"\{(\w+)\.map\s*\(")
MARKER_RE = re.compile(r"@@MAP::(\w+)@@")

# Strip JSX comments
JSX_COMMENT_RE = re.compile(r"\{/\*[\s\S]*?\*/\}")


def strip_inner_jsx_tags(s):
    """Remove inline JSX tags inside running text (<code>, <span>, <strong>,
    <em>, <br>, <Button>), keeping their text. Then collapse whitespace."""
    s = JSX_COMMENT_RE.sub("", s)
    s = inline_eval(s)
    # <br/> -> space
    s = re.sub(r"<br\s*/?>", " ", s)
    # Open/close tags: drop the tag, keep contents.
    s = re.sub(r"</?\w[^>]*?>", "", s)
    return clean_text(s)


def resolve_map_array(src, ident):
    """Resolve `const <ident> = [ ... ]` (the array backing a {ident.map(...)}
    section) into either a list of strings or a list of {title, body}-style cards.
    Returns (kind, data) with kind in {"strings", "cards", None}."""
    blob = _named_array(src, ident)
    if blob is None:
        return None, None
    head = blob.lstrip()[:1]
    if head in ('"', "'", "`"):
        return "strings", _parse_string_array(blob)
    if head == "{":
        return "cards", _parse_object_array(blob)
    return None, None


def _card_fields(el):
    """Pull a (title, body) pair from a parsed card object, tolerating the few
    field-name variants used across chapters."""
    title = clean_text(el.get("title") or el.get("heading") or el.get("name") or "")
    body = clean_text(el.get("body") or el.get("detail") or el.get("description")
                      or el.get("text") or "")
    return title, body


def extract_one(path):
    """Walk one chapter file and produce an ordered list of content items."""
    src = open(path, encoding="utf-8").read()

    # Find the function body — everything from "return (" of the export to its
    # closing. JSX lives inside that body.
    fn_match = re.search(r"export function (\w+)\(\)", src)
    if not fn_match:
        return None
    fn_start = fn_match.end()
    ret = src.find("return (", fn_start)
    if ret < 0:
        return None
    # Find matching ')' for the return — count parens from the opening one.
    i = ret + len("return ") + 1  # position of '('
    depth = 1
    while i < len(src) and depth > 0:
        c = src[i]
        if c == "(": depth += 1
        elif c == ")": depth -= 1
        i += 1
    body = src[ret + len("return ("):i - 1]

    # Replace {ident.map(...)} content sections with resolvable markers so the
    # JSX text scanner doesn't choke on the {x.title}/{x.body} placeholders.
    repls = []
    for mm in MAP_START_RE.finditer(body):
        if body[mm.start()] != "{":
            continue
        s, e = _balanced_slice(body, "{", "}", mm.start())
        repls.append((s, e, mm.group(1)))
    for s, e, ident in sorted(repls, key=lambda t: t[0], reverse=True):
        body = body[:s] + f"\n@@MAP::{ident}@@\n" + body[e:]

    # We need ordered emission. Iterate positions of matches across all
    # pattern types and emit in order.
    matches = []
    for kind, regex in (
        ("h", HEAD_RE),
        ("p", P_RE),
        ("ol", OL_RE),
        ("ul", UL_RE),
        ("mermaid", MERMAID_RE),
        ("editor", EDITOR_RE),
        ("map", MARKER_RE),
    ):
        for m in regex.finditer(body):
            matches.append((m.start(), kind, m))
    matches.sort(key=lambda t: t[0])

    seen_spans = []  # (start, end) of emitted spans, to dedupe nested matches
    items = []

    def overlaps(s, e):
        for ss, ee in seen_spans:
            if not (e <= ss or s >= ee):
                return True
        return False

    for pos, kind, m in matches:
        if overlaps(m.start(), m.end()):
            continue
        if kind == "h":
            level = int(m.group(1))
            text = strip_inner_jsx_tags(m.group(2))
            if text:
                items.append({"kind": f"h{level}", "text": text})
        elif kind == "p":
            text = strip_inner_jsx_tags(m.group(1))
            if text and len(text) > 10:  # skip stubs
                items.append({"kind": "p", "text": text})
        elif kind in ("ol", "ul"):
            lis = []
            for li in LI_RE.finditer(m.group(1)):
                t = strip_inner_jsx_tags(li.group(1))
                if t and "@@MAP::" not in t and not re.fullmatch(r"\{?\w+\}?", t):
                    lis.append(t)
            if not lis:
                mk = MARKER_RE.search(m.group(1))
                if mk:
                    ak, data = resolve_map_array(src, mk.group(1))
                    if ak == "strings":
                        lis = [clean_text(x) for x in data if clean_text(x)]
                    elif ak == "cards":
                        for el in data:
                            t, b = _card_fields(el)
                            joined = ": ".join(p for p in (t, b) if p)
                            if joined:
                                lis.append(joined)
            if lis:
                items.append({"kind": kind, "items": lis})
        elif kind == "map":
            ak, data = resolve_map_array(src, m.group(1))
            if ak == "strings" and data:
                c = [clean_text(x) for x in data if clean_text(x)]
                if c:
                    items.append({"kind": "ul", "items": c})
            elif ak == "cards" and data:
                for el in data:
                    t, b = _card_fields(el)
                    if t:
                        items.append({"kind": "h4", "text": t})
                    if b:
                        items.append({"kind": "p", "text": b})
        elif kind == "mermaid":
            chart = m.group(1).replace("\\n", "\n").strip()
            caption = clean_text(m.group(2))
            cid = hashlib.sha1(chart.encode("utf-8")).hexdigest()[:12]
            items.append({"kind": "mermaid", "id": cid, "chart": chart,
                          "caption": caption})
        elif kind == "editor":
            attrs = {}
            for am in EDITOR_ATTR_RE.finditer(m.group(1)):
                name = am.group(1)
                val = am.group(2) if am.group(2) is not None else am.group(3)
                attrs[name] = val
            code = attrs.get("code", "")
            mk = re.search(r"codes\.(\w+)", code)
            ck = mk.group(1) if mk else None
            filename = attrs.get("filename", "")
            expected = attrs.get("expectedOutput", "")
            if expected:
                eq = re.match(r'^[\'"`](.*)[\'"`]$', expected.strip(), re.DOTALL)
                if eq:
                    expected = eq.group(1).replace("\\n", "\n")
            if ck:
                items.append({"kind": "editor", "codeKey": ck,
                              "filename": filename, "expected": expected})
        seen_spans.append((m.start(), m.end()))

    return items


# ---------------------------------------------------------------------------
# Exercise-file extractor
# ---------------------------------------------------------------------------
def _balanced_slice(src, open_ch, close_ch, start):
    """Return the (start, end) of a balanced bracketed slice starting at `start`
    (which must point at `open_ch`)."""
    assert src[start] == open_ch
    depth = 0
    i = start
    while i < len(src):
        c = src[i]
        if c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return start, i + 1
        # Skip JS strings and template literals so braces inside them don't count
        elif c == '"' or c == "'" or c == "`":
            quote = c
            i += 1
            while i < len(src) and src[i] != quote:
                if src[i] == "\\":
                    i += 2
                else:
                    i += 1
        i += 1
    return start, len(src)


def _read_string_literal(src, pos):
    """Read a JS string at src[pos] (which must be a quote). Returns (value, end_pos)."""
    quote = src[pos]
    if quote not in ('"', "'", "`"):
        return None, pos
    out = []
    i = pos + 1
    while i < len(src) and src[i] != quote:
        if src[i] == "\\":
            esc = src[i + 1] if i + 1 < len(src) else ""
            mp = {"n": "\n", "t": "\t", "\\": "\\", "'": "'", '"': '"',
                  "`": "`", "$": "$"}
            out.append(mp.get(esc, esc))
            i += 2
        else:
            out.append(src[i])
            i += 1
    return "".join(out), i + 1


def _parse_string_array(src):
    """Parse `["a", "b", ...]` (already stripped of outer brackets) into list[str]."""
    items = []
    i = 0
    while i < len(src):
        c = src[i]
        if c in (' ', '\t', '\n', ','):
            i += 1; continue
        if c in ('"', "'", "`"):
            val, end = _read_string_literal(src, i)
            if val is not None:
                items.append(val)
                i = end
                continue
        i += 1
    return items


def _parse_object_fields(obj_src):
    """Parse the body of a JS object literal (without the surrounding braces).
    Returns a dict of {field: parsed_value}. Fields can be strings, numbers, or
    string-arrays (good enough for our Exercise / RustPracticeCard schema)."""
    fields = {}
    i = 0
    while i < len(obj_src):
        # Skip whitespace and commas
        while i < len(obj_src) and obj_src[i] in (' ', '\t', '\n', ','):
            i += 1
        if i >= len(obj_src):
            break
        # field name (identifier or quoted)
        if obj_src[i] in ('"', "'"):
            name, i = _read_string_literal(obj_src, i)
        else:
            m = re.match(r"\w+", obj_src[i:])
            if not m: break
            name = m.group(0); i += len(name)
        # skip whitespace and ':' and '?'
        while i < len(obj_src) and obj_src[i] in (' ', '\t', '\n', ':', '?'):
            i += 1
        if i >= len(obj_src): break
        c = obj_src[i]
        if c in ('"', "'", "`"):
            val, i = _read_string_literal(obj_src, i)
            fields[name] = val
        elif c == "[":
            s, e = _balanced_slice(obj_src, "[", "]", i)
            fields[name] = _parse_string_array(obj_src[s+1:e-1])
            i = e
        elif c == "{":
            s, e = _balanced_slice(obj_src, "{", "}", i)
            i = e  # ignore nested objects for now
        else:
            # number / identifier / literal — read until comma/newline
            m = re.match(r"[^,\n}]+", obj_src[i:])
            if m:
                raw = m.group(0).strip()
                try:
                    fields[name] = int(raw)
                except ValueError:
                    try: fields[name] = float(raw)
                    except: fields[name] = raw
                i += len(m.group(0))
    return fields


def _parse_object_array(src):
    """Parse `[ {...}, {...} ]` into list[dict]. `src` is the content inside the brackets."""
    items = []
    i = 0
    while i < len(src):
        if src[i] == "{":
            s, e = _balanced_slice(src, "{", "}", i)
            items.append(_parse_object_fields(src[s+1:e-1]))
            i = e
        else:
            i += 1
    return items


def _named_array(src, name):
    """Find `const NAME ... = [ ... ]` and return the contents inside [ ]."""
    m = re.search(rf"\bconst\s+{name}\b[^=]*=\s*\[", src)
    if not m:
        return None
    open_pos = m.end() - 1
    s, e = _balanced_slice(src, "[", "]", open_pos)
    return src[s + 1:e - 1]


def _practice_card(src):
    """Extract attrs from `<RustPracticeCard ... />`. JSX-aware: walks attribute
    by attribute, balancing braces inside expression values, so nested JSX
    fragments (e.g. description={<>...</>}) don't terminate parsing early."""
    pos = src.find("<RustPracticeCard")
    if pos < 0:
        return None
    i = pos + len("<RustPracticeCard")
    out = {}
    while i < len(src):
        # skip whitespace
        while i < len(src) and src[i].isspace():
            i += 1
        # end of tag?
        if i < len(src) and src[i] == "/":
            break
        if i >= len(src) or src[i] == ">":
            break
        # attribute name
        am = re.match(r"\w+", src[i:])
        if not am:
            break
        name = am.group(0); i += len(name)
        # '=' (might be a boolean attr without value)
        if i >= len(src) or src[i] != "=":
            continue
        i += 1
        # value: either {expr} or "string" / 'string'
        if src[i] == "{":
            s, e = _balanced_slice(src, "{", "}", i)
            raw = src[s + 1:e - 1].strip()
            i = e
            # If raw is a single string/template literal, unquote.
            sm = re.match(r'^[\'"`]([\s\S]*)[\'"`]$', raw, re.DOTALL)
            if sm:
                v = sm.group(1)
                v = (v.replace("\\n", "\n")
                       .replace("\\`", "`").replace("\\$", "$")
                       .replace("\\'", "'").replace('\\"', '"'))
                out[name] = v
            # else: ignore JSX-fragment values like description={<>...</>}
        elif src[i] in ('"', "'"):
            val, end = _read_string_literal(src, i)
            out[name] = val
            i = end
        else:
            # unquoted — read up to whitespace
            m = re.match(r"\S+", src[i:])
            if m:
                out[name] = m.group(0)
                i += len(m.group(0))
    return out or None


def extract_exercises_file(path):
    """Pull the structured exercise data from a -exercises.tsx file."""
    src = open(path, encoding="utf-8").read()
    result = {"exercises": [], "reviewQuestions": [], "workingLoop": [],
              "diagnosticRubric": [], "lab": None}

    blob = _named_array(src, "exercises")
    if blob is not None:
        result["exercises"] = _parse_object_array(blob)

    for arr_name in ("reviewQuestions", "workingLoop"):
        blob = _named_array(src, arr_name)
        if blob is not None:
            result[arr_name] = _parse_string_array(blob)

    blob = _named_array(src, "diagnosticRubric")
    if blob is not None:
        result["diagnosticRubric"] = _parse_object_array(blob)

    result["lab"] = _practice_card(src)
    return result


# ---------------------------------------------------------------------------
# Run on every rich standalone chapter page (skip exercises files for prose)
# ---------------------------------------------------------------------------
def chapter_num(path):
    m = re.search(r"page-ch(\d+)-", os.path.basename(path))
    return int(m.group(1)) if m else None


out_dir = HERE
chapters = {}
mermaid_charts = {}

paths = sorted(glob.glob(os.path.join(PAGES_DIR, "page-ch*.tsx")))
for path in paths:
    name = os.path.basename(path)
    if name.endswith("-exercises.tsx"):
        continue
    n = chapter_num(path)
    if n is None or n > 56:
        continue
    items = extract_one(path)
    if items is None:
        print(f"SKIP {name}: no function body found")
        continue
    chapters[f"ch{n:02d}"] = items
    # Also collect Mermaid charts to a flat map for later rendering.
    for it in items:
        if it["kind"] == "mermaid":
            mermaid_charts[it["id"]] = it["chart"]
    # Quick stats
    h = sum(1 for x in items if x["kind"] in ("h3", "h4"))
    p = sum(1 for x in items if x["kind"] == "p")
    md = sum(1 for x in items if x["kind"] == "mermaid")
    ed = sum(1 for x in items if x["kind"] == "editor")
    print(f"ch{n:02d}: h={h:2d}  p={p:2d}  mermaid={md:2d}  editor={ed:2d}")

json.dump(chapters, open(os.path.join(out_dir, "chapter_prose.json"), "w",
                          encoding="utf-8"), ensure_ascii=False, indent=0)
json.dump(mermaid_charts, open(os.path.join(out_dir, "mermaid_charts.json"),
                                "w", encoding="utf-8"), ensure_ascii=False,
          indent=0)

# ---- exercises -----------------------------------------------------------
exercises_data = {}
ex_paths = sorted(glob.glob(os.path.join(PAGES_DIR, "page-ch*-exercises.tsx")))
ex_total, lab_count = 0, 0
for path in ex_paths:
    n = chapter_num(path)
    if n is None or n > 56:
        continue
    data = extract_exercises_file(path)
    if data["exercises"] or data["lab"]:
        exercises_data[f"ch{n:02d}"] = data
        ex_total += len(data["exercises"])
        if data["lab"]:
            lab_count += 1

json.dump(exercises_data, open(os.path.join(out_dir, "chapter_exercises.json"),
                                "w", encoding="utf-8"),
          ensure_ascii=False, indent=0)

print(f"\nWrote {len(chapters)} chapters; {len(mermaid_charts)} unique Mermaid charts.")
print(f"Wrote exercises for {len(exercises_data)} chapters; "
      f"{ex_total} total exercises; {lab_count} runnable labs.")

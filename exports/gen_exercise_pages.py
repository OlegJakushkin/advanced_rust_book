# -*- coding: utf-8 -*-
"""Generate `page-chNN-<slug>-exercises.tsx` source pages for the 16 chapters
that previously had no exercise file.

Each generated file mirrors the repository's existing exercise-stub convention:
a `"use client"` header, an inert `export {}`, and a trailing comment block that
carries the exercise data (`const exercises`, `const reviewQuestions`,
`const workingLoop`) plus the runnable `<RustPracticeCard>` lab.

The workbook PDF builder reads those const blocks via
`exports/extract_chapter_prose.py`. The files are NOT wired into the app
navigation (that requires lockstep edits to types.ts / index.ts / index.tsx);
they are durable, extractor-readable task-page sources.
"""
import json, os, glob, re

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES_DIR = os.path.join(HERE, "..", "components", "rust-book", "pages")
OUT_DIR = os.path.join(HERE, "exgen_out")

WORKING_LOOP = [
    "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
    "Write the smallest version that compiles, then make it correct.",
    "Check each acceptance criterion explicitly before moving on.",
    "Name one tradeoff or failure mode your solution accepts.",
]


def js_str(s):
    """A double-quoted JS string literal that the extractor reads back verbatim."""
    s = (s.replace("\\", "\\\\").replace('"', '\\"')
           .replace("\r", "").replace("\n", "\\n"))
    return '"' + s + '"'


def js_arr(items, indent):
    pad = " " * indent
    inner = (",\n" + pad).join(js_str(x) for x in items)
    return "[\n" + pad + inner + ",\n" + (" " * (indent - 2)) + "]"


def tmpl(s):
    """A template-literal body (real newlines preserved) the extractor reads back."""
    return "`" + s.replace("\\", "\\\\").replace("`", "\\`").replace("$", "\\$") + "`"


def pascal(slug):
    return "".join(p.capitalize() for p in re.split(r"[-_]", slug))


def main_page_slug(n):
    for f in glob.glob(os.path.join(PAGES_DIR, f"page-ch{n:02d}-*.tsx")):
        b = os.path.basename(f)
        if b.endswith("-exercises.tsx"):
            continue
        m = re.match(rf"page-ch{n:02d}-(.+)\.tsx", b)
        if m:
            return m.group(1)
    return None


def render_exercise(e):
    fields = []
    fields.append(f"    number: {int(e['number'])},")
    fields.append(f"    kind: {js_str(e['kind'])},")
    fields.append(f"    title: {js_str(e['title'])},")
    fields.append(f"    objective: {js_str(e['objective'])},")
    fields.append(f"    starterPrompt: {js_str(e['starterPrompt'])},")
    fields.append(f"    prompts: {js_arr(e.get('prompts', []), 6)},")
    fields.append(f"    acceptanceCriteria: {js_arr(e.get('acceptanceCriteria', []), 6)},")
    fields.append(f"    hints: {js_arr(e.get('hints', []), 6)},")
    return "  {\n" + "\n".join(fields) + "\n  },"


def build_file(n, slug, data):
    comp = f"PageCh{n:02d}{pascal(slug)}Exercises"
    page_id = f"ch{n:02d}-{slug}-exercises"
    lab = data["lab"]
    ex_blocks = "\n".join(render_exercise(e) for e in data["exercises"])
    review = js_arr(data["reviewQuestions"], 2)
    loop = js_arr(WORKING_LOOP, 2)

    card = (
        "<RustPracticeCard\n"
        f"  title={{{js_str(lab['title'])}}}\n"
        f"  filename=\"{lab['filename']}\"\n"
        f"  runKey=\"{lab['runKey']}\"\n"
        f"  expectedOutput={{{js_str(lab['expectedOutput'])}}}\n"
        f"  helperText={{{js_str(lab['helperText'])}}}\n"
        f"  initialCode={{{tmpl(lab['initialCode'])}}}\n"
        "/>"
    )

    header = (
        '"use client"\n\n'
        f"// Chapter {n} · exercise workbook page ({page_id}).\n"
        "// Exercise data consumed by the workbook PDF builder\n"
        "// (exports/extract_chapter_prose.py reads the const blocks and the\n"
        "// RustPracticeCard below). Not yet wired into app navigation; wiring\n"
        "// requires lockstep edits to types.ts / index.ts / index.tsx.\n"
        f"// Intended component name: {comp}\n\n"
        "export {}\n\n"
    )

    body = (
        "/*\n"
        "interface Exercise {\n"
        "  number: number\n"
        "  kind: string\n"
        "  title: string\n"
        "  objective: string\n"
        "  starterPrompt: string\n"
        "  prompts?: string[]\n"
        "  acceptanceCriteria: string[]\n"
        "  hints: string[]\n"
        "}\n\n"
        f"const exercises: Exercise[] = [\n{ex_blocks}\n]\n\n"
        f"const reviewQuestions = {review}\n\n"
        f"const workingLoop = {loop}\n\n"
        f"{card}\n"
        "*/\n"
    )
    return header + body


def main():
    n_map = {}
    for p in sorted(glob.glob(os.path.join(OUT_DIR, "ch*.json"))):
        n = int(os.path.basename(p)[2:4])
        n_map[n] = json.load(open(p, encoding="utf-8"))

    written = []
    for n in sorted(n_map):
        slug = main_page_slug(n)
        if not slug:
            print(f"ch{n:02d}: NO MAIN PAGE FOUND — skipping")
            continue
        content = build_file(n, slug, n_map[n])
        out = os.path.join(PAGES_DIR, f"page-ch{n:02d}-{slug}-exercises.tsx")
        with open(out, "w", encoding="utf-8") as f:
            f.write(content)
        written.append(os.path.basename(out))
        print(f"ch{n:02d}: wrote {os.path.basename(out)} ({len(content)} bytes)")
    print(f"\nWrote {len(written)} exercise pages.")


if __name__ == "__main__":
    main()

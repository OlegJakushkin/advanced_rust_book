# -*- coding: utf-8 -*-
"""Render every Mermaid chart from mermaid_charts.json to SVG. Uses mmdc's
markdown batch mode — one browser session renders many charts in a single
invocation, dramatically faster than per-chart launches.
"""
import os, json, subprocess, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = os.path.join(HERE, "mermaid_svgs")
os.makedirs(SVG_DIR, exist_ok=True)

charts = json.load(open(os.path.join(HERE, "mermaid_charts.json"),
                        encoding="utf-8"))

# Filter to those that need rendering (cache by hash id).
to_render = [(cid, src) for cid, src in charts.items()
             if not (os.path.exists(os.path.join(SVG_DIR, f"{cid}.svg"))
                     and os.path.getsize(os.path.join(SVG_DIR, f"{cid}.svg")) > 200)]

print(f"{len(charts)} charts total; {len(to_render)} need rendering.")
if not to_render:
    sys.exit(0)

# mmdc config — light theme, transparent background.
# Body text in the book is set to 10.6pt. With Mermaid laying out at 96 DPI,
# 10.6pt = 14.13px. We use 14px in the diagrams so the text glyph height
# matches the body exactly when SVGs are embedded at their natural size.
config = {
    "theme": "default",
    "themeVariables": {
        "fontFamily": "Georgia, serif",
        "fontSize": "14px",                  # = 10.6pt (matches book body)
        "primaryColor": "#fff5ee",
        "primaryBorderColor": "#CE412B",
        "primaryTextColor": "#1a1a1a",
        "lineColor": "#666",
        "secondaryColor": "#f4f4f5",
        "tertiaryColor": "#fafafa",
    },
    # `useMaxWidth: false` forces mmdc to emit explicit width/height on the
    # root <svg>. With useMaxWidth: true, mermaid generates `style="max-width:
    # 100%; height: auto"` on the SVG, which stretches text to whatever
    # container width is — exactly what breaks consistent font sizing.
    "flowchart": {"curve": "linear", "useMaxWidth": False, "htmlLabels": False},
    # Force explicit px width/height on EVERY diagram type (not just flowchart),
    # else mermaid emits width="100%" for state/sequence/class diagrams and the
    # PDF upscales them to the column width, enlarging the text.
    "state": {"useMaxWidth": False},
    "sequence": {"useMaxWidth": False},
    "class": {"useMaxWidth": False},
}
cfg_path = os.path.join(HERE, "mmdc_config.json")
json.dump(config, open(cfg_path, "w"), indent=2)


def find_chrome():
    for p in (r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"):
        if os.path.exists(p): return p
    return shutil.which("chrome") or shutil.which("chromium") or ""


pup_cfg = {
    "executablePath": find_chrome(),
    "headless": "new",
    "args": ["--no-sandbox", "--disable-dev-shm-usage"],
}
pup_path = os.path.join(HERE, "mmdc_puppeteer.json")
json.dump(pup_cfg, open(pup_path, "w"), indent=2)
print("Chrome at:", pup_cfg["executablePath"])

npx = shutil.which("npx") or shutil.which("npx.cmd")
if not npx:
    raise SystemExit("npx not found on PATH")


# Body font in the book is 10.6pt = 14.13px at 96 DPI. We rewrite every
# font-size in the rendered SVG to exactly 14px so node labels, edge labels,
# and titles all share the body text size — "no less, no more".
import re as _re
BODY_PX = "14px"
_SIZE_PAT = _re.compile(r"font-size\s*:\s*[0-9.]+\s*(?:px|pt|em|rem)?", _re.I)
_SIZE_ATTR = _re.compile(r'font-size="[0-9.]+(?:px|pt|em|rem)?"', _re.I)

def _normalize_svg_text_size(path):
    s = open(path, encoding="utf-8").read()
    s = _SIZE_PAT.sub(f"font-size:{BODY_PX}", s)
    s = _SIZE_ATTR.sub(f'font-size="{BODY_PX}"', s)
    open(path, "w", encoding="utf-8").write(s)

# Render in batches via markdown mode — mmdc walks ```mermaid blocks and outputs
# SVGs sequenced as `<out>-1.svg`, `<out>-2.svg`. We do batches of 30 to keep
# memory in check and to make progress visible.
BATCH = 30
work_dir = os.path.join(HERE, "_mermaid_work")
os.makedirs(work_dir, exist_ok=True)

ok = 0
fail = []
for batch_start in range(0, len(to_render), BATCH):
    batch = to_render[batch_start:batch_start + BATCH]
    md_path = os.path.join(work_dir, f"batch_{batch_start:04d}.md")
    out_pattern = os.path.join(work_dir, f"batch_{batch_start:04d}.svg")
    with open(md_path, "w", encoding="utf-8") as f:
        for cid, src in batch:
            f.write(f"```mermaid\n{src}\n```\n\n")

    cp = subprocess.run(
        [npx, "-y", "@mermaid-js/mermaid-cli",
         "-i", md_path, "-o", out_pattern,
         "-c", cfg_path, "-p", pup_path,
         "-b", "transparent"],
        capture_output=True, text=True, timeout=600)
    if cp.returncode != 0:
        print(f"  batch {batch_start} FAILED:", cp.stderr[-300:])
        for cid, _ in batch:
            fail.append(cid)
        continue

    # mmdc names outputs <stem>-1.svg, <stem>-2.svg, ...
    stem = os.path.splitext(out_pattern)[0]
    for i, (cid, _) in enumerate(batch, start=1):
        src_svg = f"{stem}-{i}.svg"
        if os.path.exists(src_svg):
            dst = os.path.join(SVG_DIR, f"{cid}.svg")
            shutil.move(src_svg, dst)
            _normalize_svg_text_size(dst)
            ok += 1
        else:
            fail.append(cid)
    print(f"  batch ending @ {batch_start + len(batch)}/{len(to_render)}  (+{len(batch)} ok)", flush=True)

print(f"\nRendered OK: {ok}")
if fail:
    print(f"Failed: {len(fail)}")
    print("  first failures:", fail[:5])

# Clean working dir
shutil.rmtree(work_dir, ignore_errors=True)

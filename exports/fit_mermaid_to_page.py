# -*- coding: utf-8 -*-
"""Find every Mermaid SVG that's wider than the page content column and
re-render it with progressively smaller font-size until it fits.

The smaller font is applied UNIFORMLY (in the mmdc config AND normalized in
post-processing) so all text inside the oversized diagram stays at one size.
Charts that already fit are left alone — their text stays at the body size
(14px = 10.6pt) for full parity with prose.
"""
import os, re, json, subprocess, shutil, tempfile, sys

# Force UTF-8 stdout on Windows so we don't crash on `->` in status lines.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
SVG_DIR = os.path.join(HERE, "mermaid_svgs")

# A4 page, 17mm horizontal margins => ~665 CSS px content column.
# We pad a bit (640) so the largest box clears even with internal padding.
THRESHOLD_PX = 640
# Fonts to try, in order. Stops at the first that fits (or the smallest).
FONT_LADDER = [13, 12, 11, 10, 9, 8, 7]
# Don't go below this — print legibility floor.
MIN_FONT = 7

charts = json.load(open(os.path.join(HERE, "mermaid_charts.json"),
                        encoding="utf-8"))
SIZE_PAT = re.compile(r"font-size\s*:\s*[0-9.]+\s*(?:px|pt|em|rem)?", re.I)
SIZE_ATTR = re.compile(r'font-size="[0-9.]+(?:px|pt|em|rem)?"', re.I)


def svg_width(path):
    if not os.path.exists(path):
        return None
    s = open(path, encoding="utf-8").read()
    m = re.search(r'<svg[^>]*\bwidth="([\d.]+)"', s)
    return float(m.group(1)) if m else None


def normalize_size(path, px):
    s = open(path, encoding="utf-8").read()
    s = SIZE_PAT.sub(f"font-size:{px}px", s)
    s = SIZE_ATTR.sub(f'font-size="{px}px"', s)
    open(path, "w", encoding="utf-8").write(s)


def find_chrome():
    for p in (r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
              r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"):
        if os.path.exists(p): return p
    return shutil.which("chrome") or shutil.which("chromium") or ""


pup_cfg = {"executablePath": find_chrome(), "headless": "new",
           "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
pup_path = os.path.join(HERE, "mmdc_puppeteer.json")
json.dump(pup_cfg, open(pup_path, "w"), indent=2)

npx = shutil.which("npx") or shutil.which("npx.cmd")
if not npx:
    raise SystemExit("npx not found")


def render_one(src, font_px, out_svg, work_dir):
    """Render a single chart with the given fontSize. Returns True on success."""
    cfg = {
        "theme": "default",
        "themeVariables": {
            "fontFamily": "Georgia, serif",
            "fontSize": f"{font_px}px",
            "primaryColor": "#fff5ee",
            "primaryBorderColor": "#CE412B",
            "primaryTextColor": "#1a1a1a",
            "lineColor": "#666",
            "secondaryColor": "#f4f4f5",
            "tertiaryColor": "#fafafa",
        },
        "flowchart": {"curve": "linear", "useMaxWidth": False,
                       "htmlLabels": False},
    }
    cfg_path = os.path.join(work_dir, f"cfg_{font_px}.json")
    json.dump(cfg, open(cfg_path, "w"), indent=2)
    md_path = os.path.join(work_dir, "chart.md")
    out_pat = os.path.join(work_dir, "chart.svg")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(f"```mermaid\n{src}\n```\n")
    cp = subprocess.run(
        [npx, "-y", "@mermaid-js/mermaid-cli",
         "-i", md_path, "-o", out_pat,
         "-c", cfg_path, "-p", pup_path,
         "-b", "transparent", "-q"],
        capture_output=True, text=True, timeout=180)
    rendered = out_pat.replace(".svg", "-1.svg")
    if cp.returncode == 0 and os.path.exists(rendered):
        shutil.move(rendered, out_svg)
        return True
    return False


def main():
    oversize = []
    for cid in charts:
        p = os.path.join(SVG_DIR, f"{cid}.svg")
        w = svg_width(p)
        if w is not None and w > THRESHOLD_PX:
            oversize.append((cid, w))
    oversize.sort(key=lambda t: -t[1])
    print(f"oversize charts: {len(oversize)} (threshold={THRESHOLD_PX}px)", flush=True)

    fixed, gave_up = 0, 0
    work_dir = tempfile.mkdtemp(prefix="mmdc_fit_")
    try:
        for idx, (cid, orig_w) in enumerate(oversize, 1):
            src = charts[cid]
            out = os.path.join(SVG_DIR, f"{cid}.svg")
            best_path = None
            best_font = None
            for font_px in FONT_LADDER:
                tmp_out = os.path.join(work_dir, f"{cid}_{font_px}.svg")
                if not render_one(src, font_px, tmp_out, work_dir):
                    continue
                normalize_size(tmp_out, font_px)
                w = svg_width(tmp_out)
                if w is None:
                    continue
                if w <= THRESHOLD_PX:
                    best_path = tmp_out
                    best_font = font_px
                    break
                # remember the smallest-font attempt as a fallback
                best_path = tmp_out
                best_font = font_px
            if best_path:
                shutil.move(best_path, out)
                final_w = svg_width(out)
                if final_w <= THRESHOLD_PX:
                    fixed += 1
                    status = f"OK font={best_font}px {int(orig_w)}->{int(final_w)}px"
                else:
                    gave_up += 1
                    status = f"FLOOR font={best_font}px {int(orig_w)}->{int(final_w)}px"
            else:
                gave_up += 1
                status = "FAILED — no render produced"
            print(f"  [{idx}/{len(oversize)}] {cid}: {status}", flush=True)
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)

    print(f"\nFitted into column: {fixed}")
    print(f"Hit font floor (still over): {gave_up}")


if __name__ == "__main__":
    main()

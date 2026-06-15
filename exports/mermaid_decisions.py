# -*- coding: utf-8 -*-
"""Lay decision nodes (diamonds) out small with their text OUTSIDE the shape.

The only robust way to do this is to let mmdc lay the graph out with SMALL
decision nodes in the first place — otherwise the rank spacing stays sized for
giant diamonds and shrinking them afterwards leaves huge empty gaps. So the
flow is:

  1. `placeholderize(src)` (used by render_mermaid) replaces each `ID{long text}`
     decision label with a tiny placeholder and records ID -> text. mmdc then
     lays out compact small diamonds with correct edges and spacing.
  2. `transform(svg, label_map)` puts the real text back, OUTSIDE each diamond,
     on the first side (left/right/above/below) that does not collide with a
     node or another label, gives it a white pad, and recomputes the viewBox to
     the true content bounds.
"""
import re

DIAM = 14          # half-diagonal of the small diamond (px)
GAP = 8            # gap between diamond and its external label
LH = 11            # half text-line height
MARGIN = 10
CHARW = 6.6        # px per char estimate for Georgia 14px (for layout only)

DECISION_RE = re.compile(r'(?<![\w])([A-Za-z][A-Za-z0-9_]*)\{([^{}|]+)\}')


def placeholderize(src):
    """Replace `ID{label}` decision nodes with `ID{ }`; return (src2, {ID: label})."""
    label_map = {}

    def repl(m):
        nid, label = m.group(1), m.group(2).strip()
        label_map.setdefault(nid, label)
        return nid + "{ }"
    return DECISION_RE.sub(repl, src), label_map


def _esc(s):
    return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def _est_w(text):
    return max(24.0, len(text) * CHARW + 6)


def _groups(svg, cls):
    out = []
    for m in re.finditer(r'<g class="' + re.escape(cls), svg):
        i = m.start(); depth = 0; j = i
        while j < len(svg):
            if svg.startswith("<g", j): depth += 1; j += 2
            elif svg.startswith("</g>", j):
                depth -= 1; j += 4
                if depth == 0: out.append((i, j)); break
            else: j += 1
    return out


def _xy(g):
    m = re.search(r'transform="translate\(([-\d.]+),\s*([-\d.]+)\)"', g)
    return (float(m.group(1)), float(m.group(2))) if m else None


def _fo(g):
    m = re.search(r'<foreignObject width="([\d.]+)" height="([\d.]+)"', g)
    return (float(m.group(1)), float(m.group(2))) if m else (60.0, 21.0)


def _overlap(a, b):
    return not (a[2] <= b[0] or a[0] >= b[2] or a[3] <= b[1] or a[1] >= b[3])


def transform(svg, label_map=None):
    label_map = label_map or {}
    nodes = []   # [id, cx, cy, w, h, is_d, gs, ge, lw]
    for s, e in _groups(svg, "node "):
        g = svg[s:e]
        idm = re.search(r'flowchart-([A-Za-z0-9_]+)-\d+', g)
        c = _xy(g)
        if not idm or not c:
            continue
        w, h = _fo(g)
        is_d = '<polygon' in g and 'class="label-container"' in g
        nid = idm.group(1)
        lw = _est_w(label_map[nid]) if (is_d and nid in label_map) else w
        nodes.append([nid, c[0], c[1], w, h, is_d, s, e, lw])
    decisions = [n for n in nodes if n[5]]
    if not decisions:
        return svg

    # Obstacles: every NON-decision node (any shape) + edge labels. Generous
    # padding because cylinders/rounded shapes are wider than their label box.
    obstacles = []
    for nid, cx, cy, w, h, is_d, *_ in nodes:
        if is_d:
            obstacles.append((cx - DIAM, cy - DIAM, cx + DIAM, cy + DIAM))
        else:
            # cylinders / rounded shapes are wider & taller than their text label,
            # so pad generously to keep external labels off them.
            obstacles.append((cx - w / 2 - 28, cy - h / 2 - 12, cx + w / 2 + 28, cy + h / 2 + 12))
    for s, e in _groups(svg, 'edgeLabel"'):
        g = svg[s:e]; c = _xy(g)
        if c:
            w, h = _fo(g)
            obstacles.append((c[0] - w / 2 - 3, c[1] - h / 2 - 3, c[0] + w / 2 + 3, c[1] + h / 2 + 3))

    placed = []
    extents = []

    def candidates(cx, cy, w):
        return [
            ("left",  (cx - (DIAM + GAP) - w, cy - LH, cx - (DIAM + GAP), cy + LH), -(DIAM + GAP) - w, -LH, "right"),
            ("right", (cx + (DIAM + GAP), cy - LH, cx + (DIAM + GAP) + w, cy + LH), (DIAM + GAP), -LH, "left"),
            ("above", (cx - w / 2, cy - (DIAM + GAP) - 2 * LH, cx + w / 2, cy - (DIAM + GAP)), -w / 2, -(DIAM + GAP) - 2 * LH, "center"),
            ("below", (cx - w / 2, cy + (DIAM + GAP), cx + w / 2, cy + (DIAM + GAP) + 2 * LH), -w / 2, (DIAM + GAP), "center"),
        ]

    out_parts = []; last = 0
    for n in sorted(nodes, key=lambda n: n[6]):
        nid, cx, cy, w, h, is_d, gs, ge, lw = n
        if not is_d:
            extents.append((cx - w / 2 - 4, cy - h / 2 - 4, cx + w / 2 + 4, cy + h / 2 + 4))
            continue
        g = svg[gs:ge]
        label = label_map.get(nid, "")
        mine = (cx - DIAM, cy - DIAM, cx + DIAM, cy + DIAM)
        others = [o for o in obstacles if o != mine]
        chosen = None
        for name, box, lx, ly, align in candidates(cx, cy, lw):
            if not any(_overlap(box, o) for o in others + placed):
                chosen = (box, lx, ly, align); break
        if chosen is None:
            box, lx, ly, align = candidates(cx, cy, lw)[0]
        else:
            box, lx, ly, align = chosen
        placed.append(box)
        extents.append((cx - DIAM, cy - DIAM, cx + DIAM, cy + DIAM)); extents.append(box)
        # uniform small diamond
        small = (f'<polygon points="0,-{DIAM} {DIAM},0 0,{DIAM} -{DIAM},0" class="label-container" '
                 f'style="fill:#ECECFF;stroke:#9370DB;stroke-width:1px;"/>')
        g = re.sub(r'<polygon[^>]*class="label-container"[^>]*/>', small, g, count=1)
        # inject the real label text + width into the (moved) foreignObject
        if label:
            # the " " placeholder renders a 0-height foreignObject; give it real
            # width + height so the injected text is not clipped.
            g = re.sub(r'<foreignObject width="[\d.]+" height="[\d.]+"',
                       f'<foreignObject width="{lw:.1f}" height="22"', g, count=1)
            # the " " placeholder yields an empty <span class="nodeLabel"></span>
            # (no <p>); replace the whole span content with the real label.
            g = re.sub(r'<span class="nodeLabel">[\s\S]*?</span>',
                       f'<span class="nodeLabel"><p>{_esc(label)}</p></span>', g, count=1)
        g = re.sub(r'(<g class="label"[^>]*transform="translate\()[-\d.]+,\s*[-\d.]+(\)")',
                   rf'\g<1>{lx:.2f}, {ly:.2f}\g<2>', g, count=1)
        g = re.sub(r'(max-width:\s*)\d+px;\s*text-align:\s*center;',
                   rf'\g<1>600px; white-space: nowrap; text-align: {align};', g)
        g = re.sub(r'<rect\s*/>',
                   f'<rect x="-3" y="-2" width="{lw + 6:.1f}" height="{2 * LH + 4:.1f}" rx="3" '
                   f'style="fill:#ffffff;fill-opacity:0.94;stroke:none;"/>', g, count=1)
        out_parts.append(svg[last:gs]); out_parts.append(g); last = ge
    out_parts.append(svg[last:]); svg = "".join(out_parts)

    # Snap edge endpoints that met a diamond to the node centre.
    dc = {n[0]: (n[1], n[2]) for n in decisions}

    def fix_edge(m):
        g = m.group(0)
        em = re.search(r'L_([A-Za-z0-9_]+)_([A-Za-z0-9_]+)_\d+', g)
        dm = re.search(r'd="(M[^"]+)"', g)
        if not em or not dm:
            return g
        pts = [[float(x), float(y)] for x, y in re.findall(r'([-\d.]+),([-\d.]+)', dm.group(1))]
        if len(pts) < 2:
            return g
        if em.group(1) in dc: pts[0] = list(dc[em.group(1)])
        if em.group(2) in dc: pts[-1] = list(dc[em.group(2)])
        return g.replace(dm.group(0), 'd="M' + "L".join(f"{x:.3f},{y:.3f}" for x, y in pts) + '"')

    svg = re.sub(r'<path[^>]*class="[^"]*flowchart-link[^"]*"[^>]*/?>', fix_edge, svg)

    for m in re.finditer(r'class="[^"]*flowchart-link[^"]*"[^>]*d="(M[^"]+)"', svg):
        for x, y in re.findall(r'([-\d.]+),([-\d.]+)', m.group(1)):
            x, y = float(x), float(y); extents.append((x, y, x, y))
    for s, e in _groups(svg, 'edgeLabel"'):
        g = svg[s:e]; c = _xy(g)
        if c:
            w, h = _fo(g); extents.append((c[0] - w / 2, c[1] - h / 2, c[0] + w / 2, c[1] + h / 2))

    minx = min(x for x, _, _, _ in extents) - MARGIN
    miny = min(y for _, y, _, _ in extents) - MARGIN
    maxx = max(x for _, _, x, _ in extents) + MARGIN
    maxy = max(y for _, _, _, y in extents) + MARGIN
    vw, vh = maxx - minx, maxy - miny
    svg = re.sub(r'(<svg[^>]*\bwidth=")[\d.]+(")', rf'\g<1>{vw:.3f}\g<2>', svg, count=1)
    svg = re.sub(r'(<svg[^>]*\bheight=")[\d.]+(")', rf'\g<1>{vh:.3f}\g<2>', svg, count=1)
    svg = re.sub(r'(viewBox=")[-\d. ]+(")', rf'\g<1>{minx:.3f} {miny:.3f} {vw:.3f} {vh:.3f}\g<2>', svg, count=1)
    return svg

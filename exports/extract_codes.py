# -*- coding: utf-8 -*-
"""Extract DEFAULT_CODES (key -> Rust source) from types.ts AND every
default-codes-chNN.ts file into a single JSON map.

The PDF driver resolves each example's code by key from this file, so code in
the PDF is verbatim from the app rather than re-typed by hand.
"""
import json, os, re, glob

HERE = os.path.dirname(os.path.abspath(__file__))
RB = os.path.join(HERE, "..", "components", "rust-book")

# `key: \`...rust...\`,` — Rust source CAN contain escaped backticks inside doc
# comments (the source uses \` and \$ to escape inside JS template literals), so
# we match any character that isn't a backtick OR a backslash-escape pair.
ENTRY = re.compile(r"(\b\w+)\s*:\s*`((?:[^`\\]|\\.)*)`", re.DOTALL)

codes = {}

def harvest(path):
    src = open(path, encoding="utf-8").read()
    # Restrict to the inside of any `: Record<string, string> = {` block; if absent,
    # scan the whole file (covers types.ts inline section too).
    blocks = []
    for m in re.finditer(r"Record<string,\s*string>\s*=\s*\{", src):
        depth = 0
        start = m.end() - 1  # position of `{`
        i = start
        while i < len(src):
            c = src[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    blocks.append(src[start:i + 1])
                    break
            i += 1
    if not blocks:
        blocks = [src]
    found = 0
    for blk in blocks:
        for mm in ENTRY.finditer(blk):
            k, v = mm.group(1), mm.group(2)
            # JS template-literal escapes: \` and \$ become literal ` and $.
            v = v.replace("\\`", "`").replace("\\$", "$")
            if k in codes and codes[k] != v:
                # collision — keep first definition; warn
                continue
            codes[k] = v
            found += 1
    return found

files = [os.path.join(RB, "types.ts")] + sorted(glob.glob(os.path.join(RB, "default-codes-ch*.ts")))
for p in files:
    n = harvest(p)
    print(f"{os.path.basename(p):40s}  +{n} keys")

out = os.path.join(HERE, "default_codes.json")
with open(out, "w", encoding="utf-8") as f:
    json.dump(codes, f, ensure_ascii=False, indent=0)
print("---")
print("total keys:", len(codes))
print("sample ch01:", "why_rust_pipeline" in codes)
print("sample ch10:", "arrays_slices_vectors_slice_api" in codes)
print("sample ch50:", any(k.startswith("libp2p") for k in codes))

# -*- coding: utf-8 -*-
"""Materialise every code file the three books reference into a self-contained
`public/` tree, then compile-verify all of it (chapters in parallel).

Layout produced (public/ is treated as the web/distribution root):
  public/examples/chNN_<slug>/<file>.rs    — the 114 main-book example listings
  public/exercises/chNN_<slug>/<file>.rs   — the workbook lab starters (initialCode)
  public/solutions/chNN_<slug>/<file>.rs   — the lab reference solutions (solutionCode)
  public/CODE_MANIFEST.json                — catalog: path, book, chapter, runnable, crates, output

Every file is a standalone `fn main()` program. Std-only files are compiled and
run with rustc (edition 2021); files that need external crates are flagged in the
manifest and built via the cargo runner instead (see public/README.md).
"""
import json, os, re, glob, subprocess, tempfile, shutil
from concurrent.futures import ThreadPoolExecutor, as_completed

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
PUB = os.path.join(ROOT, "public")

CODES = json.load(open(os.path.join(HERE, "default_codes.json"), encoding="utf-8"))
PROSE = json.load(open(os.path.join(HERE, "chapter_prose.json"), encoding="utf-8"))
EX = json.load(open(os.path.join(HERE, "chapter_exercises.json"), encoding="utf-8"))
META = json.load(open(os.path.join(HERE, "book_meta.json"), encoding="utf-8"))

num2title = {}
for c in META["chapters"]:
    m = re.match(r"ch(\d+)", c["id"])
    if m:
        num2title[int(m.group(1))] = c["pages"][0]["title"]

# Known external crate roots (anything here ⇒ not rustc-std-only).
EXTERNAL = {
    "tokio", "serde", "serde_json", "serde_yaml", "rayon", "crossbeam",
    "anyhow", "thiserror", "tonic", "prost", "axum", "hyper", "reqwest",
    "tracing", "tracing_subscriber", "libp2p", "solana_program", "anchor_lang",
    "ndarray", "nalgebra", "rand", "futures", "async_trait", "bincode",
    "sha2", "sha3", "hex", "bytes", "mio", "tungstenite", "tokio_tungstenite",
    "rustls", "tokio_rustls", "mpi", "cudarc", "wgpu", "ort", "candle_core",
    "ark_bls12_381", "ark_ff", "ark_ec", "criterion", "wasm_bindgen",
    "borsh", "num_cpus", "parking_lot", "flume", "lapin", "deadpool", "cudarc",
}


def chap_dir(n):
    """Prefer an existing examples/chNN_* dir name; else derive one from the title."""
    existing = glob.glob(os.path.join(ROOT, "examples", f"ch{n:02d}_*"))
    if existing:
        return os.path.basename(existing[0])
    slug = re.sub(r"[^a-z0-9]+", "_", num2title.get(n, f"chapter{n}").lower()).strip("_")
    return f"ch{n:02d}_{slug}"


def needs_crates(code):
    found = set()
    for m in re.finditer(r"\buse\s+([a-zA-Z_][a-zA-Z0-9_]*)", code):
        root = m.group(1)
        if root in EXTERNAL:
            found.add(root)
    # also `crate::` style direct paths
    for root in EXTERNAL:
        if re.search(rf"\b{root}::", code):
            found.add(root)
    if re.search(r"\basync\s+fn\b", code) or re.search(r"\.await\b", code):
        found.add("(async runtime)")
    return sorted(found)


def safe_name(fn, fallback):
    fn = (fn or "").strip()
    if not fn:
        fn = fallback
    if not fn.endswith(".rs"):
        fn += ".rs"
    return os.path.basename(fn)


def write_file(path, code):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(code if code.endswith("\n") else code + "\n")


# --------------------------------------------------------------------------
# 1) materialise
# --------------------------------------------------------------------------
entries = []  # manifest entries (pre-verification)
seen_names = {}

for n in range(1, 57):
    key = f"ch{n:02d}"
    cdir = chap_dir(n)
    title = num2title.get(n, "")

    # --- main-book examples (editor refs in prose) ---
    used = set()
    for it in PROSE.get(key, []):
        if it["kind"] != "editor":
            continue
        ck = it["codeKey"]
        code = CODES.get(ck)
        if not code:
            continue
        fn = safe_name(it.get("filename"), ck)
        # de-dup filename within a chapter
        if fn in used:
            stem = fn[:-3]
            i = 2
            while f"{stem}_{i}.rs" in used:
                i += 1
            fn = f"{stem}_{i}.rs"
        used.add(fn)
        rel = f"examples/{cdir}/{fn}"
        write_file(os.path.join(PUB, rel), code)
        entries.append({"path": rel, "book": "example", "chapter": n, "title": title,
                        "name": fn, "key": ck, "crates": needs_crates(code),
                        "expected": (it.get("expected") or None)})

    # --- workbook lab starter ---
    lab = (EX.get(key) or {}).get("lab") or {}
    if lab.get("initialCode"):
        fn = safe_name(lab.get("filename"), f"{key}_lab")
        rel = f"exercises/{cdir}/{fn}"
        write_file(os.path.join(PUB, rel), lab["initialCode"])
        entries.append({"path": rel, "book": "exercise", "chapter": n, "title": title,
                        "name": fn, "key": lab.get("runKey"),
                        "crates": needs_crates(lab["initialCode"]),
                        "expected": None,  # the starter is intentionally incomplete
                        "solutionExpected": lab.get("expectedOutput")})

        # --- solution (completed lab) ---
        solp = os.path.join(HERE, "solout", f"{key}.json")
        if os.path.exists(solp):
            ls = (json.load(open(solp, encoding="utf-8")).get("labSolution") or {})
            if ls.get("solutionCode"):
                rel = f"solutions/{cdir}/{fn}"
                write_file(os.path.join(PUB, rel), ls["solutionCode"])
                entries.append({"path": rel, "book": "solution", "chapter": n, "title": title,
                                "name": fn, "key": lab.get("runKey"),
                                "crates": needs_crates(ls["solutionCode"]),
                                "expected": ls.get("expectedOutput")})

print(f"Materialised {len(entries)} files into public/ "
      f"({sum(1 for e in entries if e['book']=='example')} examples, "
      f"{sum(1 for e in entries if e['book']=='exercise')} exercises, "
      f"{sum(1 for e in entries if e['book']=='solution')} solutions)")


# --------------------------------------------------------------------------
# 2) compile-verify in parallel
# --------------------------------------------------------------------------
def verify(entry):
    """Compile-authoritative classification. The heuristic `crates` flag only
    decides display; the actual status comes from rustc. (Local rustc 1.79 can't
    build 2024-edition or nightly-only files, so those are classified by source
    markers and handled by the docker toolchain at run time.)"""
    code_path = os.path.join(PUB, entry["path"])
    src = open(code_path, encoding="utf-8").read()
    nocmt = re.sub(r"//[^\n]*", "", src)  # ignore commented mentions (std models cite ort in comments)
    if re.search(r"\buse\s+cudarc\b|\bcudarc::|\buse\s+ort\b|\bort::", nocmt):
        # real GPU example (cudarc kernel / ONNX Runtime CUDA EP) — builds and runs
        # via public/cuda/ or public/onnx-gpu/ (GPU Docker), not the std rustc runner.
        return entry, "needs-cuda", ""
    if "#[unsafe(" in src or re.search(r"\bunsafe\s+extern\b", src):
        return entry, "needs-edition-2024", ""
    if "#![feature(" in src:
        return entry, "needs-nightly", ""
    work = tempfile.mkdtemp(prefix="pubv_")
    try:
        exe = os.path.join(work, "b.exe" if os.name == "nt" else "b")
        c = subprocess.run(["rustc", "--edition", "2021", "-O", "-o", exe, code_path],
                           capture_output=True, text=True)
        if c.returncode != 0:
            err = c.stderr
            if "E0658" in err:                            # unstable library feature
                return entry, "needs-nightly", err.strip()[:200]
            if re.search(r"E0432|E0433|E0463|can't find crate|undeclared (crate|type or module)", err):
                return entry, "needs-crates", ""          # genuinely needs an external crate
            if entry["book"] == "exercise":               # starters may be fix-the-bug stubs
                return entry, "starter-incomplete", ""
            return entry, "compile-error", err.strip()[:400]
        entry["crates"] = []                              # compiled std-only; clear false flags
        r = subprocess.run([exe], capture_output=True, text=True, timeout=30)
        out = (r.stdout or "").replace("\r\n", "\n").rstrip("\n")
        entry["actualOutput"] = out
        if entry["book"] == "exercise":
            return entry, "starter-ok", ""                # output is placeholder by design
        if entry.get("expected"):
            want = entry["expected"].replace("\r\n", "\n").rstrip("\n")
            if out != want:
                return entry, "output-mismatch", f"want={want!r} got={out!r}"
        return entry, "ok", ""
    except subprocess.TimeoutExpired:
        return entry, "timeout", ""
    finally:
        shutil.rmtree(work, ignore_errors=True)


results = {"ok": 0, "needs-crates": 0, "compile-error": 0, "output-mismatch": 0, "timeout": 0}
problems = []
with ThreadPoolExecutor(max_workers=8) as pool:
    futs = [pool.submit(verify, e) for e in entries]
    for fut in as_completed(futs):
        entry, status, detail = fut.result()
        entry["status"] = status
        results[status] = results.get(status, 0) + 1
        if status in ("compile-error", "output-mismatch", "timeout"):
            problems.append((entry["path"], status, detail))

print("\n=== verification ===")
for k, v in results.items():
    print(f"  {k}: {v}")
if problems:
    print("\n--- problems ---")
    for path, status, detail in problems:
        print(f"  [{status}] {path}\n      {detail}")

# --------------------------------------------------------------------------
# 3) manifest
# --------------------------------------------------------------------------
entries.sort(key=lambda e: (e["chapter"], {"example": 0, "exercise": 1, "solution": 2}[e["book"]], e["name"]))
manifest = {
    "generated": "advanced-rust code corpus",
    "root": "public",
    "counts": {
        "examples": sum(1 for e in entries if e["book"] == "example"),
        "exercises": sum(1 for e in entries if e["book"] == "exercise"),
        "solutions": sum(1 for e in entries if e["book"] == "solution"),
        "total": len(entries),
    },
    "verification": results,
    "files": entries,
}
with open(os.path.join(PUB, "CODE_MANIFEST.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)
print(f"\nWrote public/CODE_MANIFEST.json ({len(entries)} files).")

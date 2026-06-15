# -*- coding: utf-8 -*-
"""Test every workbook exercise (lab starter) and every solution in the public
corpus by compiling and running it inside the Docker runner image (which carries
all toolchains: edition 2021/2024, nightly, and the crate dependencies).

For each `solutions/` file the program's stdout is compared to the expected
output recorded in public/CODE_MANIFEST.json. Results are summarised and written
to exports/test_results.json; genuine failures are written to
exports/test_failures.json for the fix workflow to consume.

Usage:  python test_corpus.py [examples exercises solutions]
        (default targets: exercises solutions)
"""
import json, os, sys, base64, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
PUB = os.path.join(ROOT, "public")
MAN = json.load(open(os.path.join(PUB, "CODE_MANIFEST.json"), encoding="utf-8"))

DIRS = sys.argv[1:] or ["exercises", "solutions"]

# Files that are MEANT not to compile (fix-the-bug lab starters). A starter that
# fails to build is only a genuine failure if it is not one of these.
INTENTIONAL_STARTERS = set()
for e in MAN["files"]:
    if e["book"] == "exercise" and e.get("status") == "starter-incomplete":
        INTENTIONAL_STARTERS.add(e["path"])

# expected outputs (solutions + examples carry one; starters do not)
exp_path = os.path.join(PUB, "docker", "_expected.tsv")
with open(exp_path, "w", encoding="utf-8", newline="\n") as f:
    for e in MAN["files"]:
        if e["book"] in ("solution", "example") and e.get("expected"):
            b64 = base64.b64encode(e["expected"].encode("utf-8")).decode("ascii")
            f.write(f"{e['path']}\t{b64}\n")

SCRIPT = r"""sed 's/\r$//' /work/docker/test_all.sh > /tmp/t.sh && bash /tmp/t.sh "$@" """
cmd = ["docker", "compose", "run", "--rm", "--entrypoint", "bash", "runner",
       "-c", SCRIPT, "bash"] + DIRS

print(f"Running corpus test in Docker over: {', '.join(DIRS)} ...", flush=True)
proc = subprocess.run(cmd, cwd=PUB, capture_output=True, text=True)
os.remove(exp_path)

rows = []
for line in proc.stdout.splitlines():
    parts = line.split("\t")
    if len(parts) != 3:
        continue
    status, path, b64 = parts
    try:
        detail = base64.b64decode(b64).decode("utf-8", "replace") if b64 else ""
    except Exception:
        detail = ""
    rows.append({"status": status, "path": path, "detail": detail})

if not rows:
    print("No result lines parsed. Raw docker output:\n", proc.stdout[-2000:],
          "\nSTDERR:\n", proc.stderr[-1500:])
    sys.exit(1)

by_status = {}
failures = []
for r in rows:
    by_status.setdefault(r["status"], []).append(r)
    book = "solution" if r["path"].startswith("solutions/") else (
        "exercise" if r["path"].startswith("exercises/") else "example")
    genuine = False
    if r["status"] in ("FAIL_BUILD_RUN", "MISMATCH") and book in ("solution", "example"):
        genuine = True
    elif r["status"] == "STARTER_NOCOMPILE":
        # a starter that does not compile is only OK if its lab is a known
        # fix-the-compile-error exercise
        genuine = r["path"] not in INTENTIONAL_STARTERS
    if genuine:
        failures.append({"path": r["path"], "book": book,
                         "status": r["status"], "detail": r["detail"]})

print("\n================= CORPUS TEST =================")
for st in ("PASS", "RAN_OK", "STARTER_OK", "STARTER_NOCOMPILE", "MISMATCH",
           "FAIL_BUILD_RUN", "SKIP_WASM", "SKIP_CUDA"):
    if st in by_status:
        print(f"  {st:18s} {len(by_status.get(st, []))}")
print(f"  {'TOTAL':18s} {len(rows)}")

if failures:
    print(f"\n--- {len(failures)} GENUINE FAILURE(S) ---")
    for fl in failures:
        print(f"  [{fl['status']}] {fl['path']}")
        for ln in fl["detail"].splitlines()[:6]:
            print("      " + ln)
else:
    print("\nAll exercises and solutions compile and run (intentional fix-the-bug "
          "starters excepted).")

json.dump({"targets": DIRS, "summary": {k: len(v) for k, v in by_status.items()},
           "rows": rows}, open(os.path.join(HERE, "test_results.json"), "w",
                               encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(failures, open(os.path.join(HERE, "test_failures.json"), "w",
                         encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"\nWrote test_results.json and test_failures.json "
      f"({len(failures)} failures).")
sys.exit(0 if not failures else 2)

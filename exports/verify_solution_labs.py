# -*- coding: utf-8 -*-
"""Compile + run every std-only lab solution in solout/ and check that its stdout
matches the stated expectedOutput. Crate-dependent labs (stdOnly == false) are
reported as skipped rather than failed.
"""
import json, os, glob, subprocess, tempfile, shutil, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SOL_DIR = os.path.join(HERE, "solout")


def compile_run(code, work, name):
    src = os.path.join(work, name + ".rs")
    exe = os.path.join(work, name + (".exe" if os.name == "nt" else ""))
    open(src, "w", encoding="utf-8").write(code)
    c = subprocess.run(["rustc", "--edition", "2021", "-O", "-o", exe, src],
                       capture_output=True, text=True)
    if c.returncode != 0:
        return False, None, c.stderr
    r = subprocess.run([exe], capture_output=True, text=True, timeout=30)
    return True, r.stdout, r.stderr


def main():
    files = sorted(glob.glob(os.path.join(SOL_DIR, "ch*.json")),
                   key=lambda x: int(os.path.basename(x)[2:4]))
    work = tempfile.mkdtemp(prefix="solverify_")
    passed = skipped = failed = nolab = 0
    report = []
    try:
        for p in files:
            key = os.path.basename(p)[:4]
            d = json.load(open(p, encoding="utf-8"))
            ls = d.get("labSolution")
            if not ls or not ls.get("solutionCode"):
                nolab += 1
                report.append((key, "NO-LAB", ""))
                continue
            if not ls.get("stdOnly", True):
                skipped += 1
                report.append((key, "SKIP (crate-dependent)", ""))
                continue
            ok, out, err = compile_run(ls["solutionCode"], work, key)
            if not ok:
                failed += 1
                report.append((key, "FAIL compile", err.strip()[:400]))
                continue
            got = (out or "").replace("\r\n", "\n").rstrip("\n")
            want = (ls.get("expectedOutput") or "").replace("\r\n", "\n").rstrip("\n")
            if got == want:
                passed += 1
                report.append((key, "PASS", ""))
            else:
                failed += 1
                report.append((key, "FAIL output",
                               f"want={want!r}\n        got={got!r}"))
    finally:
        shutil.rmtree(work, ignore_errors=True)

    print("\n========== SOLUTION LAB VERIFICATION ==========")
    for key, status, detail in report:
        line = f"[{status}] {key}"
        print(line)
        if detail:
            print("        " + detail.replace("\n", "\n        "))
    print(f"\nPASS={passed}  SKIP(crate)={skipped}  NO-LAB={nolab}  FAIL={failed}  "
          f"(of {len(files)} chapters)")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())

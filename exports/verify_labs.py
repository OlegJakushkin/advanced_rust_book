# -*- coding: utf-8 -*-
"""Validate every generated chapter-exercise JSON in exgen_out/.

For each chNN.json:
  * structural checks (6 exercises with all fields, 5 review questions, lab present)
  * compile solutionCode with `rustc --edition 2021`, run it, and assert that the
    stdout (trailing newline stripped) EXACTLY equals lab.expectedOutput
  * compile initialCode with `rustc --edition 2021` (must at least compile)

Exit code 0 only if all chapters pass. Prints a per-chapter report.
"""
import json, os, glob, subprocess, tempfile, sys, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "exgen_out")

KINDS_ORDER = [
    "warm-up comprehension", "code reading", "implementation",
    "implementation", "debugging or refactoring", "design or production scenario",
]


def rustc_compile(code, workdir, name):
    src = os.path.join(workdir, name + ".rs")
    exe = os.path.join(workdir, name + (".exe" if os.name == "nt" else ""))
    with open(src, "w", encoding="utf-8") as f:
        f.write(code)
    proc = subprocess.run(
        ["rustc", "--edition", "2021", "-O", "-o", exe, src],
        capture_output=True, text=True)
    return proc.returncode == 0, proc.stderr, exe


def run_exe(exe):
    proc = subprocess.run([exe], capture_output=True, text=True, timeout=30)
    return proc.returncode, proc.stdout, proc.stderr


def check_structure(d):
    errs = []
    exs = d.get("exercises", [])
    if len(exs) != 6:
        errs.append(f"expected 6 exercises, got {len(exs)}")
    for i, e in enumerate(exs, 1):
        for fld in ("number", "kind", "title", "objective", "starterPrompt",
                    "prompts", "acceptanceCriteria", "hints"):
            if fld not in e or e.get(fld) in (None, "", []):
                errs.append(f"ex{i}: missing/empty '{fld}'")
        if not (2 <= len(e.get("hints", [])) <= 3):
            errs.append(f"ex{i}: hints count {len(e.get('hints', []))}")
        if len(e.get("acceptanceCriteria", [])) < 3:
            errs.append(f"ex{i}: <3 acceptance criteria")
    rq = d.get("reviewQuestions", [])
    if len(rq) != 5:
        errs.append(f"expected 5 review questions, got {len(rq)}")
    lab = d.get("lab")
    if not lab:
        errs.append("no lab")
    else:
        for fld in ("title", "filename", "runKey", "expectedOutput",
                    "helperText", "initialCode", "solutionCode"):
            if fld not in lab or lab.get(fld) in (None, ""):
                errs.append(f"lab: missing/empty '{fld}'")
    return errs


def main():
    files = sorted(glob.glob(os.path.join(OUT_DIR, "ch*.json")))
    if not files:
        print("No exgen_out/ch*.json files found.")
        return 1
    work = tempfile.mkdtemp(prefix="labverify_")
    all_ok = True
    report = []
    try:
        for path in files:
            key = os.path.splitext(os.path.basename(path))[0]
            try:
                d = json.load(open(path, encoding="utf-8"))
            except Exception as ex:
                report.append((key, False, [f"JSON load error: {ex}"]))
                all_ok = False
                continue
            errs = check_structure(d)
            lab = d.get("lab") or {}
            # solutionCode: compile + run + compare
            if lab.get("solutionCode"):
                ok, stderr, exe = rustc_compile(lab["solutionCode"], work, key + "_sol")
                if not ok:
                    errs.append("solutionCode FAILED to compile:\n" + stderr.strip()[:800])
                else:
                    rc, out, rerr = run_exe(exe)
                    if rc != 0:
                        errs.append(f"solutionCode ran with exit {rc}; stderr={rerr.strip()[:300]}")
                    got = out.replace("\r\n", "\n").rstrip("\n")
                    want = (lab.get("expectedOutput") or "").replace("\r\n", "\n").rstrip("\n")
                    if got != want:
                        errs.append("OUTPUT MISMATCH\n  expected: "
                                    + repr(want) + "\n  got:      " + repr(got))
            # initialCode: must compile
            if lab.get("initialCode"):
                ok, stderr, _ = rustc_compile(lab["initialCode"], work, key + "_init")
                if not ok:
                    errs.append("initialCode FAILED to compile:\n" + stderr.strip()[:800])
            passed = not errs
            all_ok = all_ok and passed
            report.append((key, passed, errs))
    finally:
        shutil.rmtree(work, ignore_errors=True)

    print("\n================= LAB VERIFICATION REPORT =================")
    for key, passed, errs in report:
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {key}")
        for e in errs:
            print("   - " + e.replace("\n", "\n     "))
    npass = sum(1 for _, p, _ in report if p)
    print(f"\n{npass}/{len(report)} chapters passed.")
    return 0 if all_ok else 2


if __name__ == "__main__":
    sys.exit(main())

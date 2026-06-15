# -*- coding: utf-8 -*-
"""Structural check of solout/ against the workbook: every chapter must have one
solution per exercise (matching numbers), one answer per review question, and a
lab solution wherever the chapter has a runnable lab.
"""
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
EX = json.load(open(os.path.join(HERE, "chapter_exercises.json"), encoding="utf-8"))

problems = 0
missing = []
for n in range(1, 57):
    key = f"ch{n:02d}"
    exd = EX.get(key)
    if not exd:
        continue
    p = os.path.join(HERE, "solout", f"{key}.json")
    if not os.path.exists(p):
        missing.append(key)
        problems += 1
        continue
    try:
        d = json.load(open(p, encoding="utf-8"))
    except Exception as e:
        print(f"{key}: JSON ERROR {e}")
        problems += 1
        continue
    errs = []
    n_ex = len(exd.get("exercises", []))
    n_rq = len(exd.get("reviewQuestions") or [])
    has_lab = bool((exd.get("lab") or {}).get("initialCode"))

    es = d.get("exerciseSolutions", [])
    if len(es) != n_ex:
        errs.append(f"exerciseSolutions {len(es)} != {n_ex}")
    # number alignment + non-empty solution text
    want_nums = [e.get("number") for e in exd.get("exercises", [])]
    got_nums = [s.get("number") for s in es]
    if want_nums != got_nums:
        errs.append(f"numbers {got_nums} != {want_nums}")
    for s in es:
        if not str(s.get("solution", "")).strip():
            errs.append(f"ex{s.get('number')}: empty solution")
        ac = next((e.get("acceptanceCriteria") or [] for e in exd["exercises"]
                   if e.get("number") == s.get("number")), [])
        cr = s.get("criteria") or []
        if ac and len(cr) < max(1, len(ac) - 1):
            errs.append(f"ex{s.get('number')}: {len(cr)} criteria vs {len(ac)} acceptance")

    ra = d.get("reviewAnswers") or []
    if len(ra) != n_rq:
        errs.append(f"reviewAnswers {len(ra)} != {n_rq}")
    for qa in ra:
        if not str(qa.get("answer", "")).strip():
            errs.append("empty review answer")

    ls = d.get("labSolution")
    if has_lab and not (ls and str(ls.get("solutionCode", "")).strip()):
        errs.append("missing labSolution.solutionCode")

    if errs:
        problems += 1
        print(f"{key}: " + "; ".join(errs))
    else:
        print(f"{key}: OK ({n_ex} ex, {n_rq} rq, lab={'Y' if has_lab else '-'})")

if missing:
    print("\nMISSING FILES:", missing)
print(f"\n{'ALL GOOD' if problems == 0 else str(problems) + ' chapter(s) with problems'}")
sys.exit(0 if problems == 0 else 2)

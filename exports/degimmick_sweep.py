# -*- coding: utf-8 -*-
"""Apply the book-prose-editing standard's high-confidence string mappings to
every chapter page (rich standalone + legacy standalone + shared templates).

These mappings come from the work already validated on ch01-08 (per the skill
under .claude/skills/book-prose-editing/). Each entry is conservative: only
unique, unambiguous swaps. Nuanced rewrites stay manual.
"""
import os, re, glob

RB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                  "components", "rust-book", "pages")

# (pattern, replacement, is_regex). Order matters — apply specific before generic.
RULES = [
    # ----- plain section names ---------------------------------------------
    (r">Worked examples<", ">Examples<", True),
    (r">Diagnostic reading rubric<", ">Questions to ask for each error<", True),
    (r">Comparison callout: ", ">", True),
    (r"A senior-engineer reading checklist", "A reading checklist", False),
    (r"Senior-engineer reading checklist", "Reading checklist", False),
    (r"Recommended senior-engineer Rust workflow", "A recommended Rust workflow", False),
    (r"Senior-engineer dependency rules", "Dependency rules", False),
    (r"Senior-engineer ", "", False),
    (r"Suggested drills", "Suggested practice", False),
    (r"progressive drills", "exercises", False),
    (r"Deliberate practice for senior engineers", "Exercises", False),
    (r"Deliberate drills for ", "Exercises for ", False),
    # ----- de-cute / de-anthropomorphic metaphors --------------------------
    (r"mystical bytes", "data by magic", False),
    (r"ownership story dishonest", "violate Rust's exclusive-mutation rule",
     False),
    (r"out-argue the rule", "working around the borrow checker", False),
    (r"share immutable data honestly", "share immutable data via shared references",
     False),
    (r"smuggle request-local state", "carry request-local state", False),
    (r"smuggle references", "carry references deeper", False),
    (r"matched the problem more honestly", "fit the problem better", False),
    (r"not asking you to appease it", "not an obstacle to work around", False),
    (r"manufacture survival\.", "keep the referenced value alive.", False),
    (r"rescue the reference\.", "keep a reference to it valid.", False),
    (r"manufacture a longer-lived owner", "extend how long an owner lives", False),
    (r"rescue a bad stride pattern", "fix a bad stride pattern", False),
    (r"not magical built-in", "not a built-in", False),
    (r"\bappeasement strategy\b", "way to get past a borrow-checker error", False),
    (r"compiler appeasement", "borrow-checker work-around", False),
    (r"compiler mood", "ownership or borrowing rule involved", False),
    (r"hope discipline will carry the day", "rely on discipline to keep them valid",
     False),
    (r"Downcasting is precise, not magical\.",
     "Downcasting is precise and explicit.", False),
    # ----- hype/flattery removal ------------------------------------------
    (r"\bserious lock-free", "lock-free", False),
    (r"\ba serious Rust workspace", "a production Rust workspace", False),
    (r"becomes memorable faster", "becomes clearer", False),
    (r"engagement lab", "lab", False),
]

target_files = sorted(glob.glob(os.path.join(RB, "page-ch*.tsx")))
# Also sweep the two shared templates.
target_files += [
    os.path.join(RB, "fallback-generated-pages.tsx"),
    os.path.join(RB, "example-exercise-pages.tsx"),
]

total_files_changed = 0
total_replacements = 0
per_file = []

for path in target_files:
    if not os.path.exists(path):
        continue
    src = open(path, encoding="utf-8").read()
    orig = src
    file_subs = 0
    for pat, repl, is_regex in RULES:
        if is_regex:
            new, n = re.subn(pat, repl, src)
        else:
            n = src.count(pat)
            new = src.replace(pat, repl) if n else src
        if n:
            file_subs += n
            src = new
    if src != orig:
        open(path, "w", encoding="utf-8").write(src)
        total_files_changed += 1
        total_replacements += file_subs
        per_file.append((os.path.basename(path), file_subs))

per_file.sort(key=lambda x: -x[1])
for name, n in per_file[:30]:
    print(f"  {name:60s}  {n} edits")
print("---")
print(f"files changed: {total_files_changed}")
print(f"total replacements: {total_replacements}")

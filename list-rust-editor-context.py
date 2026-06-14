#!/usr/bin/env python3

import os
import re
import argparse
from typing import Optional

OUTPUT_NEWLINE = "\n"

TRUNCATE_ALNUM_IF_LONGER_THAN = 128
TRUNCATE_ALNUM_KEEP_PREFIX = 50
_LONG_ALNUM_RE = re.compile(
    r"[A-Za-z0-9]{" + str(TRUNCATE_ALNUM_IF_LONGER_THAN + 1) + r",}"
)

TARGET_FILES = [
    "components/rust-code-editor.tsx",
    "components/rust-book/crab-strategy-game.tsx",
    "components/rust-book/crab-strategy-defaults.ts",
    "components/rust-book/crab-strategy-compiler.ts",
    "components/rust-book/pages/page-ch01-why-rust-feels-different.tsx",
    "components/rust-book/index.tsx",
    "components/rust-book/pages/index.ts",
    "components/rust-book/types.ts",
    "components/rust-book/book-context.tsx",
    "components/rust-book/rust-simulator.ts",
    "components/ui/button.tsx",
    "lib/utils.ts",
    "app/globals.css",
]


def _normalize_newlines_to_lf(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def _normalize_rel(path: str) -> str:
    rel = os.path.normpath(path).replace(os.sep, "/")
    if rel.startswith("./"):
        rel = rel[2:]
    return rel


def _truncate_long_alnum_chunks(text: str) -> str:
    if not text:
        return text

    return _LONG_ALNUM_RE.sub(
        lambda m: m.group(0)[:TRUNCATE_ALNUM_KEEP_PREFIX] + "...",
        text,
    )


def count_file_lines(abs_path: str) -> Optional[int]:
    try:
        with open(abs_path, "rb") as f:
            return sum(1 for _ in f)
    except Exception:
        return None


def read_text_file(abs_path: str) -> str:
    try:
        with open(abs_path, "r", encoding="utf-8", errors="replace", newline=None) as f:
            return _normalize_newlines_to_lf(f.read())
    except Exception as e:
        return f"[error] Could not read {abs_path}: {e}\n"


def resolve_existing_target_files(root_dir: str):
    existing = []
    missing = []

    for rel_path in TARGET_FILES:
        rel_path = _normalize_rel(rel_path)
        abs_path = os.path.join(root_dir, rel_path)

        if os.path.isfile(abs_path):
            existing.append(rel_path)
        else:
            missing.append(rel_path)

    return existing, missing


def print_file_tree_to_console(file_list, line_counts, missing_files):
    print("Included files:\n")

    for f in file_list:
        n = line_counts.get(f)
        suffix = f" ({n} lines)" if isinstance(n, int) else " (lines: n/a)"
        print(f"- {_truncate_long_alnum_chunks(f)}{suffix}")

    if missing_files:
        print("\nMissing expected files:\n")
        for f in missing_files:
            print(f"- {f}")

    print("\n")


def compose_task_header(task_text: Optional[str]) -> str:
    if not task_text:
        return ""

    task_text = _truncate_long_alnum_chunks(_normalize_newlines_to_lf(task_text))

    return (
        "# TASK\n\n"
        f"{task_text}\n\n"
        "IMPORTANT:\n"
        "- Only the targeted Rust book/editor files are included below.\n"
        "- Existing files are shown with line numbers in the format `line|content`.\n"
        "- Missing expected files are listed separately.\n\n"
    )


def write_list_md(
    output_path: str,
    root_dir: str,
    included_files,
    missing_files,
    line_counts,
    task_text: Optional[str],
):
    with open(output_path, "w", encoding="utf-8", newline=OUTPUT_NEWLINE) as md_out:
        task_header = compose_task_header(task_text)
        if task_header:
            md_out.write(task_header)
            md_out.write(OUTPUT_NEWLINE)

        md_out.write("## Target Files Tree\n\n")

        for f in included_files:
            depth = f.count("/")
            indent = "    " * depth
            md_out.write(f"{indent}- {_truncate_long_alnum_chunks(f)}{OUTPUT_NEWLINE}")

        if missing_files:
            md_out.write("\n## Missing Expected Files\n\n")
            for f in missing_files:
                md_out.write(f"- `{f}`{OUTPUT_NEWLINE}")

        md_out.write("\n## File Contents\n\n")

        for f in included_files:
            abs_path = os.path.join(root_dir, f)
            md_out.write(f"### File: `{f}`\n\n")
            md_out.write("````\n")

            content = read_text_file(abs_path)
            lines = content.splitlines()

            for i, line in enumerate(lines, 1):
                line = _truncate_long_alnum_chunks(line)
                md_out.write(f"{i}|{line}\n")

            md_out.write("````\n\n")


def main():
    parser = argparse.ArgumentParser(
        description="Create list.md containing only the Rust book/editor target files."
    )

    parser.add_argument(
        "--root",
        type=str,
        default=".",
        help="Repository root directory. Default: current directory.",
    )

    parser.add_argument(
        "--output",
        type=str,
        default="list.md",
        help="Output markdown file. Default: list.md",
    )

    parser.add_argument(
        "--task-text",
        type=str,
        default=None,
        help="Optional task text to place at the top of list.md.",
    )

    parser.add_argument(
        "--task-text-file",
        type=str,
        default=None,
        help="Optional UTF-8 file containing task text.",
    )

    args = parser.parse_args()

    root_dir = os.path.abspath(args.root)

    task_text = args.task_text
    if args.task_text_file:
        try:
            with open(args.task_text_file, "r", encoding="utf-8", errors="replace") as f:
                task_text = _normalize_newlines_to_lf(f.read())
        except Exception as e:
            print(f"Warning: failed to read --task-text-file {args.task_text_file}: {e}")

    included_files, missing_files = resolve_existing_target_files(root_dir)

    line_counts = {}
    for f in included_files:
        line_counts[f] = count_file_lines(os.path.join(root_dir, f))

    print_file_tree_to_console(included_files, line_counts, missing_files)

    write_list_md(
        output_path=args.output,
        root_dir=root_dir,
        included_files=included_files,
        missing_files=missing_files,
        line_counts=line_counts,
        task_text=task_text,
    )

    print(f"Created {args.output} with {len(included_files)} included files.")

    if missing_files:
        print(f"Warning: {len(missing_files)} expected file(s) were missing.")


if __name__ == "__main__":
    main()
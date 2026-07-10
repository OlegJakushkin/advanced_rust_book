#!/usr/bin/env bash
# Build and run any file from the Advanced Rust code corpus.
#   run-book <path>     compile + run one .rs file (path relative to public/)
#   run-book --list     list every runnable file
#   run-book --list ch10   list one chapter's files
set -euo pipefail
ROOT=/work
arg="${1:-}"

usage() {
  cat <<'EOF'
Advanced Rust — code runner

  docker compose run --rm runner <path>          run one file (path relative to public/)
  docker compose run --rm runner --list          list everything
  docker compose run --rm runner --list ch10     list one chapter

Examples:
  docker compose run --rm runner examples/ch10_arrays_slices_and_vectors/slice_first_api.rs
  docker compose run --rm runner exercises/ch10_arrays_slices_and_vectors/window_sum_lab.rs
  docker compose run --rm runner solutions/ch10_arrays_slices_and_vectors/window_sum_lab.rs

Notes:
  * examples/  = the 114 main-book Example listings
  * exercises/ = the workbook lab STARTERS (intentionally incomplete; some are
                 fix-the-bug stubs that do not compile until you finish them)
  * solutions/ = the completed, verified lab solutions
EOF
}

if [ -z "$arg" ] || [ "$arg" = "-h" ] || [ "$arg" = "--help" ]; then usage; exit 0; fi

if [ "$arg" = "--list" ]; then
  cd "$ROOT"
  pat="${2:-}"
  if [ -n "$pat" ]; then
    find examples exercises solutions -name '*.rs' 2>/dev/null | sort | grep -- "$pat" || true
  else
    find examples exercises solutions -name '*.rs' 2>/dev/null | sort
  fi
  exit 0
fi

f="$arg"
abs="$ROOT/$f"
if [ ! -f "$abs" ]; then
  echo "Not found: $f"
  echo "Run 'docker compose run --rm runner --list' to see available files."
  exit 2
fi

# Real CUDA (cudarc) needs a GPU + the NVIDIA toolchain — use the public/cuda project.
if grep -Eq '^[[:space:]]*use[[:space:]]+cudarc\b' "$abs"; then
  echo ">> '$f' is real CUDA from Rust (cudarc). Build and run it on a GPU with the" >&2
  echo ">> project in public/cuda/:  cd public/cuda && docker compose run --rm cuda" >&2
  exit 3
fi
# Real ONNX-on-GPU (ort + CUDA EP) needs a GPU — use the public/onnx-gpu project.
if grep -Eq '^[[:space:]]*use[[:space:]]+ort\b' "$abs"; then
  echo ">> '$f' is real ONNX inference on the GPU (ort + CUDA EP). Build and run it" >&2
  echo ">> with the project in public/onnx-gpu/:  cd public/onnx-gpu && docker compose run --rm onnx" >&2
  exit 3
fi

# WebAssembly targets are built with wasm-pack, not as native binaries.
if grep -Eq '^[[:space:]]*use[[:space:]]+wasm_bindgen\b' "$abs" || grep -q '#\[wasm_bindgen' "$abs"; then
  echo ">> '$f' targets WebAssembly via wasm-bindgen and is built with wasm-pack,"
  echo ">> not as a native binary. It is included for reading; see README 'Special"
  echo ">> cases'. Not run here."
  exit 3
fi

# Pick the Rust edition: 2024 only when the file uses 2024-edition unsafe syntax.
edition=2021
if grep -q '#\[unsafe(' "$abs" || grep -Eq '\bunsafe[[:space:]]+extern\b' "$abs"; then
  edition=2024
fi
# Nightly only when the file opts into an unstable feature.
toolchain=""
if grep -q '#!\[feature(' "$abs"; then toolchain="+nightly"; fi

# External crates (or async) -> build through the cargo runner; otherwise rustc.
# Crates may appear as `use crossbeam::...` OR as a direct path `crossbeam::...`.
_crates='tokio|serde|serde_json|rayon|crossbeam|anyhow|thiserror|tracing|tracing_subscriber|futures'
if grep -Eq "^[[:space:]]*use[[:space:]]+(${_crates})\b" "$abs" \
   || grep -Eq "\b(${_crates})::" "$abs" \
   || grep -Eq '\basync[[:space:]]+fn\b|\.await\b' "$abs"; then
  echo ">> building with cargo (external crates / async runtime): $f"
  cp "$abs" /runner/src/main.rs
  cd /runner
  exec cargo run --quiet --release
else
  tmp="$(mktemp -d)"
  echo ">> rustc ${toolchain:-stable} --edition $edition: $f"
  rustc $toolchain --edition "$edition" -O -o "$tmp/bin" "$abs"
  exec "$tmp/bin"
fi

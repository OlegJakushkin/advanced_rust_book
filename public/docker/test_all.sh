#!/usr/bin/env bash
# In-container test driver for the Advanced Rust corpus.
#
#   * solutions/ (and examples/) must COMPILE, RUN, and — when an expected output
#     is listed in docker/_expected.tsv — match it.
#   * exercises/ are lab STARTERS: they only need to COMPILE. They are incomplete
#     by design (some panic or return stubs until the reader finishes them), so
#     their runtime behaviour is not checked.
#
# Emits one TSV line per file on stdout:  <STATUS>\t<relpath>\t<base64 detail>
# Statuses: PASS MISMATCH RAN_OK FAIL_BUILD_RUN STARTER_OK STARTER_NOCOMPILE SKIP_WASM
set -uo pipefail
ROOT=/work
EXP=/work/docker/_expected.tsv
dirs="${*:-exercises solutions}"
CRATES='tokio|serde|serde_json|rayon|crossbeam|anyhow|thiserror|tracing|tracing_subscriber|futures'

emit() { printf '%s\t%s\t%s\n' "$1" "$2" "$(printf '%s' "$3" | base64 -w0)"; }
get_expected() { [ -f "$EXP" ] && awk -F'\t' -v p="$1" '$1==p{print $2; exit}' "$EXP" || true; }

cd "$ROOT"
for d in $dirs; do
  [ -d "$d" ] || continue
  while IFS= read -r rel; do
    src="$ROOT/$rel"
    is_starter=0; case "$rel" in exercises/*) is_starter=1;; esac

    if grep -Eq '^[[:space:]]*use[[:space:]]+wasm_bindgen\b' "$src" || grep -q '#\[wasm_bindgen' "$src"; then
      emit "SKIP_WASM" "$rel" ""; continue
    fi
    if grep -Eq '^[[:space:]]*use[[:space:]]+(cudarc|ort)\b' "$src"; then
      emit "SKIP_CUDA" "$rel" ""; continue
    fi
    edition=2021
    if grep -q '#\[unsafe(' "$src" || grep -Eq '\bunsafe[[:space:]]+extern\b' "$src"; then edition=2024; fi
    tc=""; if grep -q '#!\[feature(' "$src"; then tc="+nightly"; fi

    use_cargo=0
    if grep -Eq "^[[:space:]]*use[[:space:]]+($CRATES)\b" "$src" \
       || grep -Eq "\b($CRATES)::" "$src" \
       || grep -Eq '\basync[[:space:]]+fn\b|\.await\b' "$src"; then use_cargo=1; fi

    err="$(mktemp)"
    if [ "$is_starter" = 1 ]; then
      # starters: compile only
      if [ "$use_cargo" = 1 ]; then
        cp "$src" /runner/src/main.rs
        (cd /runner && cargo build --quiet --release) 2>"$err"; rc=$?
      else
        rustc $tc --edition "$edition" -O -o /tmp/bin "$src" 2>"$err"; rc=$?
      fi
      if [ $rc -eq 0 ]; then emit "STARTER_OK" "$rel" ""
      else emit "STARTER_NOCOMPILE" "$rel" "$(tail -c 600 "$err")"; fi
      rm -f "$err"; continue
    fi

    # solutions / examples: compile + run (+ compare)
    if [ "$use_cargo" = 1 ]; then
      cp "$src" /runner/src/main.rs
      out="$(cd /runner && cargo run --quiet --release 2>"$err")"; rc=$?
    else
      if rustc $tc --edition "$edition" -O -o /tmp/bin "$src" 2>"$err"; then
        out="$(/tmp/bin 2>>"$err")"; rc=$?
      else rc=200; out=""; fi
    fi
    if [ $rc -ne 0 ]; then
      emit "FAIL_BUILD_RUN" "$rel" "$(tail -c 700 "$err")"; rm -f "$err"; continue
    fi
    rm -f "$err"
    exp_b64="$(get_expected "$rel")"
    if [ -n "$exp_b64" ]; then
      exp="$(printf '%s' "$exp_b64" | base64 -d)"
      if [ "$out" = "$exp" ]; then emit "PASS" "$rel" ""
      else emit "MISMATCH" "$rel" "EXPECTED:
$exp
---GOT:
$out"; fi
    else
      emit "RAN_OK" "$rel" "$out"
    fi
  done < <(find "$d" -name '*.rs' | sort)
done

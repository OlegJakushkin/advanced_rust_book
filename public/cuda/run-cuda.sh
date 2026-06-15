#!/usr/bin/env bash
# Run one of the prebuilt CUDA binaries. First arg = bin name (default
# matmul_solution); remaining args are passed through (e.g. the matrix size N).
set -euo pipefail
bin="${1:-matmul_solution}"
shift || true
exec "/work/target/release/${bin}" "$@"

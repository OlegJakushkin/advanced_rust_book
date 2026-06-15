#!/usr/bin/env bash
# Run one of the prebuilt ONNX binaries (default onnx_solution).
set -euo pipefail
bin="${1:-onnx_solution}"
shift || true
exec "/work/target/release/${bin}" "$@"

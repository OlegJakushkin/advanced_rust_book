# Chapter 54 — Real ONNX Inference on the GPU (from Rust)

The std-only Chapter 54 examples *model* inference (hand-rolled argmax/softmax).
This folder runs the real thing: **ONNX Runtime executing an ONNX model on the
GPU via Rust's [`ort`](https://crates.io/crates/ort) crate**, compared against
the CPU execution provider.

- `gen_model.py` — emits `model.onnx`, a 4-layer MLP (1024→4096→4096→4096→10,
  batch 128). Random seeded weights, so the run is reproducible.
- `src/main.rs` — loads the model into two sessions (CPU EP and CUDA EP), runs the
  same batch through both, checks the outputs agree, and reports the per-inference
  speedup. The CUDA EP dispatches the Gemm/Relu kernels to the GPU.

## Requirements

- An NVIDIA GPU + recent driver, Docker, and the NVIDIA Container Toolkit.
- The image bundles a CUDA-enabled ONNX Runtime (`onnxruntime-gpu`) plus cuDNN,
  so nothing CUDA-specific needs to be installed on the host.

## Run it

```bash
cd public/onnx-gpu
docker compose build              # CUDA+cuDNN base + onnxruntime-gpu + Rust (one time, large)
docker compose run --rm onnx
```

## Expected output

Times vary by GPU; correctness does not. On an RTX 3080 Laptop GPU:

```
cpu        = 20.41 ms / inference
gpu (cuda) = 1.25 ms / inference
batch      = 128, model = 1024->4096->4096->4096->10 (f32)
speedup    = 16.3x
agree      = true
```

`agree = true` confirms the GPU and CPU produce the same outputs to f32 precision;
the ~16x speedup is real GPU acceleration of the matmul-heavy layers. The CUDA
session is built with `.error_on_failure()`, so if the GPU EP cannot load (no
driver, GPU not passed through, version mismatch) the program **errors instead of
silently falling back to CPU** — the speedup you see is genuine device execution,
not a CPU number in disguise.

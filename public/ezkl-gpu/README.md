# Chapter 53 — Real GPU-Aware zkML (EZKL)

The std-only Chapter 53 examples *model* the proving/verification boundary. This
folder does the real thing, end to end:

1. **GPU inference** — a small ONNX model is run on the GPU through ONNX Runtime's
   CUDA execution provider (`gen_infer.py`). This is the GPU-accelerated inference
   that a zkML pipeline proves; the program errors if the CUDA EP isn't active, so
   the inference genuinely runs on the device.
2. **Real zero-knowledge proof** — the actual [EZKL](https://github.com/zkonduit/ezkl)
   prover turns that model into an arithmetic circuit and produces a succinct proof
   that the inference was computed correctly, then verifies it (`verified: true`).

So the GPU computes the inference and EZKL proves it — verifiable machine learning
on a GPU-enabled stack.

## Requirements

- An NVIDIA GPU + recent driver, Docker, and the NVIDIA Container Toolkit.
- Everything else (CUDA-enabled ONNX Runtime, the EZKL prover binary) is baked into
  the image.

## Run it

```bash
cd public/ezkl-gpu
docker compose build            # CUDA+cuDNN base + onnxruntime-gpu + EZKL CLI (one time)
docker compose run --rm ezkl
```

## Expected output (abridged)

```
===== 1) GPU inference (ONNX Runtime CUDA execution provider) =====
ONNX Runtime providers: ['CUDAExecutionProvider', 'CPUExecutionProvider']
GPU inference output: [...]

===== 2) Real zero-knowledge proof of the model (EZKL) =====
... ezkl::pfsys - proof took 1.5s
... ezkl::execute - verified: true

===== zkML complete: GPU ran the inference, EZKL proved it =====
proof = 17542 bytes  (verified above: 'verified: true')
```

## Where the GPU fits in zkML

- **Inference** (done here on the GPU): for real models the forward pass is the
  expensive part and runs on the GPU — exactly the `ort` + CUDA EP path shown in
  `public/onnx-gpu/`. The model here is kept small only so the *proof* is fast.
- **Proving** (done here on the CPU): EZKL also has a **GPU proving backend**
  (the `icicle` CUDA feature) that accelerates the polynomial commitments for large
  circuits. This image runs CPU proving (fast for a small model); building EZKL with
  the `icicle` feature moves the proving onto the GPU too. The container is already
  GPU-enabled, so the same `--gpus all` runtime carries that path.

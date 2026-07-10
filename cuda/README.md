# Chapter 37 — Real CUDA from Rust

Unlike the rest of the corpus (which models GPU concepts in plain `std` Rust so it
runs anywhere), this folder runs an **actual CUDA kernel on an NVIDIA GPU from
Rust** and measures it against a CPU baseline. It is the real version of the
Chapter 37 challenge and solution.

- `src/bin/matmul_solution.rs` — complete: multiplies two N×N `f32` matrices on
  the GPU, times it against a cache-friendly CPU baseline, checks the results
  agree, and prints the speedup.
- `src/bin/matmul_challenge.rs` — the starter. The harness is done; the kernel's
  inner dot product is a `TODO`. As shipped it prints `correct = false`; finish
  the kernel and it flips to `true`.

How it works: the CUDA C kernel is a string compiled to PTX **at run time** by
NVRTC, then launched through [`cudarc`](https://crates.io/crates/cudarc) — one
GPU thread per output element. No `.cu` files and no build-time `nvcc` step.

## Requirements

- An NVIDIA GPU with a recent driver.
- **Docker** + the **NVIDIA Container Toolkit** (so the container can see the GPU).
  Verify with: `docker run --rm --gpus all nvidia/cuda:12.6.2-base-ubuntu22.04 nvidia-smi`
- Or, to run **without Docker**: the CUDA Toolkit (for NVRTC) + Rust, then
  `cargo run --release --bin matmul_solution`.

## Run it (Docker)

```bash
cd public/cuda
docker compose build                                   # installs Rust + cudarc into a CUDA image (one time)

docker compose run --rm cuda                           # solution, N = 1024
docker compose run --rm cuda matmul_solution 2048      # bigger matrix
docker compose run --rm cuda matmul_challenge          # starter — correct=false until you finish the kernel
```

If your Docker/Compose version doesn't pass the GPU through on `compose run`,
use the image directly (the Compose build still applies):

```bash
docker run --rm --gpus all rust-cuda-matmul                 # solution
docker run --rm --gpus all rust-cuda-matmul matmul_solution 2048
```

## Expected output

Numbers vary by GPU, driver, and matrix size; correctness does not. On an RTX
3080 Laptop GPU at N = 1024 the solution prints something like:

```
device     = NVIDIA GeForce RTX 3080 Laptop GPU
matrix     = 1024 x 1024 (f32)
cpu        = 116.3 ms
gpu kernel = 2.35 ms
gpu total  = 12.7 ms  (incl. host<->device copies)
speedup    = 49.4x kernel, 9.1x end-to-end
correct    = true
```

## The lesson

Two speedups are printed on purpose:

- **kernel** — GPU compute alone. This is the headline number (≈50× here): the
  naïve one-thread-per-element kernel already crushes a fair CPU baseline.
- **end-to-end** — including copying the inputs to the device and the result
  back. It is much smaller (≈9×) because, for a single O(N³) multiply, the
  O(N²) PCIe transfers are a real fraction of the wall clock.

That gap *is* the chapter's point: GPU wins are gated by the transfer budget.
Bigger N (more compute per byte moved) widens the end-to-end speedup; keeping
data resident on the device across many kernels removes the copies entirely.

## Completing the challenge

Open `src/bin/matmul_challenge.rs`, replace the `TODO` in the kernel with the
dot product:

```c
float acc = 0.0f;
for (int k = 0; k < N; ++k) acc += A[row * N + k] * B[k * N + col];
C[row * N + col] = acc;
```

Rebuild and run: `docker compose build && docker compose run --rm cuda matmul_challenge`.
`correct` becomes `true` and you get the same speedup as the solution.

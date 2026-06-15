# -*- coding: utf-8 -*-
"""Wire the real CUDA matmul challenge/solution (public/cuda/src/bin/*.rs) into the
Chapter 37 workbook lab and solutions book, replacing the old std-only
"safe launch wrapper" model. The .rs files stay the single source of truth.

Updates:
  * chapter_exercises.json  ch37.lab          -> the CUDA challenge (starter)
  * solout/ch37.json        labSolution       -> the CUDA solution + explanation

Both are marked as needing the CUDA toolchain (stdOnly = false); they build and
run via public/cuda/ (GPU Docker), not the plain std runner.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
CUDA = os.path.join(ROOT, "public", "cuda", "src", "bin")

challenge = open(os.path.join(CUDA, "matmul_challenge.rs"), encoding="utf-8").read().rstrip("\n")
solution = open(os.path.join(CUDA, "matmul_solution.rs"), encoding="utf-8").read().rstrip("\n")

SAMPLE_OUTPUT = (
    "device     = NVIDIA GeForce RTX 3080 Laptop GPU\n"
    "matrix     = 1024 x 1024 (f32)\n"
    "cpu        = 116.3 ms\n"
    "gpu kernel = 2.35 ms\n"
    "gpu total  = 12.7 ms  (incl. host<->device copies)\n"
    "speedup    = 49.4x kernel, 9.1x end-to-end\n"
    "correct    = true"
)

HELP = ("Real CUDA from Rust via cudarc + NVRTC — a GPU matrix-multiply timed against "
        "a fair CPU baseline. Build and run it with the GPU Docker project in "
        "`public/cuda/`: `docker compose run --rm cuda matmul_challenge`. The harness "
        "(device setup, CPU baseline, timing, correctness check) is complete; your job "
        "is the kernel's inner dot product. Until you write it the kernel returns zeros "
        "and `correct` prints false. Exact times vary by GPU; the speedup and the "
        "kernel-vs-end-to-end gap are the point.")

EXPLANATION = (
    "This is the real thing: a CUDA C kernel (a string compiled to PTX at run time by "
    "NVRTC) launched through cudarc with one GPU thread per output element, measured "
    "against a cache-friendly i-k-j CPU baseline.\n\n"
    "The kernel maps `row`/`col` from the 2-D block and grid indices, guards the N x N "
    "bounds, accumulates the dot product of A's row and B's column, and writes one "
    "C[row*N + col]. The host code copies A and B to the device, launches a 16x16-thread "
    "grid sized by `div_ceil(N, 16)`, synchronizes, and copies C back. It times the GPU "
    "two ways: the kernel alone, and the end-to-end path including the host<->device "
    "copies.\n\n"
    "Both numbers matter. The kernel speedup (~50x on an RTX 3080 at N=1024) is what the "
    "GPU is capable of; the end-to-end speedup (~9x) is what you actually get once the "
    "O(N^2) PCIe transfers are paid for around a single O(N^3) multiply. That gap is the "
    "chapter's transfer-budget lesson made concrete: GPU wins scale with compute done "
    "per byte moved, so larger matrices — or keeping data resident on the device across "
    "many kernels — widen the real-world win. The correctness check (max relative error "
    "below 1e-3) confirms the GPU and CPU agree to f32 precision."
)

# --- workbook lab (the challenge) ---
exf = os.path.join(HERE, "chapter_exercises.json")
EX = json.load(open(exf, encoding="utf-8"))
EX["ch37"]["lab"] = {
    "title": "Runnable lab · Real CUDA matmul from Rust — measure the GPU speedup",
    "filename": "matmul_challenge.rs",
    "runKey": "ch37_ex_cuda_matmul",
    "expectedOutput": SAMPLE_OUTPUT,
    "helperText": HELP,
    "initialCode": challenge,
}
json.dump(EX, open(exf, "w", encoding="utf-8"), ensure_ascii=False, indent=0)

# --- solutions book ---
solf = os.path.join(HERE, "solout", "ch37.json")
SOL = json.load(open(solf, encoding="utf-8"))
SOL["labSolution"] = {
    "solutionCode": solution,
    "expectedOutput": SAMPLE_OUTPUT,
    "explanation": EXPLANATION,
    "stdOnly": False,
}
json.dump(SOL, open(solf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("Wired CUDA matmul into ch37:")
print(f"  workbook lab initialCode: {len(challenge)} chars")
print(f"  solution solutionCode:    {len(solution)} chars")
print("  both marked stdOnly=false (build/run via public/cuda/ GPU Docker).")

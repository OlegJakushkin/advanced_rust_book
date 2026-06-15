# -*- coding: utf-8 -*-
"""Wire the real ONNX-on-GPU challenge/solution (public/onnx-gpu/src/bin/*.rs) into
the Chapter 54 workbook lab and solutions book, replacing the std-only softmax
model. The .rs files stay the single source of truth. Both are marked as needing
the GPU toolchain (stdOnly=false); they build/run via public/onnx-gpu/."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, ".."))
BIN = os.path.join(ROOT, "public", "onnx-gpu", "src", "bin")

challenge = open(os.path.join(BIN, "onnx_challenge.rs"), encoding="utf-8").read().rstrip("\n")
solution = open(os.path.join(BIN, "onnx_solution.rs"), encoding="utf-8").read().rstrip("\n")

SAMPLE = (
    "cpu        = 20.41 ms / inference\n"
    "gpu (cuda) = 1.25 ms / inference\n"
    "batch      = 128, model = 1024->4096->4096->4096->10 (f32)\n"
    "speedup    = 16.3x\n"
    "agree      = true"
)

HELP = ("Real ONNX Runtime inference from Rust on the GPU via the `ort` crate's CUDA "
        "execution provider, timed against the CPU provider. Build and run it with the "
        "GPU Docker project in `public/onnx-gpu/`: `docker compose run --rm onnx`. The "
        "harness loads the model, runs both providers, and checks they agree; your job "
        "in the challenge is to register the CUDA execution provider in `build()` so the "
        "GPU session actually runs on the device. Exact times vary by GPU.")

EXPLANATION = (
    "This runs a real ONNX model on the GPU. `ort` loads model.onnx into two sessions — "
    "one on the default CPU execution provider, one on the CUDA execution provider — runs "
    "the same batch through both, checks the outputs agree to f32 precision, and reports "
    "the per-inference speedup.\n\n"
    "The key line is registering the CUDA EP: "
    "`with_execution_providers([CUDAExecutionProvider::default().build().error_on_failure()])`. "
    "`error_on_failure()` matters — without it, ONNX Runtime silently falls back to CPU when "
    "the GPU provider can't load, and you would report a CPU number while believing it was the "
    "GPU. With it, the session refuses to run unless the CUDA EP is genuinely active.\n\n"
    "For a matmul-heavy MLP at batch 128, the CUDA EP runs the Gemm/Relu kernels on the device "
    "and is ~15-20x faster per inference than ONNX Runtime's (already well-optimized) CPU "
    "backend on an RTX 3080. The `agree = true` line confirms the GPU path computes the same "
    "result as the CPU path. This is the genuinely GPU-accelerated inference that Chapter 54's "
    "std-only examples can only model."
)

exf = os.path.join(HERE, "chapter_exercises.json")
EX = json.load(open(exf, encoding="utf-8"))
EX["ch54"]["lab"] = {
    "title": "Runnable lab · Real ONNX inference on the GPU from Rust — measure the speedup",
    "filename": "onnx_challenge.rs",
    "runKey": "ch54_ex_onnx_gpu",
    "expectedOutput": SAMPLE,
    "helperText": HELP,
    "initialCode": challenge,
}
json.dump(EX, open(exf, "w", encoding="utf-8"), ensure_ascii=False, indent=0)

solf = os.path.join(HERE, "solout", "ch54.json")
SOL = json.load(open(solf, encoding="utf-8"))
SOL["labSolution"] = {
    "solutionCode": solution,
    "expectedOutput": SAMPLE,
    "explanation": EXPLANATION,
    "stdOnly": False,
}
json.dump(SOL, open(solf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("Wired ONNX-GPU into ch54:")
print(f"  workbook lab initialCode: {len(challenge)} chars")
print(f"  solution solutionCode:    {len(solution)} chars")

# Advanced Rust — Code Corpus

This folder is the public root for the three books:

* **Advanced Rust** — the main book (114 runnable examples)
* **Advanced Rust · Exercise Workbook** — per-chapter exercises and labs
* **Advanced Rust · Answers & Solutions** — worked solutions to every exercise

Every code file the books reference lives here, organised so the folder can be
served as a website root or handed out as a self-contained bundle. A Docker
runner is included so you can **build and run any example, any workbook lab, or
any solution** with one command.

## Layout

```
public/
├── examples/    chNN_<slug>/<file>.rs   the 114 main-book Example listings
├── exercises/   chNN_<slug>/<file>.rs   the workbook lab STARTERS (incomplete on purpose)
├── solutions/   chNN_<slug>/<file>.rs   the completed, verified lab solutions
├── CODE_MANIFEST.json                   catalog of every file (status, crates, expected output)
├── docker-compose.yml                   the runner
├── docker/                              Dockerfile + run script + runner crate
└── README.md                            this file
```

Folder names match the book chapters, e.g.
`examples/ch10_arrays_slices_and_vectors/slice_first_api.rs`. The matching lab
starter and its solution share a filename across `exercises/` and `solutions/`,
so the diff between them is exactly the part the reader completes.

## What's in the corpus

| Folder | Files | Notes |
|---|---:|---|
| `examples/`  | 114 | every example is a standalone `fn main()` program |
| `exercises/` |  54 | lab starters; a couple are fix-the-bug stubs that do not compile until you finish them |
| `solutions/` |  54 | each completed solution compiles **and** prints the output shown in the book |

All 54 solutions and the standard-library examples were compiled with `rustc`
(edition 2021) and run; their output matches the books. The remaining files
need a specific toolchain, flagged per file in `CODE_MANIFEST.json` (`status`):

* `needs-crates` — uses an external crate (tokio, serde, rayon, crossbeam,
  anyhow, thiserror, tracing). The runner builds these with cargo automatically.
* `needs-edition-2024` — uses Rust 2024 FFI syntax (`#[unsafe(no_mangle)]`); the
  runner compiles these with `--edition 2024`.
* `needs-nightly` — opts into an unstable std feature.

## Real-GPU examples (NVIDIA hardware)

Three chapters ship a **real GPU example** in its own folder, each with a
GPU-enabled Docker setup (needs an NVIDIA GPU + the NVIDIA Container Toolkit).
Unlike the std-only corpus above (which *models* GPU/zk concepts so it runs
anywhere), these actually use the device:

| Folder | Chapter | What runs on the GPU |
|---|---|---|
| `cuda/`     | 37 — CUDA | a `cudarc` matrix-multiply kernel, vs a CPU baseline (~40x kernel speedup) |
| `onnx-gpu/` | 54 — ONNX | ONNX Runtime inference via `ort` + the CUDA execution provider, vs CPU (~15x) |
| `ezkl-gpu/` | 53 — EZKL | GPU inference (CUDA EP) **plus a real EZKL zero-knowledge proof** of the model (`verified: true`) |

```bash
cd public/cuda     && docker compose build && docker compose run --rm cuda
cd public/onnx-gpu && docker compose build && docker compose run --rm onnx
cd public/ezkl-gpu && docker compose build && docker compose run --rm ezkl
```

In the corpus, the ch37/ch54 lab files are flagged `needs-cuda` and the std runner
points you here instead of trying to build them without a GPU.

## Running anything (Docker)

You need Docker with the Compose plugin. From **this `public/` folder**:

```bash
# 1. Build the runner image once (installs Rust + caches crate dependencies)
docker compose build

# 2. Run any file — path is relative to this folder
docker compose run --rm runner examples/ch10_arrays_slices_and_vectors/slice_first_api.rs
docker compose run --rm runner solutions/ch09_smart_pointers_and_pinning/weak_parent_edge_lab.rs
docker compose run --rm runner exercises/ch10_arrays_slices_and_vectors/window_sum_lab.rs

# List everything, or one chapter
docker compose run --rm runner --list
docker compose run --rm runner --list ch22
```

The runner picks the right build path automatically:

* standard-library files → `rustc -O` and execute;
* files that use external crates or `async`/`await` → copied into a cargo
  project (in `docker/runner-Cargo.toml`) and `cargo run --release`;
* Rust 2024 syntax → `--edition 2024`; unstable features → the `nightly` toolchain.

### Special case

* `examples/ch29_*/wasm_bindgen_boundary.rs` targets **WebAssembly** via
  `wasm-bindgen`; build it with `wasm-pack`, not as a native binary. The runner
  prints a clear message and skips it rather than failing.

(The ONNX example in Chapter 54 models inference in plain std Rust and runs
normally — no ONNX Runtime install required.)

### One known discrepancy

`examples/ch27_io_tricks_and_systems_programming_patterns/buffered_bounded_pipeline.rs`
compiles and runs, but its output differs from the value printed in the book
(`CODE_MANIFEST.json` records what it actually prints under `actualOutput`).

## Running without Docker

If you have Rust installed locally you can skip Docker entirely:

```bash
# standard-library file
rustc --edition 2021 -O examples/ch04_ownership_borrowing_and_lifetimes/shared_and_mutable_borrows.rs -o /tmp/ex && /tmp/ex

# crate-dependent file: drop it into any cargo project's src/main.rs with the
# dependency added to Cargo.toml, then `cargo run`.
```

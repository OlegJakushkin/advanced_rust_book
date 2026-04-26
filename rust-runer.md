# Rust runner in the web version

## Short answer

The web version does **not** run a real Rust toolchain in the browser.

It does **not** invoke `rustc`.
It does **not** compile arbitrary Rust to WebAssembly on the fly.
It does **not** execute user code inside a real WASM sandbox.

Instead, the site uses a **TypeScript simulator and pattern-based checker** that understands the book examples and the practice labs.

---

## What we can run

The web app can run:

- the built-in chapter examples
- the guided practice cards
- the beach strategy lab
- a subset of common Rust syntax and compile-style mistakes

In practice, this means:

1. The editor accepts Rust-like code.
2. The site checks it with a lightweight frontend validator.
3. For supported labs, it matches the code against expected patterns.
4. It returns deterministic output for that specific example.

So the browser experience is:

- fast
- static-host friendly
- deterministic
- good for teaching and guided exercises

---

## What we cannot run

The web version cannot reliably run arbitrary Rust programs, especially programs that need:

- external crates resolved from Cargo
- real macro expansion
- build scripts
- file I/O
- sockets
- OS threads
- Tokio runtime behavior
- FFI
- MPI
- CUDA / GPU execution
- actual WASM host bindings
- true borrow-checker analysis
- true codegen or optimization

Many advanced chapters still show those topics, but in the browser they are represented by **teaching simulations**, not real execution.

---

## Do we compile Rust into WASM on the fly?

**No.**

We currently do **not** take the edited Rust source and compile it to WASM in the browser.

That means:

- no in-browser Cargo build
- no `rustc` pipeline
- no `wasm-bindgen` step
- no generated `.wasm` artifact from user edits

The site is a static Next.js app, and the Rust execution experience is implemented in app code, not via a live Rust compiler backend.

---

## Do we check errors?

**Yes, but heuristically, not with real rustc diagnostics.**

The main checker lives in:

- `components/rust-book/rust-simulator.ts`

And chapter/lab-specific output logic lives in files like:

- `components/rust-book/rust-simulator-ch09.ts`
- `components/rust-book/rust-simulator-ch24.ts`
- `components/rust-book/rust-simulator-ch54.ts`

The beach lab has its own custom strategy compiler/parser.

### What kinds of errors we check

The simulator can detect a useful subset of issues, such as:

- missing `main`
- unmatched delimiters
- unterminated strings
- incomplete assignments
- some missing semicolons
- some format-string mismatches
- some unknown values, functions, and types
- some undeclared lifetime names

These are **compiler-style** errors, but they are not produced by real `rustc`.

---

## How the beach strategy lab works

The beach strategy lab is also simulated.

It does **not** compile the strategy as real Rust.
It parses the strategy source and extracts supported logic.

Current support includes:

- the new trait/interface-based strategy style
- legacy builder-style saved snippets

The trait-based path expects a shape like:

- `trait BeachView`
- `trait CrabStrategy`
- `impl CrabStrategy for ...`
- `fn choose_action(&self, view: &dyn BeachView) -> Action`
- `fn strategy()`

The lab then compiles that into the game’s internal rule model and runs the simulation on the beach board.

---

## Why this design exists

This approach is intentional.

It gives us:

- zero backend requirement
- static export support
- predictable teaching outputs
- no heavy browser toolchain download
- no sandboxing complexity
- fast page loads

It is a **teaching runner**, not a production Rust execution environment.

---

## Accuracy model

You should think of the web runner as having 3 layers:

### 1. Editor UX
Syntax coloring, editing, revert, copy, run button.

### 2. Compiler-style validation
A lightweight parser catches common mistakes and returns rustc-like messages.

### 3. Example simulation
Each supported exercise has a deterministic evaluator that returns the expected output for valid solutions.

This works well for guided learning, but it is not a substitute for a real Rust toolchain.

---

## If you need real Rust execution

Use a normal Rust environment:

- `cargo check`
- `cargo test`
- `cargo run`
- `cargo clippy`

And for real browser/WASM work, use a real Rust+WASM toolchain such as:

- `wasm-pack`
- `wasm-bindgen`
- or a server-side build pipeline

---

## Recommended wording for users

A precise way to describe the web runner is:

> The web version uses a Rust-flavored teaching simulator with compiler-style checks. It does not compile arbitrary Rust to WASM on the fly.

That is the honest contract.

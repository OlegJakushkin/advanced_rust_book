# Rust for Senior Engineers

An interactive, static-exported book site for learning Rust the way senior engineers actually use it: through ownership, boundaries, performance tradeoffs, systems design, and production review habits.

It combines:

- a **Next.js + TypeScript** static site,
- a large **chaptered Rust curriculum**,
- **editable runnable examples** in the browser,
- **chapter exercises** and reference appendices,
- and a build flow that outputs a plain static site in `out/`.

---

## Table of Contents

- [What this project is](#what-this-project-is)
- [Core ideas behind the project](#core-ideas-behind-the-project)
- [What is inside](#what-is-inside)
- [Curriculum overview](#curriculum-overview)
- [Tech stack](#tech-stack)
- [Local development](#local-development)
- [Static build](#static-build)
- [Docker export to `out/`](#docker-export-to-out)
- [GitHub Pages deployment](#github-pages-deployment)
- [Repository layout](#repository-layout)
- [Why the project is structured this way](#why-the-project-is-structured-this-way)
- [Notes](#notes)

---

## What this project is

This repository hosts a browser-based reading experience for **Rust for Senior Engineers**.

The goal is not to be a toy Rust tutorial. It is meant to teach Rust in a way that respects how experienced engineers think:

- architecture first,
- ownership as design,
- performance as measured behavior,
- APIs as contracts,
- concurrency as explicit data movement,
- and unsafe code as something that must be reviewable.

The site is built so it can be deployed as a **fully static website**, including GitHub Pages.

---

## Core ideas behind the project

This project is built around a few strong teaching and engineering principles.

### 1. Ownership is the center of the language

Rust becomes much easier once ownership is treated as a design tool instead of as compiler friction.  
This book keeps returning to the same question:

> Who owns this value now, and who owns it after the next boundary?

### 2. Senior engineers need boundary-focused explanations

The material emphasizes places where Rust matters most in real systems:

- thread and task handoff,
- API seams,
- serialization boundaries,
- FFI,
- async cancellation,
- performance hotspots,
- deployment constraints,
- and proof / verification workflows.

### 3. Examples should stay runnable and reviewable

Each chapter is paired with small Rust examples and simulator-backed outputs so ideas stay concrete.  
The point is not to hide complexity. The point is to make the important shape visible.

### 4. Static deployment matters

The project is intentionally configured so the site can be exported into a plain static `out/` directory.  
That keeps hosting simple and makes GitHub Pages a first-class deployment target.

### 5. The book should scale with the content

The repository is organized to support:

- many chapters,
- exercises,
- appendices,
- example source files,
- simulator logic,
- and a future-friendly publishing workflow.

---

## What is inside

This project includes:

- **54 numbered chapters**
- **chapter exercise pages**
- **appendices and reference pages**
- **interactive code editors**
- **simulated Rust execution for guided examples**
- **example `.rs` files grouped by chapter**
- **a static export pipeline for publishing**

In short: this is both a **book** and a **publishable learning product**.

---

## Curriculum overview

The content spans a wide range of Rust topics.

### Foundations
- Why Rust feels different
- The Rust mental model
- Project structure and tooling
- Ownership, borrowing, and lifetimes
- Ownership inside structs and vectors
- Copy vs clone
- Unsafe Rust

### Core language and modeling
- Smart pointers and pinning
- Arrays, slices, vectors
- Hash maps and sets
- Matrices and multidimensional data
- Arena allocation
- Traits
- OOP models in Rust
- Domain-driven design
- Refactoring toward idiomatic Rust
- Generics
- Serialization
- Metaprogramming
- Reflection and type introspection

### Concurrency and systems
- Multithreading
- Synchronization primitives
- Futures and async Rust
- Tokio
- Task libraries and parallel execution
- IO patterns
- C++ integration
- JS / C++ / WASM integration
- Message brokers
- Distributed task execution
- MPI / HPC

### Performance and applied systems work
- Performance-oriented Rust
- Memory profiling
- Performance profiling
- Distributed profiling
- CUDA / GPU acceleration
- Merkle trees
- Graph search
- Matrix optimization

### Reliability, services, and deployment
- Error handling in large systems
- Testing advanced Rust systems
- Observability
- Packaging and deployment
- Distributed capstone
- OpenAPI / Swagger workflows
- gRPC / Protobuf
- WebSockets
- HTTPS / TLS
- libp2p systems

### Proof systems and constrained runtimes
- Zero-knowledge proofs
- ZoKrates workflows
- EZKL / verifiable LLM inference / ZKML
- `no_std` Rust and constrained runtime derivatives

---

## Tech stack

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **Lucide icons**
- **Static export build output**
- **Docker / Docker Compose** for reproducible export builds

---

## Local development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open the local app in your browser on the default Next.js port.

---

## Static build

This repository is configured for **static export**.

Build the site:

```bash
npm run build
```

After the build finishes, the generated static website will be available in:

```bash
out/
```

That folder is what you can:

- upload to a static host,
- publish to GitHub Pages,
- or preview with any static file server.

---

## Docker export to `out/`

To build the static site into the local `out/` folder with Docker Compose:

```bash
docker compose up --build
```

What this does:

- builds the site in a container,
- runs the static export,
- and copies the result into your local `./out` directory.

This is useful when you want a reproducible build without relying on a local Node environment.

---

## GitHub Pages deployment

This project is ready for GitHub Pages-style static hosting.

For detailed instructions, see:

- [`ghpgs.md`](./ghpgs.md)

That guide covers:

- local Pages-compatible builds,
- repo-name base path handling,
- manual deployment,
- and a GitHub Actions workflow example.

---

## Repository layout

High-level structure:

```text
app/
  page.tsx
  globals.css

components/
  rust-book/
    pages/
    rust-simulator*.ts
    table-of-contents.tsx
    types.ts
  rust-code-editor.tsx
  theme-*.tsx

examples/
  ch01_...
  ch02_...
  ...
  ch54_...

Dockerfile
docker-compose.yml
next.config.mjs
package.json
ghpgs.md
README.md
```

### Important areas

#### `components/rust-book/`
This is the heart of the book UI:

- chapter pages,
- exercise pages,
- page metadata,
- simulated execution,
- book state,
- and navigation.

#### `examples/`
These are chapter-aligned Rust example files kept as normal source artifacts.

#### `next.config.mjs`
Controls the static export behavior and GitHub Pages base path support.

#### `docker-compose.yml`
Exports the built site into the local `out/` folder.

---

## Why the project is structured this way

A book like this has two jobs:

1. **teach well**, and  
2. **publish cleanly**.

That is why the repo separates:

- content pages,
- editor behavior,
- simulator logic,
- and export / deployment configuration.

This keeps the project easier to evolve when:

- new chapters are added,
- exercises expand,
- more examples are introduced,
- or the publishing target changes.

---

## Notes

- `npm run build` produces a **static export**.
- `docker compose up --build` also produces a local static export in `out/`.
- GitHub Pages support is documented in [`ghpgs.md`](./ghpgs.md).
- Example Rust files live under `examples/` and mirror chapter topics.

If your goal is to read, extend, or publish the book, this repo is designed to make all three straightforward.

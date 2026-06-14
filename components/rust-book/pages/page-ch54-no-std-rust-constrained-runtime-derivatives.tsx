"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "no_std removes runtime assumptions, not language fundamentals",
    body: "Ownership, borrowing, pattern matching, traits, generics, and most of core Rust still exist. What changes is which runtime services are available by default: allocator, files, sockets, threads, environment access, and process-level conveniences.",
  },
  {
    title: "no_std is not the same thing as no allocation",
    body: "A crate can be `no_std` and still use `alloc` when the target or host provides a global allocator. Distinguish `core`-only, `alloc`-enabled, and full `std` surfaces deliberately.",
  },
  {
    title: "Target triples are runtime contracts",
    body: "A target triple is not only a compiler string. It implies ABI, linker expectations, panic strategy, startup code, and whether an operating system or host runtime exists at all.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "This is closest to writing against libc-free or freestanding environments, but Rust pushes harder on making allocation, panic, and ownership assumptions explicit instead of ambient.",
  },
  {
    title: "C# background",
    body: "The biggest shift is that there may be no default managed runtime services at all: no GC-backed heap by default, no reflection-heavy host, and no assumption that stdout, threads, or files even exist.",
  },
  {
    title: "Go background",
    body: "Go usually assumes one substantial runtime. `no_std` Rust asks you to design as if the runtime may be tiny, host-supplied, or deliberately absent beyond what you build yourself.",
  },
]

const foundationCards = [
  {
    title: "core",
    body: "Portable building blocks: slices, iterators, formatting traits, result and option types, arithmetic, and target-supported atomics.",
  },
  {
    title: "alloc",
    body: "Heap-backed containers such as `Vec`, `String`, `Box`, and often `Arc`, but only when an allocator exists and the crate chooses to depend on it.",
  },
  {
    title: "std",
    body: "OS and process conveniences: threads, files, paths, sockets, time, env, stderr/stdout, and richer synchronization primitives.",
  },
]

const useCaseCards = [
  {
    title: "Embedded, firmware, and bare metal",
    body: "Microcontrollers, board firmware, boot stages, and deterministic device control are classic no_std workloads, but they are only one family.",
  },
  {
    title: "Kernel-adjacent, hypervisor, and bootloader code",
    body: "Freestanding x86_64 or aarch64 code often wants `core` plus tightly controlled startup, memory, and ABI decisions without pulling in userspace assumptions.",
  },
  {
    title: "WASM and constrained guest runtimes",
    body: "Minimal wasm guests, plugin sandboxes, smart-contract-like runtimes, or policy engines often expose only a narrow host ABI and intentionally omit broad std services.",
  },
  {
    title: "Portable high-assurance libraries",
    body: "Some crates go `no_std` so the same parsing, crypto, or protocol logic runs in embedded, kernel, wasm, and server environments from one codebase.",
  },
]

const portabilityCards = [
  {
    title: "Optional std support",
    body: "Keep the core domain or parsing API in `core`, add `alloc`-gated helpers for owned buffers, and reserve `std` for transport or host integration.",
  },
  {
    title: "alloc-gated APIs",
    body: "A `no_std` crate can still expose owned convenience functions behind an `alloc` feature while keeping the smallest surface borrow-based and heap-free.",
  },
  {
    title: "Dependency hygiene",
    body: "Use `default-features = false` where needed and audit transitive dependencies aggressively. One casual `std`-only dependency can quietly collapse a portability story.",
  },
  {
    title: "Public API contracts",
    body: "State explicitly whether your crate is `core`-only, `alloc`-required, optional-std, or host-bound. That contract matters for downstream release engineering and CI.",
  },
]

const memoryCards = [
  {
    title: "Static buffers and fixed capacity",
    body: "Prefer stack, static, or fixed-capacity pools where the upper bound is real. This keeps memory failure local and explicit.",
  },
  {
    title: "Arenas and bump allocation",
    body: "Region allocation is useful when many values share one lifetime and can be reset together. It reduces allocator churn but keeps peak region size visible.",
  },
  {
    title: "Custom global allocators",
    body: "If the target provides a heap, you may still want a target-specific global allocator with explicit failure behavior and audit scope.",
  },
  {
    title: "Fallible allocation",
    body: "In constrained systems, `try_reserve`, `Option`, or `Result`-returning builders are often more honest than assuming every growth step succeeds.",
  },
]

const ownershipCards = [
  {
    title: "Zero-copy buffers",
    body: "Borrowed slices, view types, and token-based handles reduce copies and avoid fake lifetimes. This matters even more when memory is scarce or DMA is involved.",
  },
  {
    title: "DMA-style ownership transfer",
    body: "Give the peripheral or driver one owned slot handle, not an ambient mutable borrow into arbitrary memory. Returning the handle on completion makes authority explicit.",
  },
  {
    title: "Volatile memory and register abstractions",
    body: "Memory-mapped IO is not ordinary Rust memory. Use volatile access or vendor abstractions, keep unsafe blocks tiny, and document aliasing and ordering assumptions.",
  },
]

const embeddedCards = [
  {
    title: "PAC",
    body: "Peripheral Access Crates model raw registers and bitfields. They are close to the hardware and often the narrowest audited unsafe surface.",
  },
  {
    title: "HAL",
    body: "Hardware Abstraction Layers wrap PAC details into typed pin, timer, bus, and peripheral APIs that application code can use more safely.",
  },
  {
    title: "BSP",
    body: "Board Support Packages add board-specific pin maps, clocks, and wiring defaults on top of chip-level HALs.",
  },
  {
    title: "RTIC or Embassy-style async models",
    body: "These ecosystems structure interrupts, tasks, and async execution for embedded targets. They are examples of target ecosystems, not universal Rust behavior.",
  },
]

const ffiCards = [
  {
    title: "C and C++ ABI seams",
    body: "no_std Rust can still export or import C ABI functions, but you must keep layout, allocation, and panic policy explicit because there may be no std-backed repair path at runtime.",
  },
  {
    title: "Kernel, hypervisor, and host ABIs",
    body: "Freestanding code often talks to boot protocols, syscalls, hypercalls, or host imports through narrow, auditable ABI contracts.",
  },
  {
    title: "WASM host boundaries",
    body: "Minimal wasm guests often pass bytes, pointers, handles, or canonical ABI values to a host. `no_std` makes that boundary easier to model honestly because host services are already explicit.",
  },
]

const testingCards = [
  {
    title: "Host-side std tests",
    body: "A `no_std` library can still run much of its logic under ordinary host tests with `#[cfg(test)] extern crate std;` or feature-enabled test adapters.",
  },
  {
    title: "Simulation and emulation",
    body: "Device logic may need probe runners, QEMU, board harnesses, or hardware-in-the-loop tests. Keep those target-specific layers separate from portable logic tests.",
  },
  {
    title: "Fuzzing and property tests",
    body: "Parsers, protocol decoders, and buffer-state machines should still be fuzzed or property-tested on the host where tooling is richer and turnaround is faster.",
  },
  {
    title: "Debugging and profiling limits",
    body: "Constrained targets may have limited symbols, no allocator stats, and weaker tracing sinks. Plan with ring buffers, counters, or host-side mirrors where full profiling is unavailable.",
  },
]

const tradeoffCards = [
  {
    title: "Portability vs specialization",
    body: "A portable `core`-first crate is reusable across many runtimes, but target-specialized crates may deliver better ergonomics or performance for one board or host.",
  },
  {
    title: "Observability limits",
    body: "There may be no filesystem, stderr, or dynamic exporter. Observability often becomes counters, memory rings, serial output, host calls, or offline dumps.",
  },
  {
    title: "Binary size and linker scripts",
    body: "Panic strategy, LTO, target-specific startup objects, and linker scripts often matter more than in ordinary server builds. Keep those knobs versioned and reviewed.",
  },
  {
    title: "Reproducibility and release engineering",
    body: "Cross-compilation, target runners, panic mode, linker inputs, and optional allocator features belong in CI and packaging policy, not only in one developer workstation setup.",
  },
]

const pitfalls = [
  "Treating `no_std` as embedded-only and missing valid wasm, plugin, kernel-adjacent, or portable-library use cases.",
  "Confusing `no_std` with `no_alloc`. A target may support `alloc` perfectly well without supporting the full standard library.",
  "Letting one `std`-bound transitive dependency quietly collapse the portability contract.",
  "Reading or writing MMIO through normal references instead of volatile or audited wrapper access.",
  "Ignoring interrupt or DMA concurrency when choosing atomics, critical sections, or buffer ownership.",
  "Assuming host-like debugging, logging, or profiling facilities exist on the target when they do not.",
]

const summaryPoints = [
  "Distinguish `core`, `alloc`, and `std` explicitly; `no_std` does not automatically mean heapless.",
  "Use `no_std` for embedded, kernel-adjacent, wasm, plugin, and portable-library cases when runtime assumptions need to stay narrow.",
  "Design crates so the smallest useful API lives in `core`, owned helpers live behind `alloc`, and host integrations live behind `std` or target adapters.",
  "Constrained-memory design is usually about fixed capacity, fallible growth, token-based ownership transfer, and tiny audited unsafe surfaces.",
  "Testing, profiling, and release engineering for `no_std` crates work best when portable logic stays host-testable and target-specific behavior stays explicit.",
]

export function PageCh54NoStdRustConstrainedRuntimeDerivatives() {
  const {
    codes,
    updateCode,
    resetCode,
    outputs,
    setOutput,
    isRunning,
    setIsRunning,
    markPageComplete,
    setCurrentPage,
  } = useBook()

  const pageIndex = getPageIndexById("ch54-no-std-rust-constrained-runtime-derivatives")
  const chapter03PageIndex = getPageIndexById("ch03-project-structure-and-tooling")
  const chapter08PageIndex = getPageIndexById("ch08-undefined-behavior-and-unsafe-rust")
  const chapter28PageIndex = getPageIndexById("ch28-cpp-integration")
  const chapter29PageIndex = getPageIndexById("ch29-js-and-cpp-integration-for-wasm")
  const chapter44PageIndex = getPageIndexById("ch44-packaging-and-deployment")
  const exercisesPageIndex = getPageIndexById("ch54-no-std-rust-constrained-runtime-derivatives-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  const runCode = (key: string) => {
    setIsRunning(key)
    setTimeout(() => {
      const output = simulateRustExecution(codes[key], key)
      setOutput(key, output)
      setIsRunning(null)
    }, 650)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          Chapter 54 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Constrained targets need explicit runtime surfaces for allocation, panic handling, IO, startup, and host calls.
          This chapter covers no_std Rust as a portability and assurance strategy.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 03, 08, 28, 29, and 44</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 03 covered feature flags and dependency hygiene. Chapter 08 established how to audit small unsafe
                surfaces. Chapters 28 and 29 covered C/C++ and wasm host boundaries. Chapter 44 covered cross-target build
                and release engineering. This chapter recombines those ideas for `no_std` and constrained-runtime Rust.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter03PageIndex)}>
                Chapter 03
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter08PageIndex)}>
                Chapter 08
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter28PageIndex)}>
                Chapter 28
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter29PageIndex)}>
                Chapter 29
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter44PageIndex)}>
                Chapter 44
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A Rust component set must run across firmware, kernel-adjacent startup code, minimal Wasm guests, and ordinary
            Linux services. The business requirement is to declare the smallest runtime surface for each layer: core-only
            logic, alloc-gated ownership helpers, std-based host adapters, and explicit target build contracts.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">The runtime stack to keep in your head</div>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`core   -> language and portable primitives
alloc  -> owned heap-backed types when an allocator exists
std    -> OS/process/thread/fs/net/time conveniences

thumbv7em-none-eabihf   // microcontroller, no OS
x86_64-unknown-none     // freestanding or kernel-adjacent
wasm32-unknown-unknown  // minimal wasm guest runtime
aarch64-unknown-linux-gnu // full std userspace`}</code>
            </pre>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {mentalModelPoints.map((point) => (
              <div key={point.title} className="rounded-lg border border-border bg-card p-4">
                <h4 className="font-semibold text-foreground mb-2">{point.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              The `no_std` mental model: core, alloc, std, target triples, panic behavior, and runtime assumptions
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {foundationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <h5 className="font-medium text-foreground mb-2">A real crate-root pattern</h5>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`#![cfg_attr(not(feature = "std"), no_std)]
#[cfg(feature = "alloc")]
extern crate alloc;

pub fn checksum(bytes: &[u8]) -> u32 { /* core only */ }

#[cfg(feature = "alloc")]
pub fn encode_frame(bytes: &[u8]) -> alloc::vec::Vec<u8> { /* owned helper */ }

#[cfg(feature = "std")]
pub fn write_diagnostic(line: &str) -> std::io::Result<()> { /* host adapter */ }`}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h5 className="font-medium text-foreground mb-2">Panic and startup are part of the contract</h5>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  Some freestanding targets need custom panic handlers, startup glue, or linker scripts. Others rely on a
                  platform crate or host runtime to provide that layer. Do not assume one universal boot story.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              When `no_std` is appropriate: embedded, kernels, wasm guests, plugin runtimes, and portable high-assurance code
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {useCaseCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The important correction is simple: `no_std` is not a synonym for “microcontroller only.” It is a way to
                make runtime assumptions explicit enough that the same logic can survive several constrained hosts honestly.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Crate design for portability: feature flags, optional std support, alloc-gated APIs, and dependency hygiene
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {portabilityCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Senior rule of thumb: design the smallest truthful API first. If borrowed slices and fixed-capacity callers
                are enough, keep the surface in `core`. Add owned convenience only when the product boundary truly benefits
                from `alloc` or `std`.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Memory management without std: static buffers, arenas, custom allocators, heapless collections, and fallible growth
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {memoryCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="font-medium text-foreground mb-2">A fallible-growth mindset</div>
              <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`#[cfg(feature = "alloc")]
fn append_packet(buf: &mut Vec<u8>, bytes: &[u8]) -> Result<(), alloc::collections::TryReserveError> {
    buf.try_reserve(bytes.len())?;
    buf.extend_from_slice(bytes);
    Ok(())
}`}</code>
              </pre>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Ownership, lifetimes, and data layout in constrained systems: zero-copy, DMA, volatile memory, and registers
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {ownershipCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <h5 className="font-medium text-foreground mb-2">Token-style DMA ownership</h5>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`struct TxSlot(usize);

fn submit_to_dma(slot: TxSlot) {
    // the peripheral now owns this slot until completion
}`}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <h5 className="font-medium text-foreground mb-2">Tiny MMIO unsafe surface</h5>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`use core::ptr::{read_volatile, write_volatile};

struct Register(*mut u32);

impl Register {
    fn read(&self) -> u32 {
        unsafe { read_volatile(self.0) }
    }

    fn write(&self, value: u32) {
        unsafe { write_volatile(self.0, value) }
    }
}`}</code>
                </pre>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Embedded Rust layering: PAC, HAL, BSP, RTIC or Embassy-style execution, interrupts, and critical sections
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {embeddedCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="font-medium text-foreground mb-2">Layering shorthand</div>
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`PAC -> raw register access
HAL -> typed peripheral APIs
BSP -> board defaults and wiring
app -> tasks, interrupts, protocols, drivers`}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground leading-6">
                Interrupt safety usually combines ownership discipline with either atomics or a critical-section model. Do
                not assume a `Mutex` from std exists, and do not assume an interrupt boundary behaves like a thread boundary.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              FFI and ABI boundaries for `no_std` code: C, C++, kernels, hypervisors, and wasm hosts
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {ffiCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                Keep panic and allocation policy explicit at the ABI seam. A freestanding or host-constrained caller cannot
                safely consume an implicit unwind or an unexpected heap contract.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Testing, simulation, debugging, fuzzing, and profiling `no_std` crates from a host-side std environment
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {testingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h5 className="font-medium text-foreground mb-2">A host-testable pattern</h5>
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`#![no_std]
#[cfg(test)]
extern crate std;

pub fn checksum(bytes: &[u8]) -> u32 {
    bytes.iter().map(|&b| b as u32).sum()
}

#[cfg(test)]
mod tests {
    use super::checksum;

    #[test]
    fn host_fixture_matches() {
        assert_eq!(checksum(&[1, 2, 3]), 6);
    }
}`}</code>
              </pre>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Safety boundaries: unsafe, atomics, MMIO, interrupt concurrency, panic handlers, and audit checklists
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>State the invariant before the unsafe block: valid register address, valid buffer slot, or valid FFI pointer contract.</li>
              <li>Use atomics only when the target supports them and the interrupt or multi-core memory model is actually understood.</li>
              <li>Never treat memory-mapped registers like normal Rust references with ordinary aliasing and optimization rules.</li>
              <li>Keep panic behavior explicit: abort, custom panic handler, or host-defined trap semantics.</li>
              <li>Audit custom allocators, linker scripts, startup objects, and boundary layout attributes as part of the release surface.</li>
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Production tradeoffs: portability, specialization, observability, binary size, linker scripts, and release engineering
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {tradeoffCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Production patterns</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Keep the smallest cross-target logic in `core`, then add `alloc` or `std` at explicit adapter boundaries
                instead of letting the runtime surface spread inward accidentally.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Prefer fixed-capacity or fallible-memory paths where bounds are real, and make buffer ownership transfer
                explicit for peripherals, DMA, or host ABI handoff.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Separate host-side tests from target-specific tests so the portable logic stays fast to validate even when
                device or guest runtime harnesses are slower.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Treat linker scripts, panic mode, startup, allocator choice, and target runners as part of the release
                contract, not only as build-system trivia.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Pitfalls and tradeoffs</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {pitfalls.map((pitfall) => (
              <div key={pitfall} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">{pitfall}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="h-5 w-5 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The common senior mistake is not unsafe syntax. It is an unspoken runtime assumption: assuming an allocator,
                assuming logs exist, assuming unwind exists, or assuming one dependency will behave the same across all targets.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: a portable crate surface split across core, alloc, and std</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The smallest API stays slice-based. Owned helpers are alloc-gated. Host diagnostics stay std-gated. This
                  is the shape to prefer before a library accidentally commits to a wider runtime than it needs.
                </p>
              </div>
              {codes.no_std_portable_surface !== DEFAULT_CODES.no_std_portable_surface && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("no_std_portable_surface")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.no_std_portable_surface}
              onChange={(newCode) => updateCode("no_std_portable_surface", newCode)}
              onRun={() => runCode("no_std_portable_surface")}
              output={outputs.no_std_portable_surface ?? null}
              isRunning={isRunning === "no_std_portable_surface"}
              filename="portable_surface.rs"
              expectedOutput={"portable modes = core|alloc|std\nchecksum = 6\nalloc-gated api = encode_frame"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.no_std_portable_surface}
              onRevert={() => resetCode("no_std_portable_surface")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">core-only contract</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `checksum` depends only on slices and integers, so it stays portable across firmware, wasm, kernels, and servers.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">alloc-gated helper</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `encode_frame` is an owned convenience API, not the baseline contract every target must support.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">std adapter</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Host formatting or IO belongs at the edge so constrained targets do not inherit it accidentally.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: fixed-capacity buffer ownership with a DMA-style slot handle</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This example uses no heap at all. Allocation is fallible, slots are explicit, and release is visible.
                  That is often calmer than pretending a constrained runtime can always grow another queue.
                </p>
              </div>
              {codes.no_std_fixed_capacity_dma !== DEFAULT_CODES.no_std_fixed_capacity_dma && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("no_std_fixed_capacity_dma")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.no_std_fixed_capacity_dma}
              onChange={(newCode) => updateCode("no_std_fixed_capacity_dma", newCode)}
              onRun={() => runCode("no_std_fixed_capacity_dma")}
              output={outputs.no_std_fixed_capacity_dma ?? null}
              isRunning={isRunning === "no_std_fixed_capacity_dma"}
              filename="fixed_capacity_dma.rs"
              expectedOutput={"in_use = 1\noverflow = true\nsent bytes = 3"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.no_std_fixed_capacity_dma}
              onRevert={() => resetCode("no_std_fixed_capacity_dma")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Fixed memory budget</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Capacity is part of the type, not a loose operational hope.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Fallible allocation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `Option<SlotId>` makes exhaustion explicit and easy to test under load or device stress.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Ownership handoff</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The slot handle is the authority token. That is the same pattern many DMA, queue, and driver APIs want.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch54_no_std_rust_constrained_runtime_derivatives/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to decide when a component should be `std`, `alloc`-only, or `no_std`,
            convert a std-bound API into a portable crate surface, design a fixed-capacity data path, and audit one unsafe
            MMIO or interrupt boundary with host-side tests in mind.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 54 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {summaryPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
````

### File: `components/rust-book/pages/page-ch54-no-std-rust-constrained-runtime-derivatives-exercises.tsx`
```tsx
"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { Button } from "@/components/ui/button"
import { RustPracticeCard } from "../rust-practice-card"

interface Exercise {
  number: number
  kind: string
  title: string
  objective: string
  starterPrompt: string
  prompts?: string[]
  acceptanceCriteria: string[]
  hints: string[]
}

const exercises: Exercise[] = [
  {
    number: 1,
    kind: "warm-up comprehension",
    title: "Choose std, alloc-only, or no_std from the actual runtime contract",
    objective: "Practice classifying components by runtime assumptions instead of by habit or team folklore.",
    starterPrompt:
      "Classify five components: a pure checksum crate, a ring-buffer telemetry queue, a browser wasm guest, a Linux daemon with file and socket IO, and a microcontroller driver that talks to a DMA engine.",
    prompts: [
      "Which component is truly `core`-only?",
      "Which component needs owned heap-backed helpers but not the full standard library?",
      "Which component clearly wants full `std` because OS services are part of the job?",
      "Which component wants a host-specific adapter around a portable core instead of one monolithic crate surface?",
    ],
    acceptanceCriteria: [
      "You distinguish at least one `std`, one `alloc`-only, and one `core`-only component clearly.",
      "You justify the classification from runtime services such as heap, OS IO, or host ABI rather than from target buzzwords alone.",
      "You explicitly avoid treating `no_std` as embedded-only.",
    ],
    hints: [
      "Start from what the caller needs: heap, files, sockets, interrupts, or none of them.",
      "If the component's real job is pure computation over borrowed input, it may not need much runtime at all.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Strip std leakage out of a portable crate surface",
    objective: "Read one API and explain which parts belong in core, which belong behind alloc, and which belong behind std adapters.",
    starterPrompt:
      "A crate currently returns `String` from every parser helper, logs through `std::io::Write`, and pulls one std-bound dependency into a library that should also run in firmware and wasm guests.",
    prompts: [
      "Which APIs could return borrowed slices, fixed-capacity values, or caller-provided buffers instead?",
      "Which helpers deserve an `alloc` feature because owned convenience is real but not fundamental?",
      "Which logic should stay in a host-only `std` adapter crate or module?",
      "Which dependency check would you add before claiming the crate is portable?",
    ],
    acceptanceCriteria: [
      "You move at least one API from unconditional `std` assumptions toward `core` or `alloc` honestly.",
      "You identify one host-only adapter boundary explicitly.",
      "You mention dependency hygiene, such as `default-features = false` or a transitive `std` audit.",
    ],
    hints: [
      "The calm repair usually starts by shrinking the public API, not by adding more cfg branches everywhere.",
      "A parser and a logger rarely deserve the same portability contract.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Design a fixed-capacity data path with explicit ownership handoff",
    objective: "Implement a small static pool or ring buffer where allocation failure and release are visible in the type system.",
    starterPrompt:
      "Build a fixed-capacity packet or frame pool where producers allocate one slot, hand the slot to a consumer or DMA boundary, and later release it.",
    prompts: [
      "Keep capacity in the type, not in a hidden runtime global.",
      "Make slot acquisition fallible with `Option` or `Result`.",
      "Use a token or handle instead of borrowed references that outlive the allocation call.",
      "Expose one read-only view method for the currently owned bytes.",
    ],
    acceptanceCriteria: [
      "The implementation uses fixed capacity and a fallible allocation path.",
      "Ownership transfer is modeled with a handle or token rather than with long-lived mutable borrows.",
      "Release is explicit and reviewable.",
      "The runnable lab prints the expected first length, overflow status, and available-slot count.",
    ],
    hints: [
      "This is the same design pressure many DMA and driver APIs have: make authority explicit.",
      "A slot handle is often calmer than a reference once work can outlive the caller frame.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Audit an unsafe no_std boundary around MMIO, interrupts, or custom allocation",
    objective: "Turn one vague unsafe region into an auditable boundary with explicit invariants and concurrency assumptions.",
    starterPrompt:
      "You inherit a register-access wrapper that uses raw pointers directly from application code, shares state with an interrupt handler, and never documents whether volatile access or atomics are required.",
    prompts: [
      "What invariant belongs above every unsafe read or write?",
      "Which access should become volatile rather than ordinary dereference?",
      "Where would a critical-section boundary or an atomic be more honest than one ordinary mutable reference?",
      "What small host-side or simulation test could still exercise the safe wrapper logic?",
    ],
    acceptanceCriteria: [
      "You name at least one explicit unsafe invariant.",
      "You identify one place where volatile access or a vendor register wrapper is required.",
      "You describe one interrupt-concurrency repair such as critical sections or atomics.",
      "You include one test or simulation idea that still validates the safe layer.",
    ],
    hints: [
      "The goal is not to eliminate every unsafe block. It is to make each one small and justified.",
      "Interrupt concurrency is not the same thing as ordinary thread scheduling, but it still needs a memory model.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Build a host-side testing, fuzzing, and profiling plan for a no_std crate",
    objective: "Keep portable logic easy to validate on the host while still respecting target-specific debug limits.",
    starterPrompt:
      "You own a `no_std` parser and protocol crate used in firmware, wasm guests, and Linux services. The target devices have weak debug output and limited profiling support.",
    prompts: [
      "Which tests should run as ordinary host-side std tests?",
      "Which parts deserve fuzzing or property testing before they ever hit hardware?",
      "Which target-specific checks still need emulator, QEMU, or hardware-in-the-loop coverage?",
      "Which counters or ring-buffer diagnostics would you add when stdout and files are unavailable?",
    ],
    acceptanceCriteria: [
      "You define at least one host-side logic test layer and one target-specific integration layer.",
      "You include fuzzing or property testing for a hostile boundary such as a parser or state machine.",
      "You mention one constrained-target observability technique such as counters, serial output, or ring buffers.",
    ],
    hints: [
      "The host can do far more work for you than the target can. Use it.",
      "If a parser bug is discoverable on the host, do not wait for a board lab to find it.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Decide whether a production component should be std, alloc-only, or no_std",
    objective: "Make one deployment and release decision with explicit tradeoffs around portability, binary size, observability, and engineering cost.",
    starterPrompt:
      "You are designing a telemetry agent, a kernel-adjacent parser library, a wasm plugin, and a board driver. The organization wants as much code reuse as possible but not at any maintenance cost.",
    prompts: [
      "Which component should stay full `std` because the runtime services are a feature, not a liability?",
      "Which component should be split into portable core plus host adapters?",
      "Which component should stay `alloc`-only or `core`-only because portability is central to its value?",
      "Which release-engineering or CI lanes would prove the chosen target matrix stays healthy over time?",
    ],
    acceptanceCriteria: [
      "You assign each component to a plausible runtime surface with a reason.",
      "You mention at least one tradeoff involving binary size, observability, host features, or maintenance cost.",
      "You include at least one CI or packaging implication such as cross-target smoke tests or feature-matrix lanes.",
    ],
    hints: [
      "Code reuse is valuable only when the runtime contract stays honest.",
      "One repository can legitimately ship several runtime surfaces if the boundaries stay clear.",
    ],
  },
]

const reviewQuestions = [
  "What practical difference separates `core`, `alloc`, and `std` in a Rust crate contract?",
  "Why is `no_std` not the same thing as heapless?",
  "Why are token or handle-based ownership transfers often calmer than borrows in DMA-style or queue-style designs?",
  "What should be audited first when a `no_std` crate contains unsafe MMIO or FFI boundaries?",
  "Why are host-side std tests such a strong default for validating portable `no_std` logic?",
]

const workingLoop = [
  "State the smallest honest runtime surface first: core, alloc, or std.",
  "Keep owned convenience and host integration outside the minimal surface until they are justified.",
  "Use fixed-capacity or fallible-memory designs where the budget is real.",
  "Document unsafe invariants before tuning performance or hardware details.",
  "Test portable logic on the host, then add target-specific runners only where the hardware contract changes.",
]

export function PageCh54NoStdRustConstrainedRuntimeDerivativesExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch54-no-std-rust-constrained-runtime-derivatives-exercises")
  const mainPageIndex = getPageIndexById("ch54-no-std-rust-constrained-runtime-derivatives")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 54 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice `no_std` design the way it survives review: explicit runtime contracts, fixed-capacity or fallible memory,
          tiny unsafe surfaces, and host-testable logic even when the final target is constrained.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a runtime-boundary review. The strongest answer does not stop at “make it no_std.”
                It says which layer belongs in core, which helpers require alloc, which adapter needs std or a host ABI,
                and how memory failure or unsafe access stays explicit.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 54
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Suggested working loop</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            {workingLoop.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="grid gap-4">
          {exercises.map((exercise) => (
            <article key={exercise.number} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 flex-col md:flex-row md:items-center mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">
                    Exercise {exercise.number} · {exercise.kind}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{exercise.title}</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  no_std drill
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Objective</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{exercise.objective}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Starter prompt</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{exercise.starterPrompt}</p>
                  {exercise.prompts?.length ? (
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                      {exercise.prompts.map((prompt) => (
                        <li key={prompt}>{prompt}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <h4 className="font-medium text-foreground mb-2">Acceptance criteria</h4>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {exercise.acceptanceCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </div>

              <details className="mt-4 rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer list-none flex items-center gap-2 font-medium text-foreground">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Optional hints
                </summary>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {exercise.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </section>

        <RustPracticeCard
          title="Runnable lab · Fixed-capacity DMA pool"
          description={
            <>
              Repair the starter so slot allocation is fallible, viewing a slot returns the right byte slice, and releasing
              a slot returns capacity to the pool. The checker expects the exact output below.
            </>
          }
          filename="fixed_capacity_dma_lab.rs"
          runKey="ch54_ex_dma_pool"
          expectedOutput={"first len = 3\noverflow = true\navailable = 1"}
          helperText={
            <>
              Tip: copy the bytes into the first free slot, record the length, return a{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">SlotId</code>, and make{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">release</code> clear the used flag so the
              capacity becomes visible again.
            </>
          }
          initialCode={`#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct SlotId(usize);

struct Pool<const SLOTS: usize, const BYTES: usize> {
    used: [bool; SLOTS],
    lens: [usize; SLOTS],
    data: [[u8; BYTES]; SLOTS],
}

impl<const SLOTS: usize, const BYTES: usize> Pool<SLOTS, BYTES> {
    const fn new() -> Self {
        Self {
            used: [false; SLOTS],
            lens: [0; SLOTS],
            data: [[0; BYTES]; SLOTS],
        }
    }

    fn alloc_copy(&mut self, _bytes: &[u8]) -> Option<SlotId> {
        None
    }

    fn view(&self, _id: SlotId) -> &[u8] {
        &[]
    }

    fn release(&mut self, _id: SlotId) {}

    fn available(&self) -> usize {
        self.used.iter().filter(|&&used| !used).count()
    }
}

fn main() {
    let mut pool = Pool::<2, 8>::new();

    let first = pool.alloc_copy(b"abc").unwrap();
    let _second = pool.alloc_copy(b"xy").unwrap();
    let overflow = pool.alloc_copy(b"zzz").is_none();

    pool.release(first);

    println!("first len = {}", pool.view(first).len());
    println!("overflow = {}", overflow);
    println!("available = {}", pool.available());
}`}
        />

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Review questions</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {reviewQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">What success looks like</h3>
          <p className="text-sm text-muted-foreground leading-6">
            By the end of this page, you should be able to choose the right runtime surface for a production component,
            refactor a std-bound crate into a more portable shape, design a fixed-capacity or fallible memory path, audit
            one unsafe constrained-runtime boundary, and explain how host-side testing still supports `no_std` development
            without pretending the target behaves like a server.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch54_no_std_rust_constrained_runtime_derivatives/portable_surface.rs`
````
#[cfg(feature = "alloc")]
extern crate alloc;

#[cfg(feature = "alloc")]
use alloc::vec::Vec;

fn checksum(bytes: &[u8]) -> u32 {
    bytes.iter().map(|&byte| byte as u32).sum()
}

#[cfg(feature = "alloc")]
fn encode_frame(tag: u8, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(payload.len() + 1);
    out.push(tag);
    out.extend_from_slice(payload);
    out
}

#[cfg(feature = "std")]
fn write_diagnostic(service: &str, checksum: u32) -> String {
    format!("{}:{}", service, checksum)
}

fn main() {
    let payload = [1_u8, 2, 3];
    let sum = checksum(&payload);

    println!("portable modes = core|alloc|std");
    println!("checksum = {}", sum);
    println!("alloc-gated api = encode_frame");
}
````

### File: `examples/ch54_no_std_rust_constrained_runtime_derivatives/fixed_capacity_dma.rs`
````
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct SlotId(usize);

struct Pool<const SLOTS: usize, const BYTES: usize> {
    used: [bool; SLOTS],
    lens: [usize; SLOTS],
    data: [[u8; BYTES]; SLOTS],
}

impl<const SLOTS: usize, const BYTES: usize> Pool<SLOTS, BYTES> {
    const fn new() -> Self {
        Self {
            used: [false; SLOTS],
            lens: [0; SLOTS],
            data: [[0; BYTES]; SLOTS],
        }
    }

    fn alloc_copy(&mut self, bytes: &[u8]) -> Option<SlotId> {
        if bytes.len() > BYTES {
            return None;
        }

        let mut index = 0;
        while index < SLOTS {
            if !self.used[index] {
                self.used[index] = true;
                self.lens[index] = bytes.len();
                self.data[index][..bytes.len()].copy_from_slice(bytes);
                return Some(SlotId(index));
            }
            index += 1;
        }

        None
    }

    fn as_slice(&self, id: SlotId) -> &[u8] {
        &self.data[id.0][..self.lens[id.0]]
    }

    fn release(&mut self, id: SlotId) {
        self.used[id.0] = false;
        self.lens[id.0] = 0;
    }

    fn in_use(&self) -> usize {
        self.used.iter().filter(|&&used| used).count()
    }
}

fn main() {
    let mut pool = Pool::<2, 8>::new();

    let first = pool.alloc_copy(b"abc").unwrap();
    let _second = pool.alloc_copy(b"rust").unwrap();
    let overflow = pool.alloc_copy(b"more").is_none();
    let sent_bytes = pool.as_slice(first).len();

    pool.release(first);

    println!("in_use = {}", pool.in_use());
    println!("overflow = {}", overflow);
    println!("sent bytes = {}", sent_bytes);
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -103,4 +103,6 @@ export { PageCh50Libp2pPeerToPeerRustSystemsExercises } from "./page-ch50-libp2
 export { PageCh51ZeroKnowledgeProofsRustEngineers } from "./page-ch51-zero-knowledge-proofs-rust-engineers"
 export { PageCh51ZeroKnowledgeProofsRustEngineersExercises } from "./page-ch51-zero-knowledge-proofs-rust-engineers-exercises"
 export { PageCh52ZoKratesWorkflowsAndEthereumVerifiers } from "./page-ch52-zokrates-workflows-ethereum-verifiers"
 export { PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises } from "./page-ch52-zokrates-workflows-ethereum-verifiers-exercises"
+export { PageCh54NoStdRustConstrainedRuntimeDerivatives } from "./page-ch54-no-std-rust-constrained-runtime-derivatives"
+export { PageCh54NoStdRustConstrainedRuntimeDerivativesExercises } from "./page-ch54-no-std-rust-constrained-runtime-derivatives-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -114,6 +114,8 @@ import {
   PageCh51ZeroKnowledgeProofsRustEngineersExercises,
   PageCh52ZoKratesWorkflowsAndEthereumVerifiers,
   PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises,
+  PageCh54NoStdRustConstrainedRuntimeDerivatives,
+  PageCh54NoStdRustConstrainedRuntimeDerivativesExercises,
   PageCh53EzklVerifiableLlmInferenceGpuZkml,
   PageCh53EzklVerifiableLlmInferenceGpuZkmlExercises,
 } from "./pages"
@@ -223,6 +225,8 @@ const PAGE_COMPONENTS = [
   PageCh51ZeroKnowledgeProofsRustEngineersExercises,
   PageCh52ZoKratesWorkflowsAndEthereumVerifiers,
   PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises,
+  PageCh54NoStdRustConstrainedRuntimeDerivatives,
+  PageCh54NoStdRustConstrainedRuntimeDerivativesExercises,
   PageCh53EzklVerifiableLlmInferenceGpuZkml,
   PageCh53EzklVerifiableLlmInferenceGpuZkmlExercises,
 ]
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh54Output } from "./rust-simulator-ch54"
 import { simulateCh53Output } from "./rust-simulator-ch53"
 import { simulateCh52Output } from "./rust-simulator-ch52"
 import { simulateCh51Output } from "./rust-simulator-ch51"
@@ -1031,6 +1032,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch54Output = simulateCh54Output(code, key)
+  if (ch54Output !== null) return ch54Output
 
   const ch53Output = simulateCh53Output(code, key)
   if (ch53Output !== null) return ch53Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -42,6 +42,7 @@ import { DEFAULT_CODES_CH49 } from "./default-codes-ch49"
 import { DEFAULT_CODES_CH50 } from "./default-codes-ch50"
 import { DEFAULT_CODES_CH51 } from "./default-codes-ch51"
 import { DEFAULT_CODES_CH52 } from "./default-codes-ch52"
+import { DEFAULT_CODES_CH54 } from "./default-codes-ch54"
 import { DEFAULT_CODES_CH53 } from "./default-codes-ch53"
 
 export interface PageConfig {
@@ -1311,6 +1312,28 @@ export const CHAPTERS: ChapterConfig[] = [
         description:
           "Classify public and private inference material, design proving and verification service seams, and profile GPU-backed ZKML pipelines",
         icon: "trophy",
+      },
+    ],
+  },
+  {
+    id: "ch54-no-std-rust-constrained-runtime-derivatives",
+    title: "Chapter 54 · no-std Rust and Constrained Runtime Derivatives",
+    icon: "book",
+    pages: [
+      {
+        id: "ch54-no-std-rust-constrained-runtime-derivatives",
+        title: "no-std Rust and Constrained Runtime Derivatives",
+        shortTitle: "no_std Rust",
+        description:
+          "core, alloc, and std boundaries; portable crate design; fixed-capacity memory; DMA and MMIO ownership; embedded layering; FFI; and host-testable constrained-runtime Rust",
+        icon: "book",
+        codeKeys: ["no_std_portable_surface", "no_std_fixed_capacity_dma"],
+      },
+      {
+        id: "ch54-no-std-rust-constrained-runtime-derivatives-exercises",
+        title: "Chapter 54 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Choose std vs alloc vs no_std, design fixed-capacity data paths, audit constrained-runtime unsafe boundaries, and plan host-side testing",
+        icon: "trophy",
       },
     ],
   },
@@ -1807,5 +1830,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH50,
   ...DEFAULT_CODES_CH51,
   ...DEFAULT_CODES_CH52,
+  ...DEFAULT_CODES_CH54,
   ...DEFAULT_CODES_CH53,
 }
 export interface BookState {
````
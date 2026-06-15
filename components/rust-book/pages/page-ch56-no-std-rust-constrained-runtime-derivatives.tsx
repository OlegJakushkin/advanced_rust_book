"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "no_std removes runtime services, not the language",
    body: "Ownership, borrowing, pattern matching, traits, generics, iterators, and the great majority of the type system are untouched. The `#![no_std]` attribute only severs the implicit dependency on the standard library. What you give up is the bundle of runtime services std assumes is present: a global allocator, files, sockets, threads, environment variables, and process-level conveniences. You write the same Rust; you just cannot reach for `std::` when those services may not exist.",
  },
  {
    title: "no_std is not the same as no allocation",
    body: "This is the single most common misconception. A crate can be `no_std` and still allocate freely the moment the target provides a global allocator and the crate opts into the `alloc` crate. `alloc` gives you `Vec`, `String`, `Box`, and `Arc` without dragging in files, sockets, or threads. Treat core-only, alloc-enabled, and full-std as three distinct surfaces and choose between them on purpose.",
  },
  {
    title: "The target triple is a runtime contract",
    body: "A string like `thumbv7em-none-eabihf` is not just a compiler flag. The `none` in the middle means there is no operating system underneath you. The triple decides the ABI, what the linker expects, whether unwinding exists, how the program starts, and whether anything at all is there to catch a panic. Reading the triple tells you which of core, alloc, and std you are even allowed to assume.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already know freestanding builds: -ffreestanding, -nostdlib, custom crt0, your own operator new. Rust formalizes what was ad hoc. Instead of a compiler flag plus tribal knowledge about which headers are safe, the allocator, the panic handler, and the entry point become declared items the compiler refuses to let you forget. The trap is assuming \"no std means no heap\" the way -nostdlib often implies it; in Rust the heap is a separate, opt-in crate.",
  },
  {
    title: "C# background",
    body: "Your entire mental model assumes a managed runtime is always underneath you: a GC heap, the JIT, reflection, a thread pool, the BCL. In no_std there may be none of that. There is no ambient allocator, no Console, possibly no threads, and a panic may simply halt the core. The shift is to stop treating runtime services as a law of physics and start treating each one as a capability you must prove is present before you depend on it.",
  },
  {
    title: "Go background",
    body: "Go ships one large, non-negotiable runtime: goroutine scheduler, GC, channels, netpoller. no_std Rust is the opposite philosophy. You design as though the runtime is whatever you build plus whatever the host hands you, and nothing more. Goroutine-style concurrency is replaced by explicit interrupt handlers, async executors you choose, or cooperative state machines. There is no `go func` because there is no scheduler unless you brought one.",
  },
  {
    title: "Python background",
    body: "Relevant when you compile portable logic to a tiny wasm guest or an embeddable engine. Forget the import-anything assumption: there is no interpreter, no GIL, no dynamic allocation \"for free,\" and often no print. The mental shift is from \"the runtime does the bookkeeping\" to \"I declare a narrow byte-and-handle ABI across the host boundary, and everything beyond it is mine to manage.\"",
  },
]

const foundationCards = [
  {
    title: "core — always available",
    body: "The portable heart of the language, free of any runtime dependency. Slices, iterators, the formatting traits, Option and Result, arithmetic, ordering, and target-supported atomics all live here. Every Rust program already uses core; std itself is built on top of it. If your logic only needs core, it compiles for a microcontroller, a kernel, a wasm guest, and a server from one source.",
  },
  {
    title: "alloc — needs a heap",
    body: "Adds owned, heap-backed containers: Vec, String, Box, Rc, and on suitable targets Arc. It depends on nothing but core plus one thing you must supply: a global allocator. The moment a target has a heap and you write extern crate alloc, you get dynamic collections back without inheriting files, sockets, or threads from std.",
  },
  {
    title: "std — needs an OS",
    body: "The full standard library: threads, files, paths, sockets, system time, environment access, stdout and stderr, process control, and the richer synchronization primitives like std::sync::Mutex. It assumes an operating system and a hosted runtime. On a bare-metal or freestanding target, most of std simply does not exist to link against.",
  },
]

const useCaseCards = [
  {
    title: "Embedded, firmware, and bare metal",
    body: "Microcontrollers, board firmware, boot stages, and deterministic device control are the textbook case. There is no OS, often only kilobytes of RAM, and every byte and every cycle is accounted for. This is the family most people picture, but it is only one of several.",
  },
  {
    title: "Kernels, hypervisors, and bootloaders",
    body: "Freestanding x86_64 or aarch64 code that runs before or instead of an OS. It wants core plus tightly controlled startup, page tables, and ABI decisions, and it must avoid anything that quietly assumes userspace, syscalls, or a libc underneath it.",
  },
  {
    title: "Wasm guests and sandboxed runtimes",
    body: "Minimal wasm modules, plugin sandboxes, smart-contract VMs, and policy engines expose only a narrow host ABI on purpose. Dropping std keeps the binary small and the host boundary honest, because every capability the guest needs has to be explicitly imported.",
  },
  {
    title: "Portable high-assurance libraries",
    body: "Parsing, cryptography, and protocol crates often go no_std so the exact same audited logic runs in firmware, a kernel, a wasm sandbox, and a server from one codebase. Writing to core first is what makes that reuse possible rather than a porting project per target.",
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
    body: "When the upper bound is real, encode it. A stack array, a static buffer, or a fixed-capacity collection such as heapless::Vec turns \"we ran out of memory\" into a local, testable branch instead of an unrecoverable allocator failure deep in a call stack. The capacity becomes part of the type, which means the compiler and the reviewer both see it.",
  },
  {
    title: "Arenas and bump allocation",
    body: "When many values share one lifetime and die together (one request, one frame, one parse pass) a bump arena allocates by moving a pointer and frees everything with a single reset. It removes per-object allocator churn and keeps the peak region size in plain view, which matters when total RAM is fixed.",
  },
  {
    title: "Custom global allocators",
    body: "If the target does have a heap, you still often want to choose the allocator rather than inherit one. Implementing GlobalAlloc lets you pin down exactly how out-of-memory behaves, keep the implementation small enough to audit, and match the allocator to the device's memory map instead of a general-purpose default.",
  },
  {
    title: "Fallible allocation",
    body: "On a server, an allocation failure aborts and you move on. On a constrained target that is not acceptable, so growth has to be fallible. try_reserve, Option-returning pushes, and Result-returning builders make the out-of-memory path a value you handle, not a panic you pray never fires under load.",
  },
]

const ownershipCards = [
  {
    title: "Zero-copy buffers",
    body: "When memory is scarce, copying a buffer just to satisfy a lifetime is a luxury you cannot afford. Borrowed slices, view types, and index-based handles let one buffer be processed in place without duplication. The ownership rules that feel strict on a server become the thing that lets you prove, at compile time, that no two parties write the same DMA region at once.",
  },
  {
    title: "DMA-style ownership transfer",
    body: "A DMA engine reads or writes memory on its own while the CPU does other work, so a plain &mut into that buffer would be a data race the borrow checker cannot see. The fix is to hand the peripheral one owned handle to the slot for the duration of the transfer and get it back on completion. Ownership, not a borrow, models who is allowed to touch the memory right now.",
  },
  {
    title: "Volatile memory and registers",
    body: "A hardware register is not ordinary memory: reading it can have side effects and its value can change without any write the compiler can see. Normal references would let the optimizer cache or reorder accesses and silently break the device. Use read_volatile and write_volatile (or a vendor abstraction), keep the unsafe block tiny, and document the address and ordering assumptions next to it.",
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

export function PageCh56NoStdRustConstrainedRuntimeDerivatives() {
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

  const pageIndex = getPageIndexById("ch56-no-std-rust-constrained-runtime-derivatives")
  const chapter03PageIndex = getPageIndexById("ch03-project-structure-and-tooling")
  const chapter08PageIndex = getPageIndexById("ch08-undefined-behavior-and-unsafe-rust")
  const chapter28PageIndex = getPageIndexById("ch28-cpp-integration")
  const chapter29PageIndex = getPageIndexById("ch29-js-and-cpp-integration-for-wasm")
  const chapter44PageIndex = getPageIndexById("ch44-packaging-and-deployment")
  const exercisesPageIndex = getPageIndexById("ch56-no-std-rust-constrained-runtime-derivatives-exercises")
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
          Chapter 56 · Page {pageIndex + 1} of {PAGES.length}
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
            Imagine one team that owns a packet-framing and checksum library and is asked to ship it in four very
            different homes: the firmware on a sensor board with no operating system, the kernel-adjacent startup code of
            a small hypervisor, a sandboxed wasm guest that talks to a host over a narrow ABI, and an ordinary Linux
            service that logs to stdout. The same parsing logic has to run unchanged in all four. The only thing that may
            differ per home is which runtime services exist underneath it.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            That is the whole job of this chapter: decide, per layer, the smallest runtime surface that is actually
            needed. Pure logic that needs nothing but the language stays in <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">core</code>.
            Helpers that own a growable buffer get gated behind <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">alloc</code>.
            Anything that touches the OS gets gated behind <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">std</code>. The target
            triple you compile for then decides which of those three surfaces is even allowed.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            The diagram below is the picture to hold in your head for the rest of the chapter. Read it as three concentric
            capability rings (core is always there, alloc needs a heap, std needs an OS) and four target triples that each
            stop at a different ring.
          </p>
          <div className="mt-3">
            <MermaidDiagram
              chart={`flowchart TD\n  Core["core<br/>language + portable primitives<br/>(always available)"] --> Alloc["alloc<br/>Vec / String / Box<br/>(needs a global allocator)"]\n  Alloc --> Std["std<br/>threads / files / net / time<br/>(needs an OS)"]`}
              caption="The three capability rings: core is always available, alloc needs a heap, std needs an OS."
            />
          </div>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            Each target triple stops at a different ring. Here is how the four homes from the scenario map onto the stack
            above:
          </p>
          <div className="mt-3">
            <MermaidDiagram
              chart={`flowchart TD\n  MCU["thumbv7em-none-eabihf<br/>microcontroller"] -.stops at.-> Core["core"]\n  Bare["x86_64-unknown-none<br/>freestanding / kernel"] -.stops at.-> Alloc["alloc"]\n  Wasm["wasm32-unknown-unknown<br/>wasm guest"] -.stops at.-> Alloc\n  Linux["aarch64-unknown-linux-gnu<br/>full userspace"] -.reaches.-> Std["std"]`}
              caption="The target triple decides how far up the stack you may reach: firmware stops at core, kernel and wasm reach alloc, a Linux userspace reaches std."
            />
          </div>
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
          <p className="text-sm text-muted-foreground leading-6">
            Three ideas do most of the work in this chapter, and getting them straight up front prevents nearly all of the
            confusion newcomers have with no_std. The first is that you are not learning a different language. The second
            is that no_std and no-heap are separate decisions. The third is that the target triple, not your preference,
            sets the ceiling on what you may use.
          </p>
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
          <p className="text-sm text-muted-foreground leading-6">
            With the three-ring picture in place, the rest of the chapter walks the concrete decisions a senior engineer
            makes: how to lay out a crate so each function lives at the right ring, when no_std is the right call at all,
            how to manage memory without a heap, how ownership changes when DMA and registers enter the picture, how the
            embedded ecosystem is layered, what happens at FFI and wasm boundaries, and how to test code that may never run
            on your laptop. Each subsection pairs the reasoning with a small, runnable shape.
          </p>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              The three surfaces in practice: core, alloc, std, and what the target triple decides
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The standard library you reach for on a server is really three layers stacked on top of each other, and
              no_std lets you opt out of the upper ones. Knowing exactly what lives in each layer is what lets you place a
              function at the lowest ring it can tolerate. The cards below name the contents of each surface; the code that
              follows shows how one crate routes its public API across all three at once.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {foundationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <h5 className="font-medium text-foreground mb-2">The crate-root pattern, and how to read it</h5>
              <p className="text-sm text-muted-foreground leading-6">
                Look at the listing below as three doors, one per surface. The crate is no_std unless the caller turns on
                the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">std</code> feature. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">checksum</code> takes
                only a slice and so compiles everywhere. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">encode_frame</code> returns
                an owned <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;u8&gt;</code> and is therefore behind the alloc
                door. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">write_diagnostic</code> touches the OS and lives behind the std door. A
                firmware build enables nothing extra and sees only the first function; a server build enables std and sees
                all three. The diagram traces those three paths before you read the code.
              </p>
              <div className="mt-3">
                <MermaidDiagram
                  chart={`flowchart TD\n  Caller["downstream crate"] --> Feat{enabled features?}\n  Feat -->|none| C["checksum(&[u8]) -> u32<br/>core only"]\n  Feat -->|alloc| A["encode_frame -> Vec&lt;u8&gt;<br/>owned helper"]\n  Feat -->|std| S["write_diagnostic -> io::Result<br/>host adapter"]\n  C --> Cont["each door has a target requirement, continues below"]\n  A --> Cont\n  S --> Cont`}
                  caption="One crate, three feature-gated doors. The smallest contract (checksum) is the only one every target must support."
                />
              </div>
              <p className="text-sm text-muted-foreground leading-6 mt-3">
                Each of those three doors carries a different target requirement:
              </p>
              <div className="mt-3">
                <MermaidDiagram
                  chart={`flowchart TD\n  C["checksum<br/>core only"] --> Any["compiles on every target"]\n  A["encode_frame<br/>owned helper"] --> Heap["targets with an allocator"]\n  S["write_diagnostic<br/>host adapter"] --> OS["targets with an OS"]`}
                  caption="The core-only door reaches every target; the alloc door needs a heap; the std door needs an OS."
                />
              </div>
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
                <p className="text-sm text-muted-foreground leading-6 mb-3">
                  In a hosted program std supplies a panic handler for free: it prints a message and unwinds or aborts. In
                  a freestanding binary there is no std to do that, so the compiler requires you to provide a{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">#[panic_handler]</code> yourself. The
                  one below simply spins forever, which is a deliberate, defined failure state for a microcontroller.
                </p>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  The lesson is that panic strategy, startup glue, and linker scripts are not background details on these
                  targets; they are first-class items you own or import explicitly. Some boards rely on a platform crate to
                  provide that layer, others want it hand-written, and there is no single universal boot story to assume.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">When to reach for no_std (and when not to)</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              It is easy to over-apply no_std out of a sense of minimalism. The honest test is whether the code must run
              somewhere that does not have, or does not want, the standard library. There are four recurring situations
              where that is genuinely the case. Outside them, a normal std crate is usually the better engineering choice;
              no_std has real costs in ergonomics and ecosystem reach, and you should pay them on purpose.
            </p>
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
                The correction worth internalizing: no_std is not a synonym for "microcontroller only." It is a way to make
                runtime assumptions explicit enough that one body of logic can survive several constrained hosts honestly.
                If your code will only ever run on a normal OS, do not go no_std just to feel lean; you will trade away
                large parts of the ecosystem for a portability you are not using.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Designing a crate that stays portable</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Portability is not something you bolt on later; it is a property of how the crate is shaped from the first
              commit. The pattern is the same one the crate-root listing showed: keep the baseline API in core, layer owned
              conveniences behind an alloc feature, and reserve std for the outermost integration. The four practices below
              are what keep that layering from quietly eroding as the crate grows and acquires dependencies.
            </p>
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
                The senior rule of thumb is to design the smallest truthful API first. If borrowed slices and
                fixed-capacity callers are enough, keep the surface in core and let it compile everywhere. Add owned
                convenience only when the product boundary genuinely benefits from alloc or std, and gate it so the
                addition never becomes mandatory for callers that did not ask for it. The dependency point deserves
                emphasis: a single transitive crate that pulls in std with default features will, by itself, end your
                portability story without any warning. Audit with{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">default-features = false</code> and a
                no_std target in CI, not by hope.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Managing memory when there is no std heap</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The biggest habit to unlearn from hosted programming is the assumption that allocation always succeeds. On a
              constrained target, memory is a fixed budget and growth can fail, so the design question shifts from "how do I
              allocate?" to "what happens when I cannot?" The four strategies below answer that question at increasing levels
              of dynamism, from no heap at all to a heap whose failure mode you control.
            </p>
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
              <p className="text-sm text-muted-foreground leading-6 mb-3">
                The difference is one method. Where a hosted version would call{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">push</code> or{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">extend_from_slice</code> and let an
                allocation failure abort the process, the version below first calls{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">try_reserve</code> and returns the error
                to the caller. The buffer only grows once the capacity is secured, so the out-of-memory case becomes an
                ordinary <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result</code> you can test.
              </p>
              <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`#[cfg(feature = "alloc")]
fn append_packet(buf: &mut alloc::vec::Vec<u8>, bytes: &[u8]) -> Result<(), alloc::collections::TryReserveError> {
    buf.try_reserve(bytes.len())?;
    buf.extend_from_slice(bytes);
    Ok(())
}`}</code>
              </pre>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Ownership and data layout next to the hardware</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Close to the metal, Rust's ownership model stops being a discipline about cleanup and becomes a tool for
              reasoning about who is physically allowed to touch a piece of memory at a given instant. Two concurrent actors
              you cannot see from ordinary code (a DMA engine and a hardware register that changes itself) are exactly the
              cases where a careless borrow turns into a real fault. The three ideas below are how you keep that honest.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {ownershipCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5">
              <h5 className="font-medium text-foreground mb-2">DMA as an ownership handoff</h5>
              <p className="text-sm text-muted-foreground leading-6">
                The key idea in the next listing is that <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">submit_to_dma</code> takes
                the slot <em>by value</em>. Once you call it, you no longer have the slot, so the compiler will reject any
                attempt to read or write that buffer while the transfer is in flight. The peripheral conceptually owns the
                memory until it signals completion and the handle is returned. The diagram shows that round trip of authority
                first, so the by-value parameter reads as deliberate rather than incidental.
              </p>
              <div className="mt-3">
                <MermaidDiagram
                  chart={`stateDiagram-v2\n  [*] --> CpuOwns: slot allocated\n  CpuOwns --> DmaOwns: submit_to_dma(slot)<br/>(slot moved by value)\n  DmaOwns --> DmaOwns: transfer in flight<br/>CPU cannot touch buffer\n  DmaOwns --> CpuOwns: completion irq<br/>handle returned\n  CpuOwns --> [*]: slot freed`}
                  caption="The slot handle is the authority token. While DMA owns it, the borrow checker forbids any CPU access to the buffer."
                />
              </div>
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
                <p className="text-sm text-muted-foreground leading-6 mb-2">
                  Here the entire unsafe footprint is two one-line functions. Wrapping the raw pointer in a{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Register</code> type means the rest of
                  the driver works with a safe API, and any audit of MMIO correctness reduces to reviewing these two reads
                  and writes plus the validity of the address that produced the pointer.
                </p>
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
            <div className="grid gap-3 lg:grid-cols-2">
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
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Option&lt;SlotId&gt;</code> makes exhaustion explicit and easy to test under load or device stress.
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
                examples/ch56_no_std_rust_constrained_runtime_derivatives/
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
            Open Chapter 56 Exercises
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

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
    title: "Rust performance is about work, movement, and layout",
    body: "The language removes many accidental costs, but it does not remove actual work. Allocation, copying, cache misses, branch misses, syscalls, and synchronization still dominate when they dominate.",
  },
  {
    title: "Ownership shows where cost is introduced",
    body: "A clone, an owned boundary, or a task handoff is not only a type-system event. It is often an allocation or copy decision. Rust makes those choices visible enough to review.",
  },
  {
    title: "Measure with the right tool for the right question",
    body: "Benchmarking compares alternatives under controlled inputs. Profiling finds hot code paths. Tracing shows timelines and causality. Production observability shows what the real service is doing under real load.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already know that layout, dispatch, and allocation matter. Rust adds stronger defaults: generic code is usually statically dispatched, ownership makes clones visible, and safe slice-based code often gives the optimizer enough structure to remove checks.",
  },
  {
    title: "C# background",
    body: "A major shift is that allocation pressure is no longer amortized behind a moving GC boundary. Rust makes ownership and buffer reuse explicit, which often improves latency discipline as much as raw throughput.",
  },
  {
    title: "Go background",
    body: "Go makes concurrency and allocation easy to express, but that can hide hot-path copying and heap churn. Rust performance work usually begins by making ownership, borrowing, and batch boundaries more explicit.",
  },
]

const performanceModelCards = [
  {
    title: "Allocation and deallocation",
    body: "Heap traffic is often the first measurable cost in parser, logging, queue, and request-shaping code. Reuse buffers, preallocate when bounds are real, and avoid cloning data that only needed to be borrowed.",
  },
  {
    title: "Data layout and locality",
    body: "The CPU likes predictable contiguous access. Flat buffers, row-major scans, and compact structs often matter more than one clever instruction-level tweak.",
  },
  {
    title: "Dispatch and control flow",
    body: "Static dispatch preserves concrete type knowledge for inlining and optimization. Dynamic dispatch can still be correct, but it should be chosen for runtime flexibility, not by habit.",
  },
  {
    title: "Synchronization and syscalls",
    body: "A fast loop can still lose badly if it flushes too often, locks too broadly, or crosses too many queue and runtime boundaries.",
  },
]

const allocationNotes = [
  "Use `Vec::with_capacity` or `String::with_capacity` when an upper bound is real and nearby.",
  "Reuse owned buffers with `clear()` when the same object naturally serves several iterations.",
  "Pass `&str`, `&[T]`, and focused borrowed views on read-only hot paths instead of forcing owned clones.",
  "If an API constructs a new long-lived result, let it return an owned value once instead of repeatedly cloning intermediate pieces.",
]

const localityCards = [
  {
    title: "Cache locality",
    body: "A flat `Vec<T>` scanned in order is easier for the CPU to prefetch than a pointer-heavy graph or a `Vec<Vec<T>>` with many row allocations. This is why dense hot loops often start by flattening storage.",
  },
  {
    title: "Branch prediction",
    body: "Keep the hot path straight when you can. If a loop mixes several rare cases into one unpredictable branch chain, consider partitioning by kind, hoisting cold checks outward, or changing the data shape so the inner loop does less guessing.",
  },
]

const dispatchCards = [
  {
    title: "Static dispatch and inlining",
    body: "Generic functions are monomorphized once per concrete type, so the optimizer always sees the concrete call target. Whether the call is then inlined is a separate decision, and many instantiations still increase compile-time and code-size pressure.",
  },
  {
    title: "Dynamic dispatch",
    body: "`dyn Trait` is the honest choice when runtime heterogeneity is real. In a hot loop, it may reduce inlining and add indirect calls, but the only safe conclusion is to measure the actual workload.",
  },
  {
    title: "Inlining hints",
    body: "`#[inline]` and `#[inline(always)]` are hints, not a license to stop measuring. Use them sparingly, especially in reusable libraries where code size can become the real regression.",
  },
]

const iteratorCards = [
  {
    title: "Iterator performance",
    body: "Iterator chains are often excellent Rust because they preserve slice structure and avoid index bookkeeping. They are not automatically slower than loops, and they are not automatically faster either. The right question is what code is emitted after optimization.",
  },
  {
    title: "Bounds checks",
    body: "Bounds checks are often removed when the compiler can prove the range. Iterating over slices, chunks, windows, and exact split ranges is usually easier to optimize than manual indexing with data-dependent bounds.",
  },
  {
    title: "Reasoning before unsafe",
    body: "If you think bounds checks are the problem, first rewrite the loop with slices or iterators. Safe Rust often gives the compiler enough proof. Only after a profile and a proof obligation should unsafe indexing enter the conversation.",
  },
]

const cloneNotes = [
  "A clone in a hot path is not automatically wrong, but it should always be explainable.",
  "Prefer borrowed keys, borrowed labels, and borrowed slices for local read-only work.",
  "If a queue, task, or cache truly needs independent ownership, clone or move once at that boundary and keep the rest of the path borrow-based.",
  "Treat `Arc::clone` and deep `clone()` differently in reviews. One adds a shared owner. The other often duplicates real data.",
]

const measurementCards = [
  {
    title: "Benchmarking",
    body: "Use benchmarking to compare two alternatives under controlled inputs. Fix the workload, run in release mode, warm up enough to reduce obvious noise, and use `black_box` or an equivalent technique when dead-code elimination would otherwise fake a speedup.",
  },
  {
    title: "Profiling",
    body: "Use profiling to find where time or allocations go. A benchmark can tell you that variant B is slower. A profile tells you whether the loss came from allocation, hashing, parsing, synchronization, or something else entirely.",
  },
  {
    title: "Tracing",
    body: "Use tracing when the question is timeline and causality: queue wait, runtime delay, handler duration, blocking-pool pressure, cross-service hops. Tracing is not a microbenchmark and should not be treated as one.",
  },
  {
    title: "Production observability",
    body: "Use metrics and logs for the live system: p50 and p99 latency, allocation or GC-equivalent pressure from dependencies, queue depth, error rate, and bytes moved. Production numbers validate whether the benchmarked hot path even matters in the deployed service.",
  },
]

const releaseProfileSnippet = `[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
panic = "abort" # binaries only, if unwinding is not part of the contract`

const productionPatterns = [
  "Keep hot-path APIs narrow: borrowed input, owned output only when the result truly crosses a subsystem boundary.",
  "Flatten dense data and scan it in the order it is stored. Locality wins are often easier to keep than clever micro-optimizations.",
  "Preallocate only when the bound is real. A guessed capacity can be harmless, but a fake performance story is not.",
  "Benchmark in release mode, profile the slow variant, and check production traces before changing lower-level details.",
  "Prefer safe loops and slice APIs first. Let the compiler remove bounds checks where it can prove them.",
  "Treat release-profile settings as workload tradeoffs: faster code, slower builds, larger binaries, or different panic behavior.",
]

const pitfalls = [
  "Calling a change “faster” because one benchmark improved while allocations, binary size, or p99 latency got worse somewhere else.",
  "Blaming iterators before checking the generated code, or blaming bounds checks before rewriting the loop around slices.",
  "Adding `clone()` everywhere a borrow felt awkward and only later discovering heap churn in the real service path.",
  "Switching to `dyn Trait` in the inner loop because it felt cleaner, then measuring too late that inlining disappeared where it mattered.",
  "Running only debug builds during local measurement and drawing conclusions from numbers that the optimizer would completely change.",
  "Turning on aggressive release profile flags globally without checking compile time, crash policy, binary size, and deployment constraints.",
]

const summaryPoints = [
  "Rust performance starts with explicit cost models: allocation, movement, layout, dispatch, synchronization, and syscalls.",
  "Allocation awareness usually means fewer hidden clones, better buffer reuse, and preallocation only where bounds are real.",
  "Cache locality and predictable control flow often matter more than one micro-level trick.",
  "Static dispatch, iterator style, and bounds-check removal should be reasoned about from emitted code and measurement, not from folklore.",
  "Benchmarking, profiling, tracing, and production observability answer different questions and should stay separate in reviews.",
  "Release builds and profile flags matter, but they are still tradeoffs that deserve workload-specific validation.",
]

export function PageCh33PerformanceOrientedRust() {
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
  const pageIndex = getPageIndexById("ch33-performance-oriented-rust")
  const chapter10PageIndex = getPageIndexById("ch10-arrays-slices-and-vectors")
  const chapter18PageIndex = getPageIndexById("ch18-generics-instead-of-templates")
  const chapter22PageIndex = getPageIndexById("ch22-multithreading-in-rust")
  const chapter27PageIndex = getPageIndexById("ch27-io-tricks-and-systems-programming-patterns")
  const chapter32PageIndex = getPageIndexById("ch32-mpi-and-high-performance-computing")
  const exercisesPageIndex = getPageIndexById("ch33-performance-oriented-rust-exercises")
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
          Chapter 33 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Performance work starts with allocation, data movement, cache behavior, and measurement. This chapter turns Rust
          optimization into a repeatable review process tied to workload evidence.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 10, 18, 22, 27, and 32</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 10 covered arrays, slices, and vectors as layout choices. Chapter 18 covered generics and
                monomorphization. Chapter 22 covered multithreading costs and ownership across workers. Chapter 27 covered
                IO and batching. Chapter 32 covered flat buffers and communication-heavy HPC thinking. This chapter turns
                those threads into a practical Rust performance model.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter10PageIndex)}>
                Chapter 10
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter18PageIndex)}>
                Chapter 18
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter22PageIndex)}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter27PageIndex)}>
                Chapter 27
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter32PageIndex)}>
                Chapter 32
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A request-processing service regressed after a readability refactor: p99 latency increased, heap traffic rose,
            and queue wait became visible. The business requirement is to restore the cost model by measuring allocation,
            data movement, layout, dispatch, synchronization, and live production latency before changing lower-level code.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A good performance review order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>State the workload and the metric first.</li>
              <li>Count allocations, copies, cache-unfriendly layout, and synchronization boundaries.</li>
              <li>Benchmark alternatives in release mode.</li>
              <li>Profile the slow one, then confirm the live system with traces and production metrics.</li>
            </ol>
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

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">The Rust performance model</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {performanceModelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Allocation awareness</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {allocationNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A useful correction for senior engineers is this: ownership clarity and performance clarity often improve
                together. The cleanest API shape frequently allocates less because the borrow or owned boundary is now
                explicit instead of accidental.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Cache locality and branch prediction</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {localityCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Static dispatch and inlining</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {dispatchCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Iterator performance, bounds checks, and unnecessary clones</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {iteratorCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h5 className="font-medium text-foreground mb-2">Avoiding unnecessary clones</h5>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {cloneNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Benchmarking methodology</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {measurementCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                Do not claim a speedup without workload context. A cleaner benchmark is not a substitute for profiling, and
                a flatter profile is not a substitute for production latency or throughput data.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Release builds and compiler flags</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Measure performance in release mode. Debug builds are for fast iteration and diagnostics, not for
                  trustworthy throughput or latency numbers. The first repair for “Rust is slow” is often simply
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">--release</code>.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`cargo run --release
cargo test --release
cargo bench`}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Release profile settings are workload tradeoffs. More optimization or LTO may help hot binaries, but it
                  also affects compile time, binary size, and sometimes panic behavior.
                </p>
                <pre className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{releaseProfileSnippet}</code>
                </pre>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Production patterns</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {productionPatterns.map((pattern) => (
              <div key={pattern} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">{pattern}</p>
              </div>
            ))}
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
                The most common performance mistake in senior Rust code is not “using iterators.” It is skipping the step
                where the team states what is actually expensive and how that expense will be measured.
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
                <h4 className="font-semibold text-foreground">Example 1: allocation-aware filtering without route clones</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The function preallocates once, borrows route labels from the input slice, and keeps the hot path
                  allocation-light.
                </p>
              </div>
              {codes.performance_allocation_borrowed_filter !== DEFAULT_CODES.performance_allocation_borrowed_filter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("performance_allocation_borrowed_filter")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.performance_allocation_borrowed_filter}
              onChange={(newCode) => updateCode("performance_allocation_borrowed_filter", newCode)}
              onRun={() => runCode("performance_allocation_borrowed_filter")}
              output={outputs.performance_allocation_borrowed_filter ?? null}
              isRunning={isRunning === "performance_allocation_borrowed_filter"}
              filename="allocation_borrowed_filter.rs"
              expectedOutput={"hot = 2\nfirst = /search\ncapacity ok = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.performance_allocation_borrowed_filter}
              onRevert={() => resetCode("performance_allocation_borrowed_filter")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Allocation awareness</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `Vec::with_capacity` makes the result budget visible instead of relying on repeated growth.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Borrowed hot path</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The output stores `&str` views because the result only needs to live as long as the input slice.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Branch shape</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The loop does one clear threshold test and pushes only on the hot predicate.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: row-major scanning for predictable locality</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The grid stays flat and contiguous. Row sums are derived with chunked iteration instead of nested owners
                  or scattered indexing.
                </p>
              </div>
              {codes.performance_row_major_scan !== DEFAULT_CODES.performance_row_major_scan && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("performance_row_major_scan")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.performance_row_major_scan}
              onChange={(newCode) => updateCode("performance_row_major_scan", newCode)}
              onRun={() => runCode("performance_row_major_scan")}
              output={outputs.performance_row_major_scan ?? null}
              isRunning={isRunning === "performance_row_major_scan"}
              filename="row_major_scan.rs"
              expectedOutput={"row0 = 10\nrow1 = 26\ntotal = 36"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.performance_row_major_scan}
              onRevert={() => resetCode("performance_row_major_scan")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Cache locality</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One flat buffer plus `chunks(self.cols)` keeps row traversal predictable for the CPU.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Iterator shape</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The iterator is working with exact slices, which is often easier to optimize than ad hoc indexing.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Bounds reasoning</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Chunking expresses the row boundary structurally instead of relying on a manual index proof.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch33_performance_oriented_rust/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to build a benchmark plan for allocation-heavy code, refactor storage for
            better locality, compare iterator and loop implementations responsibly, and separate benchmarking from
            profiling, tracing, and production observability.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 33 Exercises
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

### File: `components/rust-book/pages/page-ch33-performance-oriented-rust-exercises.tsx`
```tsx
"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
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
    title: "Separate benchmarking, profiling, tracing, and production observability",
    objective: "Practice choosing the measurement tool that matches the actual performance question.",
    starterPrompt:
      "You need to compare two parsing functions, explain a latency regression inside one of them, understand where request time is spent across queueing and IO, and confirm whether the regression matters in the live service.",
    prompts: [
      "Which question wants a benchmark?",
      "Which question wants a profile?",
      "Which question wants tracing?",
      "Which question wants production metrics or logs?",
    ],
    acceptanceCriteria: [
      "You map each question to a distinct tool with a reason tied to the information it provides.",
      "You avoid treating one benchmark result as a full production diagnosis.",
      "You explain at least one way tracing and profiling answer different questions.",
    ],
    hints: [
      "A benchmark compares alternatives. A profile explains hotspots. A trace shows timeline and causality.",
      "Production observability answers what the deployed system is actually doing.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find allocation pressure and hidden clones in a hot path",
    objective: "Read a request loop and identify where ownership choices add heap traffic.",
    starterPrompt:
      "A request filter clones route strings into a temporary vector, formats a label per item, and pushes one record at a time into a dynamically growing output buffer.",
    prompts: [
      "Which values only needed borrowed access?",
      "Which allocation could be preplanned from a real bound?",
      "Which clone is semantically real and which one only papers over an API shape problem?",
      "What would you measure after the refactor to confirm the change helped?",
    ],
    acceptanceCriteria: [
      "You identify at least one unnecessary clone and one avoidable growth pattern.",
      "You propose a borrowed read path and one preallocation repair.",
      "You mention at least one follow-up metric such as allocation count, latency, or bytes allocated per request.",
    ],
    hints: [
      "Look for helpers that take ownership only to read.",
      "Look for vectors or strings that grow in obviously bounded loops.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Write a benchmark plan for an allocation-heavy function",
    objective: "Design a benchmark that compares alternatives without confusing it with profiling or production tuning.",
    starterPrompt:
      "You are comparing two versions of a log-enrichment function: one clone-heavy and one borrow-first with preallocation.",
    prompts: [
      "Specify the fixed input shape and size distribution.",
      "State that the benchmark runs in release mode.",
      "Define what you will record: wall-clock time, allocations, output count, or all three.",
      "Describe how you will keep the compiler from optimizing the whole function away when appropriate.",
    ],
    acceptanceCriteria: [
      "Your benchmark plan compares the same logical workload under two implementations.",
      "You name at least one release-build requirement and one measurement target.",
      "You distinguish the later profiling step from the benchmark step.",
      "You avoid claiming a speedup before the plan has been executed.",
    ],
    hints: [
      "A good benchmark plan makes the input and the stopping condition boring.",
      "If the function result is unused, dead-code elimination can make the numbers meaningless.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Refactor storage to improve locality",
    objective: "Replace an indirection-heavy dense layout with a flatter one that better matches the access pattern.",
    starterPrompt:
      "You inherit a dense heatmap stored as `Vec<Vec<u64>>`, and the hot loop walks every row in full on every request.",
    prompts: [
      "What does one flat `Vec<u64>` plus `rows` and `cols` remove from the memory-access pattern?",
      "Which helper methods should expose rows as borrowed slices instead of reconstructing vectors?",
      "How does this change your reasoning about bounds checks in the inner loop?",
      "What measurement would you take before and after the refactor?",
    ],
    acceptanceCriteria: [
      "You replace nested ownership with one flat owner for the dense case.",
      "You mention locality or cache behavior explicitly.",
      "You explain how row views or chunks make inner-loop bounds reasoning simpler.",
      "You mention at least one before-and-after measurement target.",
    ],
    hints: [
      "The point is not only fewer allocations. It is also more predictable traversal.",
      "Chunked slice iteration often gives the optimizer a better proof story than ad hoc indexing.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Compare iterator and loop implementations responsibly",
    objective: "Avoid folklore by designing a fair comparison between two equivalent hot loops.",
    starterPrompt:
      "You have one implementation written as an iterator chain and one as an explicit `for` loop over the same slice.",
    prompts: [
      "How will you keep the logical work identical between the two versions?",
      "What would make the comparison unfair, such as extra allocation or a changed branch structure in only one variant?",
      "Would you inspect generated code or profile data before drawing conclusions from the benchmark alone?",
      "How would you report the result without claiming one style is globally faster?",
    ],
    acceptanceCriteria: [
      "You keep the workload and output identical between variants.",
      "You mention at least one unfair comparison trap.",
      "You include at least one follow-up inspection step such as profiling or generated-code review.",
      "You report the result as workload-specific rather than as a universal rule.",
    ],
    hints: [
      "The style difference should be the variable, not the data shape or allocation pattern.",
      "Iterator versus loop is a measurement question, not a religious one.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose release settings and performance review policy for a service",
    objective: "Make build mode, profile settings, and runtime observability part of the performance design.",
    starterPrompt:
      "You are shipping a latency-sensitive binary with one hot parser, one CPU-heavy enrichment step, and an operator requirement that crash behavior remain explicit.",
    prompts: [
      "Which release-build command should every performance run use?",
      "Which profile settings would you consider, and what tradeoff does each one carry?",
      "When might `panic = \"abort\"` be acceptable, and when would it be the wrong contract?",
      "Which live signals would you require before trusting the optimized build in production?",
    ],
    acceptanceCriteria: [
      "You name release mode explicitly for measurement.",
      "You justify at least two profile settings or profile decisions with tradeoffs.",
      "You explain `panic = \"abort\"` as a binary contract choice rather than a free speed flag.",
      "You mention at least two production observability signals such as p99 latency, queue depth, allocation pressure, or error rate.",
    ],
    hints: [
      "Compiler flags are workload tools, not trophies.",
      "A good performance review says what changed in both build behavior and runtime behavior.",
    ],
  },
]

const reviewQuestions = [
  "Why is performance work usually clearer after ownership boundaries become honest?",
  "What is the practical difference between reducing allocations and reducing branch misses?",
  "Why are slice-based and chunk-based loops often easier to optimize than index-heavy loops?",
  "When is a clone economically justified even in performance-sensitive code?",
  "What does release mode change, and what questions does it still not answer by itself?",
]

const workingLoop = [
  "State the workload and the metric first.",
  "Separate benchmarking from profiling, tracing, and production observability.",
  "Refactor allocation and layout before lower-level tricks.",
  "Validate the change in release mode, then confirm it in the live service with the right signals.",
]

export function PageCh33PerformanceOrientedRustExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 65
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 33 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice performance work the way it survives review: explicit workload definitions, careful measurement, calmer
          ownership boundaries, and layout choices that make the CPU&apos;s job easier rather than harder.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a performance review. The strongest answer does not stop at “make it faster.” It
                says what the workload is, what the metric is, what moved in the cost model, and which measurement tool
                will confirm the change honestly.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(64)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 33
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
                  Performance drill
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
          title="Runnable lab · Allocation-aware hot-route filter"
          description={
            <>
              Repair the starter so the result buffer is preallocated and the threshold comparison includes the boundary
              value. The checker expects the exact output below.
            </>
          }
          filename="hot_routes_lab.rs"
          runKey="ch33_ex_hot_routes"
          expectedOutput={"hot = 2\nfirst = /search\ncapacity ok = true"}
          helperText={
            <>
              Tip: switch to{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec::with_capacity(requests.len())</code>{" "}
              and change the comparison so a request with exactly{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">512</code> bytes still qualifies.
            </>
          }
          initialCode={`#[derive(Debug)]
struct Request<'a> {
    route: &'a str,
    bytes: usize,
}

fn hot_routes<'a>(requests: &'a [Request<'a>], min_bytes: usize) -> Vec<&'a str> {
    let mut out = Vec::new();

    for request in requests {
        if request.bytes > min_bytes {
            out.push(request.route);
        }
    }

    out
}

fn main() {
    let requests = [
        Request {
            route: "/health",
            bytes: 128,
        },
        Request {
            route: "/search",
            bytes: 900,
        },
        Request {
            route: "/checkout",
            bytes: 512,
        },
        Request {
            route: "/metrics",
            bytes: 64,
        },
    ];

    let hot = hot_routes(&requests, 512);

    println!("hot = {}", hot.len());
    println!("first = {}", hot.first().copied().unwrap_or("none"));
    println!("capacity ok = {}", hot.capacity() >= requests.len());
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
            By the end of this page, you should be able to choose the right measurement tool, spot allocation and locality
            mistakes in hot paths, compare loops and iterators without folklore, and explain performance changes in the
            same ownership-and-boundary language another senior engineer can review quickly.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch33_performance_oriented_rust/allocation_borrowed_filter.rs`
````
#[derive(Debug)]
struct Request<'a> {
    route: &'a str,
    bytes: usize,
}

fn hot_routes<'a>(requests: &'a [Request<'a>], min_bytes: usize) -> Vec<&'a str> {
    let mut out = Vec::with_capacity(requests.len());

    for request in requests {
        if request.bytes >= min_bytes {
            out.push(request.route);
        }
    }

    out
}

fn main() {
    let requests = [
        Request {
            route: "/health",
            bytes: 128,
        },
        Request {
            route: "/search",
            bytes: 900,
        },
        Request {
            route: "/checkout",
            bytes: 512,
        },
        Request {
            route: "/metrics",
            bytes: 64,
        },
    ];

    let hot = hot_routes(&requests, 512);

    println!("hot = {}", hot.len());
    println!("first = {}", hot.first().copied().unwrap_or("none"));
    println!("capacity ok = {}", hot.capacity() >= requests.len());
}
````

### File: `examples/ch33_performance_oriented_rust/row_major_scan.rs`
````
#[derive(Debug)]
struct Grid {
    rows: usize,
    cols: usize,
    data: Vec<u32>,
}

impl Grid {
    fn row_sums(&self) -> Vec<u32> {
        debug_assert_eq!(self.data.len(), self.rows * self.cols);
        self.data
            .chunks(self.cols)
            .map(|row| row.iter().copied().sum())
            .collect()
    }

    fn total(&self) -> u32 {
        self.data.iter().copied().sum()
    }
}

fn main() {
    let grid = Grid {
        rows: 2,
        cols: 4,
        data: vec![1_u32, 2, 3, 4, 5, 6, 7, 8],
    };

    let sums = grid.row_sums();

    println!("row0 = {}", sums[0]);
    println!("row1 = {}", sums[1]);
    println!("total = {}", grid.total());
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -62,3 +62,5 @@ export { PageCh31DistributedTaskExecution } from "./page-ch31-distributed-task-e
 export { PageCh31DistributedTaskExecutionExercises } from "./page-ch31-distributed-task-execution-exercises"
 export { PageCh32MpiAndHighPerformanceComputing } from "./page-ch32-mpi-and-high-performance-computing"
 export { PageCh32MpiAndHighPerformanceComputingExercises } from "./page-ch32-mpi-and-high-performance-computing-exercises"
+export { PageCh33PerformanceOrientedRust } from "./page-ch33-performance-oriented-rust"
+export { PageCh33PerformanceOrientedRustExercises } from "./page-ch33-performance-oriented-rust-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -73,6 +73,8 @@ import {
   PageCh31DistributedTaskExecutionExercises,
   PageCh32MpiAndHighPerformanceComputing,
   PageCh32MpiAndHighPerformanceComputingExercises,
+  PageCh33PerformanceOrientedRust,
+  PageCh33PerformanceOrientedRustExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -141,6 +143,8 @@ const PAGE_COMPONENTS = [
   PageCh31DistributedTaskExecutionExercises,
   PageCh32MpiAndHighPerformanceComputing,
   PageCh32MpiAndHighPerformanceComputingExercises,
+  PageCh33PerformanceOrientedRust,
+  PageCh33PerformanceOrientedRustExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh33Output } from "./rust-simulator-ch33"
 import { simulateCh32Output } from "./rust-simulator-ch32"
 import { simulateCh31Output } from "./rust-simulator-ch31"
 import { simulateCh30Output } from "./rust-simulator-ch30"
@@ -1010,6 +1011,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch33Output = simulateCh33Output(code, key)
+  if (ch33Output !== null) return ch33Output
 
   const ch32Output = simulateCh32Output(code, key)
   if (ch32Output !== null) return ch32Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -22,6 +22,7 @@ import { DEFAULT_CODES_CH29 } from "./default-codes-ch29"
 import { DEFAULT_CODES_CH30 } from "./default-codes-ch30"
 import { DEFAULT_CODES_CH31 } from "./default-codes-ch31"
 import { DEFAULT_CODES_CH32 } from "./default-codes-ch32"
+import { DEFAULT_CODES_CH33 } from "./default-codes-ch33"
 
 export interface PageConfig {
   id: string
@@ -808,6 +809,29 @@ export const CHAPTERS: ChapterConfig[] = [
         description:
           "Partition matrix rows across ranks, choose collective-friendly layouts, and reason about hybrid MPI plus threads and communication profiling",
         icon: "trophy",
+      },
+    ],
+  },
+  {
+    id: "ch33-performance-oriented-rust",
+    title: "Chapter 33 · Performance-Oriented Rust",
+    icon: "book",
+    pages: [
+      {
+        id: "ch33-performance-oriented-rust",
+        title: "Performance-Oriented Rust",
+        shortTitle: "Performance",
+        description:
+          "Rust's performance model, allocation awareness, cache locality, branch prediction, static dispatch, iterator tradeoffs, benchmarking methodology, and release profile choices",
+        icon: "book",
+        codeKeys: ["performance_allocation_borrowed_filter", "performance_row_major_scan"],
+      },
+      {
+        id: "ch33-performance-oriented-rust-exercises",
+        title: "Chapter 33 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Write a benchmark plan, refactor for locality, compare loops and iterators responsibly, and make measurement discipline explicit",
+        icon: "trophy",
       },
     ],
   },
@@ -1258,5 +1282,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH30,
   ...DEFAULT_CODES_CH31,
   ...DEFAULT_CODES_CH32,
+  ...DEFAULT_CODES_CH33,
 }
 
 export interface BookState {
````
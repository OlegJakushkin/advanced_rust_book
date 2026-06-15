"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Performance is work, movement, and layout",
    body: "Strip away the framing and a hot path is doing a small number of expensive things: allocating and freeing memory, copying bytes, missing the cache, mispredicting a branch, making a syscall, or waiting on a lock. Rust removes accidental versions of these, but the genuine ones still dominate when they dominate. Naming which one you are paying for is most of the diagnosis.",
  },
  {
    title: "Ownership is where cost is introduced",
    body: "In Rust the expensive decisions are written down in the type system. A clone is usually an allocation plus a copy. An owned function boundary is a decision to duplicate or transfer rather than borrow. A task handoff is a move across a thread. Because these are visible in the signatures, a performance review can read them off the code instead of reverse-engineering them from a profiler.",
  },
  {
    title: "Each measuring tool answers a different question",
    body: "Benchmarking compares two alternatives under a fixed input. Profiling finds which code path eats the time or the allocations. Tracing reconstructs a timeline and shows causality across queues and services. Production observability tells you whether any of it matters under real load. Mixing them up is how teams optimize a path that was never on the critical timeline.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The cost model is familiar: layout, dispatch, allocation, and aliasing all still decide the outcome. What changes is who keeps you honest. In C++ you reason about whether a tuned loop is also correct under aliasing; in Rust the borrow checker has already settled aliasing, so the compiler tends to have more freedom to vectorize and elide bounds checks. Spend your attention on the cost model, not on defending correctness by hand.",
  },
  {
    title: "C# background",
    body: "The biggest shift is that there is no moving collector quietly amortizing your allocations. Every heap object you create is a deallocation you will eventually pay for, on a thread you can name. That removes GC pauses from your tail latency, but it moves the work to you: buffer reuse, capacity hints, and borrowing instead of copying are now your job, not the runtime's.",
  },
  {
    title: "Go background",
    body: "Go makes a goroutine and a slice copy feel almost free to write, which is exactly how hidden heap churn and per-request copying accumulate. Rust does not make those cheaper; it makes them visible. A clone is a word you typed, and a task handoff is an ownership move you can see. Performance work usually starts by reading those boundaries back, not by adding more concurrency.",
  },
  {
    title: "Python background",
    body: "Your instinct that the hot loop should live in C still applies, but in Rust the hot loop is ordinary Rust. There is no interpreter overhead to escape and no NumPy boundary to cross, so a plain iterator over a flat slice is already the fast path. The new discipline is layout: a Vec of structs scanned in order behaves like a contiguous array, while a graph of boxed objects behaves like Python's pointer-chasing object model and pays for it in cache misses.",
  },
]

const performanceModelCards = [
  {
    title: "Allocation and deallocation",
    body: "Heap traffic is the most common first cost in parser, logging, queue, and request-shaping code, because each allocation is two trips to the allocator and a chance to fragment. The levers are direct: reuse buffers across iterations, preallocate when the bound is real, and stop cloning data that only ever needed to be read.",
  },
  {
    title: "Data layout and locality",
    body: "Modern CPUs are fast at arithmetic and slow at waiting for memory, so the access pattern often matters more than the instruction count. A flat buffer scanned in storage order lets the prefetcher work; a pointer-chasing graph defeats it. Compact, contiguous structs frequently beat one clever instruction-level tweak.",
  },
  {
    title: "Dispatch and control flow",
    body: "Static dispatch keeps the concrete type visible at the call site, which is what lets the optimizer inline and specialize. Dynamic dispatch through a trait object is still correct and often the right design, but it should be a deliberate choice for runtime flexibility, not a default reached for out of habit in a hot loop.",
  },
  {
    title: "Synchronization and syscalls",
    body: "A loop can be perfectly tuned and still lose at the system boundary. Flushing too often, holding a lock across too much work, or crossing too many queue and runtime boundaries turns CPU efficiency into wall-clock waiting. Batching and narrowing critical sections usually recovers more than micro-tuning the arithmetic.",
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
            A request-processing service regressed after a refactor that was meant to improve readability. p99 latency
            climbed, heap traffic rose, and queue wait that had been invisible became a line on the dashboard. Nobody
            changed an algorithm; the team changed where data was owned and copied, and the cost showed up downstream.
            The job now is not to guess. It is to rebuild the cost model deliberately, measuring allocation, data
            movement, layout, dispatch, synchronization, and live production latency before touching any lower-level
            code.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            That last clause is the whole chapter. The fastest way to waste a week is to start by rewriting the inner
            loop. The reliable path is to ask the questions in order, let each one rule out a class of explanation, and
            only descend to instruction-level work once the evidence points there. The diagram below is the order; the
            sections after it explain each box.
          </p>
          <MermaidDiagram
            chart={`flowchart TD
  A[State workload and metric] --> B[Count allocations, copies, layout, sync]
  B --> C[Benchmark alternatives in release mode]
  C --> D[Profile the slow variant]
  D --> E[Confirm with traces and production metrics]
  E -->|matters in prod| F[Change lower-level code]
  E -->|does not matter| G[Stop: the hot path was elsewhere]`}
            caption="The performance review runs top to bottom. Each step can end the investigation before you reach the code."
          />
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">The review order, in words</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>State the workload and the metric first, so every later number has a question it answers.</li>
              <li>Count allocations, copies, cache-unfriendly layout, and synchronization boundaries by reading the code.</li>
              <li>Benchmark the alternatives in release mode, never in debug.</li>
              <li>Profile the slow one to learn where the time actually goes, then confirm the live system with traces and production metrics.</li>
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Before any technique, fix the frame. Rust does not make programs fast; it removes whole categories of
            accidental cost and then hands you a clear view of the cost that remains. The phrase &ldquo;zero-cost
            abstraction&rdquo; is often misread as &ldquo;zero work.&rdquo; It means the opposite of free: it means an
            abstraction does not add overhead beyond the hand-written equivalent, so the real work is still entirely
            present and still entirely yours to manage. The three ideas below are the lens for the rest of the chapter.
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

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">The four costs worth tracking</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Almost every Rust performance problem reduces to one of four costs. Keeping the list short is the point:
              when latency regresses, you walk these four in order and ask which one the change touched. Most regressions
              announce themselves here long before you need a profiler.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Allocation is the cost most engineers underestimate because no single call looks expensive. The damage is
              cumulative: a per-request <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code>{" "}
              here, a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">clone()</code> there, a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec</code> that grows by reallocating
              instead of being sized once, and suddenly the allocator is on your hot path and your tail latency depends on
              it. The practical moves are unglamorous and they pay reliably.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Two data shapes can hold identical values and run at very different speeds. The difference is what the
              hardware sees while it walks them. A single flat allocation lets the prefetcher pull the next cache line
              before you ask for it; a structure made of many small allocations forces the CPU to chase a pointer, stall
              on the load, then chase the next one. The diagram below is the same data in both shapes &mdash; this is the
              picture to keep in mind whenever you reach for a nested collection.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  subgraph Flat["flat Vec: one allocation"]
    direction LR
    F0[a] --> F1[b] --> F2[c] --> F3[d]
  end
  Flat -.prefetcher friendly.-> Fast((fast scan))`}
              caption="Flat layout: one allocation, values adjacent, the prefetcher pulls the next line ahead of you."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The same values stored as a graph of small allocations look very different to the hardware:
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  subgraph Nested["Vec of boxes: many allocations"]
    direction LR
    H[handles] --> P0[ptr] --> B0[a]
    H --> P1[ptr] --> B1[b]
    H --> P2[ptr] --> B2[c]
  end
  Nested -.pointer chasing.-> Slow((cache misses))`}
              caption="Boxed layout: each element is a separate allocation, so the CPU stalls chasing one pointer after another."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Generics and trait objects are the two ways Rust calls behavior you do not know concretely at the call
              site, and they sit at opposite ends of the cost spectrum. A generic function is monomorphized: the
              compiler stamps out a separate copy per concrete type, so each copy sees an exact call target it can
              inline and optimize through. A <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"dyn Trait"}</code>{" "}
              value carries a pointer to a vtable, and the call goes through that pointer, which the optimizer usually
              cannot see past. The diagram shows where the indirection lives.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  subgraph Static["Generic: monomorphized"]
    GC[call site] --> GT[concrete fn body]
    GT --> GI[inline and specialize]
  end`}
              caption="Static dispatch: the call site sees the concrete body, so the optimizer can inline and specialize through it."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Dynamic dispatch puts a vtable on the same path, and the indirection is where the optimizer loses sight of
              the target:
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  subgraph Dynamic["dyn Trait: vtable"]
    DC[call site] --> DV[vtable pointer]
    DV --> DF[indirect call]
    DF --> DB[opaque to optimizer]
  end`}
              caption="Dynamic dispatch: the call routes through a vtable pointer the optimizer usually cannot follow past."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              There is a persistent folklore that iterator chains are slow and hand-written index loops are fast. The
              truth is closer to the reverse, and the reason is bounds checks. When you index a slice manually with a
              data-dependent index, the compiler must insert a check that the index is in range, because it cannot prove
              otherwise. When you iterate &mdash; over a slice, over{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">chunks</code>, over{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">windows</code> &mdash; the range is
              encoded in the iterator itself, so the check is provably unnecessary and the compiler removes it. The
              honest answer is always to read the generated code, but the default instinct should be: express the loop in
              terms of slices and let the compiler discharge the proof for you.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">Picking the right measuring tool</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The four tools below are not a hierarchy where one replaces the others; they answer four different
              questions, and a confident answer from the wrong tool is how teams optimize code that was never on the
              critical path. Match the tool to the question first. The diagram is that mapping; the cards explain each
              one.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  Q1[Which variant is faster?] --> Bench[Benchmark]
  Q2[Where does the time go?] --> Prof[Profile]`}
              caption="Comparing alternatives is a benchmark question; finding where the time goes is a profiling question."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The other two questions are about timeline and real load, and they map to two more tools:
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  Q3[What happened, and when?] --> Trace[Trace]
  Q4[Does it matter in prod?] --> Obs[Observability]`}
              caption="Reconstructing a timeline is a tracing question; whether it matters under real load is an observability question."
            />
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
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">How performance thinking shifts by background</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Senior engineers do not arrive at Rust as blank slates. The useful question is not which crate replaces
              which library; it is which of your instincts still hold and which one quietly leads you wrong. Each card
              names the mental-model shift for one background.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
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
          <p className="text-sm text-muted-foreground leading-6">
            These are the habits that keep a service fast without a heroics phase. None of them is a micro-optimization;
            each one shapes the data and the API so the expensive cost is paid once, at a boundary you chose, instead of
            silently on every request.
          </p>
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
          <p className="text-sm text-muted-foreground leading-6">
            Each of these is a true story that started with a reasonable-sounding sentence. The common thread is
            declaring victory from one number while a different number quietly got worse, or reaching for a lower-level
            change before the evidence pointed there.
          </p>
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
          <p className="text-sm text-muted-foreground leading-6">
            Both examples are small on purpose. Each one is a single design decision from the sections above, made
            concrete and runnable. Read the flow diagram first, then the code, then press Run and confirm the output
            before changing anything &mdash; the point is to see the cost decision in the signature, not just to watch it
            print.
          </p>

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
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the return type is{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;&amp;str&gt;</code>, not{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;String&gt;</code>. The function
              never copies a route; it borrows each label out of the input and hands back views that live exactly as long
              as the input slice. The one allocation in the whole function is the result vector, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec::with_capacity</code> sizes it once
              up front so the push loop never reallocates. The flow is: size the buffer, then for each request keep or
              skip on a single threshold test.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  In[requests slice] --> Cap[with_capacity once]
  Cap --> Loop{bytes over threshold}
  Loop -->|yes| Push[push borrowed route]
  Loop -->|no| Skip[skip]
  Push --> Out[vec of borrowed routes]
  Skip --> Out`}
              caption="One allocation for the result, borrowed labels throughout, one branch per request."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the grid is one{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;u32&gt;</code>, not a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;Vec&lt;u32&gt;&gt;</code>. The
              rows are not separate allocations; they are slices carved out of the same flat buffer by{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">chunks(self.cols)</code>. That single
              choice is what keeps the scan contiguous and lets the compiler drop bounds checks, because the chunk width
              proves the row boundary instead of a hand-written index. The flow is: take the flat buffer, split it into
              row-width chunks, sum each chunk.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  Flat[flat Vec, rows*cols] --> Chunk[chunks of cols]
  Chunk --> R0[row 0 slice]
  Chunk --> R1[row 1 slice]
  R0 --> S0[sum row 0]
  R1 --> S1[sum row 1]
  S0 --> Out[Vec of row sums]
  S1 --> Out`}
              caption="One contiguous buffer, sliced into rows by width. No nested allocation, no manual index proof."
            />
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

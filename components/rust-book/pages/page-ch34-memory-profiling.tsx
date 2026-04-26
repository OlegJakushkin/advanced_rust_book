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
    title: "Memory profiling starts with lifetime shape, not with a graph of bytes",
    body: "The first useful question is usually not 'how much memory do we use?' It is 'which values become owned here, how long do they live, and which boundary keeps them alive longer than expected?'",
  },
  {
    title: "Allocation count, live heap, RSS, and fragmentation are different signals",
    body: "A high allocation rate can indicate churn without a leak. A flat live heap can still coexist with rising RSS because the allocator is caching or the process is fragmented. A useful profile distinguishes those cases.",
  },
  {
    title: "Async memory problems are often queue and concurrency problems in disguise",
    body: "A runtime with many spawned tasks, unbounded channels, or oversized in-flight buffers can look like a leak even when nothing is permanently unreachable. The backlog policy is part of the memory story.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already know the difference between leaks, churn, and fragmentation. Rust helps by making ownership boundaries and deep clones more visible, but allocator caches and ref-count cycles can still fool you if you only watch RSS.",
  },
  {
    title: "C# background",
    body: "There is no GC heap to inspect by default, so the first profile often shifts toward explicit ownership, buffer sizing, queue depth, and retained data shape. Rust removes one class of hidden runtime behavior, not the need for disciplined memory budgets.",
  },
  {
    title: "Go background",
    body: "If you are used to profiles dominated by heap allocation and goroutine retention, the Rust analogue is often clone pressure, oversized queues, large pending buffers, or tasks keeping owned payloads alive longer than intended.",
  },
]

const allocationNotes = [
  "Count allocations and bytes separately. One hundred tiny allocations and one huge allocation are different pathologies.",
  "Measure steady-state and burst behavior separately. Request spikes often reveal churn that an average number hides.",
  "Prefer per-phase or per-request counters when the system has obvious batch lifetimes.",
  "Treat exact counts as a comparative tool. The important question is which boundary got more expensive after the change.",
]

const heapProfilingCards = [
  {
    title: "Heap profiling",
    body: "A heap profile should tell you who allocated, how much is still live, and whether the growth is one-time warmup or ongoing accumulation. Callsite ownership matters more than a single process-wide number.",
  },
  {
    title: "Heap snapshots",
    body: "Snapshots are strongest when you compare two points in time: after warmup, after one burst, after a long steady run, or before and after a suspected leak path. A single snapshot without a timeline is often only half a story.",
  },
  {
    title: "Retained versus allocated bytes",
    body: "A function may allocate heavily but release quickly. Another may allocate less but retain far more. Heap profiling is valuable because it separates those two behaviors.",
  },
]

const clonePressureNotes = [
  "Track deep clones independently from `Arc::clone` or `Rc::clone`. One duplicates underlying data; the other adds another owner.",
  "Instrument clone-heavy DTO paths before you move to heavier external heap profilers. A small local counter often finds the first real culprit.",
  "Review helpers that take `String`, `Vec<T>`, or `HashMap<K, V>` by ownership when they only read. Many clone regressions begin in API shape, not in the final loop.",
]

const leakNotes = [
  "Leaks in safe Rust are often logical leaks: ref-count cycles, never-drained queues, global caches with no eviction, or long-lived tasks holding owned state forever.",
  "For `Rc<T>` and `Arc<T>` graphs, watch strong-count relationships and use `Weak<T>` for observational back-edges such as parent links, listener tables, and cache indices.",
  "A task registry or callback table can leak even without a cycle if completed work is never removed. Safe Rust prevents use-after-free, not unreachable retention bugs.",
]

const fragmentationNotes = [
  "Fragmentation means the process keeps more resident memory than the current live set alone would suggest.",
  "Mixed allocation sizes, long-lived big buffers among short-lived small buffers, and allocator caching can all keep RSS high after the logical working set fell.",
  "If live bytes are flat but RSS stays high, suspect fragmentation or allocator retention before you call it a leak.",
]

const arenaNotes = [
  "When you use bump arenas or region allocation, profile peak region size, reset cadence, and what unexpectedly escapes the region.",
  "An arena can reduce allocator churn and improve locality, but it can also retain dead memory until the whole region resets. Peak region size is the number that matters.",
  "If a long-lived cache starts storing arena-owned data indirectly, the real bug is probably lifetime mismatch rather than a bad allocator choice.",
]

const asyncNotes = [
  "Track queue depth, message age, in-flight task count, and bytes per message. Those four numbers explain many async memory spikes.",
  "Bounded `mpsc` channels and explicit concurrency caps turn memory into a visible budget instead of an accidental backlog reservoir.",
  "Large owned buffers crossing `await` boundaries often stay alive longer than they would in a synchronous loop. Own once, drop early, and trim payload shape where possible.",
]

const toolCards = [
  {
    title: "Linux",
    bullets: [
      "Heaptrack or Valgrind Massif for allocation growth by callsite.",
      "Allocator statistics and `/proc/<pid>/smaps` when RSS and mapped memory disagree.",
      "Perf, eBPF-based tooling, or tracing for queue wait and runtime backlog around memory spikes.",
    ],
  },
  {
    title: "macOS",
    bullets: [
      "Instruments Allocations and Leaks for timeline and retained-object investigation.",
      "VM Tracker or Activity Monitor for resident growth versus logical heap growth.",
      "Malloc stack logging and the `leaks` tool when the process boundary is small enough to inspect locally.",
    ],
  },
  {
    title: "Windows",
    bullets: [
      "Visual Studio Diagnostic Tools and Memory Usage for heap snapshots and growth analysis.",
      "ETW and Windows Performance Analyzer for queueing, allocation, and runtime timeline correlation.",
      "Process Explorer or Performance Monitor counters for RSS, private bytes, and handle growth.",
    ],
  },
]

const allocatorBehaviorNotes = [
  "High allocation count with flat live bytes usually means churn.",
  "Flat live bytes with rising RSS often means fragmentation or allocator retention.",
  "A large one-time jump after startup may simply be cache warmup, lookup table build, or pooled buffers becoming resident.",
  "An allocator releasing memory to the process heap is not the same as the OS immediately reclaiming RSS. Interpret the curve before you rewrite code.",
]

const reductionNotes = [
  "Reduce deep clones on read paths by borrowing `&str`, `&[u8]`, slices, and focused views where the owner is nearby.",
  "Bound admission: channel capacity, semaphore permits, and batch size are memory controls as much as throughput controls.",
  "Flatten dense data and remove pointer-heavy intermediate structures where locality matters.",
  "Shrink payload shape before it crosses a queue, task, or broker boundary. Owning less data once is often better than owning the same large blob everywhere.",
  "Use `Weak<T>` to break non-owning graph edges, and remove completed tasks or callbacks from registries promptly.",
]

const countingAllocSnippet = `use std::alloc::{GlobalAlloc, Layout, System};
use std::sync::atomic::{AtomicUsize, Ordering};

struct CountingAlloc;
static ALLOCS: AtomicUsize = AtomicUsize::new(0);

unsafe impl GlobalAlloc for CountingAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCS.fetch_add(1, Ordering::Relaxed);
        unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
}`

const asyncChecklistSnippet = `// Track these together, not one at a time:
struct AsyncMemoryBudget {
    queue_depth: usize,
    queue_bytes: usize,
    in_flight_tasks: usize,
    largest_payload: usize,
}`

const productionPatterns = [
  "Start with one concrete symptom: rising RSS, OOM, latency under burst, allocator churn, or queue-age growth. Then measure the memory story that matches it.",
  "Keep a small local instrumentation path in the codebase for clone counters, queue depth, and per-request bytes. Heavy external tools are strongest after the first narrow clue exists.",
  "Profile clone pressure and async backlog before assuming a leak. A surprising number of memory incidents are really retention-by-design bugs.",
  "Use heap profilers to compare snapshots across time, not only to admire one large object graph once.",
  "Correlate memory with throughput, queue age, and task counts. A memory graph without a workload graph is often misleading.",
]

const pitfalls = [
  "Calling every RSS increase a leak. Allocator caches, warmup state, and fragmentation can all retain memory without unreachable objects accumulating.",
  "Treating `Arc::clone` and deep `clone()` as the same thing in reviews. One changes owner count. The other often duplicates real heap data.",
  "Profiling only the process heap while ignoring queue depth, task backlog, and broker redelivery that keep payloads alive longer than expected.",
  "Using arenas or bump allocation without measuring peak region size and reset cadence. A region can reduce churn and still be oversized.",
  "Fixing memory with a larger queue or pool because it improved throughput in one test. That often just hides backlog for longer and raises the peak footprint.",
]

const summaryPoints = [
  "Memory profiling works best when lifetime boundaries, allocation boundaries, and backlog boundaries are all explicit.",
  "Allocation count, live heap, RSS, fragmentation, and queue retention are different signals and should not be conflated.",
  "Clone pressure is often the fastest local signal to instrument before using heavier system profilers.",
  "Rc and Arc cycles are logical leak patterns Rust still allows; Weak back-edges and explicit cleanup policies are the repair.",
  "Async memory growth often comes from boundedness failures: too many tasks, too many buffered messages, or too-large owned payloads crossing awaits.",
  "Reducing memory footprint is usually a design repair first: borrow locally, own less across boundaries, flatten layout, and cap concurrency deliberately.",
]

export function PageCh34MemoryProfiling() {
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
  const pageIndex = getPageIndexById("ch34-memory-profiling")
  const chapter07PageIndex = getPageIndexById("ch07-copying-data-vs-cloning-data")
  const chapter09PageIndex = getPageIndexById("ch09-smart-pointers-and-pinning")
  const chapter13PageIndex = getPageIndexById("ch13-arena-allocation")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter33PageIndex = getPageIndexById("ch33-performance-oriented-rust")
  const exercisesPageIndex = getPageIndexById("ch34-memory-profiling-exercises")
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
          Chapter 34 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Memory profiling in Rust is usually a design review with measurements attached: which boundary allocates, which
          boundary retains, and which queue or graph keeps data alive longer than the author intended.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 07, 09, 13, 25, and 33</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 07 separated deep clone cost from ordinary moves and `Arc::clone`. Chapter 09 covered `Rc`, `Arc`,
                `Weak`, and cycle risk. Chapter 13 introduced arena lifetimes and region retention. Chapter 25 explained
                task and queue backpressure in Tokio. Chapter 33 established the broader performance review model that this
                chapter narrows to memory.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter07PageIndex)}>
                Chapter 07
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter09PageIndex)}>
                Chapter 09
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter13PageIndex)}>
                Chapter 13
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter33PageIndex)}>
                Chapter 33
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A service passes correctness tests and CPU benchmarks, but its resident set grows during a burst test and never
            returns to the old floor. One engineer suspects a leak. Another suspects fragmentation. A third finds a new
            async fan-out path with unbounded queueing and several deep clones per message. Rust gives you strong tools
            here, but only if the investigation stays operational: measure allocations, inspect retained owners, and
            separate backlog from unreachable memory.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical triage order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Identify the symptom precisely: churn, growth, leak, or backlog.</li>
              <li>Count allocations and retained owners at the same time.</li>
              <li>Correlate memory with queue depth, task count, and work phase.</li>
              <li>Only then decide whether the culprit is clone pressure, cycles, fragmentation, arena retention, or async admission policy.</li>
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
            <h4 className="font-semibold text-foreground mb-3">Measuring allocations</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {allocationNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">Counting allocator sketch</div>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{countingAllocSnippet}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  Keep this kind of tool local and comparative. The exact count is less important than the fact that one
                  refactor introduced twice as many allocations on the request path.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Heap profiling</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {heapProfilingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Tracking clone pressure</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {clonePressureNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Detecting leaks with Rc and Arc cycles</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {leakNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Fragmentation</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {fragmentationNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Arena allocation profiling</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {arenaNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling async memory usage</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {asyncNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">Minimal async budget sketch</div>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{asyncChecklistSnippet}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  If these numbers rise together, you probably have an admission problem before you have a leak problem.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Tools for Linux, macOS, and Windows</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {toolCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                    {card.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Interpreting allocator behavior</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {allocatorBehaviorNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Reducing memory footprint</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {reductionNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{note}</p>
                </div>
              ))}
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
                The most expensive memory optimization is often the one you make before the symptom is understood. A clone
                counter, a queue-depth graph, or one heap snapshot delta is often enough to avoid rewriting the wrong
                subsystem.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Worked examples</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: measure clone pressure before you profile the whole heap</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This local counter is intentionally simple. It helps you prove that one hot route filter is creating
                  owned strings, how many times it does that, and how many bytes those clones account for.
                </p>
              </div>
              {codes.memory_profiling_clone_pressure_counter !== DEFAULT_CODES.memory_profiling_clone_pressure_counter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("memory_profiling_clone_pressure_counter")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.memory_profiling_clone_pressure_counter}
              onChange={(newCode) => updateCode("memory_profiling_clone_pressure_counter", newCode)}
              onRun={() => runCode("memory_profiling_clone_pressure_counter")}
              output={outputs.memory_profiling_clone_pressure_counter ?? null}
              isRunning={isRunning === "memory_profiling_clone_pressure_counter"}
              filename="clone_pressure_counter.rs"
              expectedOutput={"selected = 2\nclones = 2\ncloned bytes = 21"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.memory_profiling_clone_pressure_counter}
              onRevert={() => resetCode("memory_profiling_clone_pressure_counter")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Signal</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The counter answers one narrow question: how much deep-copy work did this path choose?
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Scope</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This is not a whole-process allocator trace. It is a local instrument to guide the next profiling pass.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Repair path</div>
                <p className="text-xs text-muted-foreground leading-5">
                  If the result surprises you, the next review question is usually whether the output could stay borrowed longer.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: find an Rc cycle before you call it a leak mystery</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The first half creates a strong cycle. The second half repairs the parent edge with `Weak`, which turns
                  the retained graph into an observational link instead of another owner.
                </p>
              </div>
              {codes.memory_profiling_rc_cycle_leak !== DEFAULT_CODES.memory_profiling_rc_cycle_leak && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("memory_profiling_rc_cycle_leak")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.memory_profiling_rc_cycle_leak}
              onChange={(newCode) => updateCode("memory_profiling_rc_cycle_leak", newCode)}
              onRun={() => runCode("memory_profiling_rc_cycle_leak")}
              output={outputs.memory_profiling_rc_cycle_leak ?? null}
              isRunning={isRunning === "memory_profiling_rc_cycle_leak"}
              filename="rc_cycle_leak_detection.rs"
              expectedOutput={"bad strong = 2\ngood strong = 1\ngood parent = root"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.memory_profiling_rc_cycle_leak}
              onRevert={() => resetCode("memory_profiling_rc_cycle_leak")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Cycle</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A child holding a strong parent edge means the root can never reach strong count zero.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Weak edge</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `Weak` keeps reachability explicit without claiming ownership.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Profiling lesson</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Before you chase allocator details, prove whether the graph is logically collectible at all.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch34_memory_profiling/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor, including a small
              async budgeting example for local experimentation.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to find clone pressure in a sample workload, diagnose an `Rc` cycle leak,
            choose the right OS tools, and prepare a memory profiling checklist another engineer could use under incident
            pressure.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 34 Exercises
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

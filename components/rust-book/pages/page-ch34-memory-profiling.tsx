"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Start from lifetime shape, not a graph of bytes",
    body: "The first useful question is rarely 'how much memory do we use?' It is 'which values become owned here, how long do they live, and which boundary keeps them alive longer than expected?' Because Rust ties cleanup to ownership, a memory profile is really a map of who holds what and for how long. Read the ownership boundaries first and the byte counts will tell you a coherent story; read the byte counts first and you will guess.",
  },
  {
    title: "Allocation count, live heap, RSS, and fragmentation are four different signals",
    body: "A high allocation rate can mean churn with no leak at all. A flat live-heap line can still sit underneath a rising resident set, because the allocator is holding freed pages as a cache or the heap has fragmented. These are distinct failure modes with distinct repairs, and conflating them is the most common way to waste a profiling afternoon. A useful profile keeps the four signals on separate axes.",
  },
  {
    title: "Most async memory bugs are queue and concurrency bugs in disguise",
    body: "A runtime with thousands of spawned tasks, an unbounded channel, or oversized in-flight buffers can look exactly like a leak even though nothing is permanently unreachable. The memory is alive on purpose; the program simply admitted more work than it can drain. Before you reach for a heap profiler, treat backlog policy as part of the memory story: how deep can the queue get, how many tasks run at once, how big is each payload.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already know the difference between a leak, churn, and fragmentation, and your tools (Massif, heaptrack) mostly carry over. The mental shift is that the leaks you chased in C++ were usually missing frees, while in safe Rust the destructor always runs. What survives is retention by design: a reference-count cycle or a cache that is still reachable. Stop looking for the missing delete and start asking who still holds an owner.",
  },
  {
    title: "C# background",
    body: "There is no managed heap to dump and no GC pauses to read as a growth signal, so the dotnet-counters habit of watching gen-2 size does not transfer. Memory is deterministic instead: a value is freed the instant its owner drops. The trap is assuming that determinism means you can stop budgeting. You now own buffer sizing, queue depth, and retained shape explicitly, and nothing reclaims an unbounded channel for you.",
  },
  {
    title: "Go background",
    body: "You are used to pprof heap profiles and to growth caused by goroutine retention and escaped allocations. The Rust analogue of a leaked goroutine is a spawned task that keeps owning its payload, and the analogue of escape-to-heap pressure is deep clones on read paths. There is no background GC smoothing the curve, so an unbounded backlog shows up as monotonic RSS growth rather than rising GC frequency.",
  },
  {
    title: "Python background",
    body: "Coming from tracemalloc and objgraph, you think of memory in terms of object counts and reference cycles that the cyclic collector eventually sweeps. Rust has the same Rc/Arc cycle hazard but no collector to clean it up, so a cycle is a permanent leak rather than a deferred one. The upside is no per-object header overhead and no interpreter heap to fight: bytes map closely to your data, which makes a heap profile far easier to read.",
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

// Register it so every allocation in the program routes through this impl.
#[global_allocator]
static COUNTING_ALLOC: CountingAlloc = CountingAlloc;

unsafe impl GlobalAlloc for CountingAlloc {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        ALLOCS.fetch_add(1, Ordering::Relaxed);
        System.alloc(layout)
    }

    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        System.dealloc(ptr, layout)
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
  "Use heap profilers to compare snapshots across time, not only to inspect one large object graph once.",
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
          Memory profiling identifies where allocations, retention, and queue growth affect cost and reliability. This
          chapter connects Rust ownership decisions to measurable memory behavior.
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
            A burst load test shows the resident set climbing after a routine service release, and it does not fall back
            down when the burst ends. The graph alone cannot tell you what is wrong: the same upward curve is produced by
            allocation churn, by genuinely retained heap, by an allocator caching freed pages, by a reference-count cycle,
            by an arena that never resets, and by an async backlog of in-flight work. The job before touching capacity or
            rewriting code is to decide which of those it actually is. Guessing is expensive here, because each cause has a
            different repair and several of the repairs make the others worse.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The fastest way through is a fixed triage order rather than a favorite tool. Name the symptom precisely first,
            then measure allocation and retention together, then correlate the memory curve with the workload curve, and
            only then commit to a diagnosis. The flow below is the path this chapter follows; each branch maps to one of
            the core-concept sections that come after it.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Start[RSS climbing after release] --> Symptom{Name the symptom}\n  Symptom -->|allocs high, live flat| Churn[Clone pressure / churn]\n  Symptom -->|live flat, RSS high| Frag[Fragmentation / allocator cache]\n  Symptom -->|live heap rising| Retained{Reachable on purpose?}\n  Retained --> Cont[expand the retained branch below]`}
            caption="First half: name the symptom, then split churn and fragmentation off from genuinely retained heap."
          />
          <p className="text-sm text-muted-foreground leading-6">
            When the heap is genuinely retained, the second half decides why it is still reachable:
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Cont[Retained on purpose] -->|owner cycle| Cycle[Rc / Arc cycle]\n  Cont -->|queue or task holds it| Backlog[Async backlog]\n  Cont -->|region never resets| Arena[Arena retention]\n  Cycle --> Fix[Pick the matching repair]\n  Backlog --> Fix\n  Arena --> Fix`}
            caption="Second half: each retained leaf is one of the diagnoses the core-concept sections cover."
          />
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
            <h3 className="text-lg font-semibold text-foreground">How to frame a memory investigation</h3>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The cheapest signal in the whole toolbox is simply how often the program asks the allocator for memory and
              how many bytes it asks for. Those are two separate numbers and they describe two different problems. One
              hundred tiny allocations on every request is a count problem, usually solved by reusing a buffer or
              borrowing instead of cloning; one enormous allocation per request is a bytes problem, usually solved by
              streaming or trimming the payload. Measure them apart, and measure steady state apart from bursts, because a
              request spike often exposes churn that an average comfortably hides. Where a system has obvious batch
              lifetimes, per-phase or per-request counters localize the cost far better than a single process-wide total.
              Treat the absolute numbers as comparative: the question worth answering is not &ldquo;is 4,000 allocations a
              lot,&rdquo; it is &ldquo;which boundary started allocating twice as much after this change.&rdquo;
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-3">What to separate</div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {allocationNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">Counting allocator sketch</div>
                <p className="text-sm text-muted-foreground leading-6 mb-3">
                  A global allocator that wraps the system allocator and bumps an atomic counter on every call is the
                  smallest tool that answers the count question. It adds one relaxed atomic increment per allocation, so
                  it is cheap enough to leave behind a feature flag and read whenever a regression appears.
                </p>
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
            <h4 className="font-semibold text-foreground mb-3">Heap profiling: who allocated, and how much is still live</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A counter tells you that allocations rose; a heap profiler tells you where they came from and whether they
              are still alive. The two questions a good heap profile answers are which callsite allocated and how much of
              what it allocated is retained right now. That second question is the one that separates a function which
              allocates aggressively but releases immediately from a function which allocates modestly but holds on
              forever. The first is fine; the second is your leak. Heap profiles are also far more useful as deltas than as
              snapshots: one picture of a large object graph rarely says whether growth is a one-time warmup or steady
              accumulation, but two pictures taken at known points in the workload almost always do.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              In safe Rust the most common cause of allocation churn is the word <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">clone</code>,
              and the trap is that one verb covers two completely different operations. A deep clone of a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code> or{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;T&gt;</code> copies the entire
              backing buffer and allocates fresh heap; an <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc::clone</code> or{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc::clone</code> copies nothing but a
              pointer and bumps a counter. Both show up as &ldquo;a clone&rdquo; in review, but only one allocates. Most
              clone regressions are born not in the hot loop but in API shape: a helper that takes{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">String</code> by value when it only
              reads forces every caller to hand over an owned copy. Instrument deep clones separately from owner clones,
              start with a tiny local counter on the suspect path before you reach for a full heap profiler, and review the
              ownership in your signatures before you optimize the body of the function.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Safe Rust guarantees you will never read freed memory, but it does not guarantee that memory you no longer
              need will be freed. The destructor for a reference-counted value runs only when its strong count reaches
              zero, and a cycle keeps that count permanently above zero. The classic shape is a parent owning its children
              with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc&lt;T&gt;</code> while each child
              also owns a strong handle back to the parent: neither end can ever drop, so the whole subgraph leaks even
              though nothing in your code can still reach it. The fix is to make exactly one direction of the relationship
              non-owning. A back-edge that exists only to observe &mdash; a parent pointer, a listener registry, a cache
              index &mdash; should be a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Weak&lt;T&gt;</code>,
              which keeps the link without keeping the value alive. The diagram contrasts the two shapes; note that even
              without a cycle, a registry that never removes completed entries leaks just as effectively.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Leaks[Strong cycle - never freed]\n    P1[Parent] -->|strong| C1[Child]\n    C1 -->|strong back-edge| P1\n  end`}
              caption="A strong back-edge pins both ends forever, so neither can ever drop."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Making one direction non-owning turns the same shape into a collectible graph:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Frees[Weak back-edge - collectible]\n    P2[Parent] -->|strong| C2[Child]\n    C2 -.->|weak back-edge| P2\n  end`}
              caption="A Weak back-edge keeps the link without keeping the value alive, so the strong count can fall to zero."
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {leakNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Fragmentation and allocator retention</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Fragmentation is the gap between what your program logically holds and what the process resident set
              actually shows. When you free memory, the allocator does not necessarily hand the pages back to the
              operating system; it usually keeps them to satisfy the next request quickly. On top of that, a heap that
              mixes long-lived large buffers among short-lived small ones can end up unable to reuse the holes it creates,
              so resident memory stays high even after the live set has shrunk. This is why the single most clarifying
              measurement here is live bytes plotted against RSS. If live bytes are flat while RSS keeps climbing, you are
              almost certainly looking at fragmentation or allocator caching, not a leak &mdash; and the repair is an
              allocator or layout change, not a hunt for unreachable objects. Confirm it before you call it a leak; the
              two diagnoses lead to opposite fixes.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A bump arena trades per-object freeing for one bulk reset: allocations are nearly free and the memory is
              reclaimed all at once when the region resets. That is excellent for locality and churn, but it changes what
              you have to measure. Inside an arena, the relevant number is no longer how much is live right now but the
              peak region size between resets, because nothing inside is reclaimed until the whole region goes. An arena
              that is reset too rarely simply holds dead data until it does. The subtler failure is a lifetime mismatch: if
              a long-lived cache ends up holding data that the arena owns, the arena can no longer reset cleanly, and the
              symptom looks like an allocator problem when the real bug is that two lifetimes were wired together that
              should not have been. Profile peak size and reset cadence first, and treat anything that escapes the region
              as a design question rather than an allocator-tuning question.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Async memory growth usually traces back to a boundedness failure rather than a leak. When producers run
              faster than consumers and the channel between them is unbounded, the queue absorbs the difference, and every
              queued message keeps its payload alive. The same thing happens when tasks are spawned without a concurrency
              cap: each in-flight task owns its working set, and a thousand of them own a thousand working sets at once.
              Four numbers explain most of these spikes &mdash; queue depth, message age, in-flight task count, and bytes
              per message &mdash; and the important thing is that they are read together. The diagram shows why a bounded
              channel turns this from an accidental backlog reservoir into a visible budget: once the queue is full, the
              producer blocks instead of growing memory, which surfaces the imbalance as backpressure you can see rather
              than as RSS you discover later.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              What to look at in the sketch below: the four fields are tracked as one struct on purpose. A leak would move
              only one of them; an admission problem moves several at once, which is what tells the two apart.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Producer -->|messages| Channel{Channel bounded?}\n  Channel -->|no| Grow[Queue grows, RSS climbs]\n  Channel -->|yes, full| Backpressure[Producer blocks, visible budget]`}
              caption="First half: boundedness decides whether the imbalance becomes memory growth or visible backpressure."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Either way, the consumer side eventually drains and frees the payload:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Channel{Channel} --> Consumer[Consumer drains]\n  Consumer --> Drop[Payload dropped, memory freed]`}
              caption="Second half: draining the queue releases each message's payload, whichever policy the channel used."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-3">The four numbers</div>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The platform tools differ in name but cluster into three jobs that map onto the signals above: growth by
              callsite, resident-versus-logical disagreement, and timeline correlation with the workload. Reach for the
              callsite tool when you need to know who allocated, the resident-versus-logical tool when live bytes and RSS
              disagree, and the timeline tool when a memory spike needs to be lined up against queue waits and task counts.
              Pick the column for your platform, but choose the row by the question you are actually asking.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Once you have the curves, reading them correctly is most of the work. The same shape means different things
              depending on which signals move together, and the table below is the lookup. The recurring mistake is
              treating any rising line as a problem: an allocator releasing memory back to its own free lists is not the
              operating system reclaiming RSS, and a one-time jump after startup is often just caches and lookup tables
              becoming resident. Interpret the combination before you change a single line of code.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Reducing a footprint is usually a design repair before it is an allocator trick. The largest wins come from
              owning less data, and owning it in fewer places: borrow on read paths instead of cloning, shrink a payload
              before it crosses a queue or task boundary rather than carrying the same large blob everywhere, and flatten
              pointer-heavy intermediate structures where locality matters. Admission control belongs in the same toolbox
              &mdash; channel capacity, semaphore permits, and batch size are memory controls every bit as much as
              throughput controls, because they cap how much work can be alive at once. And the graph repairs from
              &ldquo;Detecting leaks with Rc and Arc cycles&rdquo; above apply directly: a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Weak&lt;T&gt;</code>{" "}
              breaks a non-owning edge, and promptly removing completed entries keeps a registry from quietly becoming a
              cache that never evicts.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {reductionNotes.map((note) => (
                <div key={note} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{note}</p>
                </div>
              ))}
            </div>
          </div>

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How to think about this coming from another language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Every one of these languages has a memory profiler you already trust, and the tools mostly transfer. What does
            not transfer is the mental model of where memory goes and what reclaims it. The shift that matters in Rust is
            that cleanup is tied to ownership and runs deterministically, which removes one whole class of bug and renames
            the rest. Read these as the assumption each background should drop at the door.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
              </div>
            ))}
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
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the flow is filter, then clone, then count. The filter chooses which records survive, and
              only the surviving records get cloned, so the clone count and cloned-byte total are a direct measure of how
              much owned data this path chose to duplicate. Watch the two counters move with the filter, not with the
              input size. The diagram is the shape the code implements.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Input[All records] --> Filter{Matches predicate?}\n  Filter -->|no| Skip[Skipped, borrowed only]\n  Filter -->|yes| Clone[Deep clone owned copy]\n  Clone --> Count[Bump clone + byte counters]\n  Count --> Out[Selected owned records]`}
              caption="Only records that pass the filter are cloned, so the counters measure exactly the deep-copy work this path chose."
            />
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
                <h4 className="font-semibold text-foreground">Example 2: find an Rc cycle before you call it a leak</h4>
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the program runs the same parent/child relationship twice and prints the parent strong
              count each time. In the first build the child holds a strong edge back to the parent, so the count stays at
              two and the subgraph can never drop &mdash; that is the leak. In the second build the back-edge is a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Weak&lt;T&gt;</code>, so the count
              returns to one and the parent is still reachable for reads. The number to track is the strong count, not the
              output text. The diagram traces that transition.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> StrongCycle\n  StrongCycle: Strong back-edge (strong=2)\n  StrongCycle --> Leaked: drop owner\n  Leaked: Still strong=2, never freed\n  [*] --> WeakEdge\n  WeakEdge: Weak back-edge (strong=1)\n  WeakEdge --> Freed: drop owner\n  Freed: strong=0, destructor runs`}
              caption="The strong back-edge pins the count at two; the Weak back-edge lets it fall to zero so cleanup can run."
            />
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
            profile async memory growth before calling it a leak, choose the right OS tools, and prepare a memory
            profiling checklist another engineer could use under incident pressure.
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

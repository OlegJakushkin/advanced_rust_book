"use client"

import { useEffect } from "react"
import { getPageIndexById } from "../page-index"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Users, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Pick the executor from the shape of the work, not from habit",
    body: "The first and most consequential decision is not which API to call but which kind of scheduler the work belongs on. Waiting on sockets, timers, and remote services wants an async runtime that can park thousands of in-flight operations on a handful of threads. Saturating every core with a dense numeric loop wants a work-stealing data-parallel pool. Coordinating a few long-lived threads through channels wants lower-level primitives. Tokio, Rayon, and Crossbeam are not competitors that do the same thing differently; they answer different questions, and reaching for the one you happen to know best is the most expensive mistake in this chapter.",
  },
  {
    title: "A task boundary is still an ownership boundary",
    body: "Whether the unit runs as a Tokio task, a Rayon job, or a plain thread, the rules from earlier chapters do not relax. A spawned future must be Send if the runtime can move it between worker threads; a closure handed to a thread must own or safely share everything it touches. The calm design is the same one good Rust always pushes toward: hand owned inputs across the boundary at the point of admission, produce an explicit output value, and keep borrowed views for work that stays local and short-lived. When the compiler complains about a spawn, it is usually telling you the ownership story at that boundary is not yet decided.",
  },
  {
    title: "Backpressure, cancellation, and retries are public contracts",
    body: "An unbounded queue, a task with no stop path, and a retry loop with no budget are not implementation details you can tune later. They are the parts of the design that decide how the system behaves at its worst moment, under overload, during a deploy, when a downstream dependency is slow. Make them visible: the queue capacity in a constructor argument, the shutdown signal in a clearly named channel, the retry budget as a counter another engineer can read. A reviewer should be able to point at the owner, the stop path, the retry limit, and the queue cap without opening six files.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You are used to choosing a concrete threading mechanism per problem (std::thread, a thread pool, OpenMP, TBB) and wiring them by hand. The shift is that in Rust the choice is expressed as which library's scheduler owns the work, and the type system enforces the boundary: Send and Sync decide what may cross a spawn, and a future that blocks a Tokio worker is a design error the way a long compute inside an I/O reactor would be. Treat Tokio, Rayon, and Crossbeam as three different execution models, not three flavors of std::thread.",
  },
  {
    title: "C# background",
    body: "Tokio tasks map most cleanly onto Task and async orchestration, and Rayon maps onto Parallel.For and PLINQ for CPU-bound loops. The trap is the thread pool you never think about in .NET: there, the runtime quietly grows the pool when work blocks, so a blocking call on an async path usually just costs a thread. In Rust there is no such elasticity, so a blocking call on a Tokio worker stalls unrelated futures, and you move it to spawn_blocking or Rayon deliberately rather than trusting the runtime to absorb it.",
  },
  {
    title: "Go background",
    body: "A goroutine hides the waiting-versus-computing distinction because the scheduler preempts and grows OS threads for you, so one go func handles both. Rust splits that into two tools on purpose: Tokio tasks are cheap futures for the waiting side, but they are cooperatively scheduled and will not preempt a tight CPU loop, and Rayon is the explicit answer for the compute side that a Go service often pushes to a worker pool or an external job. The mental shift is that 'just start a goroutine' becomes 'decide whether this work waits or burns, then choose the matching pool.'",
  },
  {
    title: "Python background",
    body: "Coming from asyncio you already know that CPU-bound work starves the event loop, and the usual escape is a ProcessPoolExecutor because the GIL blocks real thread parallelism. Rust removes the GIL constraint entirely: Rayon gives you genuine shared-memory parallelism across cores with no separate process and no pickling, while Tokio plays the asyncio role for I/O. The shift is that 'offload CPU work to processes' becomes 'run it in parallel threads in the same address space,' which is faster and simpler but puts ownership and Send back in your hands.",
  },
]

const toolCards = [
  {
    title: "Tokio tasks",
    fit: "IO-bound services and async orchestration",
    body: "Reach for Tokio when the core problem is waiting: sockets, timers, database and HTTP clients, or many concurrent in-flight operations whose cost is latency rather than computation. A spawned task is a future the runtime drives on a small pool of worker threads, so ten thousand idle connections cost ten thousand parked state machines, not ten thousand OS threads. The discipline that keeps this fast is to keep the worker threads non-blocking and push any CPU-heavy or blocking step off them explicitly.",
    code: `tokio::spawn(async move {
    handle_connection(stream).await
});`,
  },
  {
    title: "Rayon",
    fit: "CPU-bound data parallelism",
    body: "Reach for Rayon when the core problem is computation: one heavy collection or batch you want to spread across every core. Turning iter() into par_iter() splits the work over a work-stealing pool, so threads that finish early steal pending chunks from busier ones, which keeps uneven workloads balanced without manual scheduling. It is a parallel-iterator and fork-join engine, not an async runtime, so it has no concept of awaiting and should never sit on a socket.",
    code: `values.par_iter()
    .map(expensive_step)
    .sum::<u64>()`,
  },
  {
    title: "Crossbeam",
    fit: "Thread coordination below async service frameworks",
    body: "Reach for Crossbeam when you are coordinating a handful of long-lived threads outside an async runtime: scoped threads that can safely borrow stack data, bounded MPMC channels, selection over several channels, and lock-free building blocks. It is the calm answer for a thread-based pipeline where async would add a runtime you do not need, and it pairs well with Rayon when one stage is a parallel compute and the next is a sequential drain.",
    code: `let (tx, rx) = crossbeam::channel::bounded(1024);`,
  },
  {
    title: "The futures crate",
    fit: "Executor-agnostic async composition",
    body: "Reach for the futures crate when you want to treat a set of futures as data and drive them together without giving each one its own task. FuturesUnordered polls many futures and yields results as they complete; join_all and try_join_all wait for a whole batch. The distinction worth holding onto is that Tokio schedules tasks onto a runtime, while the futures crate composes futures in place, which is often calmer when the work does not need a separate task boundary.",
    code: `let mut pending = FuturesUnordered::new();`,
  },
]

const orchestrationCards = [
  {
    title: "JoinSet for spawned Tokio work",
    body: "Use `JoinSet` when each unit should become an owned Tokio task and you want to drain results as they finish rather than in submission order.",
  },
  {
    title: "FuturesUnordered for local future sets",
    body: "Use `FuturesUnordered` when the futures themselves are the unit you want to poll together. This is often calmer than spawning when the work does not need a separate task boundary.",
  },
  {
    title: "select! for stop, timeout, or alternate readiness paths",
    body: "Use `tokio::select!` or a futures-side selection pattern when progress depends on whichever signal arrives first: queue item, shutdown flag, timeout, or cancellation event.",
  },
  {
    title: "Retry outside the hot task body when possible",
    body: "A retry loop is often easier to review when it lives in one orchestration layer with budgets, delay policy, and logging, instead of being copied into every task closure.",
  },
]

const workloadCards = [
  {
    title: "IO-bound workloads",
    body: "Network servers, database and cache clients, timers, and fan-out waits spend most of their wall-clock time idle, waiting for bytes to arrive. The win from an async runtime is that an idle await costs a parked state machine, not a blocked OS thread, so concurrency scales to tens of thousands of connections on a few workers. The job here is admission control and bounded fan-out, not raw thread count: the threads are rarely the bottleneck, the queues are.",
  },
  {
    title: "CPU-bound workloads",
    body: "Parsing, compression, hashing, search indexing, image and signal transforms, and numeric kernels keep a core busy for the whole operation. There is no waiting to overlap, so the only lever is real parallelism across cores, which is exactly what a Rayon pool or a set of dedicated threads provides. Use spawn_blocking only as a narrow bridge when an otherwise-async service has one blocking step; if the CPU stage dominates, give it a real pool with its own budget instead of leaning on the bridge.",
  },
]

const threadPoolCards = [
  {
    title: "Tokio runtime worker pool",
    body: "Runs async tasks and should stay focused on non-blocking work. A task that blocks here steals progress from unrelated futures.",
  },
  {
    title: "Tokio blocking pool",
    body: "Runs closures submitted through `spawn_blocking`. Useful for bridging async orchestration with CPU-heavy or legacy blocking code, but still a finite shared resource worth measuring.",
  },
  {
    title: "Rayon work-stealing pool",
    body: "Runs CPU-bound data-parallel work. Work stealing helps uneven chunk sizes and fork-join style computation far more than it helps socket waiting.",
  },
  {
    title: "Custom thread pools or dedicated workers",
    body: "Useful when the workload has strict affinity, isolation, or lifecycle needs that a general-purpose pool should not own. Reach for this only when the simpler pools no longer match the system shape.",
  },
]

const backpressureChecklist = [
  "Prefer bounded queues when producer slowdown is healthier than unbounded memory growth.",
  "Budget concurrency separately from queue size. A short queue and an unbounded spawn rate still produce overload.",
  "If a task set fans out to external services, add explicit caps so one slow dependency does not create unlimited in-flight work.",
  "Treat retries as another source of load. Retry queues need their own limits and observability.",
  "Measure queue depth, in-flight task count, pool saturation, and tail latency before declaring the pipeline stable.",
]

const cancellationCards = [
  {
    title: "Cancellation should be explicit",
    body: "Use shutdown channels, watch signals, timeouts, abort handles, or scope lifetimes deliberately. Do not rely on process exit or runtime drop as the only stop story.",
  },
  {
    title: "Retry needs a budget and a reason",
    body: "A retry counter, backoff policy, and stop condition belong in the design. Without them, a retry loop is just delayed overload.",
  },
  {
    title: "Cleanup should follow ownership",
    body: "Own the resources inside the task or worker unit so cancellation and teardown naturally drop the right state without hidden global bookkeeping.",
  },
]

const apiDesignRules = [
  "Accept owned work items at real task or thread boundaries. Borrow locally, own at admission or queue handoff.",
  "Separate orchestration APIs from CPU kernels. A `par_iter` transform and a Tokio admission loop should not be one abstraction.",
  "Return structured outcomes such as success, retryable failure, or cancellation instead of hiding them in logs.",
  "Make capacity, concurrency, and retry budget visible in configuration or constructor arguments rather than in one deep private constant.",
  "Attach observability to the API surface: queue depth, retries, cancellation count, and task duration all belong near the boundary.",
]

const productionPatterns = [
  "Use Tokio for waiting-heavy orchestration, Rayon for CPU-heavy batch work, and Crossbeam where thread-based coordination is the natural fit.",
  "Use `JoinSet` when spawned Tokio tasks are the unit of ownership. Use `FuturesUnordered` when local futures are the unit of composition.",
  "Prefer bounded queues and explicit concurrency caps over unbounded spawn and hope-based backlog control.",
  "Treat `spawn_blocking` as a bridge, not as a place to hide an entire CPU pipeline forever. If the CPU stage dominates, give it a real pool and budget.",
  "Design task APIs so another engineer can point at the owner, the stop path, the retry budget, and the queue cap without opening six files.",
]

const pitfalls = [
  "Leaving CPU-heavy work on Tokio runtime workers and then blaming async when latency climbs under load.",
  "Nesting unbounded Tokio spawn, unbounded queues, and unbounded retries in one pipeline. That is an overload policy, not an implementation detail.",
  "Using Rayon for waiting-heavy network work or Tokio tasks for dense CPU loops without a clear reason.",
  "Treating Crossbeam channels as a drop-in answer everywhere without deciding whether the subsystem wants one mutable owner or many task-local owners.",
  "Designing task APIs that hide cancellation or retry policy in closures instead of making those controls visible to callers and reviewers.",
]

export function PageCh26TaskLibrariesAndParallelExecution() {
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
  const pageIndex = 54
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
          Chapter 26 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Parallel execution requires matching the library to the workload: async IO, CPU-bound data parallelism, scoped
          threads, or coordination primitives. This chapter compares those choices through ownership and scheduling.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 22 through 25</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 22 covered OS threads and ownership across them. Chapter 23 covered synchronization and visibility.
                Chapter 24 explained futures and async state machines. Chapter 25 explained Tokio itself. This chapter puts
                those models side by side with Rayon, Crossbeam, and the futures crate.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch22-multithreading-in-rust"))}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch23-synchronization-primitives"))}>
                Chapter 23
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch24-coroutines-futures-and-async-rust"))}>
                Chapter 24
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch25-tokio"))}>
                Chapter 25
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A service has a socket-heavy front door, CPU-heavy enrichment, bounded control-plane queues, and retry
            handling under overload. The business requirement is to match each execution lane to its workload: Tokio for
            waiting, Rayon for CPU-parallel batches, Crossbeam for thread coordination, and futures combinators for local
            async orchestration.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Ask whether the work is mostly waiting or mostly burning CPU.</li>
              <li>Ask whether the unit should be a spawned task, a local future, a pool job, or a channel message.</li>
              <li>Ask where backpressure and cancellation should be visible.</li>
              <li>Then choose Tokio, Rayon, Crossbeam, futures utilities, or a combination.</li>
            </ol>
          </div>
          <p className="mt-4 text-sm text-muted-foreground leading-6">
            The same decision drawn as a flow: one question about the nature of the work splits almost every case, and a
            second question about whether you want a runtime-owned task or a locally driven future splits the rest.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Start[New unit of work] --> Q1{Mostly waiting<br/>or mostly CPU?}\n  Q1 -->|waiting on IO| Q2{Own a task<br/>or drive locally?}\n  Q1 -->|burning CPU| Rayon[Rayon<br/>parallel pool]\n  Q2 -->|own a task| Tokio[tokio spawn<br/>or JoinSet]\n  Q2 -->|drive in place| Futures[FuturesUnordered<br/>or join_all]\n  Q1 -->|threads only| Crossbeam[Crossbeam channels<br/>and scope]`}
            caption="The workload nature decides the executor family; the ownership question then picks the exact tool within the async branch."
          />
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
            <h4 className="font-semibold text-foreground mb-3">The tool families at a glance</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {toolCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-medium text-foreground">{card.title}</div>
                    <span className="text-xs uppercase tracking-[0.2em] text-primary">{card.fit}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Async task orchestration</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {orchestrationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A useful distinction is this: use <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">JoinSet</code> when
                runtime-spawned tasks are the unit you own. Use{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">FuturesUnordered</code> when you already
                have futures and only need to drive them together.
              </p>
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The two differ in where the work actually runs. A{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">JoinSet</code> hands each future to the
              runtime as an independent task, so the runtime&apos;s worker threads make progress on them even while you are
              not awaiting the set. A <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">FuturesUnordered</code>{" "}
              keeps the futures inside your own task and only advances them while you poll the collection, so it never
              crosses a task boundary and never requires the futures to be Send.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  J[JoinSet] -->|spawn| T1[runtime task 1]\n  J -->|spawn| T2[runtime task 2]\n  T1 --> RW[runtime worker threads]\n  T2 --> RW`}
              caption="JoinSet path: each future becomes a separate runtime task that the worker threads advance on their own."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The local path keeps every future inside one task instead, so nothing crosses a task boundary:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  F[FuturesUnordered] -->|polled in place| FA[future a]\n  F -->|polled in place| FB[future b]\n  FA --> ME[your single task]\n  FB --> ME`}
              caption="FuturesUnordered path: futures advance inside your own task only while you poll the collection, so they never need to be Send."
            />
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              In code the local path is small: push the futures into the set, then drain them with{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">next().await</code> as each one
              completes. Nothing is spawned, so the futures stay inside this task.
            </p>
            <pre className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`use futures::stream::{FuturesUnordered, StreamExt};

let mut pending = FuturesUnordered::new();
for id in [1_u32, 2, 3] {
    pending.push(async move { id * 2 });
}

let mut total = 0;
while let Some(value) = pending.next().await {
    total += value; // results arrive as each future finishes
}`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">CPU-bound vs IO-bound workloads</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {workloadCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The usual production bug is not using the wrong syntax. It is running CPU-heavy work on the async worker pool
                or using an async runtime where a straight CPU pool would have been clearer and faster.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Thread pools</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A production service rarely has just one pool. The shape that keeps latency predictable is to route each kind
              of work to the pool built for it: async tasks on the Tokio worker pool, blocking bridges on the Tokio
              blocking pool, dense compute on a Rayon pool. The diagram below shows the routing, and the one edge to avoid
              is a CPU loop landing directly on a Tokio worker, where it stalls every unrelated future on that thread.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Req[Incoming work] --> Async[Async task]\n  Req --> Block[Blocking or<br/>legacy call]\n  Req --> CPU[CPU-heavy batch]\n  Async --> TW[Tokio<br/>worker pool]\n  Block -->|spawn_blocking| TB[Tokio<br/>blocking pool]\n  CPU -->|par_iter or<br/>send to pool| RP[Rayon<br/>work-stealing pool]\n  CPU -.->|wrong, stalls futures| TW`}
              caption="Async work stays on Tokio workers, blocking calls move to the blocking pool, and CPU batches go to Rayon. The dotted edge is the bug to avoid."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {threadPoolCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Backpressure and bounded queues</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {backpressureChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Cancellation and retry patterns</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {cancellationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Designing task APIs</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              When you wrap any of this into a reusable subsystem, expose these concerns at the API boundary rather than
              hiding them in the implementation. The examples below show the same patterns in working code, so it helps
              to read those first and treat these as the rules they illustrate.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {apiDesignRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
            </div>
          </div>

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">What changes by background</h3>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Engineers arriving from other languages tend to carry one habit that misfires here: a single concurrency
              tool that quietly covered both waiting and computing. Rust splits that into separate executors on purpose, so
              the useful mental adjustment is less about syntax and more about which assumption from your previous runtime
              no longer holds.
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
                The most common mistake is solving all concurrency with the library you learned first. Tokio, Rayon,
                Crossbeam, and futures combinators are complementary, not interchangeable.
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
                <h4 className="font-semibold text-foreground">
                  Example 1: Tokio tasks, JoinSet, bounded admission, and a visible shutdown signal
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The queue is bounded, tasks are explicit runtime units, and retry accounting stays in one orchestration
                  shell instead of being hidden inside many handlers.
                </p>
              </div>
              {codes.task_libraries_tokio_orchestration !== DEFAULT_CODES.task_libraries_tokio_orchestration && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("task_libraries_tokio_orchestration")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: every job flows through one bounded channel before it ever becomes a task, the tasks live in
              a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">JoinSet</code> that drains results as
              they finish, and the retry and shutdown bookkeeping stays in the orchestration shell rather than scattered
              across handlers. Trace that path in the diagram before reading the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Prod[Producer] -->|send, blocks if full| Ch[(bounded mpsc, cap 2)]\n  Ch --> Adm[Admission loop]\n  Adm -->|spawn task| JS[JoinSet]\n  JS --> W1[task: process job]\n  JS --> W2[task: process job]\n  W1 -->|ok| Done[completed count]\n  W2 -->|transient err| Re[retry within budget]\n  Re --> JS\n  Shut[shutdown flag] -.->|observed at drain| Adm`}
              caption="Producers push into a bounded channel; the admission loop spawns each job into the JoinSet, accounts retries centrally, and watches one shutdown flag."
            />
            <RustCodeEditor
              code={codes.task_libraries_tokio_orchestration}
              onChange={(newCode) => updateCode("task_libraries_tokio_orchestration", newCode)}
              onRun={() => runCode("task_libraries_tokio_orchestration")}
              output={outputs.task_libraries_tokio_orchestration ?? null}
              isRunning={isRunning === "task_libraries_tokio_orchestration"}
              filename="tokio_joinset_backpressure.rs"
              expectedOutput={"buffer = 2\ncompleted = 3\nretries = 1\ncancelled = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.task_libraries_tokio_orchestration}
              onRevert={() => resetCode("task_libraries_tokio_orchestration")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tokio tasks</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `tokio::spawn` creates owned runtime tasks. `JoinSet` drains them as they finish.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Backpressure</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The `mpsc` capacity is visible at the boundary, so producer speed already has a budget.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Shutdown signal</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The worker drains its queue, then observes an explicit shutdown flag at exit. Wiring the signal in once
                  here makes adding real mid-flight cancellation, with select! and abort, a small step rather than a
                  redesign.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: Rayon CPU pool plus Crossbeam bounded queue
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One pool owns the CPU-parallel loop. One bounded queue controls intake. This is a clearer model than
                  forcing a waiting-oriented runtime to do dense CPU scheduling.
                </p>
              </div>
              {codes.task_libraries_rayon_crossbeam !== DEFAULT_CODES.task_libraries_rayon_crossbeam && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("task_libraries_rayon_crossbeam")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the bounded Crossbeam channel is the only intake, each batch that comes off it is handed to
              Rayon&apos;s parallel iterator so the work fans across the pool and rejoins into one sum, and the two stages
              stay separate (admission is sequential, compute is parallel). The diagram shows that split before the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Src[Batches] -->|send, bounded| Q[(crossbeam bounded queue)]\n  Q --> Drain[Sequential drain]\n  Drain -->|per batch| PI[par_iter over batch]\n  PI --> T1[pool thread]\n  PI --> T2[pool thread]\n  T1 --> Sum[reduce to scaled total]\n  T2 --> Sum`}
              caption="Admission is one sequential bounded queue; the per-batch compute fans out across the Rayon pool and reduces back to a single total."
            />
            <RustCodeEditor
              code={codes.task_libraries_rayon_crossbeam}
              onChange={(newCode) => updateCode("task_libraries_rayon_crossbeam", newCode)}
              onRun={() => runCode("task_libraries_rayon_crossbeam")}
              output={outputs.task_libraries_rayon_crossbeam ?? null}
              isRunning={isRunning === "task_libraries_rayon_crossbeam"}
              filename="rayon_crossbeam_bounded_pipeline.rs"
              expectedOutput={"batches = 3\nscaled total = 110\npool threads = 2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.task_libraries_rayon_crossbeam}
              onRevert={() => resetCode("task_libraries_rayon_crossbeam")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Rayon</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `par_iter` and a small CPU pool make batch arithmetic parallel without manual thread choreography.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Crossbeam</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The bounded channel makes admission policy visible and keeps the thread-based pipeline simple.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Thread pool choice</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This is CPU work, so a work-stealing data-parallel pool is the right boundary.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch26_task_libraries_and_parallel_execution/
              </code>{" "}
              including an extra <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">FuturesUnordered</code>{" "}
              fan-in example for the futures crate path.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to choose Tokio, Rayon, Crossbeam, or futures combinators from real
            workload shape, implement a bounded worker queue, and add retry and cancellation behavior to task orchestration.
          </p>
          <Button onClick={() => setCurrentPage(55)} className="gap-2">
            Open Chapter 26 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Tokio is the right default for waiting-heavy service orchestration, not for every CPU-heavy inner loop.</li>
            <li>Rayon is the right default for CPU-bound data parallelism, especially when work stealing helps uneven batches.</li>
            <li>Crossbeam remains a strong tool for thread-based coordination, bounded queues, and scoped concurrency outside async runtimes.</li>
            <li>The futures crate helps compose futures as data, while Tokio&apos;s task tools help schedule runtime-owned async work.</li>
            <li>Backpressure, cancellation, retry budgets, and queue capacity should be visible in task APIs and production metrics.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

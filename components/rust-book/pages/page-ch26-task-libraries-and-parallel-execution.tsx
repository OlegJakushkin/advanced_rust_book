"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Choose the library from the workload, not from fashion",
    body: "Tokio tasks, Rayon jobs, Crossbeam coordination, and futures combinators solve different scheduling problems. The right first question is what kind of work you have: waiting, CPU saturation, shared-state coordination, or async orchestration.",
  },
  {
    title: "A task boundary is still an ownership boundary",
    body: "Whether the unit runs on a Tokio runtime, a Rayon pool, or a plain thread, owned inputs and explicit outputs keep the design reviewable. Borrowed views are strongest when the work stays local and bounded in lifetime.",
  },
  {
    title: "Backpressure, cancellation, and retries are part of the API",
    body: "A queue without limits, a task without a stop path, or a retry loop without a budget is not only an implementation detail. It is a production contract that should be visible in the design.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Think in terms of explicit executor choice rather than one generic thread abstraction. Tokio is not a thin thread wrapper, Rayon is not an async runtime, and Crossbeam is not only a channel crate. Each one maps to a different operational model.",
  },
  {
    title: "C# background",
    body: "Tokio tasks feel closest to Task-based async orchestration, while Rayon feels closer to CPU-focused parallel loops. Rust makes the distinction sharper because ownership transfer, Send, and blocking boundaries are part of ordinary type and API design.",
  },
  {
    title: "Go background",
    body: "Tokio tasks are cheaper than OS threads, but they are still futures scheduled by a runtime, not goroutines with ambient preemption semantics. Rayon covers the CPU-bound side that many Go services leave to worker pools or external jobs.",
  },
]

const toolCards = [
  {
    title: "Tokio tasks",
    fit: "IO-bound services and async orchestration",
    body: "Use Tokio when the core problem is waiting on sockets, timers, async clients, or many concurrent in-flight operations. Spawn tasks for concurrency, and move blocking or CPU-heavy work off the runtime workers explicitly.",
    code: `tokio::spawn(async move {
    handle_connection(stream).await
});`,
  },
  {
    title: "Rayon",
    fit: "CPU-bound data parallelism",
    body: "Use Rayon when the core problem is splitting one CPU-heavy collection or batch across worker threads. `par_iter`, `par_chunks`, and custom pools make parallel loops easier than hand-rolling many short-lived threads.",
    code: `values.par_iter()
    .map(expensive_step)
    .sum::<u64>()`,
  },
  {
    title: "Crossbeam",
    fit: "Thread coordination below async service frameworks",
    body: "Use Crossbeam when you want scoped threads, bounded channels, selection over channel events, or lower-level concurrent building blocks outside a Tokio runtime. It is excellent glue for thread-based pipelines.",
    code: `let (tx, rx) = crossbeam::channel::bounded(1024);`,
  },
  {
    title: "The futures crate",
    fit: "Executor-agnostic async composition",
    body: "Use `FuturesUnordered`, `join_all`, `try_join_all`, and related combinators when you need to orchestrate many futures as data rather than immediately spawning them onto a runtime. Tokio schedules tasks; the futures crate helps compose futures.",
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
    body: "Network servers, database clients, timers, and fan-out waits want async runtimes and bounded admission. The runtime wins because waiting does not need one OS thread per in-flight unit.",
  },
  {
    title: "CPU-bound workloads",
    body: "Parsing, compression, search indexing, dense transforms, hashing, and numeric kernels want explicit CPU pools: Rayon, dedicated threads, or `spawn_blocking` when the async shell only needs one blocking escape hatch.",
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
  const pageIndex = 50
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
              <Button variant="outline" onClick={() => setCurrentPage(42)}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(44)}>
                Chapter 23
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(46)}>
                Chapter 24
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(48)}>
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
            <div className="grid gap-3 lg:grid-cols-2">
              {apiDesignRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Coming from C++, C#, or Go</h4>
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
          <Button onClick={() => setCurrentPage(51)} className="gap-2">
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

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
    title: "A Tokio task is a scheduled future, not an OS thread",
    body: "Tokio runs many futures on a smaller set of runtime worker threads. A task only makes progress when the runtime polls it, and it only stops monopolizing a worker when it reaches an await point or otherwise yields.",
  },
  {
    title: "The runtime is scheduler plus drivers",
    body: "A Tokio runtime combines task scheduling with IO and timer drivers. The scheduler polls ready tasks, the IO driver wakes tasks when sockets become ready, and the timer driver wakes tasks when deadlines fire.",
  },
  {
    title: "Blocking work is a boundary decision",
    body: "Async code is excellent for waiting. CPU-heavy or legacy blocking work belongs on a blocking pool or a separate thread boundary. The design is calmer once that distinction is explicit.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Tokio is not a thin wrapper over `std::thread`. It is closer to an event loop plus a future scheduler. The key Rust difference is that ownership, `Send`, and lifetime rules still shape task boundaries directly.",
  },
  {
    title: "C# background",
    body: "Tokio tasks overlap conceptually with `Task`-based async code, but the runtime model is more explicit. A spawned future on the multithread runtime usually needs `Send + 'static`, and blocking work must be moved off the worker threads deliberately.",
  },
  {
    title: "Go background",
    body: "Tokio tasks may feel superficially goroutine-like, but the execution model is different. They are poll-driven futures that yield at await points. They are cheaper than OS threads, but they are not preemptive goroutines with ambient shared-memory conventions.",
  },
]

const runtimeArchitectureCards = [
  {
    title: "Scheduler",
    body: "Ready tasks are polled on runtime workers. On the multithread runtime, tasks may move between workers, which is why spawned futures usually need `Send`.",
  },
  {
    title: "IO driver",
    body: "Sockets are registered with the runtime so readiness wakes the right task instead of blocking a whole thread on each connection.",
  },
  {
    title: "Timer driver",
    body: "Sleep, interval, and timeout APIs are part of the runtime. Timers are not busy loops. They are driver-backed wakeups.",
  },
  {
    title: "Blocking pool",
    body: "`spawn_blocking` runs closures on a separate pool intended for blocking or CPU-heavy work so the async scheduler can keep making progress.",
  },
]

const taskBoundaryCards = [
  {
    title: "`tokio::spawn`",
    body: "Use this for async work that should run concurrently on the runtime. On the multithread runtime, the future and its output must satisfy the runtime's thread-transfer requirements, so captured values usually need to be owned and `Send`.",
    code: `let handle = tokio::spawn(async move {
    // async work
    42_u32
});`,
  },
  {
    title: "`tokio::task::spawn_blocking`",
    body: "Use this for CPU-bound parsing, compression, hashing, image work, or legacy blocking APIs. The closure runs on the blocking pool and returns one owned result back to the async side.",
    code: `let handle = tokio::task::spawn_blocking(move || {
    expensive_parse(bytes)
});`,
  },
  {
    title: "A task boundary is an ownership boundary",
    body: "If the spawned work may outlive the current stack frame, borrowed request-local data is usually the wrong shape. Move owned values into the task, or keep the work local and synchronous.",
    code: `tokio::spawn(async move {
    process(job).await
});`,
  },
]

const channelCards = [
  {
    title: "mpsc",
    body: "Good for owned work queues and result streams. Prefer bounded channels when producer speed should slow down under load instead of growing memory without limit.",
  },
  {
    title: "oneshot",
    body: "Good for one reply, one stop signal, or one completion handoff between tasks.",
  },
  {
    title: "watch",
    body: "Good for latest-state propagation such as config snapshots or shutdown flags where receivers only care about the newest value.",
  },
  {
    title: "broadcast",
    body: "Good for fan-out event delivery when several receivers should each observe the same published item stream.",
  },
]

const gracefulShutdownSteps = [
  "Pick one shutdown signal path early: `ctrl_c`, `oneshot`, `watch`, or a similar explicit stop channel.",
  "Stop admission first. For servers, that usually means breaking the accept loop before process exit.",
  "Tell background tasks to drain and finish rather than dropping the runtime under them abruptly.",
  "Bound shutdown with timeouts and log what did not finish cleanly.",
  "Close senders when appropriate so receivers wake up and see end-of-stream instead of waiting forever.",
]

const backpressureChecklist = [
  "Prefer bounded `mpsc` queues for internal pipelines when backlog should push back on producers.",
  "Limit concurrent request or connection handling with a semaphore or an explicit worker budget.",
  "Treat `spawn` rate as a resource. An unbounded task flood is a memory policy, not a neutral default.",
  "Put timeouts around slow dependencies so one stalled hop does not pin unbounded in-flight work.",
  "Measure queue depth, in-flight task count, accept backlog, and blocking-pool pressure in production.",
]

const operationalCards = [
  {
    title: "Async filesystem APIs",
    body: "Tokio's filesystem APIs are convenient integration points, but they do not make disk latency disappear. On many platforms, file work still routes through blocking machinery under the hood. Keep bulk file processing bounded.",
    code: `let config = tokio::fs::read_to_string("config.json").await?;
tokio::fs::write("cache.tmp", config.as_bytes()).await?;`,
  },
  {
    title: "Async UDP",
    body: "UDP is a socket-oriented loop, not a connection-per-peer model. One task can often receive datagrams, inspect sender addresses, and reply directly without inventing a connection abstraction.",
    code: `let socket = tokio::net::UdpSocket::bind("127.0.0.1:0").await?;
let mut buf = [0_u8; 1024];
let (n, peer) = socket.recv_from(&mut buf).await?;
socket.send_to(&buf[..n], peer).await?;`,
  },
  {
    title: "Timers and intervals",
    body: "Intervals are scheduler wakeups, not background threads. They are useful for heartbeats, metrics flushes, expiry scans, and load-shedding loops that should yield cleanly between ticks.",
    code: `let mut tick = tokio::time::interval(std::time::Duration::from_secs(1));
tick.tick().await;
tick.tick().await;`,
  },
]

const productionPatterns = [
  "Keep the async shell thin. Parsing, validation, and domain decisions can stay synchronous until real IO or scheduling boundaries appear.",
  "Use `tokio::spawn` for concurrent async work, and use `spawn_blocking` or a dedicated thread boundary for CPU-heavy or legacy blocking work.",
  "Prefer bounded channels and explicit concurrency caps over unbounded task fan-out.",
  "Treat graceful shutdown as part of the design, not as a signal handler glued on after the service already works.",
  "Own values across task boundaries. Borrow locally, but do not pass request-local references into spawned work that may outlive the stack frame.",
  "Instrument queue depth, shutdown latency, accept errors, and blocking-pool usage before calling the service production-ready.",
]

const pitfalls = [
  "Calling blocking code from an async task on the runtime workers. `std::fs`, CPU-heavy compression, long JSON parsing, or thread sleep in the wrong place can stall unrelated tasks.",
  "Using `tokio::spawn` as the answer to every concurrency problem. Unbounded spawn rate is a memory and scheduling policy, not free parallelism.",
  "Choosing unbounded channels by default and only discovering backlog when memory grows under load.",
  "Ignoring cancellation and shutdown until deployment. Accept loops, background workers, and channel receivers all need a stop story.",
  "Turning the whole service into `Arc<Mutex<_>>` shared state instead of keeping one owner per mutable subsystem where possible.",
  "Confusing runtime concurrency with true parallel CPU throughput. Tokio handles waiting extremely well, but CPU work still needs explicit budgeting and placement.",
]

export function PageCh25Tokio() {
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
  const pageIndex = 48
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
          Chapter 25 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Tokio provides the runtime layer for network services, timers, tasks, and blocking work isolation. This chapter
          covers backpressure, task ownership, shutdown, and runtime configuration.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 22, 23, and 24</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 22 established OS-thread boundaries and message passing. Chapter 23 covered synchronization and
                visibility. Chapter 24 explained futures, `async fn`, and `Pin`. Tokio turns those concepts into an
                operational runtime for production services.
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
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            An ingress service accepts TCP traffic, sends owned jobs through internal queues, reads filesystem snapshots,
            handles UDP health messages, and must shut down without losing in-flight work. The business requirement is to
            use Tokio where work is waiting, isolate blocking or CPU-heavy stages, bound internal queues, and make graceful
            shutdown part of the runtime contract.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">Repository note</h4>
            <p className="text-sm text-muted-foreground leading-6">
              The in-browser editor simulates output so you can focus on runtime shape. In a real Cargo project, the Tokio
              dependency normally enables the runtime, macros, time, net, fs, sync, and signal features used by this chapter.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">Tokio runtime architecture</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {runtimeArchitectureCards.map((card) => (
                    <div key={card.title} className="rounded-lg border border-border bg-card p-4">
                      <div className="font-medium text-foreground mb-2">{card.title}</div>
                      <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-3 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`socket readiness  -> IO driver marks task ready
timer deadline    -> timer driver marks task ready
ready task queue  -> scheduler polls future
blocking closure  -> blocking pool thread`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  In service code, the usual default is the multithread runtime because it can schedule `Send` tasks on a
                  pool of worker threads. A current-thread runtime is still valid when the application is small, embedded,
                  or intentionally local-task oriented.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Tasks and scheduling</h4>
            <p className="text-sm text-muted-foreground leading-6">
              A Tokio task is one future scheduled by the runtime. It is cheap enough to use widely, but not free enough to
              spray without a policy. A task that does not reach await points can monopolize a worker thread. A service that
              spawns without bounds can create its own backlog and memory pressure even if every individual task is small.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {taskBoundaryCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A common production mistake is to use `tokio::spawn` where the real issue was concurrency control. Spawning
                faster than downstream work can finish is not throughput. It is queue growth with nicer syntax.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {operationalCards.map((card) => (
              <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                <h4 className="font-semibold text-foreground mb-3">{card.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                <pre className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{card.code}</code>
                </pre>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Tokio channels</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {channelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Bounded `mpsc` is one of the simplest backpressure tools in Tokio. If a producer should slow down when the
                consumer falls behind, make the capacity explicit instead of discovering the policy later from memory graphs.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">Graceful shutdown</h4>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                {gracefulShutdownSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`tokio::select! {
    _ = tokio::signal::ctrl_c() => break,
    _ = shutdown_rx.changed() => break,
    accept = listener.accept() => { /* ... */ }
}`}</code>
              </pre>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">Backpressure</h4>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {backpressureChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`let permit = semaphore.clone().acquire_owned().await?;
tokio::spawn(async move {
    let _permit = permit;
    handle_request(job).await;
});`}</code>
              </pre>
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
            <h3 className="text-lg font-semibold text-foreground">Production Tokio patterns</h3>
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
                Tokio is excellent at waiting and multiplexing. It is not a free pass to ignore CPU budgets, queue budgets,
                cancellation, or ownership. The runtime gets calmer when those policies are explicit in the design.
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
                  Example 1: bounded channel, interval pacing, and `spawn_blocking`
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The queue is bounded, so producer speed has a budget. The async side waits on the channel and timer, and
                  the CPU step moves to the blocking pool explicitly.
                </p>
              </div>
              {codes.tokio_tasks_backpressure_spawn_blocking !== DEFAULT_CODES.tokio_tasks_backpressure_spawn_blocking && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("tokio_tasks_backpressure_spawn_blocking")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.tokio_tasks_backpressure_spawn_blocking}
              onChange={(newCode) => updateCode("tokio_tasks_backpressure_spawn_blocking", newCode)}
              onRun={() => runCode("tokio_tasks_backpressure_spawn_blocking")}
              output={outputs.tokio_tasks_backpressure_spawn_blocking ?? null}
              isRunning={isRunning === "tokio_tasks_backpressure_spawn_blocking"}
              filename="task_boundaries_and_backpressure.rs"
              expectedOutput={"buffer = 1\nbatches = 2\ntotal = 15"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.tokio_tasks_backpressure_spawn_blocking}
              onRevert={() => resetCode("tokio_tasks_backpressure_spawn_blocking")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Backpressure</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `mpsc::channel(1)` forces producer and consumer speed to meet instead of buffering without limit.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Task boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Async waiting stays on runtime workers; the CPU subtotal step moves behind `spawn_blocking`.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Timer</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The interval is a runtime wakeup, not a background thread and not a busy loop.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: TCP accept loop with graceful shutdown</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The listener owns admission, per-connection work is spawned deliberately, and a watch signal stops the
                  accept loop cleanly before process exit.
                </p>
              </div>
              {codes.tokio_tcp_graceful_shutdown !== DEFAULT_CODES.tokio_tcp_graceful_shutdown && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("tokio_tcp_graceful_shutdown")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.tokio_tcp_graceful_shutdown}
              onChange={(newCode) => updateCode("tokio_tcp_graceful_shutdown", newCode)}
              onRun={() => runCode("tokio_tcp_graceful_shutdown")}
              output={outputs.tokio_tcp_graceful_shutdown ?? null}
              isRunning={isRunning === "tokio_tcp_graceful_shutdown"}
              filename="tcp_graceful_shutdown.rs"
              expectedOutput={"accepted = 2\nclient_a = pong\nclient_b = pong"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.tokio_tcp_graceful_shutdown}
              onRevert={() => resetCode("tokio_tcp_graceful_shutdown")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">TCP</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `TcpListener::bind` plus `accept` is the core server loop. Admission is an explicit task, not implicit magic.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Shutdown</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The watch channel carries a stop signal into the accept loop, and `select!` makes that branch visible in code.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Connection tasks are separate from listener ownership, which keeps admission, draining, and metrics easier to reason about.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">examples/ch25_tokio/</code> so the
              chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to build a small Tokio TCP service, add graceful shutdown with explicit
            cancellation signals, and separate blocking CPU work with `spawn_blocking`.
          </p>
          <Button onClick={() => setCurrentPage(49)} className="gap-2">
            Open Chapter 25 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Tokio is a runtime made of scheduling plus IO and timer drivers, not only a macro on `main`.</li>
            <li>`tokio::spawn` runs async work concurrently; `spawn_blocking` is the honest boundary for blocking or CPU-heavy work.</li>
            <li>Timers, TCP, UDP, filesystem APIs, and channels all become calmer once task ownership and shutdown behavior are explicit.</li>
            <li>Bounded queues, semaphores, and admission control are backpressure tools, not optional polish.</li>
            <li>Graceful shutdown is part of the design surface in production Tokio services, not a final cleanup task.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
````

### File: `components/rust-book/pages/page-ch25-tokio-exercises.tsx`
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
    title: "Choose `tokio::spawn`, `spawn_blocking`, a scoped thread, or plain sync code",
    objective: "Practice selecting the execution boundary that matches the real workload instead of turning everything into async tasks.",
    starterPrompt:
      "Classify four steps in one service: a pure route parser, a Brotli compression pass, a TCP accept loop, and a request-local slice transform that borrows parent-owned data only for a short CPU burst.",
    prompts: [
      "Which step should stay a plain synchronous function?",
      "Which step wants `spawn_blocking` because it is CPU-heavy or blocking?",
      "Which step is naturally a Tokio async task or accept loop?",
      "Which step may want scoped OS threads instead of Tokio tasks because the work only borrows parent-owned data?",
    ],
    acceptanceCriteria: [
      "You keep at least one step synchronous on purpose.",
      "You choose `spawn_blocking` for blocking or CPU-heavy work rather than leaving it on runtime workers.",
      "You distinguish a Tokio task boundary from a scoped-thread CPU boundary clearly.",
    ],
    hints: [
      "The runtime is great at waiting. It is not the right place to hide every CPU spike.",
      "A borrowed local CPU burst is not automatically an async task problem.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find blocking work on the runtime workers",
    objective: "Read a Tokio service path and identify where blocking or CPU-heavy work should move out of ordinary async tasks.",
    starterPrompt:
      "A request handler uses `std::fs::read_to_string`, does a heavy checksum or compression pass inline, then awaits a database call and sends a result over `mpsc`.",
    prompts: [
      "Which operations block or monopolize a runtime worker?",
      "Which operation should move to `spawn_blocking`?",
      "Which operation is already async and should stay on the runtime?",
      "What metric would you watch to confirm the runtime is being starved under load?",
    ],
    acceptanceCriteria: [
      "You identify at least one blocking filesystem or CPU-heavy operation correctly.",
      "You keep naturally async IO work on the async side.",
      "You propose one observability signal such as runtime latency, queue depth, or blocking-pool pressure.",
    ],
    hints: [
      "The mistake is not 'using Tokio.' The mistake is putting the wrong kind of work on the wrong pool.",
      "A database client await is different from a blocking filesystem read or CPU-heavy transform.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Build a tiny Tokio TCP service",
    objective: "Implement a small TCP listener that accepts connections, spawns one handler per connection, and writes a deterministic response.",
    starterPrompt:
      "Bind a `TcpListener` on `127.0.0.1:0`, accept connections in a loop, and spawn a small handler that writes a fixed line such as `pong` or `ok` to each client.",
    prompts: [
      "Keep admission in the listener task and per-connection work in spawned handler tasks.",
      "Return or log a small accepted-connection count.",
      "Use owned task boundaries instead of borrowing stack-local request data into spawned work.",
    ],
    acceptanceCriteria: [
      "The service uses `TcpListener` and an explicit accept loop.",
      "Each connection handler is a spawned Tokio task or another explicit concurrent boundary.",
      "The handler writes a deterministic response line to the client.",
      "You can explain where ownership crosses from listener to handler.",
    ],
    hints: [
      "This is the basic service shape: accept, hand off, respond, repeat.",
      "The connection task usually owns its stream.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Add graceful shutdown with explicit cancellation signals",
    objective: "Repair a listener or worker loop so it can stop admitting new work and drain cleanly.",
    starterPrompt:
      "A service loops forever on `listener.accept().await` or `rx.recv().await` with no stop branch. Add a shutdown path using `oneshot`, `watch`, or another explicit signal plus `tokio::select!`.",
    prompts: [
      "Which signal shape fits best: one stop event or latest-state watch?",
      "Where does `tokio::select!` belong: accept loop, worker loop, or both?",
      "What should happen to in-flight tasks after admission stops?",
      "What timeout or logging would you add to keep shutdown observable?",
    ],
    acceptanceCriteria: [
      "You add an explicit stop signal path rather than relying on abrupt runtime drop.",
      "You stop admission before process exit.",
      "You describe at least one drain, join, or timeout step for in-flight work.",
      "You mention one observability hook such as shutdown duration or unfinished task count.",
    ],
    hints: [
      "Graceful shutdown is about sequencing, not only about a signal handler.",
      "The service must stop accepting before it can drain responsibly.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Separate blocking CPU work with `spawn_blocking`",
    objective: "Move CPU-heavy or legacy blocking work off the runtime workers without smearing async across the wrong boundary.",
    starterPrompt:
      "A Tokio handler currently parses a large batch and computes a heavy checksum inline before awaiting network IO. Refactor the CPU step into `tokio::task::spawn_blocking`.",
    prompts: [
      "What values should the blocking closure own?",
      "Where should the async side await the blocking result?",
      "What error or panic handling belongs on the `JoinHandle` result?",
      "When would a dedicated worker thread or offline CPU pool be better than many small `spawn_blocking` calls?",
    ],
    acceptanceCriteria: [
      "The CPU-heavy step moves behind `spawn_blocking`.",
      "The closure owns the data it needs rather than borrowing stack-local values with the wrong lifetime.",
      "You await and handle the blocking join result explicitly.",
      "You mention one tradeoff involving blocking-pool pressure or batching strategy.",
    ],
    hints: [
      "Move ownership in. Await the owned result back out.",
      "The blocking pool is helpful, but it is still a finite resource worth measuring.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose backpressure and shutdown policy for a production Tokio service",
    objective: "Map bounded queues, concurrency caps, drain behavior, and observability to one realistic async service.",
    starterPrompt:
      "You are designing `accept -> parse -> enrich -> persist -> publish`, with bursty traffic, one CPU-heavy enrichment stage, and strict shutdown requirements during rolling deploys.",
    prompts: [
      "Which internal queues should be bounded, and at what boundary does producer slowdown become healthy?",
      "Which stage should use `spawn_blocking`, and how will you prevent the blocking pool from becoming the next backlog?",
      "Where would a semaphore or in-flight task cap belong?",
      "How will the service stop admitting, drain, and time out slow tails during shutdown?",
      "What metrics or traces would you require before calling the design production-ready?",
    ],
    acceptanceCriteria: [
      "You define at least one bounded queue or concurrency cap deliberately.",
      "You place `spawn_blocking` at a real CPU or blocking boundary rather than as decoration.",
      "You describe a stop-admit-drain-timeout shutdown sequence.",
      "You mention at least two observability hooks such as queue depth, in-flight task count, shutdown time, or blocking-pool backlog.",
    ],
    hints: [
      "Backpressure is a product decision as much as a runtime decision.",
      "The cleanest answer gives every mutable or expensive subsystem a budget.",
    ],
  },
]

const reviewQuestions = [
  "What does `tokio::spawn` require on the multithread runtime, and why?",
  "When is `spawn_blocking` the honest boundary instead of an optimization trick?",
  "Why are bounded channels one of the simplest Tokio backpressure tools?",
  "What should graceful shutdown do before the process exits?",
  "Why are async filesystem APIs convenient but not magically free of disk latency or blocking cost?",
]

const workingLoop = [
  "Classify the work first: waiting, blocking, CPU-heavy, or request-local borrowed CPU work.",
  "Choose the boundary second: plain sync, Tokio task, blocking pool, or OS thread.",
  "Add bounded queues and concurrency caps before the service is already under load.",
  "Write the shutdown path before the service ships, not after the first rolling deploy incident.",
  "Define queue depth, in-flight task count, and shutdown latency as observability requirements up front.",
]

export function PageCh25TokioExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 49
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 25 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice Tokio the way it behaves in production: honest task boundaries, bounded queues, graceful shutdown, and
          blocking work moved off the runtime workers deliberately.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a runtime boundary review. The best answer does not stop at &quot;make it async.&quot;
                It explains which work is waiting, which work is blocking, where ownership crosses into a task, and how
                the service will behave when load spikes or shutdown begins.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(48)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 25
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
                  Tokio drill
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
          title="Runnable lab · Move CPU work to `spawn_blocking`"
          description={
            <>
              Repair the starter so the CPU step moves behind{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">tokio::task::spawn_blocking</code> and
              the async side awaits the result explicitly. The checker expects the exact output shown below.
            </>
          }
          filename="spawn_blocking_lab.rs"
          runKey="ch25_ex_spawn_blocking"
          expectedOutput={"spawn_blocking = true\ntotal = 20"}
          helperText={
            <>
              Tip: move the owned batch into the blocking closure, await the returned{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">JoinHandle</code>, and print the result on
              the async side.
            </>
          }
          initialCode={`#[tokio::main]\nasync fn main() {\n    let batch = vec![2_u32, 4, 6, 8];\n    let total = batch.into_iter().sum::<u32>();\n\n    println!(\"spawn_blocking = false\");\n    println!(\"total = {}\", total);\n}`}
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
            By the end of this page, you should be able to build a small Tokio TCP service, explain where graceful shutdown
            belongs in the control flow, move CPU-heavy work to `spawn_blocking` without hand-waving, and describe bounded
            queues, concurrency caps, and shutdown metrics as first-class parts of the runtime design.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch25_tokio/task_boundaries_and_backpressure.rs`
````
use tokio::sync::mpsc;
use tokio::time::{self, Duration};

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel::<Vec<u32>>(1);

    let producer = tokio::spawn(async move {
        tx.send(vec![1_u32, 2, 3]).await.unwrap();
        tx.send(vec![4_u32, 5]).await.unwrap();
    });

    let consumer = tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(10));
        let mut batches = 0_u32;
        let mut total = 0_u32;

        while let Some(batch) = rx.recv().await {
            interval.tick().await;

            let subtotal = tokio::task::spawn_blocking(move || batch.into_iter().sum::<u32>())
                .await
                .unwrap();

            total += subtotal;
            batches += 1;
        }

        (batches, total)
    });

    producer.await.unwrap();
    let (batches, total) = consumer.await.unwrap();

    println!("buffer = 1");
    println!("batches = {}", batches);
    println!("total = {}", total);
}
````

### File: `examples/ch25_tokio/tcp_graceful_shutdown.rs`
````
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::watch;

async fn handle(mut stream: tokio::net::TcpStream) -> std::io::Result<()> {
    stream.write_all(b"pong\n").await?;
    Ok(())
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);

    let server = tokio::spawn(async move {
        let mut accepted = 0_usize;

        loop {
            tokio::select! {
                _ = shutdown_rx.changed() => {
                    if *shutdown_rx.borrow() {
                        break accepted;
                    }
                }
                Ok((stream, _peer)) = listener.accept() => {
                    accepted += 1;
                    tokio::spawn(handle(stream));
                }
            }
        }
    });

    let client_a = tokio::spawn(async move {
        let mut stream = tokio::net::TcpStream::connect(addr).await.unwrap();
        let mut buf = [0_u8; 5];
        stream.read_exact(&mut buf).await.unwrap();
        String::from_utf8_lossy(&buf).trim().to_string()
    });

    let client_b = tokio::spawn(async move {
        let mut stream = tokio::net::TcpStream::connect(addr).await.unwrap();
        let mut buf = [0_u8; 5];
        stream.read_exact(&mut buf).await.unwrap();
        String::from_utf8_lossy(&buf).trim().to_string()
    });

    let a = client_a.await.unwrap();
    let b = client_b.await.unwrap();

    shutdown_tx.send(true).unwrap();
    let accepted = server.await.unwrap();

    println!("accepted = {}", accepted);
    println!("client_a = {}", a);
    println!("client_b = {}", b);
    Ok(())
}
````

### File: `examples/ch25_tokio/udp_and_async_fs.rs`
````
#[tokio::main]
async fn main() -> std::io::Result<()> {
    let socket = tokio::net::UdpSocket::bind("127.0.0.1:0").await?;
    let addr = socket.local_addr()?;
    let sender = tokio::net::UdpSocket::bind("127.0.0.1:0").await?;

    sender.send_to(b"ping", addr).await?;

    let mut buf = [0_u8; 16];
    let (n, peer) = socket.recv_from(&mut buf).await?;
    socket.send_to(&buf[..n], peer).await?;

    tokio::fs::write("tokio-example.tmp", &buf[..n]).await?;
    let saved = tokio::fs::read_to_string("tokio-example.tmp").await?;
    tokio::fs::remove_file("tokio-example.tmp").await?;

    println!("udp = {}", std::str::from_utf8(&buf[..n]).unwrap());
    println!("saved = {}", saved);
    Ok(())
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -46,3 +46,5 @@ export { PageCh23SynchronizationPrimitives } from "./page-ch23-synchronization-p
 export { PageCh23SynchronizationPrimitivesExercises } from "./page-ch23-synchronization-primitives-exercises"
 export { PageCh24CoroutinesFuturesAndAsyncRust } from "./page-ch24-coroutines-futures-and-async-rust"
 export { PageCh24CoroutinesFuturesAndAsyncRustExercises } from "./page-ch24-coroutines-futures-and-async-rust-exercises"
+export { PageCh25Tokio } from "./page-ch25-tokio"
+export { PageCh25TokioExercises } from "./page-ch25-tokio-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -57,6 +57,8 @@ import {
   PageCh23SynchronizationPrimitivesExercises,
   PageCh24CoroutinesFuturesAndAsyncRust,
   PageCh24CoroutinesFuturesAndAsyncRustExercises,
+  PageCh25Tokio,
+  PageCh25TokioExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -109,6 +111,8 @@ const PAGE_COMPONENTS = [
   PageCh23SynchronizationPrimitivesExercises,
   PageCh24CoroutinesFuturesAndAsyncRust,
   PageCh24CoroutinesFuturesAndAsyncRustExercises,
+  PageCh25Tokio,
+  PageCh25TokioExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh25Output } from "./rust-simulator-ch25"
 import { simulateCh24Output } from "./rust-simulator-ch24"
 import { simulateCh23Output } from "./rust-simulator-ch23"
 import { simulateCh22Output } from "./rust-simulator-ch22"
@@ -1003,6 +1004,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch25Output = simulateCh25Output(code, key)
+  if (ch25Output !== null) return ch25Output
 
   const ch24Output = simulateCh24Output(code, key)
   if (ch24Output !== null) return ch24Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -14,6 +14,7 @@ import { DEFAULT_CODES_CH21 } from "./default-codes-ch21"
 import { DEFAULT_CODES_CH22 } from "./default-codes-ch22"
 import { DEFAULT_CODES_CH23 } from "./default-codes-ch23"
 import { DEFAULT_CODES_CH24 } from "./default-codes-ch24"
+import { DEFAULT_CODES_CH25 } from "./default-codes-ch25"
 
 export interface PageConfig {
   id: string
@@ -610,6 +611,30 @@ export const CHAPTERS: ChapterConfig[] = [
         icon: "trophy",
       },
     ],
+  },
+  {
+    id: "ch25-tokio",
+    title: "Chapter 25 · Tokio",
+    icon: "book",
+    pages: [
+      {
+        id: "ch25-tokio",
+        title: "Tokio",
+        shortTitle: "Tokio",
+        description:
+          "Runtime architecture, tasks and scheduling, spawn vs spawn_blocking, timers, async TCP and UDP, async fs, channels, graceful shutdown, backpressure, and production Tokio patterns",
+        icon: "book",
+        codeKeys: [
+          "tokio_tasks_backpressure_spawn_blocking",
+          "tokio_tcp_graceful_shutdown",
+        ],
+      },
+      {
+        id: "ch25-tokio-exercises",
+        title: "Chapter 25 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Build a small Tokio TCP service, add graceful shutdown, and move blocking CPU work behind spawn_blocking",
+        icon: "trophy",
+      },
+    ],
   },
 ]
 
@@ -1052,5 +1077,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH22,
   ...DEFAULT_CODES_CH23,
   ...DEFAULT_CODES_CH24,
+  ...DEFAULT_CODES_CH25,
 }
 
 export interface BookState {
````
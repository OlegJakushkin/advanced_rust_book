"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A task is a scheduled future, not an OS thread",
    body: "Tokio runs many futures on a much smaller set of worker threads. A task makes progress only when the runtime polls it, and it stops monopolizing a worker only when it reaches an await point and returns control. Nothing preempts a running future, so a task that loops without ever awaiting will sit on its worker and starve everything else scheduled there. The cost of a task is the size of its state machine plus a slot in the scheduler, which is why you can have hundreds of thousands of them, but it is not zero, so spawning is still a decision rather than a reflex.",
  },
  {
    title: "The runtime is a scheduler plus drivers, not just a macro on main",
    body: "What the runtime macro actually starts is three cooperating parts: a scheduler that polls ready tasks, an IO driver that registers sockets with the operating system and wakes the right task when one becomes readable or writable, and a timer driver that wakes tasks when a deadline fires. Sleeps and timeouts are driver-backed wakeups, not background threads and not busy loops, and socket readiness wakes one specific task rather than blocking a whole thread per connection. Understanding these three parts is what makes performance and shutdown behavior predictable rather than mysterious.",
  },
  {
    title: "Blocking work is a boundary you place on purpose",
    body: "Async is excellent at waiting and terrible at hiding CPU. A long parse, a hash, an image transform, or any legacy synchronous API will hold a worker thread for its entire duration and quietly stall every other task on that worker, because there is no await point for the scheduler to interleave. The fix is to move that work across an explicit boundary, onto the blocking pool or a dedicated thread, so the async scheduler keeps making progress. The whole runtime gets calmer once the line between waiting and computing is something you wrote down rather than something you discovered under load.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "If your reflex is to reach for a thread pool plus a hand-rolled event loop on top of epoll or IOCP, Tokio is that loop and that scheduler, already built and integrated with the timer and IO machinery. The shift that bites is that ownership, Send, and lifetimes do not relax just because work is asynchronous: a spawned future that captures a reference into the current stack frame will not compile, because the runtime may outlive that frame. Model a task as an owned unit of work you hand to the scheduler, not as a pointer with a callback attached.",
  },
  {
    title: "C# background",
    body: "Tokio tasks rhyme with Task and async/await, but the runtime is explicit where the CLR is ambient: there is no thread pool quietly underneath every await, and no synchronization context to resume on. A future spawned on the multithread runtime usually needs Send + 'static because the scheduler may move it between worker threads, and there is no equivalent of Task.Run that makes a CPU-bound method safe to drop into async code. Blocking work has to be pushed across a boundary by hand, not assumed to be handled for you.",
  },
  {
    title: "Go background",
    body: "A goroutine and a Tokio task look alike from a distance and behave differently up close. Tokio futures are cooperatively scheduled and yield only at await points, so the Go habit of writing a tight CPU loop inside a goroutine and trusting the runtime to preempt it will instead pin a worker and stall its neighbors. There is also no ambient shared-memory convention: crossing a task boundary is an ownership move, and shared mutable state has to be wrapped in something the type system accepts rather than passed around as a goroutine would.",
  },
  {
    title: "Python background",
    body: "Coming from asyncio, the event loop and await syntax will feel familiar, but Rust removes the loopholes. There is no global event loop you can poke at from anywhere, and there is no run_in_executor that silently absorbs blocking calls without you naming them; spawn_blocking is the explicit, typed version of that move. Most importantly, Tokio's default runtime is genuinely multithreaded, so the GIL intuition that 'only one thing runs at a time anyway' is wrong, and the Send and Sync bounds the compiler enforces are exactly the data-race guards that asyncio never had to think about.",
  },
]

const runtimeArchitectureCards = [
  {
    title: "Scheduler",
    body: "Polls ready tasks on a pool of worker threads and uses work-stealing to keep them busy. Because a task can be picked up by a different worker than the one that spawned it, the future and everything it captures usually have to be Send.",
  },
  {
    title: "IO driver",
    body: "Registers sockets with the operating system (epoll, kqueue, IOCP) and translates readiness notifications into task wakeups. One driver thread can watch thousands of connections, so you do not pay a thread per socket.",
  },
  {
    title: "Timer driver",
    body: "Backs sleep, interval, and timeout. Deadlines are stored in a timer wheel and fire as wakeups, so a thousand idle timers cost almost nothing and never spin a CPU.",
  },
  {
    title: "Blocking pool",
    body: "A separate, growable pool for spawn_blocking closures: blocking syscalls, CPU-heavy work, and legacy synchronous APIs. Keeping that work here is what stops it from freezing the async workers.",
  },
]

const taskBoundaryCards = [
  {
    title: "tokio::spawn",
    body: "For async work that should run concurrently on the runtime. The future and its output must be Send + 'static on the multithread runtime, so captured values usually need to be owned. The returned join handle resolves to the task's output and surfaces a panic as an error.",
    code: `let handle = tokio::spawn(async move {
    // async work
    42_u32
});`,
  },
  {
    title: "tokio::task::spawn_blocking",
    body: "For CPU-bound parsing, compression, hashing, image work, or legacy blocking APIs. The closure runs on the blocking pool and hands one owned result back to the async side. Awaiting the handle is how the async task picks the result up without ever blocking a worker itself.",
    code: `let handle = tokio::task::spawn_blocking(move || {
    expensive_parse(bytes)
});`,
  },
  {
    title: "A task boundary is an ownership boundary",
    body: "A spawned task can outlive the stack frame that created it, so borrowing request-local data into it is usually the wrong shape and the compiler will say so. Move the owned values in, or keep the work local and inline. The borrow checker enforcing this at compile time is what turns a class of lifetime bugs into type errors.",
    code: `tokio::spawn(async move {
    process(job).await
});`,
  },
]

const channelCards = [
  {
    title: "mpsc (many to one)",
    body: "The workhorse for owned work queues and result streams. Many producers, one consumer. Choose the bounded constructor when producer speed should push back under load: a full channel makes send await, which is backpressure expressed directly in the type rather than discovered later from a memory graph.",
  },
  {
    title: "oneshot (one value, once)",
    body: "Exactly one value from one sender to one receiver. The natural shape for a reply to a request, a single completion handoff, or a stop signal. Dropping the sender resolves the receiver with an error, which is often how a task learns its initiator gave up.",
  },
  {
    title: "watch (latest value only)",
    body: "Holds a single current value that receivers can observe; new writes overwrite old ones. Ideal for config snapshots, feature flags, or a shutdown flag, where receivers only care about the newest state and not every intermediate one.",
  },
  {
    title: "broadcast (one to many)",
    body: "Fan-out: every active receiver sees every published item. Useful for event delivery to several independent consumers. The buffer is bounded, so a slow receiver that falls too far behind is told it lagged rather than allowed to grow memory without limit.",
  },
]

const gracefulShutdownSteps = [
  "Pick one shutdown signal path early: ctrl_c, a oneshot, a watch flag, or a similar explicit stop channel. Decide this before the service works, not after.",
  "Stop admission first. For servers, that usually means breaking the accept loop so no new work enters while in-flight work finishes.",
  "Tell background tasks to drain and finish rather than dropping the runtime under them, which would cancel them mid-operation.",
  "Bound shutdown with a timeout and log what did not finish, so a stuck task becomes a visible event instead of a hang.",
  "Close senders when appropriate so receivers wake and see end-of-stream instead of waiting on a channel that will never produce again.",
]

const backpressureChecklist = [
  "Prefer bounded mpsc queues for internal pipelines so a backlog pushes back on producers instead of buffering without limit.",
  "Cap concurrent request or connection handling with a semaphore or an explicit worker budget rather than spawning per arrival.",
  "Treat spawn rate as a resource. An unbounded task flood is a memory and scheduling policy, not a neutral default.",
  "Put timeouts around slow dependencies so one stalled hop cannot pin an unbounded amount of in-flight work.",
  "Measure queue depth, in-flight task count, accept backlog, and blocking-pool pressure in production, not just request latency.",
]

const operationalCards = [
  {
    title: "Async filesystem APIs",
    body: "The async file APIs are convenient integration points, but they do not make disk latency disappear. On most platforms file work is dispatched to the blocking pool under the hood, so async fs is really spawn_blocking with a nicer face. Keep bulk file processing bounded for the same reason.",
    code: `let config = tokio::fs::read_to_string("config.json").await?;
tokio::fs::write("cache.tmp", config.as_bytes()).await?;`,
  },
  {
    title: "Async UDP",
    body: "UDP is a single-socket loop, not a connection-per-peer model. One task can receive datagrams, read each sender's address, and reply directly, so there is no accept step and no per-connection task to manage.",
    code: `let socket = tokio::net::UdpSocket::bind("127.0.0.1:0").await?;
let mut buf = [0_u8; 1024];
let (n, peer) = socket.recv_from(&mut buf).await?;
socket.send_to(&buf[..n], peer).await?;`,
  },
  {
    title: "Timers and intervals",
    body: "An interval is a timer-driver wakeup, not a background thread and not a busy loop. It fits heartbeats, metrics flushes, expiry scans, and load-shedding loops that should yield cleanly between ticks while costing nothing while idle.",
    code: `let mut tick = tokio::time::interval(std::time::Duration::from_secs(1));
tick.tick().await;
tick.tick().await;`,
  },
]

const productionPatterns = [
  "Keep the async shell thin. Parsing, validation, and domain decisions can stay synchronous until a real IO or scheduling boundary appears.",
  "Use tokio::spawn for concurrent async work, and spawn_blocking or a dedicated thread for CPU-heavy or legacy blocking work. Name the boundary; do not let CPU work leak onto the IO workers.",
  "Prefer bounded channels and explicit concurrency caps over unbounded task fan-out, so load shows up as pushback rather than as growing memory.",
  "Treat graceful shutdown as part of the design, not as a signal handler glued on after the service already works.",
  "Own values across task boundaries. Borrow locally, but do not pass request-local references into spawned work that may outlive the stack frame.",
  "Instrument queue depth, shutdown latency, accept errors, and blocking-pool usage before calling the service production-ready.",
]

const pitfalls = [
  "Calling blocking code from an async task on the runtime workers. std::fs, CPU-heavy compression, long JSON parsing, or std::thread::sleep in the wrong place stalls every other task sharing that worker.",
  "Using tokio::spawn as the answer to every concurrency problem. Unbounded spawn rate is a memory and scheduling policy, not free parallelism.",
  "Choosing unbounded channels by default and only discovering the backlog when memory climbs under sustained load.",
  "Ignoring cancellation and shutdown until deployment. Accept loops, background workers, and channel receivers all need a stop story.",
  "Wrapping the whole service in Arc<Mutex<_>> shared state instead of keeping one owner per mutable subsystem and passing messages between them.",
  "Confusing runtime concurrency with parallel CPU throughput. Tokio multiplexes waiting beautifully, but CPU work still needs explicit budgeting and placement.",
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
                visibility. Chapter 24 explained futures,{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">async fn</code>, and{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pin</code>. Tokio turns those
                concepts into an operational runtime for production services.
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
            <h4 className="font-semibold text-foreground mb-3">What the runtime is made of</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The runtime macro on{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">main</code> hides four moving parts.
              The thing to notice in the diagram below is that the scheduler never blocks waiting for IO or time: the IO
              driver and the timer driver turn external events into wakeups and feed ready tasks back to the scheduler,
              while genuinely blocking work is shunted onto a separate pool so it cannot freeze the workers.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  SOCK[Socket readiness] --> IOD[IO driver]\n  TMR[Timer deadline] --> TD[Timer driver]\n  IOD -->|wake task| RQ[Ready task queue]\n  TD -->|wake task| RQ\n  RQ --> SCHED[Scheduler polls future]\n  SCHED -->|await point| RQ\n  SCHED -.->|spawn_blocking| BP[Blocking pool]\n  BP -.->|owned result| SCHED`}
              caption="IO and timer events become wakeups, the scheduler polls ready futures on its workers, and blocking closures run off to the side so they never stall the workers."
            />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {runtimeArchitectureCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The usual default for a service is the multithread runtime, because it can schedule{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Send</code> tasks across a pool of
                worker threads and steal work to keep them busy. A current-thread runtime is still the right choice when
                the application is small, embedded, or deliberately built around non-<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Send</code>{" "}
                local tasks.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Tasks and scheduling</h4>
            <p className="text-sm text-muted-foreground leading-6">
              A task is one future scheduled by the runtime. It is cheap enough to use widely, but not free enough to spray
              without a policy. A task that never reaches an await point monopolizes its worker thread, and a service that
              spawns without bounds builds its own backlog and memory pressure even when every individual task is small.
              The first design question for any unit of work is therefore not how to spawn it, but where it belongs.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The decision tree is short. Work that mostly waits on IO stays inline or goes to{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">tokio::spawn</code>; work that mostly
              computes goes to{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">spawn_blocking</code>. Putting CPU work
              on the IO workers is the single most common way to make a Tokio service mysteriously slow.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  W[Unit of work] --> Q{Mostly waiting or mostly computing}\n  Q -->|waiting on IO| C{Needs to run concurrently}\n  Q -->|CPU heavy or blocking API| SB[spawn_blocking on blocking pool]\n  C -->|no, await it here| INLINE[Run inline on this task]\n  C -->|yes| SP[tokio::spawn on the IO workers]\n  SP --> SEND[Future must be Send and 'static]`}
              caption="Decide by the nature of the work: inline for local IO, tokio::spawn for concurrent IO that must satisfy Send, spawn_blocking for anything CPU-bound or blocking."
            />
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
                A common production mistake is to reach for{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">tokio::spawn</code> when the real
                problem was concurrency control. Spawning faster than downstream work can finish is not throughput. It is
                queue growth with nicer syntax.
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
                A bounded{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">mpsc</code> is one of the simplest
                backpressure tools in Tokio. If a producer should slow down when the consumer falls behind, make the
                capacity explicit so a full queue makes{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">send</code> await, instead of
                discovering the policy later from a memory graph.
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
              <p className="mt-4 text-sm text-muted-foreground leading-6">
                The shape to keep in mind is a small state machine: the accept loop races a stop signal against the next
                connection, and once the signal wins, the service moves to draining before it exits.
              </p>
              <MermaidDiagram
                chart={`stateDiagram-v2\n  [*] --> Accepting\n  Accepting --> Accepting: connection, spawn handler\n  Accepting --> Draining: ctrl_c or shutdown signal\n  Draining --> Draining: wait for in-flight tasks\n  Draining --> Exit: drained or timeout\n  Exit --> [*]`}
                caption="Stop admitting first, drain in-flight work, then exit. The select! below is the Accepting state choosing between a new connection and the stop signal."
              />
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

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Almost no one meets Tokio with an empty mental model; they arrive with async habits from another ecosystem.
            The useful thing to know is which of those habits transfer and which one will quietly mislead you. The shift
            is rarely about API names. It is about where the runtime stops being ambient and starts being something you
            configure, and where the compiler now insists on facts your previous language let you assume.
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
                  Example 1: bounded channel, interval pacing, and spawn_blocking
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The queue is bounded, so producer speed has a budget. The async side waits on the channel and the timer,
                  and the CPU step moves to the blocking pool explicitly.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Read the pipeline before the code: items flow producer to bounded channel to consumer, the consumer paces
              itself on a timer, and the only CPU-heavy step is pushed across the blocking boundary so it never holds an
              async worker. Watch how a channel capacity of one is what couples producer and consumer speed.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  P[Producer task] -->|send, awaits when full| CH[Bounded mpsc cap 1]\n  CH --> C[Consumer task]\n  TICK[interval tick] -.->|pace| C\n  C -->|owned batch| SB[spawn_blocking subtotal]\n  SB -->|owned result| C\n  C --> OUT[total]`}
              caption="A capacity-1 channel makes the producer wait for the consumer, the interval paces the loop, and the CPU subtotal runs on the blocking pool."
            />
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
                  A capacity of one forces producer and consumer speed to meet, instead of buffering without limit.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Task boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Async waiting stays on the workers; the CPU subtotal step moves behind spawn_blocking.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The key moment is the race inside the accept loop: each turn waits on both the next connection and the stop
              signal at once, and whichever resolves first decides what happens. Follow the messages below to see how a
              normal accept and a shutdown signal flow through the same loop.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant Sig as Shutdown signal\n  participant L as Accept loop\n  participant Lis as TcpListener\n  participant H as Connection task\n  L->>Lis: select! accept or signal\n  Lis-->>L: new connection\n  L->>H: spawn handler\n  H-->>L: pong written\n  Sig-->>L: changed() resolves\n  L->>L: break accept loop\n  Note over L,H: stop admitting, let spawned tasks finish`}
              caption="Every loop turn races accept against the stop signal; a connection spawns a handler, while the signal breaks the loop so no new work is admitted."
            />
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
                  Bind plus accept is the core server loop. Admission is an explicit task, not implicit magic.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Shutdown</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A watch channel carries the stop signal into the loop, and select! makes that branch visible in code.
                  changed() also resolves with an error when every sender is dropped, so the branch treats that as a stop;
                  the borrow() re-check exists because a watch can carry values other than the stop sentinel.
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
            cancellation signals, and separate blocking CPU work with{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">spawn_blocking</code>.
          </p>
          <Button onClick={() => setCurrentPage(49)} className="gap-2">
            Open Chapter 25 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Tokio is a runtime made of a scheduler plus IO and timer drivers, not only a macro on the main function.</li>
            <li>tokio::spawn runs async work concurrently; spawn_blocking is the honest boundary for blocking or CPU-heavy work.</li>
            <li>Timers, TCP, UDP, filesystem APIs, and channels all become calmer once task ownership and shutdown behavior are explicit.</li>
            <li>Bounded queues, semaphores, and admission control are backpressure tools, not optional polish.</li>
            <li>Graceful shutdown is part of the design surface in production Tokio services, not a final cleanup task.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

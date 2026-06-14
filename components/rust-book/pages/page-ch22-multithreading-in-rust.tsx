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
    title: "An OS thread is an owned execution boundary",
    body: "A spawned Rust thread runs independently under the OS scheduler. If it outlives the current stack frame, the closure must own what it uses or the compiler will reject the design.",
  },
  {
    title: "Thread safety is expressed in types, not in comments",
    body: "Rust uses ownership, borrowing, and the auto traits `Send` and `Sync` to decide which values may move across threads and which shared references are safe to observe concurrently.",
  },
  {
    title: "Choose the concurrency shape before you choose the primitive",
    body: "Some workloads want shared immutable state, some want synchronized mutable state, some want owned messages, and some want data parallelism over borrowed slices. The primitive follows the model.",
  },
]

const executionKinds = [
  {
    title: "OS thread",
    body: "Scheduled by the operating system. Good for blocking work, CPU-bound workers, and explicit parallelism. Created with `std::thread::spawn` or `std::thread::scope`.",
  },
  {
    title: "Async task",
    body: "A user-space task driven by an executor. Cheaper to create than an OS thread, but the task should not block the executor thread. We cover this model in a later async chapter.",
  },
  {
    title: "Future",
    body: "A state machine describing async work. A future does nothing until some executor polls it. A future is not a thread and not a task scheduler.",
  },
  {
    title: "Executor",
    body: "The runtime component that polls futures and often multiplexes many tasks onto a smaller number of OS threads.",
  },
  {
    title: "Data parallelism",
    body: "One collection or numerical workload is split across worker threads. Work-stealing schedulers are common here because they balance uneven chunk sizes well.",
  },
  {
    title: "Distributed worker",
    body: "Another process or machine entirely. Once work crosses the network, `Send` and `Sync` stop being the main contract. Serialization, retries, and idempotency become the real boundary.",
  },
]

const threadSafetyCards = [
  {
    title: "Rust's thread safety model",
    body: "Safe Rust rules out data races by refusing unsynchronized shared mutable aliasing. The same ownership rules that stop local use-after-move bugs also shape thread boundaries.",
  },
  {
    title: "`thread::spawn` requires owned or `'static` captures",
    body: "A detached thread may outlive the current stack frame, so a plain spawned thread cannot keep borrowing short-lived stack data. That is why `move` closures appear so often.",
  },
  {
    title: "Join handles surface failure explicitly",
    body: "A child thread returns a `JoinHandle<T>`. Joining yields `Result<T, _>` because the child may panic. Production code should treat worker panics as observable failures, not as background mysteries.",
  },
  {
    title: "OS thread cost is real",
    body: "Threads are not goroutines and not async tasks. They have stack, scheduler, and wake-up cost. They are excellent when the workload justifies them and noisy when sprayed per tiny unit of work.",
  },
]

const sendSyncDefinitions = [
  {
    title: "`Send`",
    body: "A value of type `T` may be moved to another thread safely.",
  },
  {
    title: "`Sync`",
    body: "A shared reference `&T` may be used from multiple threads safely. A common shorthand is: `T` is `Sync` when `&T` is `Send`.",
  },
]

const sendSyncExamples = [
  {
    title: "String",
    traitText: "Send + Sync",
    body: "An owned string can move to another thread, and shared references to it are safe because mutation still requires ordinary Rust rules.",
  },
  {
    title: "Rc<T>",
    traitText: "!Send + !Sync",
    body: "Reference counting is not atomic, so `Rc<T>` is single-thread only. This is one of the most useful compile-time corrections for engineers coming from C++ and C#.",
  },
  {
    title: "Arc<T>",
    traitText: "Send + Sync when `T` is Send + Sync",
    body: "Atomic reference counting makes shared ownership thread-safe, but it does not bless a non-thread-safe inner type magically.",
  },
  {
    title: "RefCell<T>",
    traitText: "Send when `T: Send`, but not Sync",
    body: "You may move a `RefCell<T>` to another thread if the inner value can move, but shared references to the same `RefCell<T>` are not safe across threads.",
  },
  {
    title: "Mutex<T>",
    traitText: "Send + Sync when `T: Send`",
    body: "The mutex provides synchronized exclusive access. This is the shared-state counterpart to ordinary exclusive borrowing.",
  },
]

const sharedStateCards = [
  {
    title: "Use shared state when the state is semantically shared",
    body: "`Arc<T>` is a strong fit for immutable shared configuration and schemas. `Arc<Mutex<T>>` is a fit when several threads truly coordinate around one mutable owner.",
  },
  {
    title: "Lock scope is the real optimization surface",
    body: "Keep the critical section small. Do not hold a mutex while doing blocking IO, large allocations, or expensive CPU work if the design can stage work outside the lock.",
  },
  {
    title: "A lock is two choices",
    body: "`Arc<Mutex<T>>` means shared ownership plus synchronized mutation. If only one of those is true, the type is already telling you to simplify the design.",
  },
]

const messagePassingCards = [
  {
    title: "Channels move ownership on purpose",
    body: "Message passing is often calmer when one subsystem should own mutable state and other threads should submit work or results as owned messages.",
  },
  {
    title: "`mpsc` is a standard-library baseline",
    body: "Rust's standard library provides multiple-producer, single-consumer channels. That is enough for many worker-result and command-loop designs.",
  },
  {
    title: "Backpressure is a design choice",
    body: "An unbounded queue and a bounded queue tell different operational stories. Standard `sync_channel` or ecosystem channels are useful when you want producers to slow down instead of growing memory without limit.",
  },
]

const scopedThreadCards = [
  {
    title: "`thread::scope` still spawns OS threads",
    body: "Scoped threads are not lighter-weight threads. The win is not scheduler magic. The win is lifetime shape: child threads are guaranteed to join before the scope exits.",
  },
  {
    title: "Borrowed data becomes possible again",
    body: "Because the scope joins children before exit, the spawned closures may borrow stack data such as slices from the parent. This is often the cleanest shape for request-local CPU work.",
  },
  {
    title: "Great for slice splitting and chunked CPU work",
    body: "A scoped thread often removes fake cloning and `'static` pressure when the parent already owns one large collection and just wants parallel borrowed views.",
  },
]

const workStealingCards = [
  {
    title: "Work stealing is a scheduler strategy",
    body: "Each worker starts with local work. When it runs dry, it steals work from another worker. That reduces load imbalance for uneven CPU-bound tasks.",
  },
  {
    title: "Strong fit for data parallelism",
    body: "Fork-join workloads and parallel collection transforms often benefit from work-stealing pools because chunk sizes are rarely perfectly even in production data.",
  },
  {
    title: "Distinct from manual threads and from async executors",
    body: "Rust's standard library gives explicit thread primitives. Work-stealing pools are usually an ecosystem-layer tool such as Rayon for CPU work. Async executors may also use work stealing, but for futures rather than manual worker threads.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Rust threads feel closest to `std::thread`, but Rust adds compile-time rules around aliasing and thread transfer. In C++, thread safety is often a discipline problem. In Rust, many illegal transfers do not compile at all.",
  },
  {
    title: "C# background",
    body: "`Thread` is the closer comparison for this chapter, not `Task`. C# tasks and thread-pool work items are more like later async or pooled-runtime discussions. Rust separates those models more sharply.",
  },
  {
    title: "Go background",
    body: "Goroutines are cheap user-space tasks. `std::thread::spawn` is a heavier OS-thread tool. Rust async tasks later become the closer comparison, but Rust still keeps ownership transfer and borrowed-data lifetime far more explicit.",
  },
]

const productionPatterns = [
  "Prefer owned work messages when one thread should own mutable state and the rest of the system should submit commands or results.",
  "Prefer `Arc<T>` alone for shared immutable configuration. Add a lock only when coordinated mutation is genuinely part of the model.",
  "Use scoped threads for request-local CPU work over borrowed slices or borrowed read-only state when the parent already owns the data.",
  "Name important threads with `std::thread::Builder` and treat `join` failures as first-class operational signals.",
  "Reach for work-stealing or data-parallel libraries when the real job is CPU-bound parallel iteration, not hand-managed long-lived worker threads.",
  "Keep the multithreaded shell thin. Put parsing, normalization, and domain decisions in ordinary functions so the threaded boundary stays easy to test.",
]

const operationalCards = [
  {
    title: "Failure modes",
    body: "Watch for worker panics, poisoned locks, queue growth, and lock hold time. A thread design that only works under the happy path is not production-ready.",
  },
  {
    title: "Testing approach",
    body: "Unit test pure worker logic without threads. Then add small deterministic integration tests around the threaded shell: fixed inputs, fixed worker count, explicit joins, and explicit result assertions.",
  },
  {
    title: "Observability hooks",
    body: "Track queue depth, task latency, worker panic count, and lock wait time. If the design uses shared state, contention metrics matter. If it uses channels, backlog metrics matter.",
  },
]

const pitfalls = [
  "Spawning unbounded OS threads for tiny units of work because it resembles goroutines or thread-pool tasks from another language.",
  "Defaulting to one giant `Arc<Mutex<HashMap<...>>>` because it compiles. A broad lock often hides several different ownership domains and several different performance problems.",
  "Holding a mutex while doing blocking IO or expensive computation, then blaming Rust rather than the lock scope.",
  "Using `thread::spawn` when `thread::scope` would have expressed the real borrowed-lifetime model more directly.",
  "Confusing OS threads, async tasks, data-parallel work stealing, and distributed workers. They solve different scheduling and ownership problems.",
  "Writing `unsafe impl Send` or `unsafe impl Sync` for a type with hidden raw pointers or thread-affine resources without a proof. The invariants must cover aliasing, mutation, and drop behavior across threads.",
]

export function PageCh22MultithreadingInRust() {
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
  const pageIndex = 42
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
          Chapter 22 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Multithreaded Rust systems need clear ownership transfer, shared-state policy, and shutdown behavior. This
          chapter covers threads, scoped work, channels, and synchronization as production boundaries.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 04, 07, 09, and 14</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 04 established ownership and borrowing. Chapter 07 separated moves, copies, and clones. Chapter 09
                introduced `Arc`, `Mutex`, and related pointer choices. Chapter 14 explained trait-based boundaries. This
                chapter applies those ideas to OS threads directly.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(6)}>
                Chapter 04
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(12)}>
                Chapter 07
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(16)}>
                Chapter 09
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(26)}>
                Chapter 14
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A request-processing service performs CPU-heavy preprocessing, updates a metrics index, and dispatches
            background jobs to worker threads. The business requirement is to define each thread boundary by ownership:
            move owned jobs, share immutable configuration with Arc, synchronize only truly shared mutation, and use
            scoped threads for local borrowed slices.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">One correction before we go further</h4>
            <p className="text-sm text-muted-foreground leading-6">
              This chapter is about <strong className="text-foreground">OS threads</strong>. It is not about async tasks,
              futures, or executors, even though those models also involve concurrency. Keep those separate in your head:
              threads are scheduled by the OS, async tasks are scheduled by an executor, and distributed workers are other
              processes or machines.
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
            <h4 className="font-semibold text-foreground mb-3">Concurrency vocabulary before APIs</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {executionKinds.map((kind) => (
                <div key={kind.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{kind.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{kind.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Rust&apos;s thread safety model</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {threadSafetyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`let handle = std::thread::spawn(move || -> u64 {
    42
});

let answer = handle.join().unwrap();`}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground leading-6">
                The important part is not the number. It is that the closure owns what it uses, and the caller decides when
                failure from the child thread becomes visible by joining.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Send and Sync</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {sendSyncDefinitions.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{item.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {sendSyncExamples.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-medium text-foreground">{item.title}</div>
                    <span className="text-xs uppercase tracking-[0.2em] text-primary">{item.traitText}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                Manual <code className="px-1 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/40 font-mono text-[11px]">unsafe impl Send</code>{" "}
                or <code className="px-1 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/40 font-mono text-[11px]">unsafe impl Sync</code>{" "}
                is only correct if you can prove the type&apos;s hidden aliasing, mutation, and destruction behavior is
                thread-safe. Most application code should never need to write those impls.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Spawning threads</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Use <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">std::thread::spawn</code> when
                  you need a new OS thread. The closure usually needs{" "}
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">move</code> because the child may
                  outlive the current stack frame.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Production code often uses <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">std::thread::Builder</code>{" "}
                  when thread names, stack size, or clearer diagnostics matter. Thread names are cheap observability.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Moving data into threads</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">move</code> closure transfers
                  ownership of captured non-`Copy` values into the child thread. That is the calm default for jobs, owned
                  buffers, and request-local domain data that must survive independently in the worker.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Clone only when two threads truly need independent ownership. Share through{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc</code> when the data is
                  genuinely shared. Borrow only inside a scope that guarantees the borrow cannot outlive the parent.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Shared state concurrency</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {sharedStateCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A good default question is this: if only one thread should really own the mutable state, why not send owned
                commands to that thread instead of putting the state behind a global lock?
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Message-passing concurrency</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {messagePassingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`let (tx, rx) = std::sync::mpsc::channel();
let (tx_bounded, rx_bounded) = std::sync::mpsc::sync_channel(1024);`}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground leading-6">
                Unbounded and bounded channels tell different operational stories. Use the one that matches memory, latency,
                and producer-pressure expectations.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Scoped threads</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {scopedThreadCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Work stealing</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {workStealingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A useful production rule: if the work is CPU-bound collection processing, a Rayon-style work-stealing pool
                is often calmer than hand-rolling many `std::thread::spawn` calls. If the work is IO-bound waiting, an async
                executor is usually the more honest model. If the work crosses the network, you are in distributed systems.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparing Rust concurrency with C++, C#, and Go</h4>
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
          <div className="grid gap-3 lg:grid-cols-3">
            {operationalCards.map((card) => (
              <div key={card.title} className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">{card.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
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
                The right concurrency primitive is the one that makes ownership calm under load. A channel, a scoped thread,
                and a lock can all be correct. The mistake is using one of them because it resembles another language
                rather than because the workload actually wants it.
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
                <h4 className="font-semibold text-foreground">Example 1: spawn workers, move owned jobs, collect by channel</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This is an OS-thread design with owned job batches and message passing for results. No worker mutates a
                  shared central map directly.
                </p>
              </div>
              {codes.multithreading_owned_jobs_channel !== DEFAULT_CODES.multithreading_owned_jobs_channel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("multithreading_owned_jobs_channel")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.multithreading_owned_jobs_channel}
              onChange={(newCode) => updateCode("multithreading_owned_jobs_channel", newCode)}
              onRun={() => runCode("multithreading_owned_jobs_channel")}
              output={outputs.multithreading_owned_jobs_channel ?? null}
              isRunning={isRunning === "multithreading_owned_jobs_channel"}
              filename="owned_jobs_over_channel.rs"
              expectedOutput={"ingest total = 5\nindex total = 5\ngrand total = 10"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.multithreading_owned_jobs_channel}
              onRevert={() => resetCode("multithreading_owned_jobs_channel")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Spawning threads</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Each worker is a real OS thread with a join handle.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Moving data</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The job vectors cross the boundary by ownership through a
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">move</code>
                  closure.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Message passing</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Workers return results by channel, so the aggregation boundary stays explicit and deterministic.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: shared state with `Arc&lt;Mutex&lt;...&gt;&gt;`</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Shared state is sometimes the honest model. The important engineering work is then lock scope, contention,
                  and who really needs to mutate what.
                </p>
              </div>
              {codes.multithreading_shared_state_metrics !== DEFAULT_CODES.multithreading_shared_state_metrics && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("multithreading_shared_state_metrics")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.multithreading_shared_state_metrics}
              onChange={(newCode) => updateCode("multithreading_shared_state_metrics", newCode)}
              onRun={() => runCode("multithreading_shared_state_metrics")}
              output={outputs.multithreading_shared_state_metrics ?? null}
              isRunning={isRunning === "multithreading_shared_state_metrics"}
              filename="shared_state_route_counts.rs"
              expectedOutput={"api = 3\nbilling = 1\nroutes = 2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.multithreading_shared_state_metrics}
              onRevert={() => resetCode("multithreading_shared_state_metrics")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Shared ownership</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `Arc` makes the counter map reachable from several threads.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Synchronized mutation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `Mutex` narrows mutation to one thread at a time.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tradeoff</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The model is honest, but lock contention is now a real runtime cost to observe.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 3: scoped threads over borrowed slices</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This is still multithreading, but the parent keeps ownership and children borrow from it safely inside the
                  scope.
                </p>
              </div>
              {codes.multithreading_scoped_threads_sum !== DEFAULT_CODES.multithreading_scoped_threads_sum && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("multithreading_scoped_threads_sum")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.multithreading_scoped_threads_sum}
              onChange={(newCode) => updateCode("multithreading_scoped_threads_sum", newCode)}
              onRun={() => runCode("multithreading_scoped_threads_sum")}
              output={outputs.multithreading_scoped_threads_sum ?? null}
              isRunning={isRunning === "multithreading_scoped_threads_sum"}
              filename="scoped_threads_slice_sum.rs"
              expectedOutput={"left = 12\nright = 30\ntotal = 42"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.multithreading_scoped_threads_sum}
              onRevert={() => resetCode("multithreading_scoped_threads_sum")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Borrowed data</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The slices are borrowed from the parent array instead of cloned into separate owners.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Scope guarantee</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The scope guarantees both child threads join before the borrowed data can disappear.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Good fit</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This pattern is excellent for local CPU-bound slice processing with no detached worker lifetime.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">examples/ch22_multithreading_in_rust/</code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to classify `Send` and `Sync`, repair non-`'static` thread captures,
            compare channel-based and shared-state designs, and choose among scoped threads, work stealing, async tasks,
            and distributed workers from workload shape.
          </p>
          <Button onClick={() => setCurrentPage(43)} className="gap-2">
            Open Chapter 22 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Rust multithreading is built on ordinary ownership plus the auto traits `Send` and `Sync`.</li>
            <li>OS threads, async tasks, futures, executors, data parallelism, and distributed workers are different execution models with different costs.</li>
            <li>`thread::spawn` usually wants owned captured data; `thread::scope` is the tool when borrowed stack data is the honest model.</li>
            <li>Shared state with `Arc` and locks can be correct, but channels are often calmer when one thread should own mutation.</li>
            <li>Work stealing is a scheduler strategy, commonly used in data-parallel libraries, not a synonym for manual thread spawning.</li>
            <li>Good production thread design is observable, join-aware, and explicit about queue growth, contention, and panic handling.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
````

### File: `components/rust-book/pages/page-ch22-multithreading-in-rust-exercises.tsx`
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
    title: "Decide whether a type is Send, Sync, both, or neither",
    objective: "Practice reading thread-boundary capability from type semantics instead of from guesswork.",
    starterPrompt:
      "Classify `String`, `Rc<String>`, `Arc<String>`, `RefCell<Vec<u8>>`, `Mutex<Vec<u8>>`, and one wrapper around a raw pointer you have not audited.",
    prompts: [
      "Which values can move to another thread safely as owned values?",
      "Which shared references are safe to use from multiple threads?",
      "Which type is single-thread only because the ownership counter or borrow checks are not thread-safe?",
      "Which type should never get an `unsafe impl Send` or `Sync` casually?",
    ],
    acceptanceCriteria: [
      "You define `Send` and `Sync` precisely before classifying any example.",
      "You identify `Rc<T>` as not appropriate for thread transfer or cross-thread sharing.",
      "You distinguish `Arc<T>` from `Arc<Mutex<T>>` instead of treating them as the same idea.",
      "You state that a raw-pointer wrapper needs an explicit proof before any unsafe auto-trait impl is acceptable.",
    ],
    hints: [
      "Start from ownership movement first, then shared-reference safety second.",
      "A type that compiles in one thread is not automatically safe to move or share across threads.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Compare a channel-based design with a shared-state design",
    objective: "Read two production shapes and explain when each one is the calmer model.",
    starterPrompt:
      "Compare a worker-result pipeline built around `mpsc::channel` against a design built around `Arc<Mutex<HashMap<String, usize>>>`.",
    prompts: [
      "Which design keeps one thread as the owner of mutation?",
      "Which design makes contention and lock scope the main runtime risk?",
      "Which design is easier to reason about when message order matters?",
      "Which design is easier to reason about when many threads truly need to observe and update the same structure?",
    ],
    acceptanceCriteria: [
      "You explain ownership and mutation authority clearly for both designs.",
      "You name one operational win and one operational cost for message passing.",
      "You name one operational win and one operational cost for shared-state locking.",
      "You avoid claiming that one model is globally superior in every workload.",
    ],
    hints: [
      "Ask where the mutable state really lives.",
      "A strong answer talks about contention, backlog, and failure visibility, not only syntax.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Move owned jobs into worker threads and report totals",
    objective: "Implement a small multithreaded design where workers own their job batches and publish results back to the caller.",
    starterPrompt:
      "Spawn two worker threads, move an owned `Vec<Job>` into each one, compute a per-worker total, and return the totals through a channel.",
    prompts: [
      "Use `move` closures deliberately.",
      "Keep the worker input owned rather than borrowing stack-local job slices into `thread::spawn`.",
      "Join both workers before treating the result as complete.",
      "Print one total per worker plus a grand total.",
    ],
    acceptanceCriteria: [
      "Each worker closure owns its input jobs.",
      "The design uses a channel for results instead of a shared mutable result map updated by both workers directly.",
      "The caller joins the workers explicitly.",
      "The runnable lab prints the expected ingest, index, and grand totals.",
    ],
    hints: [
      "This is a good place to choose channels first and shared state second.",
      "A `move` closure should consume the job vector and the sender clone cleanly.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a thread boundary that captures the wrong thing",
    objective: "Fix two classic compile-time failures: borrowing stack data into `thread::spawn` and sending single-thread-only state across threads.",
    starterPrompt:
      "You inherit one function that borrows a local slice into `thread::spawn` and another that tries to send `Rc<RefCell<State>>` into a thread.",
    prompts: [
      "Which case wants owned data moved into the child thread?",
      "Which case wants `thread::scope` because the work is local and borrowed data is actually fine?",
      "Which case wants `Arc<Mutex<T>>` only if the state is semantically shared across threads?",
      "Which case should become message passing instead of shared mutation?",
    ],
    acceptanceCriteria: [
      "You repair at least one case by moving owned data.",
      "You repair at least one case by choosing scoped threads for borrowed data.",
      "You explain why `Rc<RefCell<T>>` is the wrong cross-thread shape.",
      "You justify any `Arc<Mutex<T>>` repair in semantic terms rather than as a compiler escape hatch.",
    ],
    hints: [
      "There are at least three valid repairs here. The right one depends on the lifetime and ownership story.",
      "If the child cannot outlive the parent, `thread::scope` deserves a look before cloning everything.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Choose channel-based or shared-state concurrency for a service",
    objective: "Map one realistic service boundary to the concurrency model that makes ownership easiest to operate.",
    starterPrompt:
      "You are designing `accept request -> parse -> schedule work -> update metrics -> publish completion` for a CPU-heavy service with a few hot counters and one central retry table.",
    prompts: [
      "Which parts want owned messages over channels?",
      "Which parts truly want shared immutable state through `Arc<T>` only?",
      "Which parts, if any, justify `Arc<Mutex<T>>` or another synchronized shared-state tool?",
      "What backpressure or contention signal would you monitor in production?",
    ],
    acceptanceCriteria: [
      "You choose at least one channel-based boundary and justify it.",
      "You choose at least one immutable shared-state boundary and justify it.",
      "You justify any mutable shared-state boundary in terms of real shared ownership, not convenience.",
      "You mention at least one observability hook such as queue depth, lock wait, or worker panic count.",
    ],
    hints: [
      "A service can legitimately use more than one concurrency model at once.",
      "The cleanest design usually has one owner per mutable subsystem, even if some immutable data is shared widely.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose OS threads, scoped threads, work stealing, async tasks, or distributed workers",
    objective: "Practice distinguishing five execution models that are often blurred together in design reviews.",
    starterPrompt:
      "You must parallelize four workloads: a request-local slice transform, a large CPU-bound collection map, a network fan-out with many waiting sockets, and a job that must run on another machine for isolation or capacity reasons.",
    prompts: [
      "Which workload wants scoped OS threads because it only borrows parent-owned data briefly?",
      "Which workload wants a work-stealing data-parallel scheduler because chunk sizes may be uneven?",
      "Which workload is an async-task problem rather than an OS-thread problem?",
      "Which workload is no longer a multithreading problem because the boundary is distributed?",
    ],
    acceptanceCriteria: [
      "You keep OS threads, async tasks, and distributed workers clearly separate.",
      "You choose scoped threads for at least one borrowed local CPU-bound case.",
      "You choose a work-stealing or data-parallel model for at least one uneven CPU-bound collection workload.",
      "You explain why network fan-out is more naturally an async-task or executor problem than a raw-thread spray.",
    ],
    hints: [
      "One of the easiest design mistakes is solving waiting with more threads when the real model is async IO.",
      "Another is calling a cross-machine queue 'multithreading' when the ownership and failure model has already changed completely.",
    ],
  },
]

const reviewQuestions = [
  "What does `Send` mean, and what does `Sync` mean?",
  "Why is a `move` closure the ordinary shape for `thread::spawn`?",
  "When is `thread::scope` a better answer than cloning or heap-sharing more data?",
  "What is the difference between message passing and shared-state locking as an ownership design?",
  "Why is work stealing a scheduler strategy rather than a synonym for threads?",
  "Why are async tasks and distributed workers separate from OS-thread design even when all three are 'concurrent'?",
]

const workingLoop = [
  "Name the execution model first: OS thread, scoped OS thread, async task, work-stealing data parallelism, or distributed worker.",
  "Name the ownership boundary second: moved owner, borrowed slice inside a scope, shared immutable state, or synchronized mutable state.",
  "Choose the primitive third: channel, `Arc`, `Mutex`, scoped thread, or a higher-level scheduler.",
  "Define one failure signal and one observability signal before calling the design production-ready.",
]

export function PageCh22MultithreadingInRustExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 43
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 22 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice Rust multithreading the way it shows up in real systems: explicit thread-boundary ownership, honest
          `Send` and `Sync` reasoning, deliberate shared-state choices, and clear separation from async or distributed work.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a concurrency design review. The best answer does not stop at “use threads.” It
                states what crosses the boundary by ownership, which values are merely shared, where synchronization
                exists, and why a different execution model might actually be the more honest choice.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(42)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 22
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
                  Multithreading drill
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
          title="Runnable lab · Move owned jobs into worker threads and report results"
          description={
            <>
              Repair the starter so each worker thread owns its job batch, sums the job costs, and sends the result back to
              the caller through a channel. The checker expects a real
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">move</code>
              thread boundary and the correct ingest, index, and grand totals.
            </>
          }
          filename="owned_jobs_channel_lab.rs"
          runKey="ch22_ex_owned_jobs_channel"
          expectedOutput={"ingest = 5\nindex = 4\ngrand = 9"}
          helperText={
            <>
              Tip: keep the worker input as an owned <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec&lt;Job&gt;</code>,
              spawn with a <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">move</code> closure, compute the total from{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">job.cost</code>, and send{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">(worker, total)</code> back over the channel.
            </>
          }
          initialCode={`use std::sync::mpsc;\nuse std::thread;\n\n#[derive(Debug)]\nstruct Job {\n    cost: u32,\n}\n\nfn spawn_worker(\n    tx: mpsc::Sender<(&'static str, u32)>,\n    worker: &'static str,\n    jobs: Vec<Job>,\n) -> thread::JoinHandle<()> {\n    thread::spawn(|| {\n        let total = 0;\n        tx.send((worker, total)).unwrap();\n    })\n}\n\nfn main() {\n    let (tx, rx) = mpsc::channel();\n\n    let ingest_jobs = vec![Job { cost: 2 }, Job { cost: 3 }];\n    let index_jobs = vec![Job { cost: 4 }];\n\n    let ingest = spawn_worker(tx.clone(), "ingest", ingest_jobs);\n    let index = spawn_worker(tx, "index", index_jobs);\n\n    ingest.join().unwrap();\n    index.join().unwrap();\n\n    let mut ingest_total = 0;\n    let mut index_total = 0;\n    let mut grand = 0;\n\n    for (worker, total) in rx {\n        grand += total;\n        if worker == "ingest" {\n            ingest_total = total;\n        } else if worker == "index" {\n            index_total = total;\n        }\n    }\n\n    println!(\"ingest = {}\", ingest_total);\n    println!(\"index = {}\", index_total);\n    println!(\"grand = {}\", grand);\n}`}
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
            By the end of this page, you should be able to classify `Send` and `Sync` without hand-waving, move owned data
            into worker threads intentionally, compare channel-driven and lock-driven designs from workload shape, and
            explain clearly when the right answer is scoped OS threads, work stealing, async tasks, or distributed workers.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch22_multithreading_in_rust/owned_jobs_over_channel.rs`
````
use std::collections::HashMap;
use std::sync::mpsc;
use std::thread;

#[derive(Debug)]
struct Job {
    name: &'static str,
    cost: u32,
}

fn spawn_worker(
    tx: mpsc::Sender<(&'static str, u32)>,
    worker: &'static str,
    jobs: Vec<Job>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let total: u32 = jobs.iter().map(|job| job.cost).sum();
        tx.send((worker, total)).unwrap();
    })
}

fn main() {
    let (tx, rx) = mpsc::channel();

    let ingest_jobs = vec![
        Job {
            name: "parse",
            cost: 3,
        },
        Job {
            name: "validate",
            cost: 2,
        },
    ];
    let index_jobs = vec![
        Job {
            name: "index",
            cost: 4,
        },
        Job {
            name: "flush",
            cost: 1,
        },
    ];

    let ingest = spawn_worker(tx.clone(), "ingest", ingest_jobs);
    let index = spawn_worker(tx, "index", index_jobs);

    ingest.join().unwrap();
    index.join().unwrap();

    let mut totals = HashMap::new();
    for (worker, total) in rx {
        totals.insert(worker, total);
    }

    let grand: u32 = totals.values().copied().sum();

    println!("ingest total = {}", totals.get("ingest").copied().unwrap_or(0));
    println!("index total = {}", totals.get("index").copied().unwrap_or(0));
    println!("grand total = {}", grand);
}
````

### File: `examples/ch22_multithreading_in_rust/shared_state_route_counts.rs`
````
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counts = Arc::new(Mutex::new(HashMap::<&'static str, usize>::new()));
    let mut handles = Vec::new();

    for route in ["api", "api", "billing", "api"] {
        let counts = Arc::clone(&counts);
        handles.push(thread::spawn(move || {
            let mut map = counts.lock().unwrap();
            *map.entry(route).or_insert(0) += 1;
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }

    let map = counts.lock().unwrap();
    println!("api = {}", map.get("api").copied().unwrap_or(0));
    println!("billing = {}", map.get("billing").copied().unwrap_or(0));
    println!("routes = {}", map.len());
}
````

### File: `examples/ch22_multithreading_in_rust/scoped_threads_slice_sum.rs`
````
use std::thread;

fn main() {
    let values = [2_u32, 4, 6, 8, 10, 12];
    let split_at = 3;

    thread::scope(|scope| {
        let (left, right) = values.split_at(split_at);

        let left_handle = scope.spawn(move || left.iter().copied().sum::<u32>());
        let right_handle = scope.spawn(move || right.iter().copied().sum::<u32>());

        let left_total = left_handle.join().unwrap();
        let right_total = right_handle.join().unwrap();

        println!("left = {}", left_total);
        println!("right = {}", right_total);
        println!("total = {}", left_total + right_total);
    });
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -40,3 +40,5 @@ export { PageCh20Metaprogramming } from "./page-ch20-metaprogramming"
 export { PageCh20MetaprogrammingExercises } from "./page-ch20-metaprogramming-exercises"
 export { PageCh21ReflectionAndTypeIntrospection } from "./page-ch21-reflection-and-type-introspection"
 export { PageCh21ReflectionAndTypeIntrospectionExercises } from "./page-ch21-reflection-and-type-introspection-exercises"
+export { PageCh22MultithreadingInRust } from "./page-ch22-multithreading-in-rust"
+export { PageCh22MultithreadingInRustExercises } from "./page-ch22-multithreading-in-rust-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -51,6 +51,8 @@ import {
   PageCh20MetaprogrammingExercises,
   PageCh21ReflectionAndTypeIntrospection,
   PageCh21ReflectionAndTypeIntrospectionExercises,
+  PageCh22MultithreadingInRust,
+  PageCh22MultithreadingInRustExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -98,6 +100,8 @@ const PAGE_COMPONENTS = [
   PageCh20MetaprogrammingExercises,
   PageCh21ReflectionAndTypeIntrospection,
   PageCh21ReflectionAndTypeIntrospectionExercises,
+  PageCh22MultithreadingInRust,
+  PageCh22MultithreadingInRustExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -10,6 +10,7 @@ import { DEFAULT_CODES_CH18 } from "./default-codes-ch18"
 import { DEFAULT_CODES_CH19 } from "./default-codes-ch19"
 import { DEFAULT_CODES_CH20 } from "./default-codes-ch20"
 import { DEFAULT_CODES_CH21 } from "./default-codes-ch21"
+import { DEFAULT_CODES_CH22 } from "./default-codes-ch22"
 
 export interface PageConfig {
   id: string
@@ -523,6 +524,30 @@ export const CHAPTERS: ChapterConfig[] = [
         icon: "trophy",
       },
     ],
+  },
+  {
+    id: "ch22-multithreading-in-rust",
+    title: "Chapter 22 · Multithreading in Rust",
+    icon: "book",
+    pages: [
+      {
+        id: "ch22-multithreading-in-rust",
+        title: "Multithreading in Rust",
+        shortTitle: "Multithreading",
+        description:
+          "Rust's thread safety model, Send and Sync, spawning and scoped threads, shared state, channels, work stealing, and cross-language tradeoffs",
+        icon: "book",
+        codeKeys: [
+          "multithreading_owned_jobs_channel",
+          "multithreading_shared_state_metrics",
+          "multithreading_scoped_threads_sum",
+        ],
+      },
+      {
+        id: "ch22-multithreading-in-rust-exercises",
+        title: "Chapter 22 Exercises",
+        shortTitle: "Exercises",
+        description: "Classify Send and Sync, move owned data into worker threads, and compare channel-based and shared-state designs",
+        icon: "trophy",
+      },
+    ],
   },
 ]
 
@@ -962,5 +987,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH19,
   ...DEFAULT_CODES_CH20,
   ...DEFAULT_CODES_CH21,
+  ...DEFAULT_CODES_CH22,
 }
 
 export interface BookState {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh22Output } from "./rust-simulator-ch22"
 import { simulateCh21Output } from "./rust-simulator-ch21"
 import { simulateCh20Output } from "./rust-simulator-ch20"
 import { simulateCh19Output } from "./rust-simulator-ch19"
@@ -38,7 +39,7 @@ const RUST_PRIMITIVE_TYPES = new Set([
 ])
 
 const RUST_STANDARD_TYPES = new Set([
-  "Arc", "BTreeMap", "BTreeSet", "Box", "BuildHasherDefault", "Cell", "Clone", "Context", "Copy", "Cow", "CString", "CStr", "Debug", "Default", "Display", "Entry", "Future", "HashMap", "HashSet", "IntoIterator", "Iterator", "MaybeUninit", "Mutex", "NonNull", "Option", "PhantomData", "Pin", "Poll", "RandomState", "Rc", "RefCell", "Result", "Send", "String", "Sync", "Vec", "Wake", "Weak", "Waker",
+  "Arc", "BTreeMap", "BTreeSet", "Box", "BuildHasherDefault", "Cell", "Clone", "Context", "Copy", "Cow", "CString", "CStr", "Debug", "Default", "Display", "Entry", "Future", "HashMap", "HashSet", "IntoIterator", "Iterator", "JoinHandle", "MaybeUninit", "Mutex", "NonNull", "Option", "PhantomData", "Pin", "Poll", "RandomState", "Rc", "Receiver", "RefCell", "Result", "ScopedJoinHandle", "Send", "Sender", "String", "Sync", "SyncSender", "Vec", "Wake", "Weak", "Waker",
 ])
 
 const RUST_TYPE_CONTEXT_KEYWORDS = new Set([
@@ -1000,6 +1001,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch22Output = simulateCh22Output(code, key)
+  if (ch22Output !== null) return ch22Output
 
   const ch21Output = simulateCh21Output(code, key)
   if (ch21Output !== null) return ch21Output
````

### File: `components/rust-code-editor.tsx`
````diff
--- components/rust-code-editor.tsx
+++ components/rust-code-editor.tsx
@@ -16,7 +16,7 @@ const RUST_KEYWORDS = [
 
 const RUST_TYPES = [
   "i8", "i16", "i32", "i64", "i128", "isize",
-  "u8", "u16", "u32", "u64", "u128", "usize",
+  "u8", "u16", "u32", "u64", "u128", "usize", "JoinHandle", "ScopedJoinHandle", "Sender", "Receiver", "SyncSender",
   "f32", "f64", "bool", "char", "str", "String", "Vec", "Option", "Result", "Box", "MaybeUninit", "NonNull", "CString", "CStr",
   "Any", "TypeId", "HashMap", "HashSet", "BTreeMap", "BTreeSet", "Rc", "Arc", "Weak", "RefCell", "Cell", "Mutex", "Pin", "Context", "Poll", "Waker", "Future", "RandomState", "BuildHasherDefault", "TokenStream"
 ]
````

### File: `components/rust-book/rust-simulator-ch22.ts`
````
function parseNumericList(source?: string): number[] {
  if (!source) return []

  return source
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/_/g, "")
        .replace(/(?:i|u)(?:8|16|32|64|128|size)$/i, "")
    )
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((value) => !Number.isNaN(value))
}

function parseQuotedList(source?: string): string[] {
  if (!source) return []
  return Array.from(source.matchAll(/"([^"]+)"/g), (match) => match[1])
}

function parseWorkerJobSums(code: string): Record<string, number> {
  const vectorSums: Record<string, number> = {}

  for (const match of code.matchAll(/let\s+([a-zA-Z_]\w*)\s*=\s*vec!\[([\s\S]*?)\]\s*;/g)) {
    const name = match[1]
    const body = match[2]
    const costs = Array.from(body.matchAll(/cost:\s*(\d+)/g), (costMatch) => Number(costMatch[1]))
    vectorSums[name] = costs.reduce((sum, value) => sum + value, 0)
  }

  const workerSums: Record<string, number> = {}
  for (const match of code.matchAll(
    /spawn_worker\(\s*tx(?:\.clone\(\))?\s*,\s*"([^"]+)"\s*,\s*([a-zA-Z_]\w*)\s*\)/g
  )) {
    const worker = match[1]
    const vectorName = match[2]
    workerSums[worker] = vectorSums[vectorName] ?? 0
  }

  return workerSums
}

export function simulateCh22Output(code: string, key?: string): string | null {
  if (key === "multithreading_owned_jobs_channel") {
    const totals = parseWorkerJobSums(code)
    const grand = Object.values(totals).reduce((sum, value) => sum + value, 0)

    return `ingest total = ${totals["ingest"] ?? 0}\nindex total = ${totals["index"] ?? 0}\ngrand total = ${grand}`
  }

  if (key === "multithreading_shared_state_metrics") {
    const routeSource = code.match(/for\s+route\s+in\s*\[([\s\S]*?)\]/)?.[1]
    const routes = parseQuotedList(routeSource)
    const usesArcMutex = /Arc::new\(\s*Mutex::new/.test(code) && /lock\(\)\.unwrap\(\)/.test(code)

    const counts: Record<string, number> = {}
    if (usesArcMutex) {
      for (const route of routes) {
        counts[route] = (counts[route] ?? 0) + 1
      }
    }

    return `api = ${counts["api"] ?? 0}\nbilling = ${counts["billing"] ?? 0}\nroutes = ${Object.keys(counts).length}`
  }

  if (key === "multithreading_scoped_threads_sum") {
    const values = parseNumericList(code.match(/let\s+values\s*=\s*\[([^\]]+)\]/)?.[1])
    const splitAt = Number(code.match(/let\s+split_at\s*=\s*(\d+)/)?.[1] ?? "0")
    const hasScope = /thread::scope\(/.test(code) && /scope\.spawn\(/.test(code)

    if (!hasScope) {
      return "left = 0\nright = 0\ntotal = 0"
    }

    const left = values.slice(0, splitAt).reduce((sum, value) => sum + value, 0)
    const right = values.slice(splitAt).reduce((sum, value) => sum + value, 0)

    return `left = ${left}\nright = ${right}\ntotal = ${left + right}`
  }

  if (key === "ch22_ex_owned_jobs_channel") {
    const totals = parseWorkerJobSums(code)
    const hasMoveSpawn = /thread::spawn\(\s*move\s*\|\|/.test(code)
    const sendsResult = /tx\.send\(\s*\(\s*worker\s*,\s*total\s*\)\s*\)/.test(code)
    const sumsCosts =
      /job\.cost/.test(code) &&
      (/\.sum::<u32>\(\)/.test(code) || /\.sum\(\)/.test(code) || /for\s+job\s+in\s+jobs/.test(code))
    const joins = (code.match(/join\(\)\.unwrap\(\)/g) ?? []).length >= 2

    if (hasMoveSpawn && sendsResult && sumsCosts && joins) {
      const grand = Object.values(totals).reduce((sum, value) => sum + value, 0)
      return `ingest = ${totals["ingest"] ?? 0}\nindex = ${totals["index"] ?? 0}\ngrand = ${grand}`
    }

    return "ingest = 0\nindex = 0\ngrand = 0"
  }

  return null
}
````
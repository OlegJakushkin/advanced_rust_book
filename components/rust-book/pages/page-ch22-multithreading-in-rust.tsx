"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A spawned thread is an independent execution boundary you must account for",
    body: "Once thread::spawn returns, the child runs under the OS scheduler on its own timeline and may keep running after the function that started it returns. The compiler refuses to let that detached thread borrow short-lived stack data, because there is no longer anyone guaranteeing the data outlives the thread. That single rule explains why move closures, owned jobs, and Arc show up everywhere in threaded Rust: the thread either owns what it touches or shares it through something that lives long enough.",
  },
  {
    title: "Thread safety is a property of types, checked at compile time",
    body: "In most languages, whether a value is safe to share across threads is documentation and discipline. In Rust it is encoded in two auto traits, Send and Sync, that the compiler derives for almost every type automatically. A data race is not a runtime bug you debug after the fact; it is usually a type error that stops the build, because the values involved were never Send or Sync in the first place.",
  },
  {
    title: "Pick the concurrency shape first, then the primitive that fits it",
    body: "There is no single 'correct' tool. Some work wants one owner of mutable state receiving owned messages; some wants immutable state shared read-only by many threads; some wants synchronized mutation behind a lock; some wants one large collection split into borrowed slices for parallel CPU work. Each of these maps to a different primitive, and most painful threaded code comes from forcing the wrong shape, usually a global Arc-Mutex around everything, onto a problem that wanted a channel or a scoped split.",
  },
]

const executionKinds = [
  {
    title: "OS thread",
    body: "Scheduled by the operating system. Good for blocking work, CPU-bound workers, and explicit parallelism. Created with thread::spawn or thread::scope, and the subject of this chapter.",
  },
  {
    title: "Async task",
    body: "A user-space task driven by an executor inside your process. Far cheaper to create than an OS thread, but it must not block the executor thread it runs on. This is a later-chapter topic, not this one.",
  },
  {
    title: "Future",
    body: "A state machine describing async work. A future does nothing until some executor polls it forward; it is not a thread and not a scheduler, just the value an async block produces.",
  },
  {
    title: "Executor",
    body: "The runtime component that polls futures and multiplexes many tasks onto a smaller number of OS threads. It is the scheduler for the async world, separate from the OS scheduler.",
  },
  {
    title: "Data-parallel job",
    body: "One collection or numerical workload split across worker threads. Work-stealing schedulers fit well here because real data rarely divides into perfectly even chunks.",
  },
  {
    title: "Distributed worker",
    body: "Another process or machine entirely. Once work crosses the network, Send and Sync stop being the contract; serialization, retries, and idempotency become the real boundary instead.",
  },
]

const threadSafetyCards = [
  {
    title: "Data races are ruled out by the ownership rules",
    body: "Safe Rust forbids unsynchronized shared mutable aliasing, and that single rule is what eliminates data races. The same borrow-checker logic that stops a local use-after-move bug is what shapes a sound thread boundary; concurrency does not get a separate, weaker rulebook.",
  },
  {
    title: "Spawned threads need owned or 'static captures",
    body: "A detached thread can outlive the stack frame that started it, so it cannot keep borrowing short-lived local data. That is why a move closure shows up on almost every spawn: the thread takes ownership of what it needs so the data lives as long as the thread does.",
  },
  {
    title: "Join handles make failure observable",
    body: "Spawning returns a JoinHandle, and joining it yields a Result because the child may have panicked. Treat a worker panic as a first-class operational signal you surface and act on, not a silent background failure you discover from missing output.",
  },
  {
    title: "OS threads cost real resources",
    body: "These are not goroutines or async tasks. Each thread carries a stack, scheduler bookkeeping, and wake-up latency. They earn their cost on substantial CPU-bound or blocking work and become wasteful noise when sprayed one-per-tiny-unit-of-work.",
  },
]

const sendSyncDefinitions = [
  {
    title: "Send",
    body: "A type is Send when a value of it can be moved to another thread safely. This is the trait thread::spawn asks for on everything its closure captures.",
  },
  {
    title: "Sync",
    body: "A type is Sync when a shared reference to it can be used from several threads at once safely. The precise shorthand is: T is Sync exactly when a shared reference to T is Send.",
  },
]

const sendSyncExamples = [
  {
    title: "String",
    traitText: "Send + Sync",
    body: "An owned string moves to another thread freely, and shared references are safe because any mutation still goes through ordinary borrow rules. The common case just works.",
  },
  {
    title: "Rc<T>",
    traitText: "!Send + !Sync",
    body: "Its reference count is a plain non-atomic integer, so two threads bumping it would race. Rc is therefore single-thread only. Catching this at compile time is one of the most useful corrections for engineers arriving from C++ and C#.",
  },
  {
    title: "Arc<T>",
    traitText: "Send + Sync when T is",
    body: "The atomic reference count makes shared ownership safe to pass around threads. It does not, however, make a non-thread-safe inner value safe; Arc only inherits the traits its contents already have.",
  },
  {
    title: "RefCell<T>",
    traitText: "Send if T is, never Sync",
    body: "You can move a RefCell to another thread when its contents can move, but you cannot share references to one across threads, because its runtime borrow flags are not synchronized.",
  },
  {
    title: "Mutex<T>",
    traitText: "Send + Sync when T is Send",
    body: "A Mutex provides synchronized exclusive access, which is the shared-state counterpart to an exclusive borrow. This is what upgrades an otherwise single-thread value into something many threads can mutate safely.",
  },
]

const sharedStateCards = [
  {
    title: "Share state only when the state is genuinely shared",
    body: "Plain Arc is the right fit for immutable shared configuration, schemas, or lookup tables that many threads read. Reach for Arc around a Mutex only when several threads truly coordinate around one mutable owner, not as a reflex.",
  },
  {
    title: "Lock scope is where the performance lives",
    body: "The critical section, the span of code holding the lock, is your main optimization surface. Keep it tiny. Do not hold a mutex across blocking IO, large allocations, or heavy CPU work if you can compute the result first and only take the lock to store it.",
  },
  {
    title: "A lock encodes two separate decisions",
    body: "Arc around a Mutex says two things at once: ownership is shared, and mutation is synchronized. If only one of those is actually true for your data, the type is over-specified and the design wants to be simpler, often a channel or a plain Arc.",
  },
]

const messagePassingCards = [
  {
    title: "Channels transfer ownership by design",
    body: "Sending a value down a channel moves it; the receiver becomes the new owner. This is calmest when one subsystem should own the mutable state and everyone else submits work or results as owned messages rather than reaching into shared memory.",
  },
  {
    title: "mpsc is the standard-library baseline",
    body: "The standard library ships multiple-producer, single-consumer channels. That single shape covers a surprising amount of ground: worker-to-aggregator result collection and single-owner command loops both fall out of it naturally.",
  },
  {
    title: "Bounded versus unbounded is a backpressure decision",
    body: "An unbounded channel never blocks the sender but can grow memory without limit under overload. A bounded sync_channel makes a full queue push back on producers instead. Choosing between them is choosing what happens when consumers fall behind.",
  },
]

const scopedThreadCards = [
  {
    title: "Scoped threads are still real OS threads",
    body: "thread::scope does not give you lighter or cheaper threads. The benefit is not scheduling; it is lifetime. The scope guarantees every child it spawned has joined before it returns, which changes what those children are allowed to borrow.",
  },
  {
    title: "Borrowing stack data becomes legal again",
    body: "Because the join-before-exit guarantee bounds how long a child can run, the closures may borrow data from the parent stack, such as slices of a local array. For request-local CPU work this is usually the cleanest shape available.",
  },
  {
    title: "Ideal for splitting one collection across cores",
    body: "When the parent already owns one large collection and just wants parallel read-only or disjoint views into it, a scoped split removes the fake clones and 'static pressure that a plain spawn would otherwise force on you.",
  },
]

const workStealingCards = [
  {
    title: "Work stealing is a scheduling strategy",
    body: "Each worker starts with its own queue of work. When a worker empties its queue, it steals tasks from a busier worker instead of going idle. That self-balancing is what keeps cores busy when task sizes are uneven.",
  },
  {
    title: "It fits data parallelism well",
    body: "Fork-join workloads and parallel collection transforms benefit most, because production data almost never divides into perfectly equal chunks and a static split would leave some cores idle while others finish late.",
  },
  {
    title: "Not the same as manual threads or async executors",
    body: "The standard library gives you explicit thread primitives but no work-stealing pool. That is an ecosystem tool, Rayon being the usual choice for CPU work. Async executors may also steal work, but they balance futures, not hand-managed worker threads.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "std::thread is the closest analogue, and RAII and move semantics carry straight over. The shift is that thread safety stops being a review discipline you enforce by convention and becomes a compile-time contract: sharing a non-atomic refcounted pointer or a plain mutable reference across a thread boundary is a type error, not a data race you find later with a sanitizer.",
  },
  {
    title: "C# background",
    body: "Anchor this chapter on Thread, not Task. C# tasks and thread-pool work items belong to the later async and pooled-runtime story; here we are talking about real OS threads with real cost. The harder adjustment is that there is no garbage collector to paper over shared lifetime, so you decide explicitly whether a thread owns its data, shares it through Arc, or borrows it inside a scope.",
  },
  {
    title: "Go background",
    body: "A goroutine is a cheap user-space task; thread::spawn is a heavier OS thread, and the cheap-task instinct maps better onto Rust async later. Go also leans on 'share memory by communicating' as a convention, while Rust makes it structural: ownership transfer over a channel and borrowed-data lifetime are enforced by the compiler rather than left to you to get right.",
  },
  {
    title: "Python background",
    body: "Forget the GIL. Rust threads run truly in parallel with no global lock, so CPU-bound work actually scales across cores, which it never does with Python threads. The flip side is that the interpreter is no longer serializing access for you: shared mutable state needs an explicit Mutex or an atomic, and the compiler will insist on it rather than letting two threads quietly race.",
  },
]

const productionPatterns = [
  "Prefer owned work messages when one thread should own the mutable state and the rest of the system should submit commands or results to it.",
  "Prefer a plain Arc for shared immutable configuration. Add a lock only when coordinated mutation is genuinely part of the model, not to silence the borrow checker.",
  "Use scoped threads for request-local CPU work over borrowed slices or borrowed read-only state when the parent already owns the data and outlives the work.",
  "Name important threads with thread::Builder and treat join failures as first-class operational signals rather than swallowed errors.",
  "Reach for a work-stealing or data-parallel library when the real job is CPU-bound parallel iteration, not hand-managed long-lived worker threads.",
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
  "Spawning unbounded OS threads for tiny units of work because it resembles goroutines or thread-pool tasks from another language. Each thread has real cost.",
  "Defaulting to one giant Arc-Mutex-HashMap because it compiles. A broad lock usually hides several distinct ownership domains and several distinct performance problems behind one bottleneck.",
  "Holding a mutex across blocking IO or expensive computation, then blaming Rust for the contention rather than the oversized critical section.",
  "Using thread::spawn when thread::scope would have expressed the real borrowed-lifetime model directly, forcing clones or 'static workarounds you did not need.",
  "Confusing OS threads, async tasks, data-parallel work stealing, and distributed workers. They solve different scheduling and ownership problems and have different costs.",
  "Writing an unsafe Send or Sync impl for a type with hidden raw pointers or thread-affine resources without a real proof. The invariant must cover aliasing, mutation, and drop behavior across threads.",
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
                introduced <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc</code>,{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Mutex</code>, and related pointer
                choices. Chapter 14 explained trait-based boundaries. This chapter applies those ideas to OS threads
                directly.
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
          <h3 className="text-lg font-semibold text-foreground mb-3">The problem this chapter solves</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Picture a request-processing service with three kinds of work happening at once. It does CPU-heavy
            preprocessing on incoming payloads, it keeps a shared metrics index up to date, and it hands off slower
            background jobs to a pool of worker threads. In another language you might reach for one shared object guarded
            by a lock and call it a day. In Rust the more durable design names each boundary by its ownership story: jobs
            are <em>moved</em> into the workers that run them, immutable configuration is <em>shared</em> read-only through
            an <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc</code>, genuinely shared mutation
            goes behind a lock and nothing else does, and a one-shot parallel pass over local data uses a scoped split so
            the threads can <em>borrow</em> instead of clone.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-6">
            That is the spine of the chapter. Each of those four moves, move, share, synchronize, and borrow-in-scope, is
            a distinct primitive with a distinct cost, and the skill is matching the primitive to the workload rather than
            defaulting to whichever one compiled first.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">One distinction to hold onto: this is about OS threads</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Everything here concerns <strong className="text-foreground">OS threads</strong>, the kind the operating
              system schedules and that cost real memory and scheduler attention. It is deliberately not about async tasks,
              futures, or executors, even though those also do concurrent work. The two models look similar from a distance
              and solve different problems, so keep them in separate boxes: threads are scheduled by the OS, async tasks
              are scheduled by an executor inside your process, and distributed workers are other processes or machines
              entirely. We cover the async model in its own chapter.
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
            <h4 className="font-semibold text-foreground mb-3">Naming the execution models before the APIs</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Most confusion in this area is vocabulary, not code. &quot;Concurrency&quot; gets stretched across several
              unrelated mechanisms with different schedulers, different costs, and different ownership rules. Before any
              API, fix the terms. The diagram shows who schedules what: the OS schedules threads, an executor schedules
              tasks inside one process, and distributed work runs in other processes entirely.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  W[Concurrent work] --> OS[OS thread]\n  W --> AT[Async task]\n  W --> DP[Data parallel job]\n  W --> DW[Distributed worker]`}
              caption="One label, four execution models. Each branch is a different kind of concurrent work with a different cost."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Each of those four kinds is scheduled by something different. The same four branches map to four
              schedulers:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  OS[OS thread] -->|scheduled by| Kernel[OS scheduler]\n  AT[Async task] -->|polled by| Exec[Executor in-process]\n  DP[Data parallel job] -->|balanced by| Pool[Work-stealing pool]\n  DW[Distributed worker] -->|carried by| Net[Network and serialization]\n  AT -.drives.-> Fut[Future state machine]`}
              caption="Four schedulers for the four models. This chapter is the OS-thread branch; the others have their own contracts and costs."
            />
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
            <h4 className="font-semibold text-foreground mb-3">Send and Sync: the two traits that gate every thread boundary</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              These two auto traits are the entire mechanism behind &quot;data races do not compile.&quot; They are marker
              traits with no methods; the compiler derives them automatically for a type when all of its fields qualify.
              When you call <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">thread::spawn</code>, its
              signature quietly requires the closure (and everything it captures) to be{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Send</code>. A type that is not{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Send</code> simply will not fit through
              that boundary, and you get a compile error pointing at the capture rather than a race at 3 a.m. The diagram
              shows the two questions the compiler is really asking.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  V[A value of type T] --> Q1{Move to another thread}\n  Q1 -->|needs T is Send| Spawn[thread::spawn closure]\n  V --> Q2{Share a reference across threads}\n  Q2 -->|needs T is Sync| Share[Arc read by many]`}
              caption="Two questions the compiler asks: moving a value across a thread needs Send; sharing a reference needs Sync."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Those two questions are exactly what separates the two reference-counted pointers at a thread boundary:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  RC[Rc] -->|not Send, not Sync| Reject[rejected at compile time]\n  ARC[Arc] -->|Send and Sync if T is| Accept[crosses the boundary]`}
              caption="Rc fails both checks because its refcount is non-atomic; Arc passes when its contents do, so only Arc crosses the boundary."
            />
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
                  ownership of captured non-Copy values into the child thread. That is the calm default for jobs, owned
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
                is often calmer than hand-rolling many{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">thread::spawn</code> calls. If the work
                is IO-bound waiting, an async executor is usually the more honest model. If the work crosses the network,
                you are in distributed systems.
              </p>
            </div>
          </div>

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Coming from another language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            If you already write concurrent code somewhere else, the syntax is the easy part. What trips people up is the
            mental-model shift, so read whichever card matches your background before the examples.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: ownership flows in one direction. Each job <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec</code>{" "}
              is moved into its worker, so the worker is the sole owner while it runs; results travel back as small owned
              tuples over the channel, and only the main thread builds the final map. No worker ever touches that map, so
              there is nothing to lock.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  M[main] -->|move ingest jobs| W1[ingest worker]\n  M -->|move index jobs| W2[index worker]\n  W1 -->|send worker total| Ch[(mpsc channel)]\n  W2 -->|send worker total| Ch\n  M -->|join both| J[handles joined]\n  Ch -->|drain rx| Agg[main aggregates totals]`}
              caption="Jobs move out to the workers; totals come back over one channel; aggregation happens in a single owner. Move out, message back."
            />
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
                <h4 className="font-semibold text-foreground">
                  Example 2: shared state with{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc&lt;Mutex&lt;...&gt;&gt;</code>
                </h4>
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the two wrappers do two separate jobs. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc</code>{" "}
              is what lets every thread reach the same map (each thread gets its own clone of the handle, all pointing at
              one allocation), and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Mutex</code> is what
              serializes the writes so two increments cannot collide. Read the diagram as: everyone shares the pointer,
              but only the lock holder may mutate.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Arc[(Arc Mutex HashMap)] --> T1[thread api]\n  Arc --> T2[thread api]\n  Arc --> T3[thread billing]\n  Arc --> T4[thread api]\n  T1 -->|lock, increment, unlock| Crit{Mutex held by one}\n  T2 -->|wait then lock| Crit\n  T3 -->|wait then lock| Crit\n  T4 -->|wait then lock| Crit\n  Crit --> Main[main reads final counts]`}
              caption="Shared ownership via Arc, exclusive mutation via Mutex. The lock is the bottleneck, so keeping the critical section tiny is the whole optimization."
            />
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
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc</code> makes the counter map
                  reachable from several threads.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Synchronized mutation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Mutex</code> narrows mutation to one
                  thread at a time.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: nothing is cloned and nothing is wrapped in <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc</code>.
              The parent owns the array the whole time; the children borrow non-overlapping slices of it. This compiles
              only because <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">thread::scope</code>{" "}
              guarantees every child joins before the scope returns, so the borrows provably cannot outlive the data.
              That join-before-exit guarantee is the entire reason scoped threads can do what a plain spawn cannot.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Arr[values owned by parent] --> Split[split_at index 3]\n  Split -->|borrow left slice| L[scope child: sum left]\n  Split -->|borrow right slice| R[scope child: sum right]\n  L -->|join| P[parent combines]\n  R -->|join| P\n  P --> Exit[scope exits, borrows end]`}
              caption="The parent keeps ownership; children borrow disjoint slices and are joined before the scope can return. No Arc, no clone, no 'static requirement."
            />
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
            The companion exercise page asks you to classify types by Send and Sync, repair non-&apos;static thread
            captures, compare channel-based and shared-state designs, and choose among scoped threads, work stealing,
            async tasks, and distributed workers from the shape of a workload.
          </p>
          <Button onClick={() => setCurrentPage(43)} className="gap-2">
            Open Chapter 22 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Rust multithreading is ordinary ownership plus two auto traits, Send and Sync, that turn most data races into compile errors.</li>
            <li>OS threads, async tasks, futures, executors, data parallelism, and distributed workers are different execution models with different schedulers and different costs.</li>
            <li>thread::spawn usually wants owned captured data; thread::scope is the tool when borrowing local stack data is the honest model.</li>
            <li>Shared state with Arc and a lock can be correct, but a channel is often calmer when only one thread should own the mutation.</li>
            <li>Work stealing is a scheduler strategy used by data-parallel libraries, not a synonym for spawning threads by hand.</li>
            <li>Good production thread design is observable, join-aware, and explicit about queue growth, lock contention, and panic handling.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

"use client"

import { useEffect } from "react"
import { getPageIndexById } from "../page-index"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A primitive is a concurrency contract, not a decoration",
    body: "Choose a primitive for the ownership and visibility story you actually need: one owner plus messages, one shared mutable structure, many readers and rare writers, or one-word atomic state.",
  },
  {
    title: "The predicate matters more than the wakeup",
    body: "A mutex protects a data invariant. A condvar waits for that invariant to change. A barrier synchronizes phases. A channel transfers ownership. The wakeup mechanism is secondary to the state transition it represents.",
  },
  {
    title: "Atomics are narrow and precise tools",
    body: "Atomics are excellent for counters, flags, and small publication protocols. They are usually the wrong first tool for multi-field invariants or broad application state.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You are used to a mutex and the data it protects being two separate variables held together by convention, where forgetting to take the lock compiles fine and fails in production. In Rust the data lives inside the lock, so you cannot reach the value without first acquiring the guard, and the guard's lifetime is when your access is valid. The shift is that 'who is allowed to touch this right now' moves from review discipline into the type system.",
  },
  {
    title: "C# background",
    body: "Forget the ambient monitor model where any object can be a lock target and Pulse/Wait float free of the state they guard. Rust binds the wait condition to a specific mutex and forces you to name the predicate. The bigger change is cultural: instead of reaching for a shared object plus lock by default, you ask whether the state should be shared at all, since message passing often removes the lock entirely.",
  },
  {
    title: "Go background",
    body: "Go's advice to favor channels over shared memory is a style preference; Rust makes it a typed decision. Channels here mean ownership actually moves to the receiver, so the sender can no longer touch what it sent, which is a stronger guarantee than a Go channel of pointers. Use a channel when the model is handoff, a lock when the state is genuinely co-owned, and an atomic only when the whole invariant fits in one word.",
  },
  {
    title: "Python background",
    body: "There is no GIL here, so two threads really do run your code at the same time on different cores, and a data race is a compile error rather than a corrupted dict you discover later. Coming from threading.Lock or asyncio, the new habit is that the compiler will not let a non-thread-safe value cross a thread boundary at all. That up-front friction replaces a whole class of heisenbugs you would otherwise chase at runtime.",
  },
]

const lockCards = [
  {
    title: "Mutex",
    body: "Use a mutex when one mutable structure is genuinely shared and the critical section can stay small. The default question is not 'can I lock this?' but 'should this state be shared at all?'",
    watch: "Measure contention and avoid holding the guard across expensive work.",
  },
  {
    title: "RwLock",
    body: "Use an `RwLock` for read-mostly state with rare writes and non-trivial read sections. It is not automatically faster than a mutex when writes are frequent or reads are tiny.",
    watch: "Reader-heavy designs can still suffer from writer latency or policy surprises under load.",
  },
]

const condvarPoints = [
  "Use a condvar when threads wait on a predicate guarded by the same mutex.",
  "Always wait in a loop. The loop checks the predicate; the wakeup only means 're-check now.'",
  "Change the shared state first, then notify. The notification is meaningful only because the predicate changed.",
  "If one thread should own mutation and others should submit work, a channel is often simpler than a condvar.",
]

const orderingCards = [
  {
    title: "Relaxed",
    body: "Atomicity only. Good for counters and statistics where no cross-thread ordering relationship is needed.",
  },
  {
    title: "Acquire and Release",
    body: "The practical publication pair. A Release store makes earlier writes visible to a thread that later observes the flag with Acquire.",
  },
  {
    title: "SeqCst",
    body: "The strongest ordinary ordering. Useful when you truly need one global order, but often stronger than the workload requires.",
  },
]

const barrierChannelCards = [
  {
    title: "Barriers",
    body: "A barrier is a phase gate. All participants wait until everyone arrives, then all proceed. It is a start gun, not a mutable state container.",
  },
  {
    title: "Channels",
    body: "Channels synchronize by ownership transfer. They are strongest when one thread should own mutation and other threads should send commands, jobs, or results instead of sharing the state directly.",
  },
]

const lockFreePatterns = [
  "Start with atomics for flags, counters, and sequence numbers. That already covers many hot-path needs.",
  "Full lock-free queues, maps, and intrusive structures usually involve unsafe code, memory reclamation, ABA risk, and much sharper testing requirements.",
  "An uncontended mutex is often cheaper and calmer than a hand-rolled lock-free structure.",
  "Prefer proven ecosystem implementations for lock-free structures rather than building one from scratch inside application code.",
]

const deadlockRules = [
  "Establish one global lock ordering and keep it boring.",
  "Hold guards for the shortest useful scope. Drop them before blocking IO, callbacks, or other heavy work.",
  "Do not call user-provided code while holding a lock unless the contract is extremely tight and intentional.",
  "If two subsystems each want to own mutable state, message passing is often simpler than nested locking.",
  "Use `try_lock` or lock timing in diagnostics to surface contention and lock inversion early.",
]

const choiceRows = [
  {
    workload: "One shared mutable map or queue with short critical sections",
    primitive: "Mutex",
    why: "Simple, explicit, and often faster than a more complex design when contention is modest.",
  },
  {
    workload: "Read-mostly configuration or cache with rare writes",
    primitive: "RwLock",
    why: "Lets readers proceed together while still keeping writes exclusive.",
  },
  {
    workload: "Wait until shared state becomes non-empty, ready, or closed",
    primitive: "Condvar + Mutex",
    why: "The condvar wakes waiters, but the mutex-protected predicate stays the source of truth.",
  },
  {
    workload: "Counters, flags, one-word publication state",
    primitive: "Atomics",
    why: "Precise and lightweight when the invariant fits in atomic operations.",
  },
  {
    workload: "Start several threads at the same phase boundary",
    primitive: "Barrier",
    why: "Phase synchronization without inventing shared mutable state.",
  },
  {
    workload: "One thread should own mutation, others submit work or results",
    primitive: "Channels",
    why: "Ownership transfer is the model, so the synchronization mechanism should say so directly.",
  },
  {
    workload: "Extreme hot path with a measured need to avoid locks",
    primitive: "Lock-free pattern",
    why: "Only after the invariants, benchmarks, and failure modes justify the complexity.",
  },
]

const productionPatterns = [
  "Prefer channels when one thread or subsystem should own the mutable state and other threads only need to send commands or results.",
  "Prefer `Arc<T>` for shared immutable data and add a lock only when coordinated mutation is truly part of the model.",
  "Treat `RwLock` as a read-mostly tool, not as a default upgrade over `Mutex`.",
  "Keep a condvar predicate explicit and test it with deterministic state transitions, not only with timing-sensitive sleeps.",
  "Measure lock hold time, queue depth, and atomic hot spots before escalating to a more complex primitive.",
]

const pitfalls = [
  "Switching to `RwLock` because it sounds more concurrent, without proving the state is actually read-mostly.",
  "Using atomics for a multi-field invariant and then rediscovering that atomic operations do not make the larger state transition atomic.",
  "Waiting on a condvar with `if` instead of `while`, or treating the wakeup as the predicate itself.",
  "Holding more than one lock without a declared order and then calling the resulting incident 'rare.'",
  "Jumping from a modest mutex to a lock-free structure before measuring contention or defining the memory reclamation story.",
]

export function PageCh23SynchronizationPrimitives() {
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
          Chapter 23 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Synchronization primitives protect shared state and coordinate progress under contention. This chapter covers
          mutexes, read-write locks, atomics, barriers, and channels as explicit workload choices.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 04, 09, and 22</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 04 gave us ownership and borrowing. Chapter 09 explained
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Arc</code>,
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Mutex</code>,
                and related pointer choices. Chapter 22 established OS-thread ownership boundaries and message passing. This
                chapter zooms into the synchronization contracts themselves.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch04-ownership-borrowing-and-lifetimes"))}>
                Chapter 04
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch09-smart-pointers-and-pinning"))}>
                Chapter 09
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch22-multithreading-in-rust"))}>
                Chapter 22
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Picture a small retry service running several worker threads. It holds three pieces of state with three very
            different access patterns: a table of in-flight requests that workers mutate constantly, a configuration
            snapshot that is read on every request and rewritten only when an operator pushes a change, and a queue of
            jobs that really wants a single consumer draining it. Each piece is a different concurrency problem, and the
            mistake that causes the most pain is reaching for the same primitive for all three.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The discipline this chapter teaches is to derive the primitive from the access pattern rather than from
            habit. A short, contended mutation wants a mutex. A read-mostly snapshot wants a read-write lock. A
            single-word flag or counter wants an atomic. A thread that must wait for state to change wants a condvar tied
            to that state. And a job stream with one owner wants a channel, because the real model is ownership transfer,
            not sharing. Naming the access pattern first turns primitive selection from a guessing game into a lookup.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A useful decision order</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Read the diagram top to bottom: the first fork is the most important one, because deciding whether state is
              shared at all often eliminates locks entirely in favor of message passing.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Start[Two threads need this state] --> Shared{Truly shared, or handoff?}\n  Shared -->|handoff| Chan[Channel: move ownership]\n  Shared -->|shared| Shape{What shape is the access?}\n  Shape -->|one word flag or counter| Atom[Atomic]\n  Shape -->|read mostly, rare writes| Rw[RwLock]\n  Shape -->|short mixed mutation| Mtx[Mutex]\n  Mtx --> Wait{Must a thread wait for a change?}\n  Wait -->|yes| Cv[Mutex plus Condvar]\n  Wait -->|no| Done[Plain Mutex]`}
              caption="The decision order: rule out handoff first, then pick by access shape, and only add a condvar when a thread genuinely needs to wait on a predicate."
            />
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Decide whether the state is actually shared or whether ownership transfer is the cleaner model.</li>
              <li>If the state is shared, decide whether it is write-heavy, read-mostly, or just one-word atomic state.</li>
              <li>If threads wait, name the predicate they wait on before choosing condvars, barriers, or channels.</li>
              <li>Only consider lock-free patterns after a simple design has been measured and found wanting.</li>
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

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">What changes by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Every reader brings a synchronization model from another language. Most of the friction in Rust comes not
            from the primitives, which look familiar, but from where Rust moves the safety boundary. The shift to
            internalize is the same in each case: things that were team discipline or runtime conveniences elsewhere
            become facts the compiler checks here.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
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
            <h4 className="font-semibold text-foreground mb-3">Mutex and RwLock</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The structural idea that distinguishes Rust here is that the lock <em>owns</em> the data. A
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">{"Mutex<T>"}</code>
              wraps the value of type <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">T</code>, and the
              only way to reach the value is to call <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">lock</code>,
              which hands back a guard. While you hold the guard you have exclusive access; when the guard is dropped, the
              lock is released. There is no path to the data that skips the lock, which is why a forgotten lock is not a
              category of bug that exists in safe Rust.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Look at the relationship below before the listings: the guard is a borrow with a lifetime, and releasing the
              lock is simply that borrow ending. The diagram shows the single path data takes through a mutex versus the
              two paths a read-write lock allows.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  M[Mutex of T] -->|lock returns guard| G[MutexGuard derefs to T]\n  G -->|guard dropped| M`}
              caption="A mutex offers a single exclusive path to the value. The guard's lifetime is the critical section; dropping it releases the lock."
            />
            <p className="text-sm text-muted-foreground leading-6">
              An RwLock splits that single path into two guard kinds:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  R[RwLock of T] -->|read: shared| RG[many read guards at once]\n  R -->|write: exclusive| WG[one write guard, blocks readers]`}
              caption="An RwLock offers many shared read guards or one exclusive write guard, so reads can overlap while a write still excludes everyone."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {lockCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <p className="mt-3 text-xs text-muted-foreground leading-5">
                    <strong className="text-foreground">Watch for:</strong> {card.watch}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A common misconception is worth correcting: an
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">RwLock</code>
                is not “a faster mutex.” It is a different fairness and contention trade. Multiple readers can hold the
                lock at once, but a writer must wait for all of them to leave and then excludes everyone, so under
                frequent writes or tiny read sections the bookkeeping can cost more than a plain mutex would. Reach for it
                only when you can show the workload is genuinely read-mostly.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Condvar</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              A condition variable solves a specific problem: a thread needs to wait until some shared state changes, and
              busy-spinning on the mutex would waste a core. The condvar lets the waiter atomically release the mutex and
              sleep, then re-acquire the mutex when it is woken. The crucial detail is that a wakeup is only a hint to
              re-check; it is not a promise that the predicate is now true, because of spurious wakeups and because
              another thread may have consumed the state first. That is why the wait always sits inside a
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">while</code>
              loop that tests the predicate.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {condvarPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The condvar is not the source of truth. The mutex-protected predicate is. The wait loop exists to keep that
                distinction explicit.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Atomics and memory ordering</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              An atomic operation is indivisible: no other thread can observe it half-done. That alone covers counters and
              flags. The harder concept is <em>memory ordering</em>, which controls whether the other writes a thread made
              before an atomic store become visible to a thread that observes that store. Modern CPUs and compilers
              reorder ordinary memory accesses freely, so without an ordering constraint a reader can see the flag flip to
              true while the data it was supposed to publish is still stale. The ordering you choose is a contract about
              that visibility, not about the atomic value itself.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {orderingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A practical rule is simple. If one atomic flag publishes other writes, the writer usually uses
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Release</code>
                on the flag store and the reader uses
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Acquire</code>
                on the flag load. If you cannot explain the publication story in one paragraph, a mutex or channel may be the
                better tool.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Barriers and channels</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {barrierChannelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Channels deserve to stay in this chapter because they are often the simplest synchronization primitive for a
                one-owner mutable subsystem. The standard library gives
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">mpsc::channel</code>
                and
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">sync_channel</code>
                as solid baselines, and the ecosystem offers richer channel semantics when the workload needs them.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Lock-free patterns</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {lockFreePatterns.map((pattern) => (
                <li key={pattern}>{pattern}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                In real systems, lock-free structures usually imply unsafe code somewhere in the implementation,
                plus a memory reclamation story. That is why “avoid all locks” is not a mature design principle by itself.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Deadlock prevention</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Almost every classic deadlock is a cycle: thread A holds lock 1 and wants lock 2 while thread B holds lock 2
              and wants lock 1, and neither will ever yield. The diagram contrasts that cycle with the fix, which is to
              impose one global order on locks so every thread always acquires them in the same sequence. With a total
              order there is no cycle to form. Most of deadlock prevention is this kind of design discipline rather than
              any special primitive.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  A[Thread A holds L1] -->|wants L2| B[Thread B holds L2]\n  B -->|wants L1| A`}
              caption="The deadlock: a wait cycle. A holds L1 and wants L2 while B holds L2 and wants L1, so neither can proceed."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The fix is a single global lock ordering that both threads obey:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  T1[Thread A: lock L1 then L2] --> Order[Global order: L1 before L2]\n  T2[Thread B: lock L1 then L2] --> Order`}
              caption="With one global order, every thread takes L1 before L2, so no cycle can form and the deadlock disappears."
            />
            <div className="grid gap-3 lg:grid-cols-2">
              {deadlockRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Choosing the right primitive</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {choiceRows.map((row) => (
                <div key={row.workload} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">{row.primitive}</div>
                  <div className="font-medium text-foreground mb-2">{row.workload}</div>
                  <p className="text-sm text-muted-foreground leading-6">{row.why}</p>
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
                The hardest synchronization bug is often not a missing lock. It is choosing shared mutable state when the
                workload really wanted one owner and message passing.
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
                <h4 className="font-semibold text-foreground">Example 1: Mutex plus Condvar for a tiny shared queue</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The condvar only wakes the worker. The queue state under the mutex remains the real predicate.
                </p>
              </div>
              {codes.synchronization_mutex_condvar_queue !== DEFAULT_CODES.synchronization_mutex_condvar_queue && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("synchronization_mutex_condvar_queue")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the worker holds the lock, then loops on{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">while jobs.is_empty() &amp;&amp; !closed</code>,
              calling <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">wait</code> inside the loop.
              Follow that loop in the diagram before reading the code.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Locked: lock the mutex\n  Locked --> CheckPredicate: jobs empty and not closed?\n  CheckPredicate --> Wait: yes\n  Wait --> CheckPredicate: woken, re-check\n  CheckPredicate --> Drain: no, job available\n  CheckPredicate --> Exit: no, closed and empty\n  Drain --> CheckPredicate: pop one, loop\n  Exit --> [*]: return processed count`}
              caption="The worker re-checks the mutex-protected predicate every wakeup. The condvar only says re-check now; the queue state is the source of truth."
            />
            <RustCodeEditor
              code={codes.synchronization_mutex_condvar_queue}
              onChange={(newCode) => updateCode("synchronization_mutex_condvar_queue", newCode)}
              onRun={() => runCode("synchronization_mutex_condvar_queue")}
              output={outputs.synchronization_mutex_condvar_queue ?? null}
              isRunning={isRunning === "synchronization_mutex_condvar_queue"}
              filename="mutex_condvar_batch_queue.rs"
              expectedOutput={"processed = 2\nremaining = 0"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.synchronization_mutex_condvar_queue}
              onRevert={() => resetCode("synchronization_mutex_condvar_queue")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Mutex</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The queue state has one synchronized owner at a time.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Condvar</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The worker sleeps until the predicate might have changed, then re-checks in a loop.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tradeoff</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This is correct shared-state synchronization, but a channel would be simpler if one thread should own the queue.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: RwLock plus Barrier for read-mostly configuration</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The write happens once before the phase boundary. Readers then observe the same snapshot together.
                </p>
              </div>
              {codes.synchronization_rwlock_barrier !== DEFAULT_CODES.synchronization_rwlock_barrier && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("synchronization_rwlock_barrier")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the write to the config happens before the main thread reaches{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">start.wait()</code>, so when the barrier
              releases all three threads, both readers see the same updated snapshot. The timeline below shows that gate.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant M as Main thread\n  participant R1 as Reader 1\n  participant R2 as Reader 2\n  participant B as Barrier (3)\n  R1->>B: wait()\n  R2->>B: wait()\n  M->>M: write lock, set version=2, mode=burst\n  M->>B: wait() (third arrival)\n  B-->>R1: release all\n  B-->>R2: release all\n  R1->>R1: read lock, see version 2\n  R2->>R2: read lock, see version 2`}
              caption="The write completes before the main thread reaches the barrier, so once all three threads arrive and the barrier releases, both readers see version 2 regardless of the order they arrived in. The barrier releasing is the phase gate that makes the write visible to both readers."
            />
            <RustCodeEditor
              code={codes.synchronization_rwlock_barrier}
              onChange={(newCode) => updateCode("synchronization_rwlock_barrier", newCode)}
              onRun={() => runCode("synchronization_rwlock_barrier")}
              output={outputs.synchronization_rwlock_barrier ?? null}
              isRunning={isRunning === "synchronization_rwlock_barrier"}
              filename="rwlock_barrier_startup.rs"
              expectedOutput={"reader version sum = 4\nmode = burst"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.synchronization_rwlock_barrier}
              onRevert={() => resetCode("synchronization_rwlock_barrier")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">RwLock</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The configuration is shared and read-mostly, so parallel reads make sense.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Barrier</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The barrier is a phase gate, not a data container.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Watch for</div>
                <p className="text-xs text-muted-foreground leading-5">
                  If writes become common, this design should be re-measured against a simpler mutex or one-owner model.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 3: Atomic publication with Acquire and Release</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The data word stays relaxed. The publication flag carries the ordering relationship.
                </p>
              </div>
              {codes.synchronization_atomics_ordering !== DEFAULT_CODES.synchronization_atomics_ordering && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("synchronization_atomics_ordering")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the value is stored with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Relaxed</code>,
              but the flag is stored with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Release</code>
              and loaded with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Acquire</code>. That one
              pairing is the synchronization edge. Trace it in the diagram first.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Writer\n    W1[store value = 42, Relaxed] --> W2[store ready = true, Release]\n  end\n  subgraph Reader\n    R1[load ready, Acquire] -->|false, spin| R1\n    R1 -->|true| R2[load value, Relaxed]\n  end\n  W2 -.happens-before.-> R1\n  W1 -.now visible.-> R2`}
              caption="The Release store paired with the Acquire load forms a happens-before edge. Crossing it makes the earlier Relaxed write to value visible, so the reader is guaranteed to see 42."
            />
            <RustCodeEditor
              code={codes.synchronization_atomics_ordering}
              onChange={(newCode) => updateCode("synchronization_atomics_ordering", newCode)}
              onRun={() => runCode("synchronization_atomics_ordering")}
              output={outputs.synchronization_atomics_ordering ?? null}
              isRunning={isRunning === "synchronization_atomics_ordering"}
              filename="atomics_acquire_release_publish.rs"
              expectedOutput={"ready = true\nvalue = 42"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.synchronization_atomics_ordering}
              onRevert={() => resetCode("synchronization_atomics_ordering")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Atomic flag</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The flag is the synchronization edge. The reader only trusts the payload after the Acquire load succeeds.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Ordering</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Release on the writer and Acquire on the reader express the visibility contract directly.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Limit</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This pattern is for small publication state, not for a whole shared object graph.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch23_synchronization_primitives/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to replace a mutex with an
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">RwLock</code>
            where it fits, reason about Acquire and Release ordering in a toy publication example, and repair a deadlock-prone
            lock design before it becomes a production incident.
          </p>
          <Button onClick={() => setCurrentPage(49)} className="gap-2">
            Open Chapter 23 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Choose a synchronization primitive from the ownership and state model, not from fashion.</li>
            <li>
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Mutex</code>,
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">RwLock</code>,
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Condvar</code>,
              atomics, barriers, and channels each answer a different concurrency question.
            </li>
            <li>Acquire and Release are about visibility between threads, not about preserving source-code order by wishful thinking.</li>
            <li>Deadlock prevention is mostly design discipline: lock ordering, short critical sections, and avoiding nested shared-state ownership where channels would be clearer.</li>
            <li>Lock-free structures are specialist tools. Measure before you replace a simple lock, and prefer proven implementations when the complexity is justified.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

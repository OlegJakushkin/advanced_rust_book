"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  Boxes,
  Cpu,
  Gauge,
  Layers,
  Workflow,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const whyReadCards = [
  {
    title: "Spawn threads without surrendering safety",
    body: "Move owned work across thread boundaries and let the type system reject data races at compile time. Send and Sync stop being trivia and become the contract that tells you what is allowed to cross a boundary.",
  },
  {
    title: "Choose the right sharing primitive on purpose",
    body: "Mutex, RwLock, atomics, and channels each answer a different question about who may read, who may write, and how contention is paid for. You learn to pick one deliberately instead of reaching for Arc<Mutex<T>> by reflex.",
  },
  {
    title: "Read async Rust as a state machine, not magic",
    body: "Futures, polling, and pinning stop being mysterious once you see that async fn compiles into a state machine an executor drives. That model is what makes cancellation, backpressure, and lifetime errors interpretable.",
  },
  {
    title: "Run real workloads on Tokio and Rayon",
    body: "Tasks, the multi-threaded runtime, structured concurrency, and data-parallel iterators become tools you reach for by name, with a clear sense of when an async task fits and when a CPU-bound parallel loop fits better.",
  },
  {
    title: "Drive the operating system directly",
    body: "Buffered IO, zero-copy paths, file and socket handling, and the systems patterns underneath every runtime give you the low-level fluency that separates writing Rust from writing a systems language.",
  },
]

const chapters = [
  {
    number: "22",
    title: "Multithreading in Rust",
    id: "ch22-multithreading-in-rust",
    blurb:
      "Spawning threads, moving owned work across boundaries, and letting Send and Sync turn data-race prevention into a compile-time contract.",
  },
  {
    number: "23",
    title: "Synchronization Primitives",
    id: "ch23-synchronization-primitives",
    blurb:
      "Mutex, RwLock, atomics, and channels compared by the question each one actually answers about shared reads, exclusive writes, and contention cost.",
  },
  {
    number: "24",
    title: "Coroutines, Futures, and Async Rust",
    id: "ch24-coroutines-futures-and-async-rust",
    blurb:
      "How async fn compiles into a polled state machine, why pinning exists, and what Future really means once you stop treating it as magic.",
  },
  {
    number: "25",
    title: "Tokio",
    id: "ch25-tokio",
    blurb:
      "The runtime that drives those futures: tasks, the multi-threaded scheduler, structured concurrency, and the async IO building blocks underneath real services.",
  },
  {
    number: "26",
    title: "Task Libraries and Parallel Execution",
    id: "ch26-task-libraries-and-parallel-execution",
    blurb:
      "Choosing between async tasks and data-parallel work: bounded queues, worker budgets, and Rayon-style parallel iterators for CPU-bound loops.",
  },
  {
    number: "27",
    title: "IO Tricks and Systems Programming Patterns",
    id: "ch27-io-tricks-and-systems-programming-patterns",
    blurb:
      "Buffered and zero-copy IO, file and socket handling, and the low-level operating-system patterns that sit beneath every runtime you just learned.",
  },
]

const flavorSnippet = `// Same ownership rules, now across a thread and a task.
let handle = std::thread::spawn(move || heavy_cpu_work(owned_input));
let cpu_result = handle.join().expect("worker panicked");

// On Tokio, concurrency is structured and awaited, not fire-and-forget.
let (a, b) = tokio::join!(fetch_user(id), fetch_orders(id));
let merged = combine(a?, b?);`

export function PagePart4ConcurrencyAsyncSystemsIo() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("part-4-concurrency-async-systems-io")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Layers className="h-4 w-4" />
          Part IV
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Threads, synchronization, futures, Tokio, and low-level IO: the work that makes Rust a systems language,
          not just a safe one.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground leading-6">
            The earlier parts of this book taught you the contract: ownership decides who is responsible for a value,
            borrowing decides who may touch it, and traits describe behavior without a runtime. This part is where that
            contract earns its keep. The moment work crosses a thread, a task, or a socket, the questions you have been
            answering at the call site become the questions that decide whether a service stays correct under load.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            For a senior engineer arriving from C++, C#, Go, or Python, the value here is not a new concurrency vocabulary.
            You already know about threads, locks, channels, and event loops. The shift is that Rust moves the guarantees
            you used to enforce by convention into the type system. A data race is a compile error, not a flaky test. A
            shared mutable value has to declare how it is shared. An async function is an ordinary state machine you can
            reason about, not a framework you have to trust.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            That is what makes Rust a systems language rather than only a safe one. By the end of Part IV you can spawn
            threads, choose synchronization primitives deliberately, read async code as the machinery it actually is, run
            real workloads on Tokio and Rayon, and reach down to buffered and zero-copy IO when the operating system is
            the thing you need to talk to.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Why read this part</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {whyReadCards.map((card) => (
              <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                <div className="font-medium text-foreground mb-2">{card.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">The big idea, in one picture</h3>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The arc of this part runs from the lowest concurrency primitive to the highest abstraction and back down to
              the operating system. Each layer is built from the one before it: synchronization makes threads usable,
              futures describe suspendable work, Tokio drives those futures, task libraries pick the right execution
              shape, and systems IO is the ground every layer eventually stands on.
            </p>
            <MermaidDiagram
              chart={`flowchart LR\n  T[Threads] --> S[Synchronization]\n  S --> F[Futures and async]\n  F --> R[Tokio runtime]\n  R --> P[Task libraries and parallelism]\n  P --> IO[Systems IO]\n  IO -.-> T`}
              caption="Part IV climbs from raw threads up to runtimes and parallel task libraries, then grounds the whole stack in low-level systems IO."
            />
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{flavorSnippet}</code>
            </pre>
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              The same ownership story you already know, now carried across a thread boundary and an async join. Nothing
              here is a new safety model; it is the existing one applied where concurrency lives.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Chapters in this part</h3>
          </div>
          <div className="space-y-3">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setCurrentPage(getPageIndexById(chapter.id))}
                className="w-full text-left rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-sm font-semibold">
                    {chapter.number}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-foreground">{chapter.title}</div>
                    <p className="text-sm text-muted-foreground leading-6 mt-1">{chapter.blurb}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 ml-auto" />
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Cpu className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Start with threads</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 22 begins at the foundation: how ownership crosses a thread boundary and why Send and Sync are
                the contract everything else in this part builds on. The rest of Part IV follows from there.
              </p>
            </div>
            <Button
              onClick={() => setCurrentPage(getPageIndexById("ch22-multithreading-in-rust"))}
              className="gap-2 shrink-0"
            >
              Begin Part IV
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

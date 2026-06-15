"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Languages, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { DEFAULT_CODES, PAGES } from "../types"
import { getPageIndexById } from "../page-index"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A future is a value that describes work",
    body: "Calling an `async fn` does not start work immediately. It builds a future. Progress happens only when an executor polls that future.",
  },
  {
    title: "`.await` is a suspension point inside one state machine",
    body: "An async function is compiled into a state machine. Every `.await` marks a place where the function may yield `Poll::Pending` and resume later.",
  },
  {
    title: "Ownership rules still apply across suspension",
    body: "Async Rust is still Rust. Borrowing across `.await`, spawning with non-`Send` data, or holding a lock guard too long are still ownership and lifetime design problems.",
  },
]

const coroutineVsFutureCards = [
  {
    title: "Coroutines are a useful comparison, but futures are the operational model",
    body: "If you come from C++ coroutines or generator-like systems, the intuition is helpful: async code can suspend and resume. Rust's surface still centers on futures implementing `Future::poll`, not on an ambient coroutine runtime.",
  },
  {
    title: "Rust futures are lazy",
    body: "A C# `Task` typically starts once created by an async method. A Rust future is inert until something polls it. That laziness is one reason executors matter so much.",
  },
  {
    title: "Go goroutines are scheduled execution units, not futures",
    body: "A goroutine starts running once launched. A Rust future is only a description of work until an executor drives it. Treating futures like goroutines leads to confused designs quickly.",
  },
]

const asyncModelCards = [
  {
    title: "`async fn` returns an opaque future",
    body: "The return type is some compiler-generated future that captures the function's state. The caller sees a future value, not a started thread or a hidden runtime task.",
  },
  {
    title: "`Future::poll` is the core protocol",
    body: "A polled future either produces `Poll::Ready(output)` or says `Poll::Pending` and arranges to be polled again after a wakeup.",
  },
  {
    title: "Wakers connect waiting to resumption",
    body: "When a future cannot make progress yet, it stores or uses the provided waker. Later, some readiness event wakes the task so the executor polls it again.",
  },
]

const compilerStatePoints = [
  "Each local that must survive across `.await` becomes part of the future's stored state.",
  "Each `.await` introduces another state transition in the generated future.",
  "Borrowing across `.await` extends the borrow until the future reaches the next state, which is why some small synchronous borrows suddenly become wider than expected.",
  "Manual `Future` implementations are useful mostly for low-level adapters and for understanding what the compiler is hiding for you.",
]

const pinCards = [
  {
    title: "Why `poll` takes `Pin<&mut Self>`",
    body: "Once a future has been polled, its internal state may become address-sensitive. `Pin` prevents moving that future through the pinned handle while the poll protocol is in play.",
  },
  {
    title: "Most application code touches `Pin` at the boundary",
    body: "Business logic usually uses `async fn` and `.await`. Executors, low-level future combinators, and manual `Future` implementations are the places where `Pin` becomes explicit.",
  },
]

const runtimeCards = [
  {
    title: "Executor",
    body: "The executor owns scheduled tasks and repeatedly polls ready futures. It is the component that turns lazy future values into actual progress.",
  },
  {
    title: "Reactor or IO driver",
    body: "The reactor waits for external readiness events such as socket readability or timer expiration and wakes the corresponding tasks. In many runtimes, executor and reactor are separate but coordinated pieces.",
  },
]

const cancellationCards = [
  {
    title: "Cancellation is usually drop-based",
    body: "If a future is dropped, it stops making progress. That is the default cancellation model in async Rust.",
  },
  {
    title: "Cleanup must be explicit",
    body: "If partial progress acquired permits, borrowed resources, or internal state that must be repaired, encode cleanup through narrow scopes, guard types, or explicit cancellation handling.",
  },
  {
    title: "Cancellation-safe code avoids half-finished shared state",
    body: "A future that mutates shared state before an await and relies on a later await to repair it is fragile. Keep each pre-await state transition consistent on its own.",
  },
]

const structuredConcurrencyCards = [
  {
    title: "The parent should own the child task lifetime",
    body: "Request-scoped fan-out usually wants a parent task that waits for all child tasks, observes failures, and cancels siblings when the whole operation no longer matters.",
  },
  {
    title: "Prefer joined task groups over fire-and-forget",
    body: "Detached tasks are easy to start and hard to operate. Joined task sets or scoped task groups keep lifecycle and failure handling visible.",
  },
  {
    title: "Cancellation should flow with scope",
    body: "If the client disconnects or a timeout fires, child work should usually stop too. Structured concurrency turns that into a design default instead of an afterthought.",
  },
  {
    title: "Own data before spawning",
    body: "Spawn boundaries often want `Send + 'static` futures. Convert borrowed request-local views into owned values before they cross that boundary.",
  },
]

const asyncTraitCards = [
  {
    title: "`async fn` in traits helps for static dispatch",
    body: "Stable Rust supports many trait-based async method shapes for static dispatch use cases. That is often enough for repositories, adapters, and service seams used generically.",
  },
  {
    title: "Trait objects remain the sharp edge",
    body: "An async trait method still does not become a carefree `dyn Trait` API automatically. Object safety, erased future types, and explicit boxing patterns still matter for runtime trait objects.",
  },
  {
    title: "Returned future bounds are still part of the design",
    body: "If a runtime boundary needs `Send`, the returned future must be `Send`. If the future borrows from `self`, that lifetime becomes part of the call contract too.",
  },
]

const lifetimeIssueCards = [
  {
    title: "Borrowing across `.await` makes the borrow wider",
    body: "A temporary borrow before `.await` may live until the future resumes. The fix is often to shorten the borrow or move needed data into an owned value first.",
  },
  {
    title: "Spawned tasks often require `Send + 'static`",
    body: "Capturing `Rc<T>`, borrowed stack data, or non-thread-safe guards in a spawned future often fails because the runtime may move that future between threads or keep it alive longer than the current frame.",
  },
  {
    title: "Do not hold blocking lock guards across `.await`",
    body: "A `std::sync::MutexGuard` held across `.await` is usually a bug magnet. Even async-aware locks should be scoped narrowly so suspension does not drag the critical section outward accidentally.",
  },
  {
    title: "Async repository and service boundaries usually want owned outputs",
    body: "Returning borrowed data from an async IO boundary is often the wrong ownership model. Own the data once it crosses storage, task, queue, or retry boundaries.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "C++20 coroutines give you the right starting intuition: a function that can suspend and resume. The shift is that Rust has no ambient coroutine machinery and no caller-provided promise type. The unit of work is a value implementing one trait, Future, and nothing runs until an executor calls poll on it.",
  },
  {
    title: "C# background",
    body: "The sharpest correction is laziness. A C# async method usually begins executing the moment you call it, and the Task is already in flight. In Rust, calling an async fn only constructs a future; if you never await or spawn it, it is dead code that does nothing.",
  },
  {
    title: "Go background",
    body: "Rust async is not goroutines with stricter syntax. A goroutine is a scheduled unit of execution that runs the instant you launch it; a future is an inert description of work. There is also no hidden runtime: you choose and start an executor explicitly, and Send bounds at spawn boundaries are visible in the type, not assumed.",
  },
  {
    title: "Python background",
    body: "Python coroutines are also lazy until awaited, so the laziness feels familiar. The shift is that Rust has no single implicit event loop and no GIL: a future may be polled on any worker thread, so anything you hold across .await must satisfy ownership and Send rules the interpreter never forced on you.",
  },
]

const productionPatterns = [
  "Keep parsing, validation, and domain decisions synchronous until real IO or scheduling forces an async boundary.",
  "Convert borrowed request data into owned task inputs before spawn or retry boundaries.",
  "Use structured task groups or joined task sets from your runtime ecosystem instead of request-scoped fire-and-forget tasks.",
  "Model cancellation as a first-class behavior: timeouts, client disconnects, and parent failure should have an explicit cleanup story.",
  "Keep lock scope narrow around `.await` and prefer ownership transfer or immutable sharing over broad shared mutation in async flows.",
  "Measure the async boundary itself: queue depth, wakeup rate, cancellation count, timeout count, and task latency are often more informative than raw poll folklore.",
]

const pitfalls = [
  "Treating async as a faster version of threads. Async is mostly about waiting efficiently, not about making CPU-bound work magically faster.",
  "Assuming an async function starts running when called. In Rust, it only returns a future.",
  "Capturing borrowed request data or `Rc<T>` into spawned futures that need `Send + 'static`.",
  "Holding a lock guard, borrow, or mutable reference across `.await` longer than the design can really justify.",
  "Ignoring cancellation and assuming dropped work leaves no state behind.",
  "Designing an async trait and then discovering too late that the runtime boundary actually needed a `dyn Trait` object-safe API.",
]

const summaryPoints = [
  "Rust async is future-driven and lazy: `async fn` returns a future, and executors make progress by polling it.",
  "`.await` introduces suspension points inside a compiler-generated state machine.",
  "Pin matters because polled futures may become address-sensitive, which is why `Future::poll` uses `Pin<&mut Self>`.",
  "Cancellation usually happens by dropping a future, so cleanup and cancellation safety must be designed explicitly.",
  "Structured concurrency keeps child task lifetime, failure, and cancellation tied to a parent scope.",
  "Async lifetime trouble is usually ownership trouble: own data before spawn and before wide async boundaries.",
]

export function PageCh24CoroutinesFuturesAndAsyncRust() {
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
  const pageIndex = getPageIndexById("ch24-coroutines-futures-and-async-rust")
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
          Chapter 24 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Async Rust services depend on futures, executors, cancellation, and ownership across await points. This chapter
          defines the runtime contract behind coroutines and asynchronous state machines.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 09, 14, 22, and 23</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 09 introduced pinning. Chapter 14 covered traits and object safety. Chapter 22 separated OS threads
                from other execution models. Chapter 23 covered synchronization primitives that still matter in async flows.
                This chapter puts those pieces together into Rust&apos;s async model.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch09-smart-pointers-and-pinning"))}>
                Chapter 09
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch14-interfaces-in-rust-traits"))}>
                Chapter 14
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch22-multithreading-in-rust"))}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch23-synchronization-primitives"))}>
                Chapter 23
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">The problem async is solving</h3>
          <p className="text-sm text-muted-foreground leading-6">
            You are refactoring a service that performs request parsing, several outbound RPCs, cache lookups, and a final
            database write. Most of that wall-clock time is spent waiting on sockets, not burning CPU. The threads chapter
            already taught you not to dedicate one OS thread to every waiting connection: threads have stack and scheduler
            cost, and ten thousand mostly-idle threads is a poor use of the machine. Async is the alternative. It lets a
            single thread hold thousands of in-flight operations and only do work for the ones that are actually ready to
            make progress.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-6">
            That efficiency is not free, and the price is paid in questions the runtime makes you answer explicitly. Which
            values stay borrowed only locally, and which must become owned before a task is spawned? What happens to the
            other outbound requests if one of them times out and the fan-out should stop? Who is responsible for cleanup
            when work is cancelled halfway through? In a thread-per-request model many of these answers are implicit in the
            stack; in async they become part of your types. Rust&apos;s async story holds up in production precisely because
            it refuses to hide them.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Decide which boundaries are truly IO-bound and therefore worth making async.</li>
              <li>Decide which data must become owned before a spawned or retried future can outlive the current scope.</li>
              <li>Decide how cancellation propagates when the parent request no longer cares.</li>
              <li>Only then choose runtime-specific spawn, join, timeout, or task-group APIs.</li>
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Three core ideas</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            If you keep only three things in mind, keep these. Everything later in the chapter follows from them.
          </p>
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
            <Languages className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Coming from another language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Async exists in C++, C#, Go, and Python too, so you already have an instinct for it. Each of those instincts is
            right about something and wrong about something else when applied to Rust. The corrections below are the
            mental-model shifts that matter most before you write any code.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The thread that runs through all four: in Rust, calling an async function produces a value and starts nothing.
              Execution, thread placement, and cancellation are decisions made by the executor and visible in your types,
              not conveniences supplied by an ambient runtime.
            </p>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Coroutines are the intuition, futures are the mechanism</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              &ldquo;Coroutine&rdquo; is a fine word for the shape of the code: a function that can pause in the middle and
              pick up later. But coroutine is not what Rust actually exposes. What you get is a plain value that implements
              the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Future</code> trait, and the only way
              it ever runs is for an executor to call <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">poll</code>{" "}
              on it. Keeping that distinction sharp explains almost every surprise newcomers hit.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {coroutineVsFutureCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Rust&apos;s async model</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {asyncModelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h5 className="font-medium text-foreground mb-2">How <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">async fn</code> and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code> fit together</h5>
              <p className="text-sm text-muted-foreground leading-6 mb-3">
                An <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">async fn</code> is sugar for a
                function that returns an opaque future. Inside that future, each <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code>{" "}
                is a place where the current future may hand control back to the executor instead of blocking the thread.
                Read the listing below as three phases: the call builds a future, the executor drives it, and the first{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code> is the seam where waiting
                turns into a return of <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pending</code>{" "}
                rather than a blocked thread.
              </p>
              <MermaidDiagram
                chart={`flowchart TD\n  Call["load_user(id)"] -->|builds, runs nothing| Fut[Future value]\n  Fut -->|executor polls| Body[Run until first .await]\n  Body -->|fetch_row not ready| Pending[Return Pending]\n  Pending -->|IO ready, waker fires| Resume[Resume after .await]\n  Resume --> Done[Return Ready User]`}
                caption="Calling the async fn only builds the future. The executor polls it, the body runs up to fetch_row().await, yields Pending, and resumes from there once the row is ready."
              />
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`async fn load_user(id: UserId) -> Result<User, LoadError> {
    let row = fetch_row(id).await?;
    parse_user(row)
}`}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground leading-6">
                The operational point is simple: no thread is blocked by the syntax itself. At{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code> the current future yields{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pending</code>, the executor is free to
                run other tasks, and it polls this one again only after a waker signals that{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">fetch_row</code> can make progress.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">What the compiler builds from your async function</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The single most useful model of async Rust is this: the compiler rewrites your function into one enum-shaped
              state machine. Each <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code> becomes a
              variant, the variant holds exactly the locals that must survive that suspension, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">poll</code> is a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">match</code>{" "}
              that advances from one variant to the next. The diagram shows the shape for{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">load_user</code> above.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Start\n  Start --> AwaitingRow: poll, begin fetch_row\n  AwaitingRow --> AwaitingRow: poll returns Pending\n  AwaitingRow --> Done: row ready, parse_user\n  Done --> [*]: return Ready\n  note right of AwaitingRow: stores id and the fetch_row future`}
              caption="Each .await is a state. The AwaitingRow variant carries the locals that must outlive suspension, and poll moves Start to AwaitingRow to Done."
            />
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {compilerStatePoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                In plain terms: an async function is ordinary Rust control flow lowered into one
                enum-like state machine plus the locals it must keep alive between polls. Once you see it that way, the
                lifetime and Send rules later in this chapter stop being surprises and start being consequences.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Why poll takes a pinned reference</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Here is the one subtle part. The state machine the compiler generates can hold a reference into itself, for
              example a borrow of one local that lives across an <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code>.
              Such a self-referential value would be corrupted if it were moved in memory, because the internal pointer
              would still point at the old address. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pin</code>{" "}
              is the type-system promise that, once polling has begun, the future will not move. That is why{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">poll</code> takes{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pin&lt;&amp;mut Self&gt;</code> and not a
              plain mutable reference.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {pinCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">
                {`trait Future {
    type Output;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}`}
              </code>
            </pre>
            <p className="mt-3 text-sm text-muted-foreground leading-6">
              Many everyday futures are effectively movable and implement
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Unpin</code>.
              The runtime boundary still has to respect the general pinned case, which is why the poll signature stays as
              strong as it does.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Who actually runs the future: executors and reactors</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A future is inert, so something has to drive it. In production that something is a runtime, and a runtime is
              really two cooperating parts. The executor is the scheduler that decides which ready task to poll next; the
              reactor (or IO driver) is the part that watches the operating system for readiness and fires the waker that
              makes a sleeping task ready again. The two cards name the pieces; the sequence below shows how one waiting
              operation travels between them.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {runtimeCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant App as Your code\n  participant Ex as Executor\n  participant Fut as Future\n  participant Re as Reactor / OS\n  App->>Ex: spawn(future)\n  Ex->>Fut: poll(cx)\n  Fut->>Re: register interest, store waker\n  Fut-->>Ex: Poll::Pending\n  Note over Ex: run other tasks meanwhile\n  Re-->>Ex: IO ready, call waker\n  Ex->>Fut: poll(cx) again\n  Fut-->>Ex: Poll::Ready(value)`}
              caption="The executor polls, the future parks itself with the reactor and returns Pending, and a readiness event wakes the task so the executor polls it to completion."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Cancellation means dropping the future</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              In a thread, cancellation is awkward because you cannot safely stop a thread at an arbitrary instruction. In
              async Rust it is the opposite: a future only advances when polled, so to cancel it you simply stop polling it
              and drop it. A timeout, a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">select!</code>{" "}
              that picks the other branch, or a parent task that finishes will all drop the loser. The catch is that the
              future stops at whatever <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code> it
              was parked on, and only its destructors run. Anything that needed a second{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code> to finish is left undone.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Running\n  Running --> Suspended: hits .await, Pending\n  Suspended --> Running: polled again\n  Running --> Completed: returns Ready\n  Suspended --> Dropped: timeout or select, no more polls\n  Dropped --> [*]: only Drop impls run\n  Completed --> [*]`}
              caption="A suspended future is cancelled by being dropped instead of polled again. Cleanup is whatever runs in Drop; logic past the await point never executes."
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {cancellationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The important correction is this: “cancel” usually means “drop the future.” If the future must clean up
                partially acquired state, that cleanup must be explicit in the future&apos;s own design.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Keeping child tasks tied to a parent scope</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Back to the opening service: one request fans out to several outbound calls and then joins their results.
              Structured concurrency is the discipline of making the parent own that whole fan-out, so that the children
              cannot outlive it. The parent waits for all of them, surfaces the first failure, and drops the rest, which (as
              the cancellation section just showed) is how you cancel them. The alternative, detaching tasks and forgetting
              them, is easy to type and hard to operate.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  P[Parent request task] --> A[child: pricing RPC]\n  P --> B[child: inventory RPC]\n  P --> C[child: cache lookup]\n  A --> J{Join all}\n  B --> J\n  C --> J\n  J -->|all ok| R[Combine results]\n  J -->|one fails| X[Drop siblings, propagate error]`}
              caption="The parent owns every child. Join collects all results, or the first failure drops the remaining siblings and the error flows back up one scope."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {structuredConcurrencyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                In runtime-specific code, this often translates to join-set style task groups, request-scoped task scopes,
                or parent-owned cancellation tokens. The runtime API may differ. The ownership rule should not.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Async methods in traits, and where they get sharp</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              You will want async methods on traits the moment you have a repository or service seam with more than one
              implementation. Recent stable Rust supports <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">async fn</code>{" "}
              in traits directly, which covers most generic, statically dispatched code. The edge appears at runtime
              polymorphism: a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">{"dyn Trait"}</code> with an
              async method has to erase the returned future type, which is where boxing, object safety, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Send</code> bounds come back into the
              design.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {asyncTraitCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Where lifetimes bite in async code</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Almost every async error message that mentions lifetimes or <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Send</code>{" "}
              is the state-machine model from earlier coming back to collect. A borrow held across an{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code> becomes a field of the future
              and therefore lives as long as the future does; a future handed to{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">spawn</code> may be moved across threads and
              must be <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Send + &apos;static</code>. The
              recurring fix is the same one from Chapter 4: own the data before it crosses the boundary.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {lifetimeIssueCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
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
                Async Rust is not hard because the syntax is exotic. It is hard because suspension makes ownership, task
                lifetime, and cancellation more visible. That is exactly why it holds up well in production.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="font-semibold text-foreground mb-2">Repository note</h4>
            <p className="text-sm text-muted-foreground leading-6">
              The in-browser editor uses tiny std-only examples so the poll model stays visible without pulling in a full
              runtime. In production, you will usually pair these ideas with an ecosystem executor and reactor such as Tokio
              or another async runtime.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: `async fn`, `.await`, and a tiny `block_on`</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The future is lazy. The tiny executor polls it. Each awaited subfuture yields once before becoming ready.
                </p>
              </div>
              {codes.async_rust_async_fn_await_block_on !== DEFAULT_CODES.async_rust_async_fn_await_block_on && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("async_rust_async_fn_await_block_on")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              Watch the loop, not the syntax: each printed{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">poll = pending</code> is one trip around{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">block_on</code>, and the future only
              returns its label after it has been polled enough times to advance through its states.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Build["build_label()"] -->|lazy future| Loop[block_on loop]\n  Loop -->|poll| Pend1[Pending: print pending]\n  Pend1 -->|poll| Pend2[Pending: print pending]\n  Pend2 -->|poll| Ready["Ready: label = billing:/ready"]`}
              caption="build_label returns a lazy future; the block_on loop polls it repeatedly, printing pending until the state machine reaches Ready."
            />
            <RustCodeEditor
              code={codes.async_rust_async_fn_await_block_on}
              onChange={(newCode) => updateCode("async_rust_async_fn_await_block_on", newCode)}
              onRun={() => runCode("async_rust_async_fn_await_block_on")}
              output={outputs.async_rust_async_fn_await_block_on ?? null}
              isRunning={isRunning === "async_rust_async_fn_await_block_on"}
              filename="async_fn_and_manual_block_on.rs"
              expectedOutput={"poll = pending\npoll = pending\nlabel = billing:/ready"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.async_rust_async_fn_await_block_on}
              onRevert={() => resetCode("async_rust_async_fn_await_block_on")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Lazy future</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Calling <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">build_label</code> only
                  constructs a future value.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Suspension</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Each awaited subfuture yields one <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pending</code>{" "}
                  before the state machine advances.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Executor role</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The tiny <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">block_on</code> loop is
                  the component turning description into progress.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: a manual `Future` that looks like a state machine</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This is the low-level shape the compiler normally generates for you: explicit states, explicit pending,
                  explicit ready.
                </p>
              </div>
              {codes.async_rust_manual_future_state_machine !== DEFAULT_CODES.async_rust_manual_future_state_machine && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("async_rust_manual_future_state_machine")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              Follow the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Stage</code> field and the
              retry counter: the future stays in <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Waiting</code>{" "}
              and returns <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pending</code> while retries
              remain, then transitions to <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Ready</code>.
              This is exactly the machine the compiler wrote for you in Example 1, only spelled out by hand.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Waiting\n  Waiting --> Waiting: poll, retries left, return Pending\n  Waiting --> Ready: retries exhausted\n  Ready --> [*]: return Ready connected`}
              caption="The hand-written poll matches on Stage. Waiting decrements retries and returns Pending; once they hit zero it moves to Ready and returns the value."
            />
            <RustCodeEditor
              code={codes.async_rust_manual_future_state_machine}
              onChange={(newCode) => updateCode("async_rust_manual_future_state_machine", newCode)}
              onRun={() => runCode("async_rust_manual_future_state_machine")}
              output={outputs.async_rust_manual_future_state_machine ?? null}
              isRunning={isRunning === "async_rust_manual_future_state_machine"}
              filename="manual_future_state_machine.rs"
              expectedOutput={
                "pending stage = Waiting\npending retries = 1\npending stage = Waiting\npending retries = 0\nready = connected"
              }
              showResultComparison={true}
              originalCode={DEFAULT_CODES.async_rust_manual_future_state_machine}
              onRevert={() => resetCode("async_rust_manual_future_state_machine")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Explicit states</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The enum-like <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Stage</code> values
                  are the shape the compiler usually hides.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Pin boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Even a tiny manual future must accept
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Pin&lt;&mut Self&gt;</code>
                  in its poll method.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Operational translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Compiler-generated async futures are easier to write, but they obey the same poll protocol.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust files under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch24_coroutines_futures_and_async_rust/
              </code>{" "}
              including extra files for a Send-safe spawn boundary and drop-based cancellation cleanup beyond the in-browser
              editors.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to trace an async function as a state machine, repair a Send-bound spawn
            problem, model cancellation cleanup explicitly, and choose structured concurrency patterns from workload shape.
          </p>
          <Button onClick={() => setCurrentPage(47)} className="gap-2">
            Open Chapter 24 Exercises
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

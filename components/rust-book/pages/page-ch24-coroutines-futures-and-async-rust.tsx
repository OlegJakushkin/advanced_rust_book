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
    body: "Think of Rust async as futures and poll-driven state machines rather than as a direct translation of coroutine handles. The comparison teaches suspension, but the Rust surface is much more explicit about ownership and executor boundaries.",
  },
  {
    title: "C# background",
    body: "The sharpest correction is laziness. In C#, the async method usually starts work immediately. In Rust, calling the async function returns a future value that will do nothing until polled.",
  },
  {
    title: "Go background",
    body: "Rust async is not goroutines with harder syntax. Goroutines are scheduled units of execution. Futures are lazy descriptions of work. Use OS threads or later async runtimes when the execution model truly calls for them.",
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
  const pageIndex = 46
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
              <Button variant="outline" onClick={() => setCurrentPage(16)}>
                Chapter 09
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(26)}>
                Chapter 14
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(42)}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(44)}>
                Chapter 23
              </Button>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h4 className="font-semibold text-foreground mb-2">Repository note</h4>
            <p className="text-sm text-muted-foreground leading-6">
              The in-browser editor uses tiny std-only examples so the poll model stays visible without pulling in a full
              runtime. In production, you will usually pair these ideas with an ecosystem executor and reactor such as Tokio
              or another async runtime.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            You are refactoring a service that performs request parsing, several outbound RPCs, cache lookups, and a final
            database write. The threads chapter already taught you not to spray OS threads at every waiting socket. Async
            now looks attractive, but it also brings harder questions. Which values stay borrowed only locally? Which values
            must become owned before a task is spawned? What happens if one outbound request times out and the rest of the
            fan-out should stop? Rust&apos;s async story is strong precisely because it does not hide those questions.
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
            <h4 className="font-semibold text-foreground mb-3">Coroutines vs futures</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {coroutineVsFutureCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
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
              <h5 className="font-medium text-foreground mb-2">`async fn` and `.await`</h5>
              <p className="text-sm text-muted-foreground leading-6 mb-3">
                An <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">async fn</code> is sugar for a
                function that returns an opaque future. Inside that future, each <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.await</code>{" "}
                pauses the current future until the awaited future becomes ready.
              </p>
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{`async fn load_user(id: UserId) -> Result<User, LoadError> {
    let row = fetch_row(id).await?;
    parse_user(row)
}`}</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground leading-6">
                The operational point is simple: no thread is blocked by the syntax itself. The current future yields
                `Pending`, and some executor decides when to poll it again.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">State machines generated by the compiler</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {compilerStatePoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A useful senior-level translation is this: an async function is ordinary Rust control flow lowered into one
                enum-like state machine plus the locals it must keep alive between polls.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Why async Rust involves Pin</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Executors and reactors</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {runtimeCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`call async fn
  -> get Future
executor polls Future
  -> Future hits .await
  -> returns Pending
reactor notices IO readiness
  -> wakes task
executor polls again
  -> Future resumes from saved state`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Cancellation</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Structured concurrency patterns</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Async traits and their limitations</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Common async lifetime issues</h4>
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
````

### File: `components/rust-book/pages/page-ch24-coroutines-futures-and-async-rust-exercises.tsx`
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
    title: "Separate coroutines, futures, tasks, and threads",
    objective: "Practice naming the execution model correctly before you choose a runtime primitive.",
    starterPrompt:
      "Classify four concepts: a lazily created future returned by `async fn`, a runtime-owned scheduled task, an OS thread doing blocking work, and a Go-style goroutine comparison term.",
    prompts: [
      "Which one is only a description of work until polled?",
      "Which one is actually scheduled by an executor?",
      "Which one is scheduled by the operating system directly?",
      "Which comparison term is useful historically but not Rust's primary runtime abstraction?",
    ],
    acceptanceCriteria: [
      "You identify the future as lazy and poll-driven.",
      "You distinguish runtime tasks from OS threads clearly.",
      "You explain that coroutines are a comparison aid while futures are Rust's operational async model.",
    ],
    hints: [
      "Ask what starts immediately and what only becomes work once something polls it.",
      "Rust's async vocabulary is precise for a reason.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace an async function as a state machine",
    objective: "Practice narrating what the compiler-generated future must store and when it may return `Pending`.",
    starterPrompt:
      "Read an `async fn` that awaits two subfutures and then formats a result string. Explain the states you expect the compiler to generate.",
    prompts: [
      "Which locals must survive across the first `.await`?",
      "Which locals must survive across the second `.await`?",
      "At what points can the future legitimately return `Poll::Pending`?",
      "What does the final `Poll::Ready` contain?",
    ],
    acceptanceCriteria: [
      "You describe at least three stages: before first await, between awaits, and ready.",
      "You identify one local that must be stored across suspension.",
      "You explain `Pending` as a suspension protocol event, not as failure.",
    ],
    hints: [
      "Imagine the compiler lowering the function into an enum plus captured locals.",
      "The state machine only stores what must survive to the next poll.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Drive a tiny future intentionally",
    objective: "Implement or repair a small manual future or mini-executor so you can see the poll protocol directly.",
    starterPrompt:
      "Build a tiny future that yields `Pending` at least once, then becomes ready, and drive it with a small `block_on`-style loop or manual poll loop.",
    prompts: [
      "Keep the future state explicit.",
      "Use a no-op waker or another minimal wake path only for the local demo.",
      "Print enough information to make each state transition visible.",
    ],
    acceptanceCriteria: [
      "Your future implements `Future` plausibly.",
      "The polling loop distinguishes `Pending` and `Ready` explicitly.",
      "The output makes the state transition visible to the reader.",
    ],
    hints: [
      "This is not about building a production runtime.",
      "The goal is to make the protocol concrete enough to reason about later.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Fix a Send-bound problem in spawned async code",
    objective: "Repair a spawned future boundary that captures non-Send or non-'static state.",
    starterPrompt:
      "A task-spawning boundary requires `Future<Output = ()> + Send + 'static`, but the current future captures `Rc<String>` from a local scope.",
    prompts: [
      "Should the repair be an owned `String` clone, an `Arc<String>`, or a different redesign?",
      "Which part of the requirement comes from cross-thread movement and which part comes from lifetime?",
      "What boundary becomes clearer once the spawned task owns Send-safe data?",
    ],
    acceptanceCriteria: [
      "You remove the `Rc<T>` cross-thread capture problem.",
      "You explain the `Send` and `'static` requirement accurately.",
      "Your repair moves or shares data in a way another senior engineer could review quickly.",
    ],
    hints: [
      "The compiler is forcing you to choose an honest ownership boundary.",
      "The fix is not automatically `Arc`. It is whichever Send-safe owned boundary fits the design.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Model cancellation and cleanup explicitly",
    objective: "Repair a future so cancellation by drop still releases or records the state that matters.",
    starterPrompt:
      "A future acquires request-local cleanup state only after its first await, so dropping it early leaves no cleanup story at all.",
    prompts: [
      "Which cleanup object or state should exist before the first suspension point?",
      "Should the future rely on `Drop`, explicit cancellation tokens, or a narrower scope?",
      "What makes the pre-await state cancellation-safe?",
    ],
    acceptanceCriteria: [
      "You move or design cleanup so early cancellation still has a coherent story.",
      "You explain cancellation as drop-based by default.",
      "You identify one reason a half-mutated shared state before await is dangerous.",
    ],
    hints: [
      "If the future can be dropped while pending, ask what work already became the future's responsibility.",
      "A small guard object is often clearer than a late cleanup branch.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose structured concurrency for request fan-out",
    objective: "Design a request-scoped async boundary that owns child lifetime, cancellation, and result joining explicitly.",
    starterPrompt:
      "You are designing `parse -> call profile service -> call pricing service -> call inventory service -> merge -> persist`, with request cancellation and a deadline.",
    prompts: [
      "Which child work items should be joined as a group rather than detached?",
      "How should cancellation propagate when one child fails or the parent times out?",
      "Which data should become owned before the fan-out?",
      "What observability hooks would you add around timeouts, retries, and cancellations?",
    ],
    acceptanceCriteria: [
      "You keep child task lifetime owned by the parent request scope.",
      "You describe one explicit cancellation propagation rule.",
      "You choose owned data before the fan-out boundary where appropriate.",
      "You mention at least one production signal such as timeout count, cancellation count, or in-flight task count.",
    ],
    hints: [
      "Detached work is cheap to start and expensive to operate.",
      "The cleanest answer sounds like one parent scope controlling several owned child futures.",
    ],
  },
]

const reviewQuestions = [
  "Why does calling an `async fn` not start work immediately in Rust?",
  "What does `Pin<&mut Self>` on `Future::poll` tell you about the general future model?",
  "Why do spawned tasks often require `Send + 'static` futures?",
  "What is the default cancellation mechanism for a future in Rust?",
  "Why is structured concurrency usually calmer than request-scoped fire-and-forget tasks?",
  "What ownership mistake often hides behind async lifetime errors?",
]

const workingLoop = [
  "Ask what is only a future value and what is actually scheduled work.",
  "Before each `.await`, ask what state would be left behind if the future were dropped there.",
  "Before each spawn, ask which captured values must become owned and Send-safe.",
  "Keep the parent request or job scope responsible for joining child work unless detached lifetime is genuinely intended.",
]

export function PageCh24CoroutinesFuturesAndAsyncRustExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 47
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 24 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice async Rust as an ownership and scheduling discipline: trace state machines, repair Send-bound spawn
          failures, and make cancellation behavior explicit.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as an async boundary review. The strongest answer does not say only “make it async.” It
                says what is lazy, what gets scheduled, what may be dropped, what must be owned before spawn, and how
                cancellation leaves the system in a coherent state.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(46)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 24
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
                  Async drill
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
          title="Runnable lab · Fix a Send-bound spawn problem"
          description={
            <>
              Repair the starter so the spawned future captures a Send-safe owned boundary instead of
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">Rc&lt;String&gt;</code>.
              A common repair is
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">Arc&lt;String&gt;</code>,
              but another Send-safe owned boundary is also valid if the contract stays honest.
            </>
          }
          filename="send_bound_spawn_lab.rs"
          runKey="ch24_ex_send_bound_spawn"
          expectedOutput={"spawned = true\nshared = cfg-v1"}
          helperText={
            <>
              Tip: this page uses a tiny std-only <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">spawn_send</code>{" "}
              boundary so the Send rule stays visible without a full runtime dependency. The real lesson is the boundary,
              not the helper.
            </>
          }
          initialCode={`use std::future::Future;\nuse std::rc::Rc;\n\nfn spawn_send<F>(future: F)\nwhere\n    F: Future<Output = ()> + Send + 'static,\n{\n    drop(future);\n}\n\nfn main() {\n    let shared = Rc::new(String::from(\"cfg-v1\"));\n    let worker = Rc::clone(&shared);\n\n    spawn_send(async move {\n        let text = std::future::ready(worker.as_str()).await;\n        let _ = text.len();\n    });\n\n    println!(\"spawned = true\");\n    println!(\"shared = {}\", shared);\n}`}
        />

        <RustPracticeCard
          title="Runnable lab · Cancellation with explicit cleanup"
          description={
            <>
              Repair the starter so a future cancelled after its first poll still drops a cleanup guard with the request ID.
              The checker expects explicit cancellation by drop and explicit cleanup output.
            </>
          }
          filename="cancellation_cleanup_lab.rs"
          runKey="ch24_ex_cancellation_cleanup"
          expectedOutput={"cancelled = true\ncleanup = dropped request-7"}
          helperText={
            <>
              Tip: if the cleanup guard is created only after the first
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">.await</code>,
              early cancellation has nothing to drop. Move the responsibility earlier, then drop the pending future on
              purpose.
            </>
          }
          initialCode={`use std::future::Future;\nuse std::pin::Pin;\nuse std::sync::Arc;\nuse std::task::{Context, Poll, Wake, Waker};\n\nstruct YieldOnce {\n    yielded: bool,\n}\n\nimpl Future for YieldOnce {\n    type Output = ();\n\n    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {\n        if self.yielded {\n            Poll::Ready(())\n        } else {\n            self.yielded = true;\n            Poll::Pending\n        }\n    }\n}\n\nstruct Cleanup {\n    request_id: &'static str,\n}\n\nimpl Drop for Cleanup {\n    fn drop(&mut self) {\n        println!(\"cleanup = skipped\");\n    }\n}\n\nasync fn request(request_id: &'static str) {\n    YieldOnce { yielded: false }.await;\n    let _cleanup = Cleanup { request_id };\n}\n\nstruct NoopWake;\n\nimpl Wake for NoopWake {\n    fn wake(self: Arc<Self>) {}\n}\n\nfn cancel_after_one_poll<F>(future: F)\nwhere\n    F: Future<Output = ()>,\n{\n    let waker = Waker::from(Arc::new(NoopWake));\n    let mut cx = Context::from_waker(&waker);\n    let mut future = Box::pin(future);\n\n    let _ = Future::poll(future.as_mut(), &mut cx);\n    println!(\"cancelled = false\");\n}\n\nfn main() {\n    cancel_after_one_poll(request(\"request-7\"));\n}`}
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
            By the end of this page, you should be able to narrate a small async future as a state machine, repair spawned
            futures that capture the wrong ownership shape, explain cancellation as drop-based by default, and choose
            structured concurrency patterns that keep task lifetime and failure handling inside one parent scope.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch24_coroutines_futures_and_async_rust/async_fn_and_manual_block_on.rs`
```rust
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};

struct YieldOnce {
    value: &'static str,
    yielded: bool,
}

impl YieldOnce {
    fn new(value: &'static str) -> Self {
        Self {
            value,
            yielded: false,
        }
    }
}

impl Future for YieldOnce {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        if self.yielded {
            Poll::Ready(self.value)
        } else {
            self.yielded = true;
            Poll::Pending
        }
    }
}

async fn build_label(service: &'static str, route: &'static str) -> String {
    let left = YieldOnce::new(service).await;
    let right = YieldOnce::new(route).await;
    format!("{}:{}", left, right)
}

struct NoopWake;

impl Wake for NoopWake {
    fn wake(self: Arc<Self>) {}
}

fn block_on<F: Future>(future: F) -> F::Output {
    let waker = Waker::from(Arc::new(NoopWake));
    let mut cx = Context::from_waker(&waker);
    let mut future = Box::pin(future);

    loop {
        match future.as_mut().poll(&mut cx) {
            Poll::Ready(value) => return value,
            Poll::Pending => println!("poll = pending"),
        }
    }
}

fn main() {
    let label = block_on(build_label("billing", "/ready"));
    println!("label = {}", label);
}
````

### File: `examples/ch24_coroutines_futures_and_async_rust/manual_future_state_machine.rs`
```rust
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};

#[derive(Debug, Clone, Copy)]
enum Stage {
    Start,
    Waiting,
    Done,
}

struct Handshake {
    stage: Stage,
    remaining_polls: u8,
}

impl Future for Handshake {
    type Output = &'static str;

    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        match self.stage {
            Stage::Start => {
                self.stage = Stage::Waiting;
                Poll::Pending
            }
            Stage::Waiting if self.remaining_polls > 0 => {
                self.remaining_polls -= 1;
                Poll::Pending
            }
            Stage::Waiting => {
                self.stage = Stage::Done;
                Poll::Ready("connected")
            }
            Stage::Done => Poll::Ready("connected"),
        }
    }
}

struct NoopWake;

impl Wake for NoopWake {
    fn wake(self: Arc<Self>) {}
}

fn main() {
    let waker = Waker::from(Arc::new(NoopWake));
    let mut cx = Context::from_waker(&waker);
    let mut future = Box::pin(Handshake {
        stage: Stage::Start,
        remaining_polls: 1,
    });

    loop {
        match future.as_mut().poll(&mut cx) {
            Poll::Pending => {
                println!("pending stage = {:?}", future.as_ref().get_ref().stage);
                println!("pending retries = {}", future.as_ref().get_ref().remaining_polls);
            }
            Poll::Ready(value) => {
                println!("ready = {}", value);
                break;
            }
        }
    }
}
````

### File: `examples/ch24_coroutines_futures_and_async_rust/send_bound_spawn_boundary.rs`
```rust
use std::future::Future;
use std::sync::Arc;

fn spawn_send<F>(future: F)
where
    F: Future<Output = ()> + Send + 'static,
{
    drop(future);
}

fn main() {
    let shared = Arc::new(String::from("cfg-v1"));
    let worker = Arc::clone(&shared);

    spawn_send(async move {
        let text = std::future::ready(worker.as_str()).await;
        let _ = text.len();
    });

    println!("spawned = true");
    println!("shared = {}", shared.as_str());
}
````

### File: `examples/ch24_coroutines_futures_and_async_rust/cancellation_drop_guard.rs`
```rust
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;
use std::task::{Context, Poll, Wake, Waker};

struct YieldOnce {
    yielded: bool,
}

impl Future for YieldOnce {
    type Output = ();

    fn poll(mut self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<Self::Output> {
        if self.yielded {
            Poll::Ready(())
        } else {
            self.yielded = true;
            Poll::Pending
        }
    }
}

struct Cleanup {
    request_id: &'static str,
}

impl Drop for Cleanup {
    fn drop(&mut self) {
        println!("cleanup = dropped {}", self.request_id);
    }
}

async fn request(request_id: &'static str) {
    let _cleanup = Cleanup { request_id };
    YieldOnce { yielded: false }.await;
}

struct NoopWake;

impl Wake for NoopWake {
    fn wake(self: Arc<Self>) {}
}

fn cancel_after_one_poll<F>(future: F)
where
    F: Future<Output = ()>,
{
    let waker = Waker::from(Arc::new(NoopWake));
    let mut cx = Context::from_waker(&waker);
    let mut future = Box::pin(future);

    if let Poll::Pending = Future::poll(future.as_mut(), &mut cx) {
        println!("cancelled = true");
        drop(future);
    }
}

fn main() {
    cancel_after_one_poll(request("request-7"));
}
````
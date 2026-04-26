"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Move is the default for owned, non-Copy values",
    body: "Assignment and argument passing usually transfer ownership for types like String, Vec<T>, and most structs. After the move, the old binding is no longer the owner.",
  },
  {
    title: "Copy is implicit and intentionally narrow",
    body: "Copy says plain duplication is always safe, cheap, and unsurprising. It is the right contract for small value types, not for heap-owning or resource-owning types.",
  },
  {
    title: "Clone is explicit duplication work",
    body: "Clone may be cheap, moderate, or expensive. The point is not the exact cost class. The point is that the call site must opt into duplication intentionally.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Rust separates the ideas more sharply than C++ copy and move constructors usually feel in day-to-day code. `Copy` is a simple, implicit duplication contract. `Clone` is explicit. Non-`Copy` assignment is a move, not a hidden deep copy.",
  },
  {
    title: "C# background",
    body: "In C#, assigning a reference type copies the reference, not the object. In Rust, assigning a `String` moves ownership by default. If you want another owned `String`, you call `clone()` explicitly.",
  },
  {
    title: "Go background",
    body: "Go makes header copies of slices, maps, and strings feel cheap, but the backing storage story can still be subtle. Rust pushes you to name whether the next step borrows, copies a small value, clones owned data, or shares through `Rc` or `Arc`.",
  },
]

const operationCards = [
  {
    title: "Move",
    body: "Ownership transfers. The old binding stops being usable for that value.",
    signature: "let next = owned_value;",
  },
  {
    title: "Copy",
    body: "A small value duplicates implicitly because the type promises this is always safe and cheap.",
    signature: "let b = request_id;",
  },
  {
    title: "Clone",
    body: "Duplication happens because the caller asked for it explicitly.",
    signature: "let backup = payload.clone();",
  },
]

const coreConceptCards = [
  {
    title: "Move semantics",
    body: "The simplest model is the best one: for non-Copy values, the next binding becomes the owner. Do not think in terms of 'maybe copied, then invalidated.' Think in terms of ownership transfer.",
  },
  {
    title: "Copy vs Clone",
    body: "Copy is implicit and happens on assignment, passing, and return for eligible types. Clone is a trait method call. You choose it at the call site because semantic duplication is actually wanted.",
  },
  {
    title: "Cheap copies and expensive clones",
    body: "A `u64`, `bool`, or small handle wrapper may copy for free in practice. A `String` clone usually duplicates heap data. An `Arc<T>` clone is often cheap relative to deep cloning, but it still performs atomic reference-count work.",
  },
  {
    title: "Implementing Clone manually",
    body: "Manual `Clone` is for cases where `derive(Clone)` is not enough or when you want to document the exact duplication story. Clone owned fields explicitly. Copy plain scalar fields directly.",
    code: `impl Clone for JobTemplate {\n    fn clone(&self) -> Self {\n        Self {\n            service: self.service.clone(),\n            steps: self.steps.clone(),\n            retries: self.retries,\n        }\n    }\n}`,
  },
  {
    title: "Implementing Copy safely",
    body: "Only implement `Copy` when every field is `Copy`, the type has no custom destructor, and implicit duplication preserves the semantics readers would expect. IDs, coordinates, and tiny immutable descriptors are typical candidates.",
    code: `#[derive(Copy, Clone)]\nstruct Span {\n    start: usize,\n    end: usize,\n}`,
  },
  {
    title: "Clone-on-write patterns",
    body: "Use `Cow<'a, str>` or `Cow<'a, [u8]>` when a function often returns borrowed data but occasionally needs owned transformed data. Use `Rc::make_mut` or `Arc::make_mut` when shared ownership should clone only on mutation.",
  },
  {
    title: "Reference-counted cloning with Rc and Arc",
    body: "Cloning `Rc<T>` or `Arc<T>` does not deep-clone `T`. It creates another owner of the same allocation by incrementing a reference count. That is cheap relative to deep duplication, but it changes ownership semantics from single-owner to shared-owner.",
  },
  {
    title: "Avoiding accidental allocation",
    body: "Take `&str` instead of `String` when read-only access is enough. Return borrowed views from accessors where possible. Normalize or allocate at subsystem boundaries, not at every helper call.",
  },
  {
    title: "Receiver choices: self, &self, and &mut self",
    body: "`self` consumes the value and is good for builders, finalization, and ownership-changing transitions. `&self` reads without taking ownership. `&mut self` mutates in place without replacing the owner.",
    code: `fn view(&self) -> &str\nfn update(&mut self, next: &str)\nfn finish(self) -> Output`,
  },
]

const copyChecklist = [
  "Every field must already be Copy.",
  "The type must not implement Drop.",
  "Implicit duplication must be semantically boring and unsurprising.",
  "A copied value must not create two owners of one heap allocation or resource.",
  "If you hesitate, prefer Clone or no duplication trait at all.",
]

const productionPatterns = [
  "Use `Copy` for tiny domain values such as IDs, indices, counters, timestamps, and coordinate-like structs when implicit duplication is clearly correct.",
  "Use `Clone` explicitly at queue, retry, cache, and fan-out boundaries when independent ownership is semantically real.",
  "Prefer `Rc::clone(&value)` and `Arc::clone(&value)` at call sites when you want the code review to read as 'shared owner added' rather than 'deep data duplicated.'",
  "Reach for `Cow` when an API often returns borrowed data and only occasionally needs normalization or allocation.",
  "Design accessors to borrow by default. A getter that returns `String` from an owned `String` field is usually doing accidental work.",
]

const pitfalls = [
  "Calling `clone()` to silence a move error before deciding whether the callee should borrow instead.",
  "Marking a type `Copy` because it looks small while forgetting that one field owns heap data or a resource.",
  "Treating `Arc::clone` as free. It is often the right tradeoff, but atomic reference counting still has cost and changes your concurrency model.",
  "Returning owned strings from read-only methods when `&str` would do, then wondering where allocations came from in a hot path.",
  "Using `self` receivers casually on large owned structs, then re-cloning just to keep using the original value later.",
  "Confusing shared ownership with independent ownership. `Arc<T>` clone gives two owners of one allocation, not two deep copies of `T`.",
]

export function PageCh07CopyingDataVsCloningData() {
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
  const pageIndex = getPageIndexById("ch07-copying-data-vs-cloning-data")
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
          Chapter 07 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Rust gets calmer once you stop treating every duplication as the same event. Moves transfer ownership, `Copy`
          duplicates tiny value types implicitly, and `Clone` is the explicit price tag for real duplication.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 04, 05, and 06</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 04 explained ownership and borrowing. Chapter 05 moved those rules into struct design. Chapter 06
                showed why resizable collections make handle choice matter. This chapter adds the duplication model on top:
                when values move, when they copy, when they clone, and how to keep that decision visible in production
                APIs.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(6)}>
                Revisit Chapter 04
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(8)}>
                Revisit Chapter 05
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(10)}>
                Revisit Chapter 06
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            You are reviewing a service that parses requests, fans work out to several workers, and stores enough state to
            retry failed jobs. The team has made the code compile, but the profiler now shows avoidable allocations in the
            request path. The root cause is familiar: someone reached for `clone()` every time ownership felt slightly
            awkward. Rust is not telling you “never clone.” It is asking for a cleaner boundary: which values should move,
            which tiny values may copy, which data truly needs a second independent owner, and which paths should borrow
            instead.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A fast decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Can the next step borrow instead of owning?</li>
              <li>If ownership must transfer, is a move the correct model?</li>
              <li>If duplication is needed, is the type a plain `Copy` value or an explicit `Clone` value?</li>
              <li>If many readers share one value, is `Rc` or `Arc` the real semantic model?</li>
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
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Three different events, not one blurry idea</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {operationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <div className="rounded-md bg-card px-3 py-2 text-xs font-mono text-foreground overflow-x-auto">
                    {card.signature}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Source-of-truth topics for this chapter</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {coreConceptCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <h5 className="font-medium text-foreground mb-2">{card.title}</h5>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  {card.code ? (
                    <pre className="mt-3 rounded-lg border border-border bg-card px-3 py-2 text-xs overflow-x-auto">
                      <code className="font-mono text-foreground">{card.code}</code>
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Copy safety checklist</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {copyChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A useful default is conservative: if the type owns heap memory, file descriptors, sockets, locks, or any
                state where two implicit duplicates would be misleading, it should not be `Copy`.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout: prior instincts that help and mislead</h4>
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
                “Just clone it” is not always wrong. It becomes wrong when the code review can no longer explain why
                independent ownership is needed, or when hidden allocation cost shows up in the hot path later.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Worked examples</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: move, Copy, Clone, and receiver choices in one pass</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One tiny ID copies, one config clones explicitly, one method reads by `&self`, one mutates by `&mut
                  self`, and one consumes by `self`.
                </p>
              </div>
              {codes.copying_data_moves_copy_clone !== DEFAULT_CODES.copying_data_moves_copy_clone && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("copying_data_moves_copy_clone")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.copying_data_moves_copy_clone}
              onChange={(newCode) => updateCode("copying_data_moves_copy_clone", newCode)}
              onRun={() => runCode("copying_data_moves_copy_clone")}
              output={outputs.copying_data_moves_copy_clone ?? null}
              isRunning={isRunning === "copying_data_moves_copy_clone"}
              filename="move_copy_clone_receivers.rs"
              expectedOutput={"request id copy = 42\nlive retries = 2\nbuilder consumed = ingest-v2\ncurrent name = ingest-v1"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.copying_data_moves_copy_clone}
              onRevert={() => resetCode("copying_data_moves_copy_clone")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: run the baseline, then change the request ID or replacement name. The useful part is not the
              output. It is seeing three receiver choices and two duplication models in one small service-shaped example.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Copy</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">RequestId</code> is a tiny value.
                  Implicit duplication is predictable.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Clone</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">live.clone()</code> creates a
                  second independent config before the consuming builder-style call.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Receivers</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&self</code> views,
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&mut self</code> mutates, and
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">self</code> finalizes or
                  transforms ownership.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: clone-on-write normalization and cheap shared ownership</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Borrow the common case with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cow</code>,
                  allocate only on transformation, and use <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc::clone</code> when
                  shared ownership is the real model.
                </p>
              </div>
              {codes.copying_data_cow_arc !== DEFAULT_CODES.copying_data_cow_arc && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("copying_data_cow_arc")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.copying_data_cow_arc}
              onChange={(newCode) => updateCode("copying_data_cow_arc", newCode)}
              onRun={() => runCode("copying_data_cow_arc")}
              output={outputs.copying_data_cow_arc ?? null}
              isRunning={isRunning === "copying_data_cow_arc"}
              filename="cow_and_arc_clone_costs.rs"
              expectedOutput={"borrowed = ready\nowned = mixed-case\nstrong count = 2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.copying_data_cow_arc}
              onRevert={() => resetCode("copying_data_cow_arc")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: change the labels and rerun. Inputs that already fit the normalized form can stay borrowed;
              transformed inputs become owned. The `Arc` side shows another distinction: cheap shared ownership is still
              different from deep cloning.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Borrow first</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `Cow` lets the API return a borrowed value when no rewrite is needed.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Allocate on change</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The owned branch pays for normalization once, at the boundary that actually needs it.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Shared owner added</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `Arc::clone` increments the count. It does not copy the underlying schema string.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust files under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch07_copying_data_vs_cloning_data/
              </code>{" "}
              so the chapter can be reviewed outside the web editor as ordinary Rust source.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to classify operations as move, copy, or clone, implement `Clone`
            manually for a realistic type, decide when `Copy` is safe, remove unnecessary clones from an API, and choose
            receiver forms deliberately.
          </p>
          <Button onClick={() => setCurrentPage(13)} className="gap-2">
            Open Chapter 07 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Moves, `Copy`, and `Clone` are different ownership events with different review meanings.</li>
            <li>`Copy` is for small, boring value types. `Clone` is explicit because duplication may be meaningful or costly.</li>
            <li>Manual `Clone` should clone owned fields and copy plain scalar fields directly.</li>
            <li>`Rc` and `Arc` cloning add shared owners; they do not deep-copy the inner value.</li>
            <li>Borrow by default, allocate at real boundaries, and choose `self`, `&self`, and `&mut self` to match the ownership story.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

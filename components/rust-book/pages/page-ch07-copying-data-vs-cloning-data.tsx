"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, GitBranch, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Move is the default for owned, non-Copy values",
    body: "For types like String, Vec, and most structs, assignment and argument passing transfer ownership rather than duplicating data. After the move, the old binding is no longer the owner and the compiler will not let you use it. The bytes themselves do not necessarily move in memory; what moves is the responsibility for the value and the right to use it.",
  },
  {
    title: "Copy is implicit, cheap, and intentionally narrow",
    body: "A type that is Copy says plain bitwise duplication is always safe and unsurprising, so assignment leaves the original usable. That is the right contract for small value types whose meaning does not change when there are two of them. It is the wrong contract for anything that owns heap memory or a resource.",
  },
  {
    title: "Clone is explicit duplication you opt into",
    body: "A clone can be cheap, moderate, or expensive, and the chapter is not about memorizing the cost class of each type. The point is that the call site names the duplication out loud. A reader sees clone() and knows a second independent value was deliberately created, which is exactly the signal a Copy type hides.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Copy constructors and move constructors run implicitly, so 'did this assignment deep-copy or move?' often depends on the type's special members and the call site. Rust splits the two apart and makes them visible: non-Copy assignment is always a move, and a deep copy only happens when you write clone(). There is no silent copy constructor firing on the way into a function.",
  },
  {
    title: "C# background",
    body: "Assigning a reference type copies the reference, and the object lives until the GC collects it, so 'who owns this' rarely comes up. In Rust, assigning a String moves ownership, the original binding dies, and there is no shared reference unless you ask for Rc or Arc. When you want a second independent owner, you call clone() explicitly.",
  },
  {
    title: "Go background",
    body: "Header copies of slices, maps, and strings feel cheap, but two slice headers can still alias the same backing array, which is a quiet trap. Rust forces the question into the open at every step: does the next line borrow, copy a small value, clone owned data, or add a shared owner through Rc or Arc? The aliasing is never ambient.",
  },
  {
    title: "Python background",
    body: "Names bind to objects and assignment never copies, so the real distinction is the one between mutating an object and rebinding a name, plus the perennial shallow-versus-deep copy question. Rust removes the ambiguity: a move is a single-owner handoff, Copy is bitwise duplication of small values, and clone() is your copy.deepcopy made explicit and type-checked.",
  },
]

const operationCards = [
  {
    title: "Move",
    body: "Ownership transfers to the new binding. The old binding stops being usable for that value, and the compiler enforces it.",
    signature: "let next = owned_value;",
  },
  {
    title: "Copy",
    body: "A small value duplicates implicitly because the type promises this is always safe and cheap. The original stays usable.",
    signature: "let b = request_id;",
  },
  {
    title: "Clone",
    body: "Duplication happens because the caller asked for it. The cost lives at the visible call site, not in an invisible constructor.",
    signature: "let backup = payload.clone();",
  },
]

const coreConceptCards = [
  {
    title: "Move semantics",
    body: "The simplest model is the best one: for non-Copy values, the next binding becomes the owner. Do not think 'maybe copied, then invalidated.' Think ownership transfer. The error you get from using the old binding (E0382, borrow of moved value) is the compiler pointing at exactly this transfer.",
  },
  {
    title: "Copy versus Clone",
    body: "Copy is implicit and happens on assignment, passing, and return for eligible types. Clone is a trait method call. Copy is in fact a marker built on Clone with the extra promise that the clone is a trivial bitwise duplicate, which is why every Copy type is also Clone but not the reverse.",
  },
  {
    title: "Cheap copies and expensive clones",
    body: "A u64, bool, or small handle wrapper copies for free in practice. A String or Vec clone duplicates heap data and costs proportionally to its length. An Arc clone is cheap relative to deep cloning, but it still performs atomic reference-count work, so 'cheap' is not the same as 'free.'",
  },
  {
    title: "Implementing Clone manually",
    body: "Reach for a manual impl when derive(Clone) is not enough or when you want to document exactly how duplication works. Clone owned fields explicitly, copy plain scalar fields directly. In almost all ordinary code derive(Clone) is correct; a hand-written impl is a signal that something nontrivial happens during duplication.",
    code: `impl Clone for JobTemplate {\n    fn clone(&self) -> Self {\n        Self {\n            service: self.service.clone(),\n            steps: self.steps.clone(),\n            retries: self.retries,\n        }\n    }\n}`,
  },
  {
    title: "Implementing Copy safely",
    body: "Only implement Copy when every field is Copy, the type has no Drop impl, and implicit duplication preserves the meaning a reader expects. IDs, coordinates, spans, and tiny immutable descriptors are the typical candidates. Copy requires Clone, so you derive both together.",
    code: `#[derive(Copy, Clone)]\nstruct Span {\n    start: usize,\n    end: usize,\n}`,
  },
  {
    title: "Clone-on-write",
    body: "Use Cow when a function usually returns borrowed data but occasionally needs an owned, transformed value. The common path stays allocation-free and only the path that actually changes the data pays. Rc::make_mut and Arc::make_mut apply the same idea to shared ownership: they clone the inner value only when the count is greater than one, so a writer gets an exclusive copy without duplicating data that is not actually shared.",
    code: `let mut shared = Arc::new(vec![1, 2, 3]);\nlet _other = Arc::clone(&shared); // count is now 2\n// make_mut clones the Vec because it is shared, then writes through it.\nArc::make_mut(&mut shared).push(4);`,
  },
  {
    title: "Reference-counted cloning with Rc and Arc",
    body: "Cloning an Rc or Arc does not deep-clone the inner value. It creates another owner of the same allocation by incrementing a reference count. That is cheap relative to deep duplication, but it changes the ownership model from single-owner to shared-owner, which has real consequences for mutation and teardown.",
  },
  {
    title: "Avoiding accidental allocation",
    body: "Take &str instead of String when read-only access is enough. Return borrowed views from accessors where possible. Normalize or allocate at subsystem boundaries, not at every helper call. A getter that returns String from an owned String field is doing copy work on every call that nobody asked for.",
  },
  {
    title: "Receiver choices: self, &self, and &mut self",
    body: "self consumes the value and suits builders, finalizers, and ownership-changing transitions. &self reads without taking ownership. &mut self mutates in place without replacing the owner. The receiver you pick is part of the duplication story: a self-by-value method often pushes callers toward a clone if they need the original afterward.",
    code: `fn view(&self) -> &str\nfn update(&mut self, next: &str)\nfn finish(self) -> Output`,
  },
]

const copyChecklist = [
  "Every field is already Copy.",
  "The type does not implement Drop.",
  "Implicit duplication is semantically boring and unsurprising.",
  "A copied value never creates two owners of one heap allocation or resource.",
  "If you hesitate, prefer Clone, or no duplication trait at all.",
]

const productionPatterns = [
  "Use Copy for tiny domain values such as IDs, indices, counters, timestamps, and coordinate-like structs when implicit duplication is clearly correct.",
  "Use Clone explicitly at queue, retry, cache, and fan-out boundaries where independent ownership is semantically real, not just convenient for the borrow checker.",
  "Prefer Rc::clone(&value) and Arc::clone(&value) at call sites so a reviewer reads 'shared owner added' rather than 'deep data duplicated.'",
  "Reach for Cow when an API often returns borrowed data and only occasionally needs normalization or allocation.",
  "Design accessors to borrow by default. A getter that returns String from an owned String field is usually doing accidental work on a hot path.",
]

const pitfalls = [
  "Calling clone() to silence a move error before deciding whether the callee should borrow instead.",
  "Marking a type Copy because it looks small, while forgetting that one field owns heap data or a resource.",
  "Treating Arc::clone as free. It is often the right tradeoff, but atomic reference counting still has cost and changes your concurrency model.",
  "Returning owned strings from read-only methods when &str would do, then wondering where the allocations in a hot path came from.",
  "Using self receivers casually on large owned structs, then cloning just to keep using the original value later.",
  "Confusing shared ownership with independent ownership. An Arc clone gives two owners of one allocation, not two deep copies of the inner value.",
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
          Whether a value moves, copies, or clones decides latency, memory use, and what an API promises about ownership.
          This chapter separates those events so that a reader, and a code reviewer, can always tell which one is
          happening and why the cost was chosen on purpose.
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
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch04-ownership-borrowing-and-lifetimes"))}>
                Revisit Chapter 04
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch05-ownership-inside-structs"))}>
                Revisit Chapter 05
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch06-ownership-inside-vectors"))}>
                Revisit Chapter 06
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A request service fans work out to several workers and keeps retry state for failed jobs. The requirement is a
            reviewable duplication policy: borrow read-only data on hot paths, move owned jobs at boundaries, copy tiny
            values implicitly when that is safe, and clone only where independent ownership is genuinely required. The goal
            is not to ban clones; it is to make every clone explainable in review.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A fast decision order</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              When you hit a value that needs to be used more than once, walk these questions in order. The first one that
              answers yes is usually the right tool, and the diagram after it shows the same decision as a single path.
            </p>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Can the next step borrow instead of owning?</li>
              <li>If ownership must transfer, is a move the correct model?</li>
              <li>
                If duplication is needed, is the type a plain <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Copy</code>{" "}
                value or an explicit <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Clone</code> value?
              </li>
              <li>
                If many readers share one value, is <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc</code> or{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc</code> the real model?
              </li>
            </ol>
          </div>
          <MermaidDiagram
            chart={`flowchart TD\n  Start[Need this value again?] --> Borrow{Can the next step borrow?}\n  Borrow -->|yes| UseRef[Pass &T or &mut T]\n  Borrow -->|no, needs to own| Move{Single owner moving on?}\n  Move -->|yes| DoMove[Move it]\n  Move -->|no, need a duplicate| Cont[duplication: continues below]`}
            caption="First half: borrow if the next step can, otherwise move when a single owner is handing the value on. If you actually need a duplicate, follow the second half."
          />
          <p className="text-sm text-muted-foreground leading-6 mt-3 mb-3">
            When a duplicate is genuinely needed, the second half decides which kind:
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Cont[need a duplicate] --> Dup{Type is Copy?}\n  Dup -->|yes| DoCopy[Implicit copy]\n  Dup -->|no| Independent{Independent owner needed?}\n  Independent -->|yes| DoClone[clone explicitly]\n  Independent -->|no, just shared reads| DoShare[Rc or Arc clone]`}
            caption="Second half: a Copy type duplicates implicitly; otherwise clone explicitly for an independent owner, or add a shared owner with Rc or Arc when many readers share one value."
          />
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
            <GitBranch className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Most engineers do not meet move, Copy, and Clone with a blank slate. They arrive with a duplication model from
            another language, and the useful question is which part of that model transfers and which part quietly
            misleads. The shift is almost never about API names. It is about where duplication becomes visible: Rust drags
            the deep copy out of the constructor and the assignment and onto a line you can read.
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

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Three different events, not one blurry idea</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The whole chapter rests on keeping three things apart. A move hands a single value from one owner to the
              next. A copy is an implicit bitwise duplicate that a type opts into for small values. A clone is an explicit,
              possibly expensive duplication that you write by hand. The diagram shows what happens to the source binding
              in each case, which is the detail that trips people up.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Move\n    A1[src owns value] -->|let b = src| B1[b owns value]\n    A1 -.->|src unusable| X1[compile error if used]\n  end`}
              caption="Move: assignment hands the single value to the new binding and the source can no longer be used."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-3 mb-3">
              Copy and Clone behave differently: in both cases the source stays usable. The split is who pays and
              whether the duplication is implicit or written down.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Copy\n    A2[src small value] -->|let b = src| B2[b is a duplicate]\n    A2 -->|src still usable| C2[src stays valid]\n  end\n  subgraph Clone\n    A3[src owns data] -->|"let b = src.clone()"| B3[b owns a deep copy]\n    A3 -->|src still usable| C3[src stays valid]\n  end`}
              caption="Copy and Clone both leave the source valid. Copy is an implicit bitwise duplicate of a small value; Clone is an explicit, possibly expensive duplication you write by hand."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
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
            <h4 className="font-semibold text-foreground mb-3">What Copy and Clone share, and where they differ</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              These two traits are related, not independent. Clone is the general duplication trait. Copy is a marker that
              sits on top of Clone and adds a promise: the duplicate is a trivial bitwise copy, so the language may make it
              implicit and leave the original usable. That relationship is why every Copy type must also be Clone, and why
              a type that owns heap data can be Clone but never Copy.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Clone[Clone trait: explicit duplication] --> Copy[Copy marker: implicit bitwise duplicate]\n  Copy --> Small[u64, bool, char, Span]\n  Small --> Why[small and bitwise-trivial, so duplication is implicit]`}
              caption="Copy is a special case of Clone: a marker for small, bitwise-trivial values where implicit duplication is safe and unsurprising."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-3 mb-3">
              The other families stay Clone-only on purpose. Heap-owning and reference-counted types can duplicate, but
              never implicitly:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Clone[Clone trait: explicit duplication] --> Heap[String, Vec, HashMap]\n  Clone --> Shared[Rc and Arc handles]\n  Heap -.->|cannot be Copy| NoCopy[owns heap, needs explicit clone]\n  Shared -.->|cheap clone, not Copy| Counted[increments a reference count]`}
              caption="Heap-owning types must clone explicitly; reference-counted handles clone cheaply but only bump a count, so neither is ever Copy."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Key concepts</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Reference-counted cloning is sharing, not copying</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The most common confusion in this whole topic is treating an Arc clone as if it deep-copied the inner value.
              It does not. Both handles point at the same allocation; the clone only bumps a counter so the allocation
              lives until the last handle is dropped. That is what makes it cheap, and also what makes it different from an
              independent clone: a mutation through one handle is visible to the other unless you go through make_mut.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  H1[Arc handle a] --> Alloc[(one allocation: count 2)]\n  H2[Arc handle b] --> Alloc\n  Alloc --> Data[the actual String or struct]\n  Note[Arc::clone bumps the count; it copies the handle, not Data]`}
              caption="An Arc clone adds a second handle to one shared allocation and increments the reference count. The underlying data is never duplicated."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">When is implementing Copy safe?</h4>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {copyChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A useful default is conservative: if the type owns heap memory, file descriptors, sockets, locks, or any
                state where two implicit duplicates would be misleading, it should not be Copy. The compiler enforces the
                mechanical half of this (no Drop, all fields Copy); the semantic half (would two of these be surprising?)
                is yours to judge.
              </p>
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
                &ldquo;Just clone it&rdquo; is not always wrong. It becomes wrong when the review can no longer explain why
                independent ownership is needed, or when the hidden allocation cost shows up in the hot path later.
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
                <h4 className="font-semibold text-foreground">Example 1: move, Copy, Clone, and receiver choices in one pass</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One tiny ID copies, one config clones explicitly, one method reads by{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&self</code>, one mutates by{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&mut self</code>, and one consumes by{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">self</code>.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: follow the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">live</code>{" "}
              config. It is mutated through <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&mut self</code>,
              then explicitly cloned so the consuming{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">replace_name(self, ...)</code> can take
              the clone by value while the original keeps living. The diagram traces that single value; the code is the
              same path written out.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Id[RequestId 42] -->|Copy: let copy = id| IdCopy[copy, original still valid]\n  Live[live config] -->|&mut self: bump_retries| Live2[live, retries bumped]\n  Live2 -->|clone| Dup[independent copy]\n  Dup -->|self: replace_name| Built[replaced config]\n  Live2 -->|&self: name| Read[still readable after]`}
              caption="RequestId copies and the original survives; live is borrowed mutably, cloned once, and the clone is consumed by a by-value method while live stays usable."
            />
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
              Quick check: run the baseline, then try removing the{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.clone()</code> before{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">replace_name</code>. The compiler refuses,
              because <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">replace_name(self)</code> would
              move <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">live</code> away and the last line
              still reads it. That is the move-versus-clone decision made concrete.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Copy</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">RequestId</code> is a tiny value.
                  Implicit duplication is predictable and the original stays valid.
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
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&self</code> views,{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&mut self</code> mutates, and{" "}
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">normalize_label</code>{" "}
              branches on whether the input already fits the normalized form. An already-clean label returns{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cow::Borrowed</code> with no allocation;
              a dirty one returns <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cow::Owned</code> and
              pays once. The Arc lines are a second, separate idea: cloning a handle adds a shared owner rather than copying
              the string. The diagram splits those two paths so you can read each in the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  In[input label] --> Check{already normalized?}\n  Check -->|yes| Borrowed["Cow::Borrowed: no allocation"]\n  Check -->|no| Owned["Cow::Owned: allocate once"]`}
              caption="Cow borrows the clean path and only allocates when it must transform the label."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-3 mb-3">
              The Arc lines are a separate idea: cloning a handle adds a shared owner rather than copying the string.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Schema[Arc schema] -->|Arc::clone| Worker[second handle]\n  Worker --> Count[strong count = 2, data not copied]`}
              caption="Arc::clone adds a shared owner and leaves the schema string untouched: the count goes to 2, the data is not duplicated."
            />
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
              Quick check: change the labels and rerun. Inputs that already fit the normalized form stay borrowed;
              transformed inputs become owned. The Arc side shows the other distinction: cheap shared ownership is still
              not the same as deep cloning.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Borrow first</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cow</code> lets the API return a
                  borrowed value when no rewrite is needed.
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
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc::clone</code> increments the
                  count. It does not copy the underlying schema string.
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
            The companion exercise page asks you to classify operations as move, copy, or clone, implement{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Clone</code> manually for a realistic type,
            decide when <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Copy</code> is safe, remove
            unnecessary clones from an API, and choose receiver forms deliberately.
          </p>
          <Button onClick={() => setCurrentPage(getPageIndexById("ch07-copying-data-vs-cloning-data-exercises"))} className="gap-2">
            Open Chapter 07 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Moves, Copy, and Clone are different ownership events with different review meanings: a move invalidates the source, while Copy and Clone leave it usable.</li>
            <li>Copy is a marker on top of Clone for small bitwise-trivial values; Clone is the general, explicit duplication trait.</li>
            <li>Manual Clone should clone owned fields and copy plain scalar fields directly, and is a signal that duplication does something nontrivial.</li>
            <li>Rc and Arc cloning add shared owners; they increment a reference count and do not deep-copy the inner value.</li>
            <li>Borrow by default, allocate at real boundaries, and choose self, &self, and &mut self to match the ownership the method actually needs.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

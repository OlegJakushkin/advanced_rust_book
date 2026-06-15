"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
  Shield,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const comparisons = [
  {
    title: "C++ background",
    body: "RAII and move semantics carry over, but Rust turns aliasing and mutation rules into ordinary API design instead of team discipline. The biggest shift is not syntax. It is that the compiler now participates in resource-protocol review.",
  },
  {
    title: "C# background",
    body: "Rust trades runtime-managed convenience for deterministic destruction and explicit fallibility. The design question moves earlier: who owns this resource, and what does the caller have to prove before using it?",
  },
  {
    title: "Go background",
    body: "Rust keeps the lightweight service instinct but removes much of the ambient trust around shared state and cross-thread ownership. Message passing, queues, and worker handoff still exist; the ownership contract just becomes explicit.",
  },
]

const diagnostics = [
  {
    code: "error[E0382]",
    title: "borrow of moved value",
    meaning: "Ownership already moved, so this binding is no longer the one allowed to use the value.",
    fix: "Decide whether the boundary should borrow, return ownership, or clone deliberately. The repair is about API shape before it is about syntax.",
  },
  {
    code: "error[E0499]",
    title: "cannot borrow as mutable more than once",
    meaning: "Rust is protecting exclusive mutation. Two active mutable paths to the same state would violate Rust's exclusive-mutation rule.",
    fix: "Shorten the first borrow, split the state, or centralize mutation in one owner instead of working around the borrow checker.",
  },
  {
    code: "error[E0277]",
    title: "type cannot be sent between threads safely",
    meaning: "The thread boundary demands stronger guarantees than the captured type can currently provide.",
    fix: "Move owned data, share immutable data via shared references, or introduce a thread-safe ownership model such as Arc at the boundary that actually needs it.",
  },
]

const productionPatterns = [
  "Turn parse-time bytes into owned domain values before queue, task, or thread boundaries where the caller can no longer guarantee lifetime.",
  "Use borrowing for narrow read paths, not as a way to carry request-local state deeper into the system than it belongs.",
  "Prefer enums, Result, and explicit ownership transitions over sentinel values, ambient mutation, or class-shaped state machines.",
  "Start concrete, then generalize only after the second real implementation or boundary appears.",
]

const pitfalls = [
  "Cloning to quiet the borrow checker before deciding whether the callee needed ownership at all.",
  "Recreating inheritance or shared-mutable object graphs when a struct, enum, or one-owner workflow would have fit the problem better.",
  "Wrapping broad state in `Arc<Mutex<T>>` as the first move instead of deciding who should own mutation.",
  "Treating 'zero-cost abstraction' like 'zero work.' Iteration, hashing, parsing, allocation, and contention still cost what they cost.",
]

const learningCurveNotes = [
  {
    title: "The friction is concentrated at boundaries",
    body: "Small expressions are rarely the expensive part of learning Rust. APIs, shared state, queues, and worker handoff are where the language insists that ownership, mutation, and lifetime become explicit.",
  },
  {
    title: "Your old instincts still help, but they need a new ordering",
    body: "C++ instincts help with layout and RAII, C# instincts help with modeling, and Go instincts help with service decomposition. Rust's extra question is always: who owns this value right now, and who owns it after the next call?",
  },
  {
    title: "Compiler feedback is early architectural feedback",
    body: "A rejected ownership design is often cheaper than a late production incident. Rust surfaces protocol mistakes while the code is still small enough to reshape confidently.",
  },
]

const compilerReadingLoop = [
  "Name the violated rule first: move, borrow exclusivity, trait bound, lifetime relationship, or exhaustiveness.",
  "Find the first ownership mistake, not only the last line the compiler highlighted.",
  "Rewrite the ownership story in plain English before editing the code.",
  "Then choose the repair deliberately: borrow, return ownership, shorten scope, clone on purpose, or change the boundary.",
]

const decisionChecklist = [
  "Who owns the data or resource after this line?",
  "Does the next step need read-only access, exclusive mutation, or full ownership?",
  "Is fallibility visible in the signature or hidden in control flow?",
  "If concurrency appears, is the boundary message passing, shared immutable state, or synchronized shared mutation?",
]

export function PageCh01WhyRustFeelsDifferent() {
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
  const pageIndex = getPageIndexById("ch01-why-rust-feels-different")
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
          Chapter 01 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Production Rust is valuable because ownership, failure handling, concurrency, and deployment rules become
          explicit contracts that teams can review before release.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="p-5 rounded-xl bg-card border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A payments platform is moving latency-sensitive services to Rust after repeated incidents in resource
            ownership, failure recovery, and concurrent state updates. The business requirement is direct: make ownership,
            mutation authority, and fallibility explicit enough for release review before the system grows.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">What Rust is asking you to state up front</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Name the owner of the data or resource.</li>
              <li>Say whether the next step only borrows, mutates exclusively, or takes ownership outright.</li>
              <li>Make fallibility and concurrency visible where the boundary actually changes.</li>
            </ul>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <h4 className="font-semibold text-foreground mb-2">A reading checklist</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              {decisionChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-sm text-muted-foreground leading-6">
                Rust is not “C++ with a stricter compiler,” “C# without a GC,” or “Go with harder syntax.” The
                operational model is different: values have owners, borrows describe temporary access, and APIs must
                state whether they transfer responsibility, share read access, or require exclusive mutation.
              </p>
            </div>
            <div className="p-4 rounded-lg bg-card border border-border">
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Ownership</strong> says who is responsible for cleanup. When the
                  owner goes out of scope, Rust runs
                  <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">Drop</code>
                  to release the resource deterministically.
                </li>
                <li>
                  <strong className="text-foreground">Borrowing</strong> says who may access a value temporarily.
                </li>
                <li>
                  <strong className="text-foreground">Traits</strong> describe behavior; generics usually compile via
                  monomorphization rather than dynamic dispatch.
                </li>
                <li>
                  <strong className="text-foreground">Thread boundaries</strong> carry trait requirements like
                  <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs ml-1">Send</code> and
                  <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs ml-1">Sync</code>.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="p-4 rounded-lg bg-card border border-border">
              <h4 className="font-semibold text-foreground mb-2">
                Rust’s core promise: control without unsafety by default
              </h4>
              <p className="text-sm text-muted-foreground leading-6">
                Rust wants C-like control over layout, allocation, and destruction while keeping memory unsafety out of
                ordinary code. Safe Rust rules out use-after-free, double-free, and data races in the safe subset.
                When low-level work truly needs escape hatches, you use
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">unsafe</code>
                in small, auditable regions and document the invariants there.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card border border-border">
              <h4 className="font-semibold text-foreground mb-2">Zero-cost abstractions in practice</h4>
              <p className="text-sm text-muted-foreground leading-6">
                “Zero-cost” does not mean “free magic.” It means abstractions do not inherently add overhead relative to
                a hand-written equivalent. Iterator pipelines, enums, and generics often compile to code close to an
                explicit loop. Traits become dynamic only when you opt into trait objects; otherwise, generic code is
                usually monomorphized.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card border border-border">
              <h4 className="font-semibold text-foreground mb-2">The senior-developer Rust learning curve</h4>
              <p className="text-sm text-muted-foreground leading-6">
                The learning curve is mostly architectural, not syntactic. Rust pushes design choices earlier: where is
                ownership transferred, which references may outlive which scopes, which types are allowed across
                threads, and where should cloning be explicit? Later chapters go deeper on borrowing, traits, and async,
                but this chapter’s goal is to make the early discomfort interpretable.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-card border border-border">
              <h4 className="font-semibold text-foreground mb-2">Rust compared with C++, C#, and Go</h4>
              <p className="text-sm text-muted-foreground leading-6">
                The most useful comparison is not syntax. It is where each language places trust: C++ trusts discipline
                around aliasing, C# trusts a managed runtime, Go trusts a runtime plus simplified concurrency
                primitives, and Rust spends more compile time to reduce what must be trusted in production.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-card border border-border">
            <h4 className="font-semibold text-foreground mb-3">What changes by background</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {comparisons.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="font-semibold text-foreground mb-3">Why this feels slower before it feels faster</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {learningCurveNotes.map((note) => (
                <div key={note.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{note.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{note.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="p-4 rounded-lg bg-card border border-border">
              <h4 className="font-semibold text-foreground mb-3">Compile-time guarantees vs runtime checks</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-foreground mb-2">Usually compile time</div>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                    <li>Move-after-use and many lifetime mistakes</li>
                    <li>Overlapping mutable borrows</li>
                    <li>Thread-boundary safety via trait bounds</li>
                    <li>Missing exhaustiveness in pattern matching</li>
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground mb-2">Still runtime work</div>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                    <li>Allocation, syscalls, and network failures</li>
                    <li>Bounds checks when data-dependent</li>
                    <li>Parsing invalid input and I/O availability</li>
                    <li>Contention, cache misses, and real performance costs</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-card border border-border">
              <h4 className="font-semibold text-foreground mb-3">Reading compiler errors productively</h4>
              <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                <li>Read the violated rule first, not just the red text.</li>
                <li>Find the origin span: where was the move, borrow, or trait bound introduced?</li>
                <li>Change ownership shape before changing syntax.</li>
                <li>Only clone or heap-share after deciding that duplication or sharing is actually correct.</li>
              </ol>
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-medium text-foreground mb-2">A practical reading loop</div>
                <p className="text-xs text-muted-foreground leading-5 mb-2">
                  This is the shorter habit you internalize once the four steps above become routine: the same process, condensed into the order you actually run it in.
                </p>
                <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                  {compilerReadingLoop.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {diagnostics.map((diagnostic) => (
              <div key={diagnostic.code} className="rounded-lg border border-border bg-card p-4">
                <div className="text-xs font-mono text-primary mb-2">{diagnostic.code}</div>
                <div className="font-medium text-foreground mb-2">{diagnostic.title}</div>
                <p className="text-sm text-muted-foreground leading-6 mb-2">{diagnostic.meaning}</p>
                <p className="text-sm text-muted-foreground leading-6">
                  <strong className="text-foreground">Typical repair:</strong> {diagnostic.fix}
                </p>
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
                A borrow-checker error is not an obstacle to work around. It is exposing an ownership protocol you have not
                stated clearly enough yet. Treat that as design feedback, especially in production code.
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
                <h4 className="font-semibold text-foreground">Example 1: iterator pipeline with no extra abstraction tax</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This reads like high-level code, but the abstraction can still compile down close to an ordinary loop.
                </p>
              </div>
              {codes.why_rust_pipeline !== DEFAULT_CODES.why_rust_pipeline && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("why_rust_pipeline")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.why_rust_pipeline}
              onChange={(newCode) => updateCode("why_rust_pipeline", newCode)}
              onRun={() => runCode("why_rust_pipeline")}
              output={outputs.why_rust_pipeline ?? null}
              isRunning={isRunning === "why_rust_pipeline"}
              filename="zero_cost_pipeline.rs"
              expectedOutput="critical count = 3"
              showResultComparison={true}
              originalCode={DEFAULT_CODES.why_rust_pipeline}
              onRevert={() => resetCode("why_rust_pipeline")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: press Run first to confirm the baseline output, then change the threshold or input data and
              see how the pipeline stays readable while remaining executable.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Compile-time structure</div>
                <p className="text-xs text-muted-foreground leading-5">Iterator adapters, closure types, and the final return type describe structure. In ordinary generic code, that structure does not imply a heap allocation or a vtable lookup.</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Runtime work that still exists</div>
                <p className="text-xs text-muted-foreground leading-5">The CPU still walks the slice, evaluates the predicate, branches, and counts matches. Zero-cost abstractions remove abstraction tax, not the cost of real work.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: ownership handoff into a worker thread</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Moving the job into the closure makes the lifetime and thread boundary explicit.
                </p>
              </div>
              {codes.why_rust_thread_handoff !== DEFAULT_CODES.why_rust_thread_handoff && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("why_rust_thread_handoff")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.why_rust_thread_handoff}
              onChange={(newCode) => updateCode("why_rust_thread_handoff", newCode)}
              onRun={() => runCode("why_rust_thread_handoff")}
              output={outputs.why_rust_thread_handoff ?? null}
              isRunning={isRunning === "why_rust_thread_handoff"}
              filename="ownership_thread_handoff.rs"
              expectedOutput="worker started: rebuild-search-index"
              showResultComparison={true}
              originalCode={DEFAULT_CODES.why_rust_thread_handoff}
              onRevert={() => resetCode("why_rust_thread_handoff")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: reproduce the expected output, then change the job name or move more data into the closure to
              explore how ownership makes the thread boundary explicit.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Ownership fact</div>
                <p className="text-xs text-muted-foreground leading-5">The <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">move</code> closure consumes captured non-<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Copy</code> data so the worker owns what it needs. That makes the handoff explicit instead of leaving lifetime questions to convention.</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">Queues, threads, and async tasks are ownership boundaries. Borrow locally when you can, but hand off owned work items when execution may outlive the current scope.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page contains exercises for warm-up comprehension, code reading,
            implementation, debugging, and production design. One exercise explicitly asks you to interpret three
            compiler diagnostics and propose repairs.
          </p>
          <Button onClick={() => setCurrentPage(getPageIndexById("ch01-why-rust-feels-different-exercises"))} className="gap-2">
            Open Chapter 01 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Next chapter</h3>
              <p className="text-sm text-muted-foreground leading-6">Chapter 02 turns this intuition into an operational model: values, bindings, moves, drops, stack versus heap-backed ownership, and why lifetimes are about borrowed references rather than object survival.</p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch02-the-rust-mental-model"))} className="gap-2 shrink-0">
              Continue to Chapter 02
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Rust feels different because it makes resource protocols part of the type-checked API instead of part of team folklore.</li>
            <li>The goal is not abstract safety rhetoric. It is earlier feedback on ownership, mutation, and thread-boundary mistakes.</li>
            <li>Zero-cost abstractions remove abstraction tax, not the real cost of parsing, allocation, synchronization, or IO.</li>
            <li>Once you can read compiler errors as design notes, later chapters get much easier to use well.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

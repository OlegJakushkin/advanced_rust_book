"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  HardDrive,
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

const mentalModelPoints = [
  {
    title: "Values are the thing; bindings are scope-local names",
    body: "A Rust `let` binding is not a little object wrapper with secret identity. It is a name in a scope. The value can move, be borrowed temporarily, or be dropped when its owner goes out of scope.",
  },
  {
    title: "Moves transfer responsibility, not data by magic",
    body: "For non-`Copy` types such as `String`, `Vec<T>`, and most structs, assignment or argument passing usually transfers ownership. After the move, the previous binding is simply no longer the owner.",
  },
  {
    title: "Lifetimes describe borrowed reach, not object survival",
    body: "A lifetime annotation does not keep data alive and does not behave like a garbage collector. It only states a compile-time relationship: this reference must not outlive the owner it points into.",
  },
]

const coreConcepts = [
  {
    title: "Values, bindings, moves, and drops",
    body: "Think operationally: values exist, bindings name them, ownership determines who will run cleanup, moves transfer ownership, and `Drop` runs when the owner leaves scope. This model is simpler than class identity plus hidden runtime memory management, but it is more explicit.",
    exampleCode: "let b = a;",
    exampleNote: "For a non-Copy value, ownership moved and the original binding no longer owns cleanup.",
  },
  {
    title: "Stack vs heap allocation",
    body: "Do not confuse the owner with the storage behind it. A `String` value is a small stack-resident handle, but its bytes live on the heap. A `Vec<T>` owns a heap buffer; the `Vec` metadata itself is a fixed-size value. Heap allocation buys flexibility, not free performance.",
    exampleCode: 'let payload = String::from("ok");',
    exampleNote: "The handle is local data; the string bytes are heap-backed.",
  },
  {
    title: "Immutability by default",
    body: "Bindings are immutable unless you write `mut`. This makes state changes stand out in APIs and local code. It does not mean Rust is globally immutable; it means mutation is opt-in and therefore easier to audit.",
    exampleCode: "let mut y = 1;",
    exampleNote: "Mutation is explicit at the binding where it is needed.",
  },
  {
    title: "Expressions, statements, and blocks",
    body: "Most constructs in Rust produce values. `if`, `match`, and blocks can return a result. This makes it natural to build values with local scratch state and then expose only the final immutable result.",
    exampleCode: "let timeout_ms = if bursty { 200 } else { 50 };",
    exampleNote: "Control flow can compute a value directly instead of widening mutation.",
  },
  {
    title: "RAII and deterministic destruction",
    body: "Rust inherits the RAII spirit familiar to C++ engineers, but makes the ownership rules visible in ordinary code. Scope exit triggers deterministic destruction in reverse lexical order. That matters for files, sockets, locks, buffers, and transaction guards.",
    exampleCode: "{ let file = open_log(); }",
    exampleNote: "Cleanup happens when the owner leaves scope, not when a GC eventually notices it.",
  },
  {
    title: "Lifetimes as compile-time reasoning, not garbage collection",
    body: "Lifetimes are attached to references, not owned values. They let the compiler verify that borrowed data is still valid where used. They are not runtime tags, object regions, or reachability roots.",
    exampleCode: "fn pick<'a>(left: &'a str, right: &'a str) -> &'a str",
    exampleNote: "The annotation constrains the returned reference; it does not extend any owner's lifetime.",
  },
]

const comparisons = [
  {
    title: "C++ background",
    body: "RAII and move semantics will feel familiar, but Rust refuses casual aliasing patterns that C++ often permits. References are more constrained, and safe code cannot quietly rely on discipline alone.",
  },
  {
    title: "C# background",
    body: "There is no GC extending object reachability behind the scenes. If a value must survive, some owner must hold it. If a reference is returned, the compiler proves the referent outlives that use.",
  },
  {
    title: "Go background",
    body: "Go hides many storage decisions behind escape analysis and a garbage collector. Rust exposes ownership more directly: borrowed local views stay local, while owned values cross threads, queues, and subsystem boundaries.",
  },
]

const productionPatterns = [
  "Use borrowed views for short local work, but convert to owned values before task queues, worker handoff, cache storage, or long-lived structs.",
  "Prefer block expressions to assemble validated immutable values. Local mutation inside a short block is often clearer than a wider mutable scope.",
  "Treat `Drop` as the last line of defense for releasing resources, not as a general business-logic callback mechanism.",
  "Model ownership at subsystem boundaries first; performance work is easier once the movement and lifetime of data are explicit.",
]

const pitfalls = [
  "Confusing a binding with object identity. Rebinding a name is not the same thing as preserving one owner.",
  "Using a reference as if it could extend lifetime. References describe access; they do not keep the referenced value alive.",
  "Marking wide state as `mut` early and then fighting borrow conflicts that were really scope-design problems.",
  "Trying to return references to function-local data instead of deciding who should own the result.",
  "Putting slow, fallible, or order-sensitive business logic inside `Drop` instead of keeping destructors small and unsurprising.",
  "Adding lifetime annotations before the ownership model is clear enough to justify them.",
]

const operationalChecklist = [
  "What value exists here, and which binding owns it right now?",
  "If the value is heap-backed, which part is inline metadata and which part owns separate storage?",
  "Where does scope end, and therefore where does deterministic cleanup happen?",
  "If a reference appears, which owner keeps it valid?",
]

export function PageCh02TheRustMentalModel() {
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
  const pageIndex = getPageIndexById("ch02-the-rust-mental-model")
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
          Chapter 02 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Reliable Rust services depend on a precise model of values, ownership transfer, drops, stack and heap storage,
          expressions, and references. This chapter defines that model for code review and debugging.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapter 01</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 01 explained why Rust feels different at a high level. This chapter turns that intuition into an
                operational model: who owns a value, what actually moves, what gets dropped, and why lifetimes are
                proofs about references rather than a runtime memory system.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(0)} className="shrink-0">
              Revisit Chapter 01
            </Button>
          </div>
        </section>

        <section className="p-5 rounded-xl bg-card border border-border">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A message-ingestion service parses inbound bytes, enriches records, and dispatches owned jobs to workers. The
            business requirement is a precise value lifecycle: where data is created, which component owns it, where heap
            storage is used, and when cleanup occurs.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="font-semibold text-foreground mb-2">Operational checklist</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              {operationalChecklist.map((item) => (
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
            <HardDrive className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {coreConcepts.map((concept) => (
              <div key={concept.title} className="rounded-lg border border-border bg-card p-4">
                <h4 className="font-semibold text-foreground mb-2">{concept.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{concept.body}</p>
                <pre className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground overflow-x-auto">
                  <code className="font-mono text-foreground">{concept.exampleCode}</code>
                  {concept.exampleNote ? (
                    <>
                      {" "}
                      <span className="font-sans text-muted-foreground">{concept.exampleNote}</span>
                    </>
                  ) : null}
                </pre>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="font-semibold text-foreground mb-3">translating prior instincts</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Two corrections that remove a lot of confusion</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">A move is not “copy then invalidate” as a user model</div>
                <p className="text-sm text-muted-foreground leading-6">
                  The useful model is simpler: ownership transferred. For small fixed-size `Copy` values the data is
                  copied. For non-`Copy` types, think of the old binding as no longer owning the value. That is the
                  rule that matters when reading APIs and diagnostics.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">A lifetime does not keep anything alive</div>
                <p className="text-sm text-muted-foreground leading-6">
                  Owned values live until their owner is dropped. Lifetimes constrain references that point at those
                  values. If the owner is dropped, no annotation can keep a reference to it valid.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="font-semibold text-foreground mb-3">Expressions, statements, and blocks in one pass</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Statement</div>
                <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">let retries = 3;</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  A statement performs work in the enclosing scope. It does not become the value of that scope.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Expression</div>
                <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`if bursty { 200 } else { 50 }`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  An expression produces a value. In Rust, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">if</code>, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">match</code>, and blocks are often value-producing tools, not only control-flow syntax.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Block expression</div>
                <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`{ let base = 40; base + 2 }`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  The last line without a semicolon becomes the block&apos;s value. Add a trailing semicolon and the block evaluates to <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">()</code> instead.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="font-semibold text-foreground mb-3">Lifetime repair rule of thumb</h4>
            <p className="text-sm text-muted-foreground leading-6">
              When a lifetime error appears, repair ownership before you reach for annotations. Usually the real choice is one of two shapes: borrow from caller-owned input that already lives long enough, or return an owned value so the function transfers data instead of a reference. Randomly adding <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">'a</code> to a signature rarely fixes the model because lifetimes describe valid borrowing relationships; they do not extend how long an owner lives.
            </p>
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
                Deterministic destruction is powerful, but it is not magic. Destructors should release resources and
                maintain invariants, not hide slow network calls, lock acquisition chains, or critical business logic
                that is hard to reason about during unwinding and shutdown.
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
                <h4 className="font-semibold text-foreground">Example 1: move a value and observe deterministic drop</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The binding in `main` stops owning the value after the function call, and cleanup runs when the new
                  owner leaves scope.
                </p>
              </div>
              {codes.mental_model_move_drop !== DEFAULT_CODES.mental_model_move_drop && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("mental_model_move_drop")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.mental_model_move_drop}
              onChange={(newCode) => updateCode("mental_model_move_drop", newCode)}
              onRun={() => runCode("mental_model_move_drop")}
              output={outputs.mental_model_move_drop ?? null}
              isRunning={isRunning === "mental_model_move_drop"}
              filename="move_and_drop_timeline.rs"
              expectedOutput={"before move\nshipping audit.log\ndrop audit.log\nafter ship"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.mental_model_move_drop}
              onRevert={() => resetCode("mental_model_move_drop")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: run the baseline once, then rename the file or move more fields through the handoff to make
              the ownership timeline concrete.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: use block expressions to build owned heap data with narrow mutation
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The outer bindings stay immutable while a short inner block uses mutation to assemble the final value.
                </p>
              </div>
              {codes.mental_model_blocks_heap !== DEFAULT_CODES.mental_model_blocks_heap && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("mental_model_blocks_heap")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.mental_model_blocks_heap}
              onChange={(newCode) => updateCode("mental_model_blocks_heap", newCode)}
              onRun={() => runCode("mental_model_blocks_heap")}
              output={outputs.mental_model_blocks_heap ?? null}
              isRunning={isRunning === "mental_model_blocks_heap"}
              filename="expression_blocks_and_heap.rs"
              expectedOutput={"status = hot\ncapacity = 8"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.mental_model_blocks_heap}
              onRevert={() => resetCode("mental_model_blocks_heap")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: confirm the expected output, then experiment with the block contents and see how narrow
              mutation still produces an owned final value.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The exercise page asks you to predict move and drop behavior, classify stack and heap ownership precisely,
            refactor imperative code into expression-oriented Rust, and explain a lifetime error in operational terms.
          </p>
          <Button onClick={() => setCurrentPage(3)} className="gap-2">
            Open Chapter 02 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Rust gets calmer when you treat bindings as names and ownership as the cleanup contract.</li>
            <li>Stack and heap explain storage placement; ownership explains who is responsible for the value that uses it.</li>
            <li>Immutability by default and expression-oriented blocks push mutation into narrower, more reviewable scopes.</li>
            <li>RAII in Rust is explicit and deterministic, which is exactly why `Drop` should stay small and unsurprising.</li>
            <li>Lifetimes talk only about borrowed references. They never extend the life of owned data.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

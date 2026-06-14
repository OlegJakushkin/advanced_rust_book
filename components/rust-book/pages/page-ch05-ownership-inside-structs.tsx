"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
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
    title: "A struct is an ownership boundary",
    body: "Field types decide whether the struct owns data, borrows it, or shares it through deliberate heap indirection. Read the fields first; the API usually follows from there.",
  },
  {
    title: "Borrowed fields spread lifetime coupling",
    body: "If one field is `&'a str`, the whole struct becomes `Struct<'a>`. That lifetime then leaks into callers, containers, async boundaries, and return types.",
  },
  {
    title: "Prefer owned long-lived state, borrowed short-lived views",
    body: "Borrowed structs are excellent for parser views, adapters, and temporary projections. Most domain records, caches, queues, and service state should own their data.",
  },
]

const fieldDesignCards = [
  {
    title: "Owned fields",
    signature: "struct StoredAlert { service: String, route: String }",
    body: "Use owned fields when the struct must survive independently of the input buffer, be stored in collections, cross thread or queue boundaries, or remain easy to move around the program.",
  },
  {
    title: "Borrowed fields",
    signature: "struct HeaderView<'a> { name: &'a str, value: &'a str }",
    body: "Use borrowed fields when the struct is intentionally a view into caller-owned data and its lifetime should stay short, local, and explicit.",
  },
]

const borrowedStructNotes = [
  {
    title: "Structs containing references",
    body: "A borrowed struct says, plainly, that some other owner must stay alive. That is a useful statement for parsing and read-only inspection. It is usually the wrong default for persisted or queued domain data.",
  },
  {
    title: "Lifetime parameters on structs",
    body: "Once a struct contains references, you name the relationship with a lifetime parameter such as `MessageView<'a>`. The annotation does not make the owner live longer. It only constrains where the view may be used.",
  },
  {
    title: "Avoid over-lifetime-parameterization",
    body: "If every service type becomes `Thing<'a>`, the design is usually borrowing too far from the edge. A common repair is simple: borrow at the input boundary, then build an owned struct for the long-lived part of the system.",
  },
]

const pointerChoices = [
  {
    title: "Box<T>",
    pointer: "Box<T>",
    bestFit: "Single ownership with heap indirection",
    body: "Use `Box<T>` when the struct should still own the value, but the field needs heap placement, recursive shape support, or a stable-sized outer struct.",
  },
  {
    title: "Rc<T>",
    pointer: "Rc<T>",
    bestFit: "Shared ownership on one thread",
    body: "`Rc<T>` is for single-thread shared ownership. It is not `Send` or `Sync`. Reach for it when shared read-mostly state is semantically real and stays inside one thread.",
  },
  {
    title: "Arc<T>",
    pointer: "Arc<T>",
    bestFit: "Shared ownership across threads",
    body: "`Arc<T>` uses atomic reference counting. It enables shared ownership across threads when `T` itself is thread-safe. It does not by itself make shared mutation safe, and it is not a substitute for a clean concurrency design.",
  },
]

const bufferOwnershipNotes = [
  "Own the source buffer as `String` or `Vec<u8>` when the struct must manage its own lifetime.",
  "Expose borrowed views with methods like `fn header(&self) -> &str` or `fn bytes(&self) -> &[u8]`.",
  "If computing views is non-trivial, store byte ranges or indices rather than storing self-borrows.",
  "If mutation can invalidate derived views, keep borrows short and avoid promising more than `&self` can safely support.",
]

const safeAlternatives = [
  {
    title: "Store byte ranges or offsets",
    body: "Keep the owned buffer in one field and store `Range<usize>` or offset pairs in another. Reconstruct `&str` or `&[u8]` on demand from `&self`.",
  },
  {
    title: "Store stable IDs or indices",
    body: "If one field conceptually points at another owned collection, use an index or typed ID. This is often the cleanest replacement for a tempting self-reference.",
  },
  {
    title: "Separate owner from view",
    body: "Let one type own the data and a second type borrow from it. This splits lifecycle concerns cleanly and makes movement of the owner unsurprising.",
  },
  {
    title: "Use `Pin` only for truly address-sensitive types",
    body: "`Pin` exists for address-sensitive invariants, but pinning alone does not make ordinary business-struct self-borrows ergonomic or automatically safe. Most application code should choose a different representation first.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Owning fields and `Box<T>` will feel close to RAII plus unique ownership. The surprise is that Rust does not let you embed references into the same object that owns the backing storage and rely on discipline to keep them valid.",
  },
  {
    title: "C# background",
    body: "A borrowed field is not just a cheaper string. It is a promise that some external owner remains valid. That promise spreads through the type system much more directly than a managed reference normally would.",
  },
  {
    title: "Go background",
    body: "Go makes it easy to pass slice and string views around, but ownership of the backing storage is often implicit. Rust makes the coupling visible, which is why long-lived structs frequently want owned `String`, `Vec<u8>`, or `Arc<T>` instead.",
  },
]

const productionPatterns = [
  "Use borrowed structs for request parsing, protocol decoding, and local inspection where the owner is clearly outside and nearby.",
  "Convert borrowed input into owned domain structs before queues, retries, caches, async tasks, or thread handoff.",
  "Use `Rc<T>` or `Arc<T>` only when the model truly has multiple owners, not to work around a move error.",
  "Prefer `Box<T>` for recursive or indirection-heavy layouts when you still want one clear owner rather than a shared graph.",
  "If a struct owns a buffer and exposes views, make the views derived from `&self` each time or from stored ranges. Do not try to store references into the same buffer inside the struct.",
]

const pitfalls = [
  "Making long-lived domain types borrow from request buffers because it seems allocation-free. The lifetime coupling usually spreads farther than the allocation savings justify.",
  "Putting `Rc<T>` into code that later wants a thread boundary. `Rc<T>` is single-thread only; replacing it with `Arc<T>` late can reveal a deeper model problem.",
  "Treating `Arc<T>` as a universal answer. Shared ownership is a semantic commitment and an atomic-cost tradeoff, not a default container.",
  "Trying to build a self-referential struct like `struct Parsed<'a> { raw: String, first: &'a str }`. Safe Rust rejects the ordinary form because moving the owner would invalidate the internal reference.",
  "Overusing lifetime parameters on service structs, then discovering everything from tests to caches to async tasks now carries avoidable lifetime complexity.",
  "Creating `Rc<RefCell<T>>` or `Arc<Mutex<T>>` graphs with back-edges and forgetting about cycles or contention. If shared graphs are real, design the ownership edges deliberately and use `Weak` for non-owning back references.",
]

export function PageCh05OwnershipInsideStructs() {
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
  const pageIndex = getPageIndexById("ch05-ownership-inside-structs")
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
          Chapter 05 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Struct design fixes ownership policy in public data models. This chapter covers owned fields, borrowed views,
          shared pointers, and stable representations for systems that must expose safe state without hidden aliasing.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 02 and 04</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 02 established values, moves, drops, and heap-backed ownership. Chapter 04 explained borrowing
                and lifetime relationships. This chapter moves those rules into struct design, where production Rust
                either becomes clear or becomes accidentally lifetime-heavy.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(2)}>
                Revisit Chapter 02
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(6)}>
                Revisit Chapter 04
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A command-processing service converts request text into normalized records, stores selected data, and sends
            background work to processors. The business requirement is to classify every struct as a transient view or
            owned state, so lifetimes stay local and durable data remains easy to store, test, and move.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A durable design order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Decide whether the struct is a view or an owner.</li>
              <li>If it borrows, say which outer owner keeps it alive.</li>
              <li>If it owns, decide whether the owned fields are inline, boxed, or shared.</li>
              <li>If you are tempted by self-reference, change the representation instead.</li>
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
            <h4 className="font-semibold text-foreground mb-3">Owned fields vs borrowed fields</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {fieldDesignCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <div className="rounded-md bg-card px-3 py-2 text-xs font-mono text-foreground overflow-x-auto">
                    {card.signature}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h5 className="font-medium text-foreground mb-2">Rule of thumb</h5>
              <p className="text-sm text-muted-foreground leading-6">
                A borrowed-field struct is usually a temporary lens over someone else&apos;s data. An owned-field struct is
                usually a value the rest of the system may keep, move, test, queue, and reason about independently.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Structs containing references and lifetime parameters on structs
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {borrowedStructNotes.map((note) => (
                <div key={note.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{note.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{note.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="font-medium text-foreground mb-2">A useful operational question</div>
              <p className="text-sm text-muted-foreground leading-6">
                If this struct ended up inside a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec</code>,
                a cache, a worker message, or a test fixture, would you still want it tied to some external owner&apos;s
                lifetime? If the answer is no, give the struct owned fields.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Interior ownership using Box, Rc, and Arc</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {pointerChoices.map((choice) => (
                <div key={choice.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-medium text-foreground">{choice.title}</div>
                    <code className="px-1.5 py-0.5 rounded bg-card font-mono text-xs text-foreground">
                      {choice.pointer}
                    </code>
                  </div>
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">{choice.bestFit}</div>
                  <p className="text-sm text-muted-foreground leading-6">{choice.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The pointer type is part of the domain model. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Box&lt;T&gt;</code>{" "}
                means one owner plus indirection. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc&lt;T&gt;</code>{" "}
                means shared ownership in one thread. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc&lt;T&gt;</code>{" "}
                means shared ownership across threads, provided <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">T</code> is itself safe there.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Structs that own buffers and expose views</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              This is one of the most Rust-native patterns in systems and service code. Let the struct own the buffer.
              Then derive borrowed slices from <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;self</code> as
              needed. The struct manages lifetime. Callers get safe read-only views.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {bufferOwnershipNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The repository example{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                  examples/ch05_ownership_inside_structs/owned_buffer_views.rs
                </code>{" "}
                mirrors the first example below.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Self-referential struct problems</h4>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <TriangleAlert className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                    The tempting shape is something like{" "}
                    <code className="px-1 py-0.5 rounded bg-amber-100/80 dark:bg-amber-950/40 font-mono text-[11px]">
                      struct Parsed&lt;'a&gt; {"{"} raw: String, first: &amp;'a str {"}"}
                    </code>
                    . The trouble is that the borrow would point into storage owned by the same struct. Moving the struct
                    can move that storage, which makes the ordinary safe layout invalid.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {safeAlternatives.map((alternative) => (
                <div key={alternative.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{alternative.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{alternative.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The repository example{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                  examples/ch05_ownership_inside_structs/stable_indices_instead_of_self_reference.rs
                </code>{" "}
                shows the most practical repair: own the buffer, store ranges, and derive views when needed.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Translating from C++, C#, and Go</h4>
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
                The cheapest-looking field type is not always the cheapest design. Saving one allocation by borrowing can
                cost far more if the whole object graph becomes lifetime-coupled and hard to store, test, or hand off.
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
                <h4 className="font-semibold text-foreground">Example 1: own the buffer, borrow the view</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The struct owns the raw line. Methods derive lightweight views from that owned buffer.
                </p>
              </div>
              {codes.ownership_structs_owned_views !== DEFAULT_CODES.ownership_structs_owned_views && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("ownership_structs_owned_views")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.ownership_structs_owned_views}
              onChange={(newCode) => updateCode("ownership_structs_owned_views", newCode)}
              onRun={() => runCode("ownership_structs_owned_views")}
              output={outputs.ownership_structs_owned_views ?? null}
              isRunning={isRunning === "ownership_structs_owned_views"}
              filename="owned_buffer_views.rs"
              expectedOutput={"level = INFO\nmessage = user signed in"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.ownership_structs_owned_views}
              onRevert={() => resetCode("ownership_structs_owned_views")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: run the baseline, then change the raw line passed to{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">LogLine::new</code>. The output
              changes, but the ownership stays simple: one owner, many short borrows.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Why this works</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The returned <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;str</code> values
                  are tied to <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;self</code>, not
                  stored inside the struct. That keeps the representation movable and ordinary.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This pattern shows up in log parsing, protocol headers, request lines, and binary message frames:
                  own once, slice many times, store offsets only when repeated lookup deserves it.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: choose Box, Rc, and Arc by ownership semantics</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One field needs single-owner indirection, one needs single-thread shared ownership, and one must cross
                  a thread boundary.
                </p>
              </div>
              {codes.ownership_structs_pointer_choices !== DEFAULT_CODES.ownership_structs_pointer_choices && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("ownership_structs_pointer_choices")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.ownership_structs_pointer_choices}
              onChange={(newCode) => updateCode("ownership_structs_pointer_choices", newCode)}
              onRun={() => runCode("ownership_structs_pointer_choices")}
              output={outputs.ownership_structs_pointer_choices ?? null}
              isRunning={isRunning === "ownership_structs_pointer_choices"}
              filename="pointer_choices_inside_structs.rs"
              expectedOutput={"box delimiter = =>\nrc clones = 2\nthread schema = v2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.ownership_structs_pointer_choices}
              onRevert={() => resetCode("ownership_structs_pointer_choices")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: keep the three field types distinct, then change the string literals and rerun. The point is
              not the output itself. The point is that the field type communicates the ownership model.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Box</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The parser config still has one owner. The box gives indirection without changing ownership count.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Rc</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The UI template is shared on one thread only. That is why the example clones it locally and never sends it to the worker.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Arc</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The shared schema crosses a thread boundary, so the reference count must be atomic and the inner type must remain thread-safe.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The exercise page asks you to choose owned versus borrowed fields for real domain objects, refactor a
            self-referential design into stable indices, select between `Box`, `Rc`, and `Arc`, and build a struct that
            owns data while exposing safe read-only views.
          </p>
          <Button onClick={() => setCurrentPage(9)} className="gap-2">
            Open Chapter 05 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Struct field types are ownership decisions, not mere storage details.</li>
            <li>Borrowed fields are useful for short-lived views, but they spread lifetime coupling through the type.</li>
            <li>
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Box&lt;T&gt;</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Rc&lt;T&gt;</code>, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Arc&lt;T&gt;</code> solve different
              ownership problems. Pick by semantics, not habit.
            </li>
            <li>Owning a buffer and deriving views from `&self` is a strong Rust-native pattern for parsers and protocols.</li>
            <li>Most self-referential designs should be rewritten as offsets, ranges, stable IDs, or separate owner/view types.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

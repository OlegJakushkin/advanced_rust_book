"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Layers,
  Shield,
  TriangleAlert,
  Users,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A vector owns one resizable buffer",
    body: "A `Vec<T>` is a small owner value that manages a heap buffer, a length, and a capacity. The elements live contiguously in that buffer. If growth exhausts capacity, the vector may allocate a new buffer and move every element into it.",
  },
  {
    title: "A reference into a vector borrows the current buffer",
    body: "A borrowed element such as `&vec[i]` or `&mut vec[i]` is valid only for the vector storage that exists at that moment. It is not a durable handle that survives arbitrary `push`, `insert`, `reserve`, `remove`, or reorder operations.",
  },
  {
    title: "Choose the handle before you choose the syntax",
    body: "When the collection shape is fixed, references and slices are excellent. When the collection may grow, shrink, or reshuffle, indices, IDs, `Box<T>`, or arena-like storage are usually the more robust design.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already know std::vector iterators and element pointers are invalidated by push_back past capacity; the rule is the same here. The shift is that C++ trusts you to remember which operations relocate storage, while Rust refuses to compile code that keeps a stale alias plausible. The bug you used to catch in review or under a sanitizer becomes a compile error.",
  },
  {
    title: "C# background",
    body: "A List<T> resizes the same way, but you rarely hold a direct reference into a value slot, so invalidation seldom shows up in your code. In Rust, &vec[i] is a first-class borrow you can pass around, which means address stability becomes a design question you must answer rather than one the runtime hides from you.",
  },
  {
    title: "Go background",
    body: "append hides backing-array reallocation, and a slice header captured before append can silently point at the old array. Rust closes exactly that gap: a borrowed view cannot outlive the shape change that would invalidate it. When a later stage needs a durable handle, reach for an index or an owned value on purpose instead of relying on it accidentally still working.",
  },
  {
    title: "Python background",
    body: "A Python list element is a reference to a heap object, so x = lst[0] keeps the object alive even as the list grows or reorders. Rust gives you that stability only when you ask for it explicitly, with Vec<Box<T>> or an arena; a plain &vec[0] is a borrow of a slot, not a handle to a kept-alive object.",
  },
]

const storageChoices = [
  {
    title: "Vec<T>",
    body: "Best when contiguous layout, cache locality, and simple ownership matter more than stable addresses. References and slices are short-lived views; durable handles are usually indices.",
    tradeoff: "Fast iteration and compact storage, but growth or reordering can move elements.",
  },
  {
    title: "Vec<Box<T>>",
    body: "Best when you want vector indexing plus heap-stable pointees. The boxes may move inside the vector, but the `T` values they own stay at stable heap addresses.",
    tradeoff: "Extra allocation and pointer indirection for each element.",
  },
  {
    title: "Arena or slab-like store",
    body: "Best when the program wants stable logical handles, frequent insertion/removal, or graph-style relationships. The common pattern is ID-based access instead of borrowed aliases into the collection.",
    tradeoff: "More infrastructure and often less contiguous layout than plain `Vec<T>`.",
  },
]

const sliceRules = [
  "`vec.as_slice()` and `&vec[..]` are excellent for read-only bulk processing when the vector shape stays fixed during the borrow.",
  "`&mut vec[..]` is appropriate for in-place mutation of existing elements when you are not changing length or capacity.",
  "`split_at_mut` is the right tool when you need two disjoint mutable regions of the same vector at once.",
  "If the algorithm wants to grow, shrink, or reorder the vector, end the slice borrow first or switch to a two-phase design.",
]

const mutationPatterns = [
  "Use `iter_mut()` when you only mutate existing elements and the vector length stays constant.",
  "Collect indices, commands, or IDs in a first pass, then apply shape-changing edits in a second pass.",
  "Use `retain`, `drain`, or rebuild into a fresh vector when removal and partitioning are the main job.",
  "If removal must preserve handles, plain indices may not be enough; add generation counters or move to a slab-like design.",
]

const productionPatterns = [
  "Use indices or typed IDs as durable handles when a worker registry, parser table, or connection set may grow during normal operation.",
  "Borrow slices for hot-path scanning, validation, sorting windows, and batch processing only while the collection shape is stable.",
  "Reach for `Vec<Box<T>>` when the element address itself matters, not merely because the borrow checker complained.",
  "Model shape-changing loops in two phases: inspect first, mutate structure second.",
  "Treat stable-address storage as a semantic choice. If the design does not truly need stable addresses, prefer plain `Vec<T>` and short borrows.",
]

const pitfalls = [
  "Keeping `&T` or `&mut T` from a vector, then calling `push`, `insert`, `reserve`, or another operation that may relocate or reshuffle elements.",
  "Replacing every borrow problem with `Vec<Box<T>>` or `Arc<T>` before deciding whether stable addresses or shared ownership are actually required.",
  "Using raw pointers or `unsafe` to work around vector invalidation in ordinary application code. Most of the time the representation, not the compiler, is the thing to change.",
  "Assuming an index remains a stable identity after `swap_remove`, sorting, or compaction. Index-based designs still need a policy for reordering.",
  "Mutating vector shape from inside iteration because it looks small in code. Production bugs here are often intermittent and expensive to diagnose in other languages.",
]

export function PageCh06OwnershipInsideVectors() {
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
  const pageIndex = getPageIndexById("ch06-ownership-inside-vectors")
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
          Chapter 06 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          A vector owns one resizable buffer, and growth can move every element it holds. This chapter is about choosing
          the right handle into that buffer: when a borrowed reference is safe, when an index or ID is the durable choice,
          and when the model genuinely needs stable addresses from boxed or arena-style storage.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 04 and 05</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 04 explained borrowing and lifetime relationships. Chapter 05 moved those rules into struct field
                design. This chapter applies the same discipline to collections, where growth, reordering, and temporary
                views make ownership mistakes especially easy to import from C++, C#, or Go.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(6)}>
                Revisit Chapter 04
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(8)}>
                Revisit Chapter 05
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A worker registry tracks live connections, appends new workers during scaling, scans readiness, and removes
            unhealthy entries. The business requirement is a stable handle policy: use short borrows only while the vector
            shape is fixed, and use indices, IDs, boxed storage, or arena handles when growth and reordering are normal.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical review order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Will the vector&apos;s length, capacity, or ordering change while this handle is alive?</li>
              <li>If yes, should the handle be an index or ID instead of a reference?</li>
              <li>If address stability truly matters, should each element be separately allocated?</li>
              <li>If the algorithm needs both inspection and reshaping, can it run in two phases?</li>
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
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">What a vector actually is</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A vector is one owner of one resizable buffer. The value stored in a local binding is only the control
                  block: pointer, length, and capacity. The elements live in heap-backed contiguous storage managed by
                  that owner.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Moving the <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Vec&lt;T&gt;</code> moves
                  ownership of the buffer. Growing beyond capacity may move the elements themselves into a new buffer.
                  That second fact is the one that makes element references delicate.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The thing to picture is the split between the small fixed-size handle on the stack and the heap buffer it
              points at. The handle stays put; the buffer underneath it can be replaced.
            </p>
            <MermaidDiagram
              chart={`flowchart LR\n  subgraph Stack\n    H["Vec handle: ptr, len, cap"]\n  end\n  subgraph Heap\n    B["buffer: e0 e1 e2 ... free cap"]\n  end\n  H -->|ptr| B`}
              caption="The Vec value on the stack is just a pointer, length, and capacity. The elements live in a separate heap buffer the vector owns."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">References into vectors and invalidation</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A borrowed element such as <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">&amp;jobs[i]</code>{" "}
                  is tied to the current buffer and the current aliasing rules. It says, in effect, &quot;while this borrow
                  lives, nobody may perform conflicting access that would make it invalid or ambiguous.&quot;
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Rust therefore rejects many patterns that would be merely dangerous in other languages: take a borrow,
                  then append, reserve, insert, or otherwise reshape the same vector while still using the borrowed
                  element later.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The hazard is easiest to see as a sequence. A borrow names a slot in the current buffer; a growth past
              capacity allocates a new buffer and moves the elements; the old borrow would now point into freed memory.
              Rust rejects the code at the second step rather than letting the third one happen at runtime.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  A["take r = &vec[0]"] --> B["call vec.push(x)"]\n  B --> C{"len > cap?"}\n  C -->|no| D["same buffer, r still valid"]\n  C -->|yes| E["allocate new buffer, move elements"]\n  E --> F["r points at freed memory"]\n  F --> G["compile error: cannot borrow vec as mutable while borrowed"]`}
              caption="Growth past capacity relocates the buffer, which would dangle the earlier borrow. Rust forbids the conflicting mutable access at compile time."
            />
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h5 className="font-medium text-foreground mb-2">Reallocation hazards</h5>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">push</code>,{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">extend</code>, and{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">insert</code> may move the buffer
                  when length grows past capacity.
                </li>
                <li>
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">reserve</code> is an explicit
                  request for more capacity and may also relocate storage.
                </li>
                <li>
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">remove</code>,{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">swap_remove</code>, sorting, and
                  compaction may shift element positions even when the buffer does not relocate.
                </li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Index-based designs</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Indices are the default durable handle for a plain vector. You store the position, mutate the vector as
                  needed, and then reborrow from the vector when you are ready to use the element again.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This works well when you control reordering policy. If the code uses{" "}
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">swap_remove</code>, sorting, or
                  compaction, the index is a location, not an identity. Production code often wraps indices in typed IDs
                  or adds generation checks when stale handles matter.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Choosing a handle</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Before reaching for any representation, the decision worth making explicit is what kind of handle the code
              needs. The first question is whether the vector&apos;s shape is fixed for the lifetime of the handle. If it
              is, borrows and slices are ideal. If it is not, the choice is between a location handle (an index or ID) and
              a representation that gives genuinely stable addresses.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Q1{"Shape fixed while handle is alive?"}\n  Q1 -->|yes| R["use &T, &mut T, or a slice"]\n  Q1 -->|no| Cont["shape can change: continues below"]`}
              caption="First question: if the vector cannot grow, shrink, or reorder while the handle lives, a short borrow or slice is ideal."
            />
            <p className="text-sm text-muted-foreground leading-6">
              When the shape can change, the choice is between a location handle and genuinely stable addresses:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cont["shape can change"] --> Q2{"Need a stable address, not just a position?"}\n  Q2 -->|no| I["use an index or typed ID, reborrow later"]\n  Q2 -->|yes| Q3{"Few elements or graph-like with churn?"}\n  Q3 -->|few| Bx["Vec of Box T: stable pointees"]\n  Q3 -->|churn| Ar["arena or slab: access by ID"]`}
              caption="If shape changes, prefer an index for plain growth; reach for boxed or arena storage only when an address itself must stay put."
            />
            <h4 className="font-semibold text-foreground mt-5 mb-3">Stable-address allocation patterns</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Sometimes the correct requirement really is stable addressability. A parser cache, intrusive structure, or
              FFI boundary may need each element to stay put even if the collection grows. That is when you change the
              representation, not when you try to stretch a plain borrowed element reference farther than it should go.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {storageChoices.map((choice) => (
                <div key={choice.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{choice.title}</div>
                  <p className="text-sm text-muted-foreground leading-6 mb-3">{choice.body}</p>
                  <p className="text-xs text-muted-foreground leading-5">
                    <strong className="text-foreground">Tradeoff:</strong> {choice.tradeoff}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A precise note on <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Pin</code>: pinning
                can matter for address-sensitive pointees such as certain async or self-referential low-level machinery,
                but it does not make references into a plain <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;T&gt;</code>{" "}
                stable on its own. For ordinary collection design, indices, boxes, or arena-style handles are the usual tools.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Vec&lt;Box&lt;T&gt;&gt;, arenas, and slab allocation</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Vec&lt;Box&lt;T&gt;&gt;</code> is a
                  tactical choice: indexing stays simple, and each element lives in its own heap allocation. Growing the
                  vector moves boxes, not pointees.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Arena and slab-style stores solve a different problem. They usually give you stable logical handles,
                  efficient reuse, and explicit deletion policy. The ecosystem offers several variants, but the shared
                  idea is more important than any one crate: store by owner-managed pool, access by ID.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Borrowing slices from vectors</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {sliceRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h5 className="font-medium text-foreground mb-2">Mutating while iterating</h5>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {mutationPatterns.map((pattern) => (
                  <li key={pattern}>{pattern}</li>
                ))}
              </ul>
            </div>
          </div>

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Every language with a growable array has the same underlying reallocation behavior. What differs is whether
            you normally hold a reference into a slot, and whether anything stops you from using it after the array
            moves. The mental shift below is the trap most likely to surprise an engineer coming from each language.
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
                The cheapest-looking handle is often the most expensive long-term design. A borrowed element reference is
                wonderful when the vector shape is fixed. It is a trap when growth and reshaping are part of the normal
                lifecycle.
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
                <h4 className="font-semibold text-foreground">Example 1: index handles instead of borrowed elements</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The vector may grow, so the durable handle is the index. The code reborrows from the vector only when it
                  actually needs the element.
                </p>
              </div>
              {codes.ownership_vectors_indices !== DEFAULT_CODES.ownership_vectors_indices && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("ownership_vectors_indices")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              What to look at: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">push_task</code>{" "}
              returns the index it just wrote, not a reference. Later pushes are free to reallocate the buffer, and the
              code only reborrows through <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">tasks[billing]</code>{" "}
              after all growth is done. The index is the handle that survives the mutation.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  P["push_task returns index 0"] --> S["store billing = 0"]\n  S --> G["push search, push indexer (may grow buffer)"]\n  G --> M["mark_not_ready(tasks, billing)"]\n  M --> R["reborrow tasks[0] to read name and ready"]`}
              caption="The index stays valid across growth. Each access reborrows the current buffer instead of holding a reference through the pushes."
            />
            <RustCodeEditor
              code={codes.ownership_vectors_indices}
              onChange={(newCode) => updateCode("ownership_vectors_indices", newCode)}
              onRun={() => runCode("ownership_vectors_indices")}
              output={outputs.ownership_vectors_indices ?? null}
              isRunning={isRunning === "ownership_vectors_indices"}
              filename="index_handles_instead_of_refs.rs"
              expectedOutput={"task = billing\nready = false\ntotal = 3"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.ownership_vectors_indices}
              onRevert={() => resetCode("ownership_vectors_indices")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: keep the handle as an index, then change task names or add more pushes. The design stays correct
              because the vector is allowed to grow without carrying old element borrows through the mutation.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Operational rule</div>
                <p className="text-xs text-muted-foreground leading-5">
                  If the collection may reallocate, keep a location handle such as an index and borrow later.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Worker tables, scheduler queues, and parser token streams often become easier once durable handles stop
                  being raw references into resizable storage.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: stable pointees plus two-phase mutation
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Each job lives in its own box, and shape-changing logic is split from inspection logic.
                </p>
              </div>
              {codes.ownership_vectors_boxed_stable !== DEFAULT_CODES.ownership_vectors_boxed_stable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("ownership_vectors_boxed_stable")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              What to look at: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">first_ptr</code>{" "}
              records the heap address of the first job before two more pushes. Because each job is its own{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Box</code>, growing the vector relocates
              the boxes but not the jobs, so the address still matches afterward. The retry update then runs in two
              phases: collect indices first, mutate second, so no borrow is held across a shape change.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  A["record first_ptr = address of jobs[0]"] --> B["push two more boxed jobs (buffer may grow)"]\n  B --> C["ptr::eq(first_ptr, &jobs[0]) is still true"]\n  C --> D["phase 1: collect retry_indices by reading needs_retry"]\n  D --> E["phase 2: for each index, bump attempts and clear flag"]`}
              caption="Boxes move when the vector grows; the boxed jobs keep their addresses. Inspection (phase 1) is fully separated from mutation (phase 2)."
            />
            <RustCodeEditor
              code={codes.ownership_vectors_boxed_stable}
              onChange={(newCode) => updateCode("ownership_vectors_boxed_stable", newCode)}
              onRun={() => runCode("ownership_vectors_boxed_stable")}
              output={outputs.ownership_vectors_boxed_stable ?? null}
              isRunning={isRunning === "ownership_vectors_boxed_stable"}
              filename="vec_box_stable_addresses.rs"
              expectedOutput={"same address = true\nattempts = 2\nretry pending = 0"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.ownership_vectors_boxed_stable}
              onRevert={() => resetCode("ownership_vectors_boxed_stable")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: keep the boxed representation, then add more jobs or change the retry flag. The point is not
              boxing by habit. The point is that stable pointees and two-phase updates are explicit, reviewable choices.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Stable address</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The vector may move boxes around, but the boxed job itself stays at one heap address.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Two-phase loop</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The first pass records retry targets. The second pass performs mutation. Inspection and reshaping stay separate.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tradeoff</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Extra allocation buys stronger address stability. Use it when the model needs it, not by reflex.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The exercise page asks you to repair vector reallocation hazards, convert reference-heavy designs into
            index-based ones, choose between plain vectors and stable-address patterns, and implement safe mutation while
            iterating.
          </p>
          <Button onClick={() => setCurrentPage(11)} className="gap-2">
            Open Chapter 06 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>A vector owns a resizable contiguous buffer, and growth may move every element.</li>
            <li>References and slices are short-lived views into the current buffer, not durable handles across shape changes.</li>
            <li>Indices are the default stable handle for plain vectors, provided the code manages reordering policy explicitly.</li>
            <li>
              Stable-address needs usually call for a different representation such as{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;Box&lt;T&gt;&gt;</code>, arenas,
              or slab-style storage.
            </li>
            <li>When mutation changes vector shape, inspection-first and mutation-second is often the cleanest production pattern.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

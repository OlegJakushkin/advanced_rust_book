"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "An array is a value with size in the type",
    body: "A Rust array such as `[u8; 16]` is fixed-size storage whose length is part of the type. It is a good fit when the bound is semantically real: protocol headers, coordinates, small fixed tables, or bounded scratch state.",
  },
  {
    title: "A slice is a borrowed view, not a container",
    body: "`&[T]` and `&mut [T]` describe temporary access to contiguous elements owned elsewhere. That is why slices make strong function parameters: they talk about the shape the algorithm needs without forcing one allocation strategy.",
  },
  {
    title: "`Vec<T>` is the owner for growable contiguous storage",
    body: "`Vec<T>` owns a heap buffer and tracks length plus capacity. It is the default choice when element count is decided at runtime or accumulation is part of the job.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The shapes map almost one to one: array to std::array, slice to std::span, vector to std::vector. The shift is that borrow lifetimes and resize rules become compiler-checked instead of team discipline, so a slice held across a push is a build error, not a dangling-pointer bug found in production.",
  },
  {
    title: "C# background",
    body: "A vector is not a GC-backed List. It is an owned heap buffer you allocate, grow, and drop deterministically. The new question is who owns the buffer right now, and whether a function needs that ownership or only a Span-like view over it.",
  },
  {
    title: "Go background",
    body: "Rust slices are also pointer-and-length views into contiguous storage, but there is no hidden append-reallocates-or-aliases surprise. Ownership is explicit: the vector owns the buffer, a slice only borrows it, and the borrow checker forbids reading a slice whose backing buffer just moved.",
  },
  {
    title: "Python background",
    body: "A list mixes growth, dynamic typing, and reference semantics. Rust splits those apart: the element type is fixed and contiguous, the vector owns its buffer by value, and passing a slice copies no data and shares no ownership the way passing a list reference does.",
  },
]

const storageChoices = [
  {
    title: "`[T; N]`",
    bestFit: "Compile-time fixed size",
    body: "Choose an array when the exact count belongs in the type and is part of the invariant.",
  },
  {
    title: "`&[T]` / `&mut [T]`",
    bestFit: "Borrowed contiguous view",
    body: "Choose a slice when the algorithm wants contiguous elements but does not need to own or resize them.",
  },
  {
    title: "`Vec<T>`",
    bestFit: "Owned runtime-sized sequence",
    body: "Choose a vector when data must be accumulated, returned, stored, or resized.",
  },
  {
    title: "Inline-first small buffer",
    bestFit: "Hot tiny collections after profiling",
    body: "Choose an inline-first pattern only when small typical sizes and allocation pressure are proven to matter enough to justify extra representation complexity.",
  },
]

const iteratorNotes = [
  {
    title: "`iter()`",
    body: "Borrows elements immutably. Use this for read paths, scans, reductions, and most pure transforms.",
  },
  {
    title: "`iter_mut()`",
    body: "Borrows elements mutably in place. Use this when you need to rewrite existing elements without changing collection shape.",
  },
  {
    title: "`into_iter()`",
    body: "Consumes the owner when the owner is a `Vec<T>` or array value. On a slice reference, you are already iterating a borrowed view.",
  },
]

const mutationPatterns = [
  "Use `copy_from_slice` or `clone_from_slice` for bulk overwrite when the lengths already match.",
  "Use `split_at_mut` when the algorithm needs two disjoint mutable regions at once.",
  "Use `chunks`, `chunks_mut`, or `windows` when batch shape is part of the algorithm.",
  "Use `retain`, `drain`, `truncate`, or rebuild into a fresh `Vec<T>` when structural edits dominate the logic.",
]

const cacheNotes = [
  {
    title: "Contiguous scans are the default strength",
    body: "Arrays, slices, and vectors pack elements together. That usually improves cache behavior for scanning, filtering, summing, sorting, and serialization work.",
  },
  {
    title: "Middle insertions and removals shift data",
    body: "Contiguous layout is not free in every workload. If your hot path constantly inserts into the middle or preserves many stable external handles, the shifting cost matters.",
  },
  {
    title: "Stable-address alternatives cost indirection",
    body: "If the model truly needs stable addresses or graph-style edges, pointer-rich layouts may be correct. You pay with extra indirection and usually worse locality.",
  },
]

const productionPatterns = [
  "Accept `&[T]` or `&mut [T]` for algorithms. Accept `Vec<T>` only when the callee truly needs ownership or growth.",
  "Preallocate with `Vec::with_capacity` when you have a trustworthy upper bound from a batch size, protocol header, or prior scan.",
  "Keep hot numeric and parsing data contiguous when you want predictable scans and fewer cache misses.",
  "Treat `len` as logical occupancy and `capacity` as allocation budget. They answer different questions and should not be conflated in reviews.",
  "If tiny collections are hot enough to matter, measure first and only then consider an inline-first representation.",
]

const pitfalls = [
  "Writing APIs as `fn work(items: &Vec<T>)` when the function only needs a slice. That narrows callers unnecessarily and hides the real contract.",
  "Confusing `len()` with `capacity()`. One is how many elements exist now; the other is how many can fit before another allocation may be needed.",
  "Holding a slice or element borrow across structural vector mutation such as `push`, `reserve`, `insert`, or sorting.",
  "Assuming an exact vector growth factor. Growth strategy is an implementation detail. Optimize by measuring allocations and capacity behavior, not by trusting folklore.",
  "Reaching for an inline-first small-buffer optimization before the workload justifies bigger stack frames, more expensive moves, or extra representation complexity.",
  "Using a large fixed array on the stack because the type looks elegant, then discovering request-path stack pressure or unnecessary copies.",
]

export function PageCh10ArraysSlicesAndVectors() {
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
  const pageIndex = getPageIndexById("ch10-arrays-slices-and-vectors")
  const chapter04PageIndex = getPageIndexById("ch04-ownership-borrowing-and-lifetimes")
  const chapter06PageIndex = getPageIndexById("ch06-ownership-inside-vectors")
  const chapter07PageIndex = getPageIndexById("ch07-copying-data-vs-cloning-data")
  const exercisesPageIndex = getPageIndexById("ch10-arrays-slices-and-vectors-exercises")
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
          Chapter 10 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Contiguous storage choices affect allocation, cache locality, and API flexibility. This chapter defines arrays
          for fixed shape, slices for borrowed access, and vectors for owned growth.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 04, 06, and 07</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Borrowing rules from Chapter 04, vector ownership hazards from Chapter 06, and allocation-aware API design
                from Chapter 07 all meet here. Arrays, slices, and vectors are not beginner-only material. They are where
                many production Rust performance and API decisions become concrete.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter04PageIndex)}>
                Chapter 04
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter06PageIndex)}>
                Chapter 06
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter07PageIndex)}>
                Chapter 07
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            An ingestion service parses fixed headers, scans metric windows, and builds dynamic retry batches. The
            business requirement is to choose the narrowest storage shape for each path: fixed arrays for protocol
            invariants, slices for borrowed contiguous access, and vectors for owned runtime growth.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Read the diagram top to bottom: each question narrows the choice to one storage shape before you write a
              single line. The same four questions drive every example in this chapter.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Q1{Is length part of the type invariant?} -->|yes| Arr["Array  T;N"]\n  Q1 -->|no| Q2{Need ownership or just a view?}\n  Q2 -->|view only| Slice["Slice  and T"]\n  Q2 -->|own it| Q3{Will it grow at runtime?}\n  Q3 -->|yes| Vec["Vec T"]\n  Q3 -->|no, fixed runtime size| Box["Boxed slice  Box T"]\n  Vec --> Q4{Tiny and hot, proven by profiling?}\n  Q4 -->|yes| Inline["Inline-first small buffer"]\n  Q4 -->|no| Keep["Plain Vec T is the default"]`}
              caption="Length in the type means an array; a borrowed view means a slice; runtime ownership means a vector, with inline-first reserved for profiled hot paths."
            />
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
            <h4 className="font-semibold text-foreground mb-3">Which tool when?</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {storageChoices.map((choice) => (
                <div key={choice.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="font-medium text-foreground">{choice.title}</div>
                    <span className="text-xs uppercase tracking-[0.2em] text-primary">{choice.bestFit}</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{choice.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Fixed-size arrays</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  An array such as <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">[u8; 32]</code> is
                  one value whose size is known at compile time. That makes arrays useful for bounded protocol fields,
                  cryptographic material, coordinates, and other cases where the exact count is semantically real.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`let header: [u8; 4] = [0x52, 0x53, 0x54, 0x21];`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  The length is in the type. `[u8; 4]` and `[u8; 8]` are different types, not the same type with a stored
                  runtime length.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Slices as views</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A slice is a borrowed view into contiguous elements. It is not an owner, and it does not decide
                  allocation strategy. That is why slice parameters are usually the right API shape for parsing, scanning,
                  hashing, serialization, and most read-only transforms.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`fn checksum(bytes: &[u8]) -> u32 {
    bytes.iter().map(|&b| b as u32).sum()
}`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  The same function can accept an array, a vector borrow, or a sub-slice. That keeps callers flexible and
                  keeps the algorithm honest about what it actually needs.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              How a <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec&lt;T&gt;</code> is laid out in memory
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The thing to notice is that the vector value itself is tiny and lives wherever you put it (stack, struct,
              another vector). It is three words: a pointer, a length, and a capacity. The elements live somewhere else,
              in one contiguous heap allocation that the vector owns.
            </p>
            <MermaidDiagram
              chart={`flowchart LR\n  subgraph Owner[Vec value - 3 words]\n    P[ptr]\n    L[len = 3]\n    C[cap = 4]\n  end\n  P --> E0\n  subgraph Heap[Heap buffer - capacity 4]\n    E0[elem 0]\n    E1[elem 1]\n    E2[elem 2]\n    E3[spare slot]\n  end\n  Slice[and T view] -. ptr + len .-> E0`}
              caption="The owner is three words; the elements sit in one heap allocation. len marks how many are live, cap marks how many fit, and a slice is just a borrowed pointer-and-length into the same buffer."
            />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Because the owner is so small, moving the vector value moves only those three words. Ownership of the
                  buffer transfers, but the elements are not copied or re-touched at the move. This is why returning a
                  vector from a function is cheap even when it holds millions of elements.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>
                    <strong className="text-foreground">length</strong> = how many elements are currently initialized and
                    logically present.
                  </li>
                  <li>
                    <strong className="text-foreground">capacity</strong> = how many elements can fit before another
                    allocation may be needed.
                  </li>
                  <li>
                    <strong className="text-foreground">buffer</strong> = contiguous owned storage, usually on the heap.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Capacity, allocation, and growth</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Preallocation is one of the simplest meaningful vector optimizations. If you know an upper bound, use
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px] mx-1">Vec::with_capacity</code>
                  or reserve space before the hot push loop. That reduces allocation churn and often makes profiles cleaner.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Do not depend on an exact growth factor. Rust does not promise one in the language contract. Treat growth
                  behavior as an implementation detail and validate the workload with measurements, capacity logs, or
                  allocation tracing.
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                Capacity planning is an optimization, not a license to hard-code folklore. Use it when a bound is real.
                Skip it when the bound is fake or when the complexity costs more than the saved allocations.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Iterators over arrays, slices, and vectors</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {iteratorNotes.map((note) => (
                <div key={note.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{note.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{note.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Mutation patterns</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {mutationPatterns.map((pattern) => (
                <li key={pattern}>{pattern}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The recurring rule is familiar by now: if the algorithm only mutates existing elements, slices and
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">iter_mut()</code>
                are excellent. If the algorithm also changes vector shape, end any active borrows first or split the work
                into phases.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Small-vector optimizations</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Some workloads create many tiny vectors whose most common size is just a few elements: tags, short path
                  segments, tiny batch keys, or parser-side scratch buffers. In those cases, an inline-first representation
                  can avoid heap allocation for the common path and spill to the heap only when the collection grows past an
                  inline threshold.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is an ecosystem pattern, not the default answer. Inline-first containers usually make the parent
                  struct larger, increase move cost, and can inflate stack pressure. Use them only after profiling shows
                  that ordinary vectors are a real problem.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Cache locality and contiguous storage</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {cacheNotes.map((note) => (
                <div key={note.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{note.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{note.body}</p>
                </div>
              ))}
            </div>
          </div>

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">What changes coming from another language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            The three shapes have close analogues in most languages, so the syntax is rarely the hard part. The mental
            shift is that ownership and resize rules are now part of the type system, which changes how you read an API
            signature and which mistakes the compiler catches for you.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
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
                The cheapest-looking signature is not always the cheapest design. A slice-first API often removes needless
                ownership constraints. A vector-only API often leaks an allocation assumption that the algorithm never
                needed in the first place.
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
                <h4 className="font-semibold text-foreground">
                  Example 1: one slice-first function works for arrays and vectors
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The algorithm wants a contiguous read-only view, so the function accepts a slice and callers keep their
                  own storage choices.
                </p>
              </div>
              {codes.arrays_slices_vectors_slice_api !== DEFAULT_CODES.arrays_slices_vectors_slice_api && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("arrays_slices_vectors_slice_api")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: three different owners all reach the same function through one <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;[u64]</code> parameter.
              The array, the vector borrow, and a sub-slice converge to the same borrowed view, so no caller is forced to allocate or give up ownership.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  A["fixed: array u64;4"] -->|and fixed| S["and u64 slice"]\n  V["dynamic: Vec u64"] -->|and dynamic| S\n  Sub["any sub-slice"] -->|and v 1..3| S\n  S --> F["tail_sum reads contiguous view"]\n  F --> R["u64 result"]`}
              caption="One slice parameter accepts an array, a vector borrow, or a sub-slice; the function never learns or cares which owner it came from."
            />
            <RustCodeEditor
              code={codes.arrays_slices_vectors_slice_api}
              onChange={(newCode) => updateCode("arrays_slices_vectors_slice_api", newCode)}
              onRun={() => runCode("arrays_slices_vectors_slice_api")}
              output={outputs.arrays_slices_vectors_slice_api ?? null}
              isRunning={isRunning === "arrays_slices_vectors_slice_api"}
              filename="slice_first_api.rs"
              expectedOutput={"fixed tail = 21\ndynamic tail = 15"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.arrays_slices_vectors_slice_api}
              onRevert={() => resetCode("arrays_slices_vectors_slice_api")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: run the baseline, then change the array contents or the take counts. The useful lesson is not
              the arithmetic. It is that the API shape stays calm because the function borrows a slice rather than forcing
              a vector.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">API shape</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A slice says “contiguous borrowed data.” That is exactly the contract this function needs.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Operational payoff</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Arrays, vectors, and sub-slices all call the same function without extra allocation or a narrower public
                  signature.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: preallocate when a trustworthy upper bound exists
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The batch size is bounded by the input slice length, so capacity planning is simple and justified.
                </p>
              </div>
              {codes.arrays_slices_vectors_capacity !== DEFAULT_CODES.arrays_slices_vectors_capacity && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("arrays_slices_vectors_capacity")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the capacity is reserved once from a real bound (the result can never be longer than the
              input), and then the loop only filters and pushes. The diagram is the pipeline; the listing fills in the arithmetic.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  In["ids: and u32 slice"] --> Cap["Vec::with_capacity(ids.len())"]\n  Cap --> Loop{for each id}\n  Loop -->|id is even| Push["push id * 10"]\n  Loop -->|id is odd| Skip["skip"]\n  Push --> Loop\n  Skip --> Loop\n  Loop -->|done| Out["return owned Vec u32"]`}
              caption="Reserve once from a bound that cannot be exceeded, then filter-and-push without further reallocation; the helper hands back an owned vector the caller keeps."
            />
            <RustCodeEditor
              code={codes.arrays_slices_vectors_capacity}
              onChange={(newCode) => updateCode("arrays_slices_vectors_capacity", newCode)}
              onRun={() => runCode("arrays_slices_vectors_capacity")}
              output={outputs.arrays_slices_vectors_capacity ?? null}
              isRunning={isRunning === "arrays_slices_vectors_capacity"}
              filename="vec_capacity_and_growth.rs"
              expectedOutput={"len = 3\ncan fit two more = true\nlast = 220"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.arrays_slices_vectors_capacity}
              onRevert={() => resetCode("arrays_slices_vectors_capacity")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: keep the upper bound tied to the input length, then change the IDs or appended values and rerun.
              The point is that preallocation follows a real bound, not a guessed folklore capacity.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Owner</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The function returns an owned vector because the batch must survive after the helper returns.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Capacity</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Capacity is chosen from a real bound: the result cannot exceed the number of input elements.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tradeoff</div>
                <p className="text-xs text-muted-foreground leading-5">
                  You pay a small planning step up front to reduce later allocation churn in the push loop.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch10_arrays_slices_and_vectors/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to benchmark preallocation against push-only growth, rewrite a helper over
            slices instead of vectors, and choose among arrays, slices, vectors, and inline-first storage for realistic
            workloads.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 10 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Use arrays when size is part of the invariant, slices when the algorithm needs a view, and vectors when the code needs owned growth.</li>
            <li>A <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;T&gt;</code> is an owner of contiguous storage with separate logical length and allocation capacity.</li>
            <li>Slice-first APIs are usually the most flexible and honest public contract for contiguous read or write algorithms.</li>
            <li>Preallocation helps when the bound is real. Exact growth strategy is not something production code should assume.</li>
            <li>Contiguous storage buys locality for scans and batch work, but middle insertions, stable-address needs, and inline-first tricks all carry tradeoffs.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

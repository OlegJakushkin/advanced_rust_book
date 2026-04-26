"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
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
    body: "`[T; N]` is closest to `std::array<T, N>`, `&[T]` is conceptually like `std::span<T>`, and `Vec<T>` is much like `std::vector<T>`. The big Rust difference is that borrow lifetimes and structural mutation rules stay visible in ordinary APIs.",
  },
  {
    title: "C# background",
    body: "Rust arrays and slices overlap with `T[]` and `Span<T>` in spirit, but ownership stays explicit. `Vec<T>` is not a GC-backed list. It is an owned buffer with allocation and growth costs you should reason about directly.",
  },
  {
    title: "Go background",
    body: "Rust slices are also views into contiguous storage, but the ownership boundary is sharper. A `Vec<T>` is the owner, and algorithms that only need a view should usually say so with `&[T]` rather than forcing callers to hand over a growable vector.",
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
          Rust gets cleaner and faster when you choose the right contiguous-storage tool: array for fixed shape, slice for
          a borrowed view, and <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec&lt;T&gt;</code> for
          owned growth.
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
            You are reviewing an ingestion service that parses fixed headers, scans rolling windows of metrics, and builds
            dynamic retry batches. One engineer used large fixed arrays everywhere because they looked cheap. Another used
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">Vec&lt;T&gt;</code>
            for every helper, even when the code only read a contiguous view. A third added an inline-first small-buffer
            optimization before anyone had measured allocation pressure. Rust wants a calmer question first: what shape does
            this code really need right now—fixed-size value, borrowed view, or owned growable buffer?
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Is the length part of the invariant, or only a runtime fact?</li>
              <li>Does the algorithm need ownership, or only a contiguous borrowed view?</li>
              <li>If ownership is required, will the buffer grow enough that capacity planning matters?</li>
              <li>If tiny hot collections dominate, do the measurements justify an inline-first representation?</li>
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
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Vec&lt;T&gt;</code> internals
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A vector is a small owner value that manages a heap buffer plus two counters: length and capacity. The
                  elements live contiguously in the owned buffer. Moving the vector value moves ownership of the buffer; it
                  does not itself imply moving all elements at that moment.
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

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout: translating prior instincts</h4>
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
            <h3 className="text-lg font-semibold text-foreground">Worked examples</h3>
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
            <li>`Vec<T>` is an owner of contiguous storage with separate logical length and allocation capacity.</li>
            <li>Slice-first APIs are usually the most flexible and honest public contract for contiguous read or write algorithms.</li>
            <li>Preallocation helps when the bound is real. Exact growth strategy is not something production code should assume.</li>
            <li>Contiguous storage buys locality for scans and batch work, but middle insertions, stable-address needs, and inline-first tricks all carry tradeoffs.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
````

### File: `components/rust-book/pages/page-ch10-arrays-slices-and-vectors-exercises.tsx`
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
    title: "Choose array, slice, vector, or inline-first storage from the workload",
    objective: "Practice selecting the right contiguous-storage tool from semantics rather than habit.",
    starterPrompt:
      "Choose a representation for each case: a 16-byte protocol header, a read-only checksum helper, a dynamically accumulated retry batch, and a tiny hot list of usually three tags.",
    prompts: [
      "Which case has compile-time fixed length as part of the invariant?",
      "Which case only needs a borrowed view?",
      "Which case truly needs owned growth?",
      "Which case might justify an inline-first representation only after profiling?",
    ],
    acceptanceCriteria: [
      "You choose `[T; N]` for the semantically fixed-size case.",
      "You choose `&[T]` or `&mut [T]` for the borrowed-algorithm case.",
      "You choose `Vec<T>` for the owned growable batch.",
      "You treat inline-first storage as conditional on measurement rather than as a default style choice.",
    ],
    hints: [
      "Start with ownership and size invariants before talking about performance.",
      "A good answer separates API shape from storage shape.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read `len` and `capacity` operationally",
    objective: "Explain what a vector knows now versus what it can hold before another allocation may be needed.",
    starterPrompt:
      "Review a small helper that builds a `Vec<u64>` with `with_capacity(1024)`, pushes 600 items, and logs both `len()` and `capacity()`.",
    prompts: [
      "What does `len()` tell you exactly?",
      "What does `capacity()` tell you exactly?",
      "Why is `capacity() == 1024` not a portable design assumption for every vector in the system?",
    ],
    acceptanceCriteria: [
      "You explain `len()` as the count of logically present initialized elements.",
      "You explain `capacity()` as allocation budget before the next growth step may be needed.",
      "You explicitly reject using an exact growth factor or exact capacity folklore as a correctness assumption.",
    ],
    hints: [
      "One number is occupancy. The other is allocation slack.",
      "The language contract is not 'trust whatever a blog post said about growth factors.'",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Write the function over slices, not vectors",
    objective: "Design an algorithm around a borrowed contiguous view so callers keep control over storage.",
    starterPrompt:
      "Implement `fn window_sum(values: &[u32]) -> u32` so it sums the provided window and works for both an array subslice and a vector subslice.",
    prompts: [
      "Keep the parameter type exactly as `&[u32]`.",
      "Do not allocate a new vector just to sum.",
      "Use either iterator-style code or a small explicit loop.",
    ],
    acceptanceCriteria: [
      "The function signature stays `fn window_sum(values: &[u32]) -> u32`.",
      "The function returns `54` for `&fixed[2..5]` and `18` for `&dynamic[..3]` in the lab.",
      "The implementation does not require ownership of a `Vec<u32>`.",
    ],
    hints: [
      "The whole point is that callers may have arrays, vectors, or subslices and the function should not care.",
      "A reduction over a slice is usually one line in Rust.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Benchmark preallocation versus push-only growth honestly",
    objective: "Measure whether capacity planning changes your workload enough to matter.",
    starterPrompt:
      "Build a small benchmark harness that pushes the same number of elements into two vectors: one created with `Vec::new()` and one created with `Vec::with_capacity(n)`.",
    prompts: [
      "Run the same workload many times in release mode.",
      "Keep the pushed element type and loop shape identical between the two variants.",
      "Record at least wall-clock timing and final capacity for both runs.",
    ],
    acceptanceCriteria: [
      "Your harness compares the same workload under two allocation strategies.",
      "You run it under conditions that reduce obvious noise, such as repeated iterations and release settings.",
      "You report observations rather than assuming preallocation always matters equally.",
      "You call out one tradeoff: simpler code, allocation count, or realistic workload fidelity.",
    ],
    hints: [
      "A benchmark is only useful if the workload is actually comparable.",
      "Do not confuse a toy microbenchmark with a production decision, but do use it to validate intuition.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Repair a structural-mutation bug without changing the API lie",
    objective: "Fix code that keeps a borrowed slice alive while reshaping the underlying vector.",
    starterPrompt:
      "A helper takes `let hot = &buffer[..4];`, then `buffer.push(99);`, then still reads from `hot`. Refactor the flow without pretending the original borrow should survive structural mutation.",
    prompts: [
      "Can the borrowed work happen earlier?",
      "Should the code copy a tiny fixed header into an array before the push if it truly needs that data later?",
      "Would two phases make the buffer and borrow lifetime easier to review?",
    ],
    acceptanceCriteria: [
      "Your repair ends the active borrow before structural mutation, or copies the tiny truly-needed subset into independent storage deliberately.",
      "You explain the failure in terms of borrowing a view into storage that may change, not in terms of compiler stubbornness.",
      "You do not keep the old slice alive across the vector growth path.",
    ],
    hints: [
      "A slice is a view into existing storage, not a durable reservation of future layout.",
      "If later code really needs a tiny fixed piece, a small copied array may be the honest repair.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose the right contiguous-storage design for three real workloads",
    objective: "Make explicit tradeoffs among fixed shape, borrowed view, owned growth, inline-first storage, and locality.",
    starterPrompt:
      "You are designing three subsystems: a packet parser with fixed headers, a metrics engine that scans rolling numeric windows, and a request pipeline that accumulates retryable jobs.",
    prompts: [
      "Which subsystem wants arrays because the bound is semantically fixed?",
      "Which subsystem wants slice-first APIs because the caller already owns the data?",
      "Which subsystem wants owned vectors and where does preallocation make sense?",
      "Would any subsystem justify an inline-first representation, and what measurement would have to prove it first?",
    ],
    acceptanceCriteria: [
      "You name one concrete representation for each subsystem and justify it with workload shape.",
      "You discuss locality or contiguous scans for at least one subsystem.",
      "You justify at least one preallocation decision with a real upper bound rather than a guess.",
      "You keep inline-first storage as a measured optimization rather than a stylistic preference.",
    ],
    hints: [
      "Do not answer only with type names. Explain the operational reason each choice fits.",
      "A strong answer mentions shape, ownership, mutation, and locality together.",
    ],
  },
]

const reviewQuestions = [
  "When is `[T; N]` the right type rather than `Vec<T>`?",
  "Why is `&[T]` usually a better function parameter than `&Vec<T>`?",
  "What is the practical difference between `len()` and `capacity()`?",
  "Why should production code avoid depending on a specific vector growth factor?",
  "What workload characteristics make contiguous storage especially attractive?",
]

const workingLoop = [
  "State whether the algorithm needs fixed shape, borrowed access, or owned growth.",
  "Write the narrowest honest API shape first, usually `&[T]` or `&mut [T]` for pure algorithms.",
  "If allocation behavior matters, decide whether you have a real upper bound before reaching for preallocation.",
  "If a fancy representation appears, name the measured problem it solves before keeping it.",
]

export function PageCh10ArraysSlicesAndVectorsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 19
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 10 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice the contiguous-storage decisions that shape serious Rust code: fixed arrays, slice-first APIs, vector
          capacity planning, and workload-driven representation choices.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as an API and representation review. The right answer is not “always use slices” or
                “always preallocate.” The right answer is the narrowest honest shape for the workload plus a clear story
                about ownership, locality, and allocation.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(18)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 10
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
                  Storage drill
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
          title="Runnable lab · Slice-first implementation"
          description={
            <>
              Implement{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">window_sum</code> over a slice so the
              same function works for an array window and a vector window. The checker expects the exact signature{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">fn window_sum(values: &[u32]) -&gt; u32</code>.
            </>
          }
          filename="window_sum_lab.rs"
          runKey="ch10_ex_window_sum"
          expectedOutput={"fixed = 54\ndynamic = 18"}
          helperText={
            <>
              Tip: keep the parameter as a slice and sum what you were handed. The caller already decided whether the
              backing storage is an array, a vector, or a subslice of either.
            </>
          }
          initialCode={`fn window_sum(values: &[u32]) -> u32 {\n    values[0]\n}\n\nfn main() {\n    let fixed = [4_u32, 8, 15, 16, 23, 42];\n    let dynamic = vec![3_u32, 6, 9, 12];\n\n    println!("fixed = {}", window_sum(&fixed[2..5]));\n    println!("dynamic = {}", window_sum(&dynamic[..3]));\n}`}
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
            By the end of this page, you should be able to choose among arrays, slices, vectors, and inline-first storage
            from workload shape, write slice-first functions without narrowing callers unnecessarily, and discuss vector
            capacity planning with concrete operational language instead of folklore.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch10_arrays_slices_and_vectors/slice_first_api.rs`
````
fn tail_sum(values: &[u64], take: usize) -> u64 {
    let start = values.len().saturating_sub(take);
    values[start..].iter().copied().sum()
}

fn main() {
    let fixed = [3_u64, 5, 8, 13];
    let dynamic = vec![1_u64, 2, 3, 4, 5, 6];

    println!("fixed tail = {}", tail_sum(&fixed, 2));
    println!("dynamic tail = {}", tail_sum(&dynamic, 3));
}
````

### File: `examples/ch10_arrays_slices_and_vectors/vec_capacity_and_growth.rs`
````
fn collect_even_scaled(ids: &[u32]) -> Vec<u32> {
    let mut out = Vec::with_capacity(ids.len());

    for &id in ids {
        if id % 2 == 0 {
            out.push(id * 10);
        }
    }

    out
}

fn main() {
    let ids = [10_u32, 11, 12, 13, 14];
    let mut out = collect_even_scaled(&ids);

    println!("len = {}", out.len());
    println!("can fit two more = {}", out.len() + 2 <= out.capacity());

    out.extend([200, 220]);
    println!("last = {}", out.last().copied().unwrap());
}
````
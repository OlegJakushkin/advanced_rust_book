"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A matrix is an indexing policy laid over flat storage",
    body: "Rust ships no privileged built-in matrix type, and that absence is the first thing to internalize. What you build instead is a one-dimensional buffer plus a small function that turns a (row, col) pair into a single linear index. The buffer holds the numbers; the indexing function is the matrix. Once you see it that way, every later decision (layout, views, sparsity, interop) is just a variation on how that index is computed and who owns the bytes it points into.",
  },
  {
    title: "Layout is a contract you publish, not an implementation detail",
    body: "Row-major versus column-major is not a presentation choice you can defer. It fixes the address arithmetic, decides which loop order walks memory in a straight line, governs whether the cache and the vectorizer can keep up, and determines whether a foreign library can read your buffer as-is or has to repack it first. Treat the layout the same way you would treat a wire format: state it at the boundary, and never let two pieces of code disagree about it silently.",
  },
  {
    title: "Owners own a buffer; views borrow it with metadata",
    body: "The long-lived dense data should have exactly one owner, almost always a single Vec<T>. Submatrices, tiles, sliding windows, and read-only projections should not be second owners that copy the data; they should borrow the original slice and carry just enough metadata (rows, cols, stride, offset) to reinterpret it. The borrow checker then guarantees no view outlives the buffer it points into, which is the property that makes zero-copy views safe rather than merely fast.",
  },
]

const layoutCards = [
  {
    title: "Row-major",
    formula: "offset = row * cols + col",
    body: "Adjacent elements in the same row are contiguous. This is a natural fit for many Rust loops, image scanlines, and row-oriented batch processing.",
  },
  {
    title: "Column-major",
    formula: "offset = col * rows + row",
    body: "Adjacent elements in the same column are contiguous. This often matters when interoperating with Fortran-style numeric libraries or column-oriented kernels.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The flat-buffer-plus-index pattern is exactly what you already do with std::vector and manual offset math, or what Eigen and BLAS bindings do under the hood, so the storage story transfers cleanly. The shift is that Rust will not let a view quietly outlive its buffer or alias a mutable owner: the lifetime on a borrowed submatrix is checked, not a convention you maintain by hand. Where C++ trusts your discipline at the view and FFI edges, Rust asks you to make that discipline a type.",
  },
  {
    title: "C# background",
    body: "C# multidimensional arrays (T[,]) and jagged arrays (T[][]) both hide their layout consequences behind the runtime, so the cost difference between them is easy to ignore. In Rust the difference is in your face: a Vec<Vec<T>> is visibly a graph of independently allocated owners, while a flat Vec<T> is one buffer. The trap is reaching for nested vectors because they read like a 2-D array, when the dense, cache-friendly thing you actually wanted is the single flat buffer.",
  },
  {
    title: "Go background",
    body: "A Go [][]float64 is comfortable to write, but it is still a slice of independently allocated rows with pointer chasing between them, and the runtime hides that from you. Rust makes the indirection explicit and nudges you toward one flat owner plus shape metadata for dense work. The mental shift is to stop thinking 'slice of rows' and start thinking 'one buffer, computed index,' reserving the slice-of-slices shape for data that is genuinely ragged.",
  },
  {
    title: "Python background",
    body: "Coming from NumPy, the ndarray makes shape, stride, and views feel free and ambient: arr[1:, 2:] hands you a view and you rarely think about who owns the data. Rust pulls all of that into the open. You declare the stride and offset yourself, the borrow checker enforces that a view cannot outlive its buffer, and there is no broadcasting or dtype machinery doing layout work behind the scenes. It is more to spell out, but the layout you depend on is the layout you can read in the code.",
  },
]

const storageCards = [
  {
    title: "Flat Vec<T>: the calm default",
    body: "For dense, runtime-sized matrices, a single Vec<T> is the owner you want. One allocation, contiguous bytes, a length you can check, and a pointer you can hand to a foreign library without copying. Every other dense structure in this chapter is a way of interpreting a buffer that looks like this one underneath.",
  },
  {
    title: "Nested Vec<Vec<T>>: convenient but costly",
    body: "Reaching for a vector of vectors is tempting because the indexing reads like a 2-D array, but it buys you one allocation per row, pointers chased on every row access, rows scattered anywhere on the heap, and no single buffer to pass across an FFI boundary. It earns its place only when rows are genuinely different lengths.",
  },
  {
    title: "Const generics: shape in the type",
    body: "When the dimensions are fixed and part of the invariant (a 4x4 transform, a fixed protocol block), const generics let the type itself carry the size. The compiler then checks the shape, can unroll and inline the fixed loops, and lets one generic kernel serve every concrete N without runtime dimension fields.",
  },
]

const simdNotes = [
  "Keep the hot inner loop unit-stride. Auto-vectorizers and explicit SIMD both prefer a contiguous access pattern.",
  "Avoid `Vec<Vec<T>>` in dense numeric kernels. Pointer chasing and per-row allocation sabotage locality before arithmetic begins.",
  "Consider tiling or blocked layouts when the working set outgrows cache. A flat buffer is still the foundation, but traversal order and block size decide whether locality survives.",
  "Alignment and padding can matter at the boundary, but do not guess. Measure the kernel first, then choose the stricter layout contract only if it pays.",
]

const sparseNotes = [
  {
    title: "COO",
    body: "Coordinate form is simple for construction and ingestion: store `(row, col, value)` triples. It is often the easiest format at the edges of a system.",
  },
  {
    title: "CSR",
    body: "Compressed sparse row is strong when row traversal dominates. Many sparse linear algebra kernels prefer row-grouped structure.",
  },
  {
    title: "CSC",
    body: "Compressed sparse column is the column-oriented sibling. It can be the right boundary when downstream kernels or foreign libraries consume columns efficiently.",
  },
]

const interopNotes = [
  {
    title: "BLAS and LAPACK style boundaries",
    body: "Foreign numeric libraries usually want a pointer, dimensions, leading stride, scalar type, and a layout contract. The Rust side should make that contract explicit before the call, not infer it from hope.",
  },
  {
    title: "CUDA and GPU workflows",
    body: "GPU boundaries are ownership boundaries. Host buffers, device buffers, transfers, and kernel launch layouts should be modeled as explicit stages. Hidden repacking or transposition can dominate runtime if you are careless.",
  },
  {
    title: "Unsafe and FFI proof obligations",
    body: "If the boundary drops to raw pointers or driver APIs, the Rust side must prove contiguity, lifetime, mutability, layout, and ownership transfer rules explicitly. A fast kernel is not a valid reason to leave those invariants implicit.",
  },
  {
    title: "Testing and profiling the boundary",
    body: "Keep a small scalar reference implementation, compare dense and sparse cases against it, and profile copies, packing, and transposition separately from the math kernel itself.",
  },
]

const interopChecklist = [
  "State the layout explicitly: row-major or column-major, plus the stride or leading-dimension rule.",
  "State ownership explicitly: borrowed host slice, owned host buffer, or device-resident allocation.",
  "Validate scalar type, rows, cols, and contiguity assumptions before the foreign call.",
  "Measure packing, transposition, and transfer time separately from kernel execution time.",
  "Keep a scalar reference path or golden test so layout bugs fail as correctness bugs before they become performance mysteries.",
  "If the boundary is unsafe, document the safety invariant at the wrapper site: contiguity, lifetime, aliasing expectations, and who frees what.",
]

const productionPatterns = [
  "Use a flat `Vec<T>` for dense owned storage unless the data is genuinely jagged.",
  "Keep matrix APIs explicit about layout, shape, and stride. Silent layout assumptions become production bugs at interop boundaries.",
  "Borrow views for windows, tiles, and submatrices instead of cloning data into temporary matrices by reflex.",
  "Choose const-generic fixed matrices for truly fixed kernels, transforms, and protocol-sized numeric blocks. Use runtime dimensions for the rest.",
  "Treat sparse format choice as a workload decision: build format, traversal format, and interop format are not always the same thing.",
]

const pitfalls = [
  "Using `Vec<Vec<T>>` for dense numeric work because it looks easy. It often turns one predictable buffer into many heap allocations and worse locality.",
  "Mixing row-major and column-major assumptions at FFI boundaries and only discovering it when results look transposed or scrambled.",
  "Building views that copy data unnecessarily. A view should usually be a borrow plus metadata, not another owner.",
  "Assuming SIMD wins come from syntax alone. Layout, stride, aliasing, and traversal order decide whether the compiler or the kernel has a chance.",
  "Packing or transposing on every call into a foreign library without measuring whether the boundary work dominates the actual computation.",
  "Choosing a sparse format from habit rather than from update pattern, traversal pattern, and downstream kernel behavior.",
]

export function PageCh12MatricesAndMultidimensionalData() {
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
  const pageIndex = getPageIndexById("ch12-matrices-and-multidimensional-data")
  const chapter08PageIndex = getPageIndexById("ch08-undefined-behavior-and-unsafe-rust")
  const chapter10PageIndex = getPageIndexById("ch10-arrays-slices-and-vectors")
  const chapter11PageIndex = getPageIndexById("ch11-hash-maps-and-sets")
  const exercisesPageIndex = getPageIndexById("ch12-matrices-and-multidimensional-data-exercises")

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
          Chapter 12 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Matrix and multidimensional workloads need explicit layout, shape, ownership, and traversal rules. This chapter
          covers dense and sparse representations used for numeric pipelines and accelerator handoff.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 08, 10, and 11</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 08 explained unsafe Rust and FFI proof obligations. Chapter 10 covered contiguous storage and
                slice-first APIs. Chapter 11 covered workload-aware data-structure choice. This chapter applies those same
                instincts to multidimensional numeric and domain data, where layout becomes part of the performance,
                correctness, and interop contract.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter08PageIndex)}>
                Chapter 08
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter10PageIndex)}>
                Chapter 10
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter11PageIndex)}>
                Chapter 11
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Picture a data-processing service that handles three shapes of numeric data at once: dense image grids it
            convolves with a kernel, a recommendation score matrix it slices into per-user windows, and a large mostly-zero
            feature matrix it hands to an accelerator. None of these is well served by the same representation, and the
            expensive failures here are not arithmetic bugs. They are a column-oriented BLAS call fed a row-major buffer, a
            view that copied a megabyte it should have borrowed, or a sparse matrix stored in the format that was cheap to
            build and ruinous to multiply. The job of this chapter is to make layout, ownership, and traversal explicit
            decisions you take on purpose rather than defaults you discover under a profiler.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A reliable design order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Decide whether the data is dense, jagged, or sparse.</li>
              <li>Choose the physical layout before you optimize the arithmetic.</li>
              <li>Choose owned storage for long-lived buffers and borrowed views for windows and tiles.</li>
              <li>Make foreign-library layout assumptions explicit at the boundary, not in a comment after the bug.</li>
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
            <h4 className="font-semibold text-foreground mb-3">Row-major and column-major representations</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: both layouts store the same six logical cells in the same six bytes of memory; the only
              difference is the order. Row-major lays the first row down first, so walking a row is unit-stride and walking
              a column jumps by the row width. Column-major flips that. The diagram below shows the same 2x3 matrix under
              both rules, so you can see why one loop order is contiguous and the other is not.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph L["Logical 2x3 matrix"]\n    direction LR\n    A["(0,0)"] --- B["(0,1)"] --- C["(0,2)"]\n    D["(1,0)"] --- E["(1,1)"] --- F["(1,2)"]\n  end\n  L --> RM["Row-major buffer: (0,0) (0,1) (0,2) (1,0) (1,1) (1,2)"]\n  L --> CM["Column-major buffer: (0,0) (1,0) (0,1) (1,1) (0,2) (1,2)"]`}
              caption="One logical matrix, two linearizations. Row-major keeps each row contiguous; column-major keeps each column contiguous."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {layoutCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.formula}</code>
                  </pre>
                  <p className="mt-3 text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The important operational consequence is not the formula itself. It is which loop order is unit-stride,
                which access pattern is cache-friendly, and which foreign library can consume the buffer without conversion.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {storageCards.map((card) => (
              <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                <h4 className="font-semibold text-foreground mb-3">{card.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Nested vectors and their costs</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The difference between a flat Vec and a Vec of Vecs is not syntax, it is the heap shape. A flat buffer is one
              allocation the CPU can stream through. A nested buffer is an outer array of pointers, each one leading to a
              separately allocated row that can sit anywhere in memory, so every row access pays for an extra hop and the
              locality is gone before any arithmetic begins.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Each row is a separate allocation and a separate owner.</li>
                  <li>Rows need not be adjacent in memory.</li>
                  <li>Jagged shapes are easy, but dense numeric kernels pay with pointer chasing.</li>
                  <li>FFI handoff becomes awkward because there is no single buffer to pass.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  That does not make nested vectors wrong. They are a good fit when row lengths truly differ or when the
                  domain is naturally ragged. They are just not the calm default for dense matrices.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Matrix views and slices</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: a view does not allocate. It points back into the owner&apos;s buffer and carries the
              metadata needed to skip past the rows it does not care about. The lifetime parameter is the part that earns
              its keep: the borrow checker refuses to let the view be used after the buffer is dropped, so a dangling
              submatrix is a compile error rather than a runtime fault.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Owner["Owner: one Vec<T> buffer"] -->|"&'a [T] borrow"| View["MatrixView<br/>rows, cols<br/>stride, offset"]\n  View -->|"offset + row*stride + col"| Cell["element inside<br/>the buffer"]\n  Owner -. "checked: view cannot<br/>outlive owner" .-> View`}
              caption="A view is a borrow plus an index rule. It reads the owner's bytes through stride and offset; the lifetime keeps it from outliving the buffer."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A view usually borrows a slice and carries metadata: rows, cols, stride, and maybe an offset. That lets
                  you describe submatrices, tiles, and windows without copying data into a second owner.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`struct MatrixView<'a, T> {
    data: &'a [T],
    rows: usize,
    cols: usize,
    stride: usize,
    offset: usize,
}`}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  The view does not own the buffer. It interprets borrowed storage under an explicit layout contract.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">SIMD-friendly layouts</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {simdNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Whether you use compiler auto-vectorization, explicit intrinsics, or an ecosystem SIMD abstraction, the
                layout question arrives first. Syntax cannot fix a bad stride pattern.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Sparse matrices</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              When most cells are zero, you stop storing the grid and start storing only the nonzeros plus the structure
              needed to find them. COO is the easy ingestion format, a bag of (row, col, value) triples; CSR and CSC are
              the compressed formats that traverse fast in one direction. The usual lifecycle is to build in COO at the
              edges, then compress into CSR or CSC for the traversal your kernels actually perform.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {sparseNotes.map((note) => (
                <div key={note.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{note.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{note.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A useful rule is to separate build format from execution format. The easiest format to ingest
                is not always the cheapest format to multiply or traverse.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Interoperating with BLAS, LAPACK, CUDA, and HPC libraries
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the cost at a numeric boundary is rarely the math. It is the handoff. Your Rust buffer may
              be the wrong layout, the wrong leading dimension, or in host memory when the kernel wants device memory, and
              every mismatch turns into a repack or a transfer before any arithmetic runs. The diagram lays out the stages
              so you can see where the hidden copies hide and measure them on purpose.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Rust["Rust-owned Vec<T>"] -->|"check layout, stride, type"| Pack["repack if layout differs"]\n  Pack -->|"host to device copy"| Dev["device buffer"]\n  Dev -->|"launch with layout contract"| Kernel["foreign kernel: BLAS / CUDA"]\n  Kernel -->|"results back, copy or transpose"| Rust`}
              caption="Each arrow is a potential copy. The arithmetic is one box; the repacks and transfers around it often dominate the runtime."
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {interopNotes.map((note) => (
                <div key={note.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{note.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{note.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                Be careful with claims of zero-copy interop. A foreign kernel may still require a different layout, leading
                dimension, alignment rule, memory domain, or device residency than your Rust-side buffer currently has.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Interop boundary checklist</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {interopChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                This checklist is deliberately boring. Boring is good here. Most expensive matrix interop bugs come from
                unstated layout or ownership assumptions, not from exotic arithmetic.
              </p>
            </div>
          </div>

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Almost nobody meets Rust matrices as a blank slate. You arrive with a mental model from another ecosystem, and
            the useful question is which part of that model carries over and which part will quietly mislead you. With
            matrices the shift is rarely about API names; it is about who owns the buffer, where the layout contract lives,
            and how much of the indexing and lifetime work the language does for you versus asks you to spell out.
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
                Dense numeric code often looks like “just math,” but the hard bugs and hard performance losses are usually
                layout bugs. Treat layout as a first-class API decision.
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
                  Example 1: row-major{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Matrix&lt;T&gt;</code> over{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;T&gt;</code>
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One contiguous owner, explicit offset calculation, and row views derived from the flat buffer.
                </p>
              </div>
              {codes.matrices_row_major_dense !== DEFAULT_CODES.matrices_row_major_dense && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("matrices_row_major_dense")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: there is one buffer and one place where a (row, col) becomes a linear index, the
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">offset</code>
              method computing
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">row * cols + col</code>.
              Every accessor (<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">get</code>,
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">set</code>,
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">row</code>) routes through it, and
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">row</code> hands back a borrowed
              slice rather than a copy. Trace one cell through the diagram, then read the same path in the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Call["get(0, 2)"] -->|"row, col"| Off["offset = row * cols + col"]\n  Off -->|"= 0 * 3 + 2 = 2"| Idx["data[2]"]\n  Idx --> Val["&30"]\n  Row["row(1)"] -->|"start = 1 * cols"| Slice["&data[3..6] (borrowed)"]`}
              caption="One offset rule feeds every accessor. get returns a borrowed element; row returns a borrowed slice of the same buffer."
            />
            <RustCodeEditor
              code={codes.matrices_row_major_dense}
              onChange={(newCode) => updateCode("matrices_row_major_dense", newCode)}
              onRun={() => runCode("matrices_row_major_dense")}
              output={outputs.matrices_row_major_dense ?? null}
              isRunning={isRunning === "matrices_row_major_dense"}
              filename="row_major_matrix.rs"
              expectedOutput={"last in row0 = 30\nrow1 sum = 15"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.matrices_row_major_dense}
              onRevert={() => resetCode("matrices_row_major_dense")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: change the inserted values or the matrix dimensions and keep the offset logic row-major. The
              exercise is not the printing. It is making the storage contract obvious in code.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Why flat storage works well</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One allocation keeps the matrix contiguous. Row slicing is just range arithmetic over one buffer.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Dense grids, image kernels, tensor-like feature blocks, and FFI handoff all benefit from one explicit
                  owner plus a documented layout policy.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: borrowed matrix view plus const-generic fixed kernel
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A view borrows without copying, while a fixed-size compile-time kernel keeps shape in the type.
                </p>
              </div>
              {codes.matrices_views_const_generics !== DEFAULT_CODES.matrices_views_const_generics && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("matrices_views_const_generics")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: two different ways shape is carried. The
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">MatrixView</code>
              borrows a 12-element backing buffer and uses runtime
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">stride</code> and
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">offset</code> to address a 2x2
              window without copying, so
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">get(1, 1)</code> resolves to index
              5 + 1*4 + 1 = 10, the value 11. The
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">trace</code> function instead takes
              the size as a const-generic
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">N</code> so the shape is fixed at
              compile time. Follow both paths in the diagram before reading the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Buf["backing: 12 elements"] -->|"&'a [T] borrow"| V["MatrixView (stride 4, offset 5)"]\n  V -->|"get(1,1) = 5 + 1*4 + 1"| Idx["data[10] = 11 (no copy)"]\n  Fixed["[[3,1],[2,4]] (owned)"] -->|"trace<const N>"| Tr["sum diagonal 3 + 4 = 7"]`}
              caption="Left path: a borrowed view addresses a window by runtime stride and offset. Right path: a const-generic kernel carries N in the type."
            />
            <RustCodeEditor
              code={codes.matrices_views_const_generics}
              onChange={(newCode) => updateCode("matrices_views_const_generics", newCode)}
              onRun={() => runCode("matrices_views_const_generics")}
              output={outputs.matrices_views_const_generics ?? null}
              isRunning={isRunning === "matrices_views_const_generics"}
              filename="matrix_views_and_const_generics.rs"
              expectedOutput={"view corner = 11\nfixed trace = 7"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.matrices_views_const_generics}
              onRevert={() => resetCode("matrices_views_const_generics")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: change the backing data or the fixed matrix values, then rerun. The useful distinction is that
              the view borrows storage while the fixed kernel carries shape information at compile time.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">View</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The submatrix window is metadata plus a borrowed slice, not a copied dense owner.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Const generics</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The trace helper knows the square size at compile time and works for any fixed `N`.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Interop hint</div>
                <p className="text-xs text-muted-foreground leading-5">
                  View metadata such as stride and offset is exactly the kind of information foreign numeric APIs often need.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch12_matrices_and_multidimensional_data/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to build a row-major matrix wrapper, replace nested vectors with flat
            storage, design a view without copying, and choose among dense, sparse, and foreign-library layouts under
            production constraints.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 12 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>A matrix in Rust is usually explicit storage plus explicit indexing policy, not a built-in abstraction.</li>
            <li>Row-major and column-major layouts change address calculation, traversal cost, and interop correctness.</li>
            <li>
              Dense matrices usually want flat{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;T&gt;</code> storage; nested
              vectors are better for ragged data than for dense numeric kernels.
            </li>
            <li>Const generics help when shape is part of the invariant. Borrowed views help when you need windows without copying.</li>
            <li>SIMD, sparse formats, and foreign-library interop all begin with layout discipline rather than clever syntax.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

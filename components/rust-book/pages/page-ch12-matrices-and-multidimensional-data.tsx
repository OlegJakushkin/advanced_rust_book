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
    title: "A matrix is indexing policy over storage",
    body: "Rust does not have a privileged built-in matrix type. A matrix is usually a dense flat buffer plus shape metadata, or a borrowed view plus layout metadata such as stride and offset.",
  },
  {
    title: "Layout is a contract, not a detail",
    body: "Row-major versus column-major is not presentation. It decides address calculation, cache behavior, SIMD opportunity, and whether foreign libraries can consume your data without repacking.",
  },
  {
    title: "Views should borrow, owners should own",
    body: "Long-lived dense storage usually owns a `Vec<T>`. Lightweight windows, submatrices, and read-only projections should borrow slices and carry only the metadata needed to interpret them.",
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
    body: "If you have used `std::vector<T>` plus manual indexing, Eigen, or BLAS/LAPACK bindings, the storage questions will feel familiar. Rust makes the ownership and borrowing edges much more explicit, especially for views and interop boundaries.",
  },
  {
    title: "C# background",
    body: "C# multi-dimensional arrays and jagged arrays hide some layout consequences behind the runtime. In Rust, a `Vec<Vec<T>>` is explicitly a nested owner graph, not a single flat matrix buffer.",
  },
  {
    title: "Go background",
    body: "Go slices-of-slices are easy to write, but they are still nested indirection. In Rust, dense numeric work usually wants one flat owner plus explicit shape metadata rather than a pile of independently allocated rows.",
  },
]

const storageCards = [
  {
    title: "`Vec<T>` as matrix storage",
    body: "For dense runtime-sized matrices, `Vec<T>` is the default owner. One allocation, contiguous storage, explicit length, and straightforward FFI handoff make it a strong baseline.",
  },
  {
    title: "Nested vectors",
    body: "`Vec<Vec<T>>` is easy to reach for, but it buys you many allocations, pointer chasing, irregular row placement, and awkward foreign-library boundaries. It is a better fit for truly jagged data than for dense matrices.",
  },
  {
    title: "Const generics",
    body: "When dimensions are part of the invariant, const generics let the type carry shape information at compile time. That improves local reasoning and can simplify fixed-kernel code.",
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
            A data-processing service handles image grids, recommendation scores, and sparse feature matrices for
            accelerator handoff. The business requirement is explicit multidimensional layout: dense flat buffers for
            numeric kernels, borrowed views for windows, sparse formats for nonzero-heavy traversal, and documented row or
            column order at every interop boundary.
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

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">How prior instincts translate</h4>
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

"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"

const mentalModelPoints = [
  {
    title: "Most matrix speed comes from layout and reuse, not from a clever operator alone",
    body: "A matrix kernel spends its time walking memory, reusing cache lines, and feeding arithmetic units. If the storage layout and loop order are wrong, the language and hardware barely matter.",
  },
  {
    title: "Dense and sparse are different data models, not just different optimizations",
    body: "A dense row-major buffer and a CSR sparse matrix answer different questions. Dense favors predictable contiguous traversal. Sparse favors skipping zeros and paying metadata only where edges or values actually exist.",
  },
  {
    title: "Parallelism and GPU offload only help after the local boundary is honest",
    body: "If a CPU kernel still thrashes cache or launches one tiny unit at a time, adding Rayon or a GPU often scales the wrong cost. Fix locality and batching first, then widen the execution model.",
  },
]

const storageLayoutCards = [
  {
    title: "Row-major dense storage",
    body: "A flat `Vec<T>` in row-major order is usually the calm default for host-side Rust matrix work. It keeps ownership simple, makes row slices cheap, and gives the CPU a predictable scan order.",
    code: `offset = row * cols + col`,
  },
  {
    title: "Column-major or transposed views",
    body: "Column access over row-major storage is usually strided and cache-hostile. If the algorithm repeatedly walks columns, a transposed copy or a column-major boundary can be the honest fix.",
    code: `b_t[offset = col * rows + row]`,
  },
  {
    title: "Blocked or tiled layout",
    body: "When one kernel repeatedly reuses local tiles, blocked storage can improve locality further than plain row-major. The tradeoff is more complex indexing and more format-specific code.",
    code: `tile -> row block -> col block`,
  },
]

const cacheAwareCards = [
  {
    title: "Loop order matters",
    body: "Naive `i-j-k` multiplication repeatedly walks one row of `A` but often walks one column of `B` in a cache-hostile way. Reordering to `i-k-j` or using a transposed `B` often improves locality before any advanced tuning.",
  },
  {
    title: "Reuse hot values explicitly",
    body: "In a row-major blocked kernel, loading `a[i, k]` once and reusing it across a short `j` tile often matters more than squeezing a tiny amount of syntax out of the loop.",
  },
  {
    title: "Measure cache-aware changes on the same workload",
    body: "A tiled multiply and a transposed-right-hand-side multiply should be compared on the same matrix sizes, the same initialization, and the same release build. Otherwise the result is noise disguised as technique.",
  },
]

const simdCards = [
  {
    title: "Auto-vectorization likes simple tight loops",
    body: "Flat contiguous buffers, predictable bounds, and straight-line arithmetic give LLVM and the backend optimizer their best chance to vectorize automatically.",
  },
  {
    title: "Explicit SIMD is a narrow tool",
    body: "Target-specific intrinsics through stable platform APIs such as `std::arch` can help when profiling proves the kernel is arithmetic-bound and the wrapper isolates CPU feature assumptions cleanly.",
  },
  {
    title: "Do layout work before intrinsic work",
    body: "If the loop still misses cache or reads strided columns from row-major storage, explicit SIMD often just accelerates the wrong memory pattern.",
  },
]

const sparseDenseCards = [
  {
    title: "Dense wins when most cells matter",
    body: "If your matrix is full or nearly full and the kernel touches most values anyway, dense row-major storage avoids metadata overhead and keeps traversal predictable.",
  },
  {
    title: "Sparse wins when zero-skipping dominates",
    body: "CSR, CSC, or coordinate-like formats pay indexing overhead to avoid walking zeros. That tradeoff is worth it when the graph or matrix is genuinely sparse and arithmetic would otherwise be mostly wasted.",
  },
  {
    title: "Pathfinding frontiers often look like sparse matrix work",
    body: "A frontier step over a graph adjacency matrix is really a sparse expansion problem. Modeling it with CSR-style storage often makes the memory budget and traversal cost obvious immediately.",
  },
]

const parallelCards = [
  {
    title: "Parallel matrix operations",
    body: "Wide independent tiles or output rows often parallelize cleanly with Rayon or scoped threads on one host. The key review question is still ownership: who owns the output tile, and when do workers merge?",
  },
  {
    title: "Keep merge cost visible",
    body: "A parallel kernel that writes into one hot shared lock or one atomically contended accumulator usually loses the benefit of the split. Partition outputs so each worker owns a chunk whenever possible.",
  },
  {
    title: "MPI and domain decomposition are different from local threads",
    body: "If the real workload is already cluster-scale, per-rank row or tile partitioning from the MPI chapter is usually the honest outer model, with local thread or SIMD tuning only inside each rank.",
  },
]

const gpuCards = [
  {
    title: "GPU offload pays for dense, regular, large batches",
    body: "Matrix multiply, batched tensor work, and large reductions amortize host-device transfer and launch overhead much better than tiny request-local transforms do.",
  },
  {
    title: "The GPU boundary is still a queue boundary",
    body: "A device is a scarce worker. Bound its queue, own inputs before submission, and make fallback or retry policy explicit just as you would for any other specialist subsystem.",
  },
  {
    title: "Profile transfer, launch, kernel, and sync separately",
    body: "A 2 ms kernel inside a 20 ms end-to-end path is not a 2 ms feature. Queue wait, copy time, and synchronization can dominate the real latency story.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Your instincts about cache lines, loop nests, and SIMD lanes all carry over intact, and that is the good news. The shift is that Rust wants the same flat layout you would hand-tune, but it asks who owns the buffer at every boundary. Wrap any lower-level tuning in a small safe API instead of leaving raw pointers and aliasing assumptions in the open.",
  },
  {
    title: "C# background",
    body: "Stop reaching for an object graph. A matrix here is one contiguous buffer plus a stride formula, not a class with rich runtime identity and a managed heap behind it. The speed comes from deleting the abstraction layer that fights memory layout, not from modeling cells as first-class objects.",
  },
  {
    title: "Go background",
    body: "The natural Go move is a slice-of-slices, and for a dense kernel that is almost always the wrong shape: each row is a separate allocation, so traversal chases pointers and the cache never warms up. Rust pushes you toward one owner plus explicit index math, which is exactly the contiguous layout a cache-aware or SIMD-friendly kernel needs.",
  },
  {
    title: "Python background",
    body: "In NumPy the fast path is hidden: as long as you stay in vectorized array ops, C and BLAS do the real work for you. In Rust you are the BLAS. Writing the loop yourself means you also own the layout, the loop order, and the tiling decisions that NumPy made on your behalf, so the cache and SIMD reasoning becomes your job rather than the library's.",
  },
]

const challengeTracks = [
  {
    title: "Challenge: optimize matrix multiplication",
    score: "Correctness 40 · Speed 25 · Cache story 20 · Profiling notes 15",
    body: "Start from one correct naive dense multiply. Add tiling, consider a transposed right-hand side, and report both the speedup and the memory-locality explanation.",
    extensions: [
      "Compare `i-j-k` against `i-k-j` before adding tiling.",
      "Add a serial baseline, a tiled CPU variant, and a parallel tiled variant.",
      "Track checksum equality so optimization never outruns correctness.",
    ],
  },
  {
    title: "Challenge: sparse pathfinding matrix",
    score: "Representation 30 · Correct frontier step 30 · Memory budget 20 · Evidence 20",
    body: "Model one graph frontier step as sparse matrix expansion. Choose dense or CSR honestly, then justify the choice in terms of nonzero count, bytes, and queueable ownership.",
    extensions: [
      "Render frontier width over several steps.",
      "Compare dense bytes against sparse payload bytes explicitly.",
      "Add duplicate suppression if the frontier goes parallel or distributed.",
    ],
  },
  {
    title: "Challenge: CPU vs GPU benchmark tournament",
    score: "Fair benchmark 25 · Batch sweep 25 · Transfer accounting 25 · Recommendation 25",
    body: "Run the same workload across CPU, parallel CPU, and GPU candidates. The point is not crown-a-winner theater. The point is to find the break-even size and the real boundary cost.",
    extensions: [
      "Plot or tabulate batch size versus wall time.",
      "Separate queue wait, transfer, launch, kernel, and sync time.",
      "Add a 'stay on CPU' recommendation for small batches if the numbers justify it.",
    ],
  },
]

const productionPatterns = [
  "Keep dense matrices flat and contiguous on the host side unless the algorithm truly demands another layout.",
  "Choose sparse storage only when zero-skipping and metadata economics beat dense scanning in the real workload.",
  "Treat tiling as both a cache policy and an ownership policy: each worker should own a tile or output chunk when parallelism enters the design.",
  "Benchmark naive, tiled, parallel, and offloaded variants under the same data sizes and the same release build.",
  "Profile matrix work at several layers: cache-aware CPU loop, thread or worker merge cost, and device queue or transfer cost if a GPU is involved.",
  "Use direct SIMD or GPU-specific tuning only after layout, loop order, and batching are already honest.",
]

const pitfalls = [
  "Using `Vec<Vec<T>>` for dense matrix kernels and then spending the rest of the project compensating for pointer indirection and poor locality.",
  "Calling a matrix sparse because it sounds advanced, even though the kernel still touches most cells and now pays needless metadata cost.",
  "Adding threads before fixing tile ownership, then serializing the whole gain back through one hot merge or shared output lock.",
  "Offloading tiny matrices to the GPU because one isolated kernel benchmark looked impressive while transfer and launch dominated the service path.",
  "Talking about SIMD before proving the loop is already contiguous, straight-line, and arithmetic-heavy enough to benefit.",
]

const summaryPoints = [
  "Matrix performance begins with storage layout and loop order.",
  "Cache-aware multiplication usually means row-major honesty, reuse of hot values, and blocking or tiling where the workload is large enough.",
  "SIMD helps most after the memory pattern is already good.",
  "Sparse and dense matrices are different workload models, not merely different tuning modes.",
  "Parallel CPU work and GPU offload only pay when ownership, batching, and merge cost are already explicit.",
  "A fair matrix tournament compares correctness, wall time, and operational evidence, not only one fastest micro-kernel number.",
]

export function PageCh40MatrixOptimizationGames() {
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
  const pageIndex = getPageIndexById("ch40-matrix-optimization-games")
  const chapter12PageIndex = getPageIndexById("ch12-matrices-and-multidimensional-data")
  const chapter22PageIndex = getPageIndexById("ch22-multithreading-in-rust")
  const chapter26PageIndex = getPageIndexById("ch26-task-libraries-and-parallel-execution")
  const chapter32PageIndex = getPageIndexById("ch32-mpi-and-high-performance-computing")
  const chapter33PageIndex = getPageIndexById("ch33-performance-oriented-rust")
  const chapter37PageIndex = getPageIndexById("ch37-cuda-and-gpu-acceleration")
  const exercisesPageIndex = getPageIndexById("ch40-matrix-optimization-games-exercises")
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
          Chapter 40 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Matrix optimization depends on layout, tiling, sparsity, SIMD, thread budgets, and accelerator boundaries. This
          chapter turns those factors into measurable Rust implementation choices.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 12, 22, 26, 32, 33, and 37</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 12 established dense matrix layout and views. Chapter 22 covered threads and ownership across
                them. Chapter 26 covered pools and bounded work orchestration. Chapter 32 covered MPI and HPC partitioning.
                Chapter 33 covered performance-oriented Rust more broadly. Chapter 37 covered GPU boundaries and transfer
                budgeting.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter12PageIndex)}>
                Chapter 12
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter22PageIndex)}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter26PageIndex)}>
                Chapter 26
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter32PageIndex)}>
                Chapter 32
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter33PageIndex)}>
                Chapter 33
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter37PageIndex)}>
                Chapter 37
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Three teams land on the same desk in the same week. One owns a batch scoring service whose hot path is a dense
            matrix multiply. One owns a route planner whose graph is mostly empty space. One owns a research spike that
            wants to put everything on a GPU. Each team has a story about why their workload is slow and what would make
            it fast, and each story is plausible. The work here is to replace those stories with measurements, in an order
            that does not waste effort.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            That order matters more than any single trick. The mistake repeated across all three teams is reaching for the
            most exciting lever first: SIMD intrinsics, a thread pool, a GPU. Those levers can all help, but only after
            the storage layout and the loop order are honest. A clever kernel built on a cache-hostile layout just makes
            the wrong memory pattern run faster. So the chapter walks the levers in the order that actually pays off, and
            insists that every step prove itself against the same workload and the same release build.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Read the pipeline below from left to right. Each stage is cheaper to get right than the one after it, and
              each later stage assumes the earlier ones are already settled. You almost never need to reach the GPU stage,
              and when you do, you want to arrive there with the layout question already answered.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  L[Pick storage layout] --> O[Fix loop order and reuse]\n  O --> T[Add tiling]\n  T --> P[Parallel CPU]\n  P --> G[GPU offload]\n  O -. measure each step .-> M[(same workload\\nsame release build)]\n  T -.-> M\n  P -.-> M\n  G -.-> M`}
              caption="Optimize in cost order: layout first, accelerator last, and measure every stage against one fixed workload."
            />
            <ol className="mt-4 space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Choose dense row-major, column-oriented, blocked, or sparse storage from actual access pattern.</li>
              <li>Fix loop order and reuse before widening the execution model.</li>
              <li>Introduce tiles before threads, and bounded work before a shared accelerator.</li>
              <li>Compare CPU, parallel CPU, and GPU on one benchmark plan instead of on three stories.</li>
            </ol>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Start with storage layout and loop order before you talk about threads, SIMD, or GPUs.</li>
              <li>Dense and sparse matrices are different workload models, not merely different optimization flavors.</li>
              <li>Tiling is both a cache policy and an ownership policy for parallel work.</li>
              <li>A fair CPU-versus-GPU comparison publishes transfer and launch costs, not only kernel time.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Optimization order</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>What is the real inner-loop access pattern?</li>
              <li>Does the workload want row-major dense storage, blocked storage, or a sparse format?</li>
              <li>Can each worker own an output tile without a hot shared merge?</li>
              <li>Which signal proves the next change mattered: wall time, cache misses, bytes moved, or queue wait?</li>
            </ul>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Before any specific technique, three ideas frame the whole chapter. They explain why the optimization order is
            what it is: speed lives in how memory is laid out and reused, dense and sparse are genuinely different problems,
            and the wide execution models only help once the local boundary is already honest.
          </p>
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
            <h4 className="font-semibold text-foreground mb-3">Matrix storage layouts</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A matrix is a two-dimensional idea, but memory is one-dimensional. Every layout is really a rule for
              flattening rows and columns into a single contiguous run of bytes, and the rule you pick decides which
              traversals are cheap. Row-major storage lays each row down end to end, so walking a row is a straight,
              cache-friendly scan and walking a column jumps by a full row width on every step. The diagram below shows
              that flattening for a small matrix; keep it in mind whenever you reason about which loop is the fast one.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph LV["Logical view"]\n    R0["row 0: a b c"]\n    R1["row 1: d e f"]\n  end\n  subgraph MEM["Memory, row-major"]\n    M["a b c d e f"]\n  end\n  R0 --> M\n  R1 --> M\n  M --> Idx["offset = row * cols + col"]`}
              caption="Row-major flattens rows back to back; the index formula is the bridge between the 2D view and the 1D buffer."
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {storageLayoutCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Cache-aware multiplication</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Matrix multiply does the same arithmetic no matter how you nest the loops, but the three loop indices
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">i</code>,
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">j</code>, and
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">k</code> can be ordered six ways,
              and the order decides how memory is touched. With row-major storage the classic
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">i-j-k</code> order walks
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">B</code> down a column in the inner
              loop, which strides across whole rows and defeats the cache. Swapping to
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">i-k-j</code> makes the inner loop
              sweep a row of <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">B</code> contiguously
              while a single scalar from <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">A</code>
              stays hot. Same result, far fewer cache misses. The diagram contrasts the two inner-loop access patterns.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  IJK["i-j-k order: inner loop varies k"] --> Bcol["B walked down a column\\nstrided, cache-hostile"]`}
              caption="Slow order: the i-j-k nesting walks B down a column in the inner loop, striding across whole rows."
            />
            <p className="text-sm text-muted-foreground leading-6">Reordering to i-k-j keeps the same arithmetic but changes which way the inner loop walks B:</p>
            <MermaidDiagram
              chart={`flowchart TD\n  IKJ["i-k-j order: inner loop varies j"] --> Brow["B walked along a row\\ncontiguous, cache-friendly"]\n  IKJ --> Areuse["a[i,k] held in a register"]`}
              caption="Fast order: the i-k-j nesting sweeps a row of B contiguously while a scalar of A stays hot in a register."
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {cacheAwareCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A reliable first upgrade is often embarrassingly simple: stop walking columns of a row-major right-hand
                matrix in the innermost loop. Even before tiling, that change can move the cache story in your favor.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">SIMD opportunities</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              SIMD lets one instruction multiply or add several values at once, which is exactly the shape of the inner
              dot-product loop. But the compiler can only vectorize what it can prove is safe and regular, and you can
              only reach for intrinsics productively once the data is already contiguous. So treat SIMD as the last layer,
              not the first. In most kernels the auto-vectorizer does the work for free if you feed it a flat buffer and a
              tight loop; explicit intrinsics earn their complexity only after profiling shows the loop is genuinely
              arithmetic-bound. The snippet below is the kind of inner loop that vectorizes well: contiguous loads, a fixed
              trip count, and no branchy noise.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {simdCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`// conceptually good SIMD territory:
// contiguous loads, fixed-width inner loop, low branch noise
for k in 0..tile_width {
    acc += a_row[k] * b_col[k];
}`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Sparse vs dense matrices</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Dense and sparse are not two tuning settings on the same matrix; they are two different data models that
              answer different questions. A dense matrix stores every cell, including the zeros, and pays for that with
              predictable contiguous traversal. A sparse matrix stores only the nonzero values plus enough index metadata
              to find them, trading random-access simplicity for the ability to skip empty space entirely. The most common
              sparse format, compressed sparse row (CSR), encodes the whole matrix as three flat arrays: the nonzero
              values, the column index of each value, and a per-row pointer that says where each row begins in those
              arrays. The diagram shows how those three arrays relate, and why iterating one row is just slicing between two
              row pointers.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Mat["sparse matrix\\nmost cells are zero"] --> V["values:\\nnonzero entries"]\n  Mat --> C["col_index:\\ncolumn of each value"]\n  Mat --> R["row_ptr:\\nwhere each row starts"]\n  R --> Slice["row i =\\nvalues between\\nrow_ptr[i] and row_ptr[i+1]"]\n  C --> Slice`}
              caption="CSR is three flat arrays; a row is the slice of values and columns between two consecutive row pointers."
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {sparseDenseCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Blocking and tiling</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Blocking turns one large multiply into many smaller reuse-friendly subproblems. The common host-side shape
              is tile loops over <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">ii</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">kk</code>, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">jj</code>, then short inner loops that
              keep one tile of <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">A</code> hot while
              updating one tile of <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">C</code>.
            </p>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">What tiling buys</div>
                <p className="text-sm text-muted-foreground leading-6">
                  Better cache reuse, fewer cold misses on reused blocks, and a natural parallel work unit.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">What tiling costs</div>
                <p className="text-sm text-muted-foreground leading-6">
                  More indexing logic, more tuning surface, and more sensitivity to matrix size and cache shape.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">When to stop</div>
                <p className="text-sm text-muted-foreground leading-6">
                  If the matrices are tiny or the service is dominated by queueing or serialization, tiling may not move
                  the real wall-clock story enough to matter.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Parallel matrix operations</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Matrix multiply parallelizes well because the output cells are independent: nothing in computing
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">C[i, j]</code> depends on any other
              cell of <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">C</code>. That independence is
              the whole opportunity, and the way to keep it is to partition the output so each worker owns a disjoint set
              of rows or tiles and writes only there. The moment workers share a write target through a lock or a
              contended accumulator, you serialize the gain back out. In Rust this is the same ownership question from the
              earlier chapters, just applied to a buffer: hand each worker its own slice of the output and the merge cost
              disappears. The diagram shows the clean split.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  C["output matrix C"] --> S0["rows 0..n\\nworker 0"]\n  C --> S1["rows n..2n\\nworker 1"]\n  C --> S2["rows 2n..3n\\nworker 2"]\n  S0 --> Done["join,\\nno shared lock"]\n  S1 --> Done\n  S2 --> Done`}
              caption="Partition the output by rows so each worker owns its slice; joining needs no shared lock or contended accumulator."
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {parallelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">GPU offload</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A GPU does not run your kernel in isolation; it sits at the far end of a queue with a copy bus in between.
              The end-to-end cost of an offload is the sum of waiting for the device, copying inputs across the bus,
              launching the kernel, running it, and copying results back. A 2 ms kernel wrapped in 18 ms of transfer and
              synchronization is an 18 ms feature, not a 2 ms one. That is why a kernel benchmark in isolation is so
              misleading and why the only honest comparison measures each segment separately. The sequence below traces a
              single offload so you can see where the time actually goes.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant Host\n  participant Queue\n  participant GPU\n  Host->>Queue: submit work\n  Note over Host,Queue: queue wait\n  Host->>GPU: copy inputs (transfer in)\n  Host->>GPU: launch kernel\n  GPU->>GPU: run kernel\n  GPU-->>Host: copy results (transfer out)\n  Host->>Host: synchronize`}
              caption="Kernel time is one slice of the path; queue wait, transfers, and synchronization often dominate the real latency."
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {gpuCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The fastest matrix kernel can still lose the product decision if the path is admission-bound or
                transfer-bound. The break-even size is usually a service fact, not a whiteboard fact.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">How to think about this coming from another language</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Every language you have used already made a layout decision for matrices, usually without telling you. The
              useful question is not which crate replaces which library. It is what mental habit each background brings,
              which of those habits help here, and which one quietly produces the wrong memory layout if you let it run on
              autopilot.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
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
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Optimization games and challenge tracks</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Each track is scored, because the point is not to chase one fastest number but to defend a decision with
            evidence. The scoring weights reward the parts that engineers most often skip: a clear cache story, an honest
            memory budget, and benchmark accounting that separates queue wait from transfer from kernel time. Treat the
            extension lists as ways to make the comparison fairer, not as feature checklists.
          </p>
          <div className="grid gap-4 lg:grid-cols-3">
            {challengeTracks.map((track) => (
              <div key={track.title} className="rounded-xl border border-border bg-card p-5">
                <div className="font-semibold text-foreground mb-2">{track.title}</div>
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-3">{track.score}</div>
                <p className="text-sm text-muted-foreground leading-6">{track.body}</p>
                <div className="mt-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Extension track</div>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                    {track.extensions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
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
                In matrix work, the most expensive mistake is often skipping the layout review and jumping straight to the
                accelerator review.
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
                <h4 className="font-semibold text-foreground">Example 1: row-major dense multiplication with tiling</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The example keeps the owner flat, compares one naive multiply against one tiled multiply, and prints one
                  deterministic cell plus a checksum so correctness stays visible while tuning.
                </p>
              </div>
              {codes.matrix_games_tiled_matmul !== DEFAULT_CODES.matrix_games_tiled_matmul && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("matrix_games_tiled_matmul")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <div className="mb-3 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                What to look at: the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Matrix</code>
                struct stores one flat <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;f32&gt;</code>
                with the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">offset = row * cols + col</code>
                formula doing all the 2D-to-1D translation. Then compare the two kernels.
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">matmul_naive</code> is the plain
                triple loop. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">matmul_tiled</code>
                wraps the same arithmetic in outer
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">ii</code> /
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">kk</code> /
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">jj</code> tile loops, then runs
                short inner loops inside each tile so a block of data stays hot in cache. The diagram shows that nesting;
                the key check is that <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">approx_eq</code>
                still prints <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">true</code>, meaning the
                tiling changed locality without changing the result.
              </p>
            </div>
            <MermaidDiagram
              chart={`flowchart TD\n  II["outer: ii tile of rows"] --> KK["outer: kk tile of A cols"]\n  KK --> JJ["outer: jj tile of C cols"]\n  JJ --> Inner["inner i,k,j loops over one tile"]\n  Inner --> Hot["a[i,k] reused across the j tile"]\n  Inner --> Same["same sums as naive, just reordered"]`}
              caption="Tiling adds three outer loops that carve the work into cache-sized blocks; the inner loops do the identical arithmetic."
            />
            <RustCodeEditor
              code={codes.matrix_games_tiled_matmul}
              onChange={(newCode) => updateCode("matrix_games_tiled_matmul", newCode)}
              onRun={() => runCode("matrix_games_tiled_matmul")}
              output={outputs.matrix_games_tiled_matmul ?? null}
              isRunning={isRunning === "matrix_games_tiled_matmul"}
              filename="row_major_tiled_matmul.rs"
              expectedOutput={"naive == tiled = true\nc[1,2] = 6.00\nchecksum = 55.00"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.matrix_games_tiled_matmul}
              onRevert={() => resetCode("matrix_games_tiled_matmul")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Storage</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One flat row-major owner keeps cache reasoning and serialization simple.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tiling</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Tile loops turn a large multiply into reuse-friendly subproblems without changing correctness.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Verification</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Printing equality and checksum keeps optimization grounded in identical results.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: sparse frontier expansion with CSR</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This turns a pathfinding-style frontier step into explicit sparse matrix traversal and prints the dense
                  byte budget for comparison.
                </p>
              </div>
              {codes.matrix_games_sparse_frontier !== DEFAULT_CODES.matrix_games_sparse_frontier && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("matrix_games_sparse_frontier")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <div className="mb-3 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                What to look at: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">advance_frontier</code>
                is one breadth-first expansion step expressed as a sparse matrix-vector product. It walks only the rows that
                are currently active in the frontier, and for each one it reads the slice
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">indptr[row]..indptr[row + 1]</code>
                to find that row's outgoing edges, marking each reachable column in the next frontier. Crucially it never
                touches a zero cell, so the cost scales with the number of edges, not with rows times columns. The
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">dense_bytes</code> print exists to
                make the tradeoff concrete: the CSR payload here is a handful of values while the equivalent dense matrix
                would reserve every cell. The diagram traces that per-row skip-and-expand loop.
              </p>
            </div>
            <MermaidDiagram
              chart={`flowchart TD\n  Start["for each row in frontier"] --> Active{"row active?"}\n  Active -->|no| Skip["skip, touch nothing"]\n  Active -->|yes| Edges["slice indptr[row]..indptr[row+1]"]\n  Edges --> Mark["mark reachable columns in next"]\n  Mark --> Start\n  Skip --> Start`}
              caption="The frontier step visits only active rows and only their stored edges, so work scales with edges rather than total cells."
            />
            <RustCodeEditor
              code={codes.matrix_games_sparse_frontier}
              onChange={(newCode) => updateCode("matrix_games_sparse_frontier", newCode)}
              onRun={() => runCode("matrix_games_sparse_frontier")}
              output={outputs.matrix_games_sparse_frontier ?? null}
              isRunning={isRunning === "matrix_games_sparse_frontier"}
              filename="sparse_frontier_csr.rs"
              expectedOutput={"nnz = 6\nnext frontier = 0,1,1,1,1\ndense bytes = 100"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.matrix_games_sparse_frontier}
              onRevert={() => resetCode("matrix_games_sparse_frontier")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Sparse shape</div>
                <p className="text-xs text-muted-foreground leading-5">
                  CSR pays metadata to skip zeros and to touch only active outgoing edges.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Graph translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One frontier step over an adjacency matrix is often really sparse pathfinding work in disguise.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Budgeting</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Printing dense bytes beside nonzero count makes the representation tradeoff reviewable quickly.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch40_matrix_optimization_games/
              </code>{" "}
              including a small CPU-versus-GPU tournament scoreboard sketch alongside the two in-browser worked examples.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to implement naive and tiled multiplication variants, choose sparse or
            dense representations deliberately, and design a fair CPU-versus-GPU benchmark tournament with explicit
            scoring rules.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 40 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {summaryPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

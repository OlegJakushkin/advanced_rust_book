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
    body: "You may already think in cache lines, loop nests, and SIMD lanes. Rust's main correction is ownership and boundary honesty: flat storage by default, explicit sparse formats, and a small safe wrapper around any lower-level tuning.",
  },
  {
    title: "C# background",
    body: "Think less in terms of object graphs and more in terms of contiguous buffers. The performance win comes from removing abstraction that fights layout, not from recreating matrix objects with rich runtime identity.",
  },
  {
    title: "Go background",
    body: "A slice-of-slices matrix is easy to write but often the wrong dense layout. Rust nudges you toward one owner plus explicit indexing, which is exactly what cache-aware and SIMD-friendly kernels usually want.",
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
          Matrix work is where Rust, cache behavior, SIMD, sparse formats, thread budgets, and GPU boundaries all stop
          being separate topics and become one performance review.
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
            You are reviewing one batch service that does dense scoring, one route planner that behaves like sparse
            frontier expansion, and one research path that wants a GPU only when batch size grows past a real break-even
            point. The wrong move is to argue from slogans like “SIMD all the things” or “put it on the GPU.” The right
            move is to ask three boring questions first: how is the matrix stored, how is it walked, and how often does
            the system cross ownership or device boundaries?
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
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
            <div className="grid gap-4 lg:grid-cols-3">
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
            <div className="grid gap-4 lg:grid-cols-3">
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
            <div className="grid gap-4 lg:grid-cols-3">
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
            <div className="grid gap-4 lg:grid-cols-3">
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
            <div className="grid gap-4 lg:grid-cols-3">
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
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
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
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Optimization games and challenge tracks</h3>
          </div>
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
            <h3 className="text-lg font-semibold text-foreground">Worked examples</h3>
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
````

### File: `components/rust-book/pages/page-ch40-matrix-optimization-games-exercises.tsx`
```tsx
"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
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
    title: "Choose row-major, blocked, CSR, or dense-matrix representation from the workload",
    objective: "Practice selecting the matrix shape that matches the real traversal and sparsity profile instead of defaulting to whatever was easiest to write first.",
    starterPrompt:
      "Classify four cases: a dense batch GEMM on one node, a graph frontier step over mostly empty adjacency, a tiny fixed 4x4 transform matrix, and a service path that repeatedly multiplies one matrix by many vectors from the same hot cache footprint.",
    prompts: [
      "Which case wants ordinary row-major dense storage?",
      "Which case wants CSR or another sparse format because zero-skipping is the whole point?",
      "Which case may justify blocked storage because tile reuse dominates?",
      "Which case can stay simple because the matrix is tiny and fixed-shape?",
    ],
    acceptanceCriteria: [
      "You choose at least one dense case and one sparse case with a concrete reason.",
      "You distinguish sparsity from size: tiny and dense is not the same thing as sparse.",
      "You mention at least one locality or metadata tradeoff explicitly.",
    ],
    hints: [
      "Start from what the inner loop actually touches.",
      "If most values are zeros and the algorithm can skip them, that is usually sparse territory.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read a cache-hostile multiplication loop like a profiler",
    objective: "Explain why one multiplication variant is memory-unfriendly before you even talk about SIMD or GPU offload.",
    starterPrompt:
      "Compare one naive `for i { for j { for k { ... } } }` row-major multiply against one tiled multiply that keeps `a[i, k]` hot across a short `j` range.",
    prompts: [
      "Which loop order repeatedly walks columns of the right-hand matrix in a cache-hostile way?",
      "How does tiling improve reuse of one loaded `a[i, k]` value?",
      "Why is this still a CPU-layout question before it becomes a thread or GPU question?",
      "What metric or profile signal would you inspect next?",
    ],
    acceptanceCriteria: [
      "You identify at least one loop-order locality problem concretely.",
      "You explain one specific reuse win from tiling.",
      "You mention at least one follow-up measurement such as cache misses, wall time, or bytes moved.",
    ],
    hints: [
      "Think in rows and cache lines, not only in algebra.",
      "The right answer sounds like a memory story, not like a syntax story.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement naive and tiled matrix multiplication variants",
    objective: "Write one correct baseline and one blocked variant so correctness is stable while locality changes.",
    starterPrompt:
      "Implement `matmul_naive` and `matmul_tiled` over one flat row-major matrix owner. Compare their outputs on the same input and print one deterministic cell and equality flag.",
    prompts: [
      "Keep the matrix owner as one `Vec<f32>` plus `rows` and `cols`.",
      "Use a tile size parameter for the blocked variant.",
      "Do not use pointer-like references between cells or rows.",
      "Verify equality before claiming the tiled version is correct.",
    ],
    acceptanceCriteria: [
      "Both variants produce the same matrix on the same input.",
      "The tiled version walks work in visible tile bands rather than only calling the naive function again.",
      "The runnable lab prints the expected equality flag and output cell.",
      "The implementation remains small enough to review without unsafe code.",
    ],
    hints: [
      "A flat owner plus `offset(row, col)` is enough.",
      "Tile loops usually step over `ii`, `kk`, and `jj` outside the smaller inner loops.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a sparse pathfinding matrix that stayed dense too long",
    objective: "Replace a dense adjacency matrix with a sparse representation once the edge pattern and memory budget make the dense model dishonest.",
    starterPrompt:
      "You inherit a pathfinding step that stores a 20,000-node graph as a dense adjacency matrix even though each node has only a handful of outgoing edges.",
    prompts: [
      "What makes the dense representation wasteful here?",
      "Which sparse representation would you try first for frontier expansion?",
      "What API surface should stay stable even after the storage model changes?",
      "Which metric would prove the refactor mattered?",
    ],
    acceptanceCriteria: [
      "You explain the dense-memory cost in terms of node count squared or equivalent scale pressure.",
      "You choose one sparse representation and tie it to the frontier workload.",
      "You mention one stable outer API boundary and one after-the-fix measurement.",
    ],
    hints: [
      "The algorithm did not become sparse only after the rewrite. The data was already sparse.",
      "A stable outer API lets the storage repair stay local.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Repair a benchmark that lies about CPU versus GPU performance",
    objective: "Design a fair comparison so the tournament measures the same logical work and the real boundary costs.",
    starterPrompt:
      "A team benchmark launches one tiny GPU kernel per request item, compares it against one batched CPU loop, and reports 'GPU slower' as a universal conclusion.",
    prompts: [
      "What makes the comparison unfair already?",
      "Which dimensions should the benchmark sweep: batch size, transfer size, launch count, or all three?",
      "Which result would justify 'stay on CPU' for one service path without declaring GPU offload universally bad?",
      "What should be recorded separately: transfer, queue wait, launch, kernel, sync?",
    ],
    acceptanceCriteria: [
      "You name at least two fairness problems in the original benchmark.",
      "You propose at least one batch-size sweep or launch-count repair.",
      "You explain one workload-specific reason to stay on CPU even when a large batch GPU path still wins elsewhere.",
      "You record at least three boundary cost categories explicitly.",
    ],
    hints: [
      "A fair tournament compares the same logical work, not different batching policies disguised as different hardware.",
      "The break-even point is often the real result.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design the CPU versus GPU benchmark tournament with scoring rules",
    objective: "Turn the chapter topics into a production-shaped evaluation plan that another team could run and audit.",
    starterPrompt:
      "Create a tournament for `dense multiply`, `sparse frontier step`, and `batched scorer` paths across plain CPU, parallel CPU, and optional GPU implementations.",
    prompts: [
      "Which scoring categories belong in the tournament: correctness, wall time, memory traffic, explanation quality, reproducibility?",
      "What input classes should every contestant run: tiny, medium, and large batches?",
      "Which outputs must every contestant publish for review?",
      "What extension track would you add for distributed or MPI-backed variants?",
    ],
    acceptanceCriteria: [
      "You define explicit scoring rules or weights for the tournament.",
      "You include at least three input-size classes and a reproducibility rule.",
      "You require correctness evidence before performance points count.",
      "You include one extension or bonus track for sparse or distributed variants.",
    ],
    hints: [
      "A good tournament rewards evidence, not only a single fastest number.",
      "Correctness has to score first or the rest is theater.",
    ],
  },
]

const reviewQuestions = [
  "Why is row-major dense storage such a strong default for host-side matrix work?",
  "What does tiling repair that loop-order-only changes may not fully repair?",
  "Why are sparse and dense matrices different workload models rather than different flavors of the same owner?",
  "What makes a SIMD discussion premature?",
  "Why should CPU versus GPU comparisons publish transfer and launch cost separately from kernel cost?",
]

const workingLoop = [
  "State the storage layout first: dense row-major, blocked, or sparse.",
  "State the traversal second: loop order, reuse pattern, and frontier behavior.",
  "Implement one correct baseline before the optimized variant.",
  "Measure with the same inputs and the same output checks across all contenders.",
  "Only then decide whether the path should stay local, go parallel, or go to an accelerator.",
]

const benchmarkTournamentRules = [
  "Correctness is mandatory: any wrong checksum, wrong path frontier, or wrong output matrix scores zero on speed.",
  "Benchmark classes must include at least tiny, medium, and large inputs so break-even behavior stays visible.",
  "Every run must publish wall time plus at least one ownership or boundary metric, such as bytes copied or launch count.",
  "GPU entries must report transfer, launch, kernel, and sync separately.",
  "Parallel CPU entries must report thread count or worker budget explicitly.",
]

const extensionTracks = [
  "Sparse pathfinding bonus: compare dense bytes against CSR payload bytes and explain the break-even point.",
  "Distributed bonus: add an MPI or queue-backed matrix path and report communication or queue-wait cost separately.",
  "SIMD bonus: isolate one explicit vectorized or auto-vectorization-friendly kernel and report what changed in the memory story.",
]

export function PageCh40MatrixOptimizationGamesExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch40-matrix-optimization-games-exercises")
  const mainPageIndex = getPageIndexById("ch40-matrix-optimization-games")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 40 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice matrix optimization the way it survives review: correct baselines first, locality second, accelerator
          claims only after fair measurement.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a performance design review. The strongest answer names the storage model, the
                access pattern, the measurement plan, and the budget or scoring rule before it names the trick.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 40
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

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Benchmark tournament rules</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {benchmarkTournamentRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
          <div className="mt-4">
            <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Extension tracks</div>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {extensionTracks.map((track) => (
                <li key={track}>{track}</li>
              ))}
            </ul>
          </div>
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
                  Matrix drill
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
          title="Runnable lab · Repair the tiled multiplication variant"
          description={
            <>
              Finish the blocked multiply so it matches the naive baseline on the same input. The checker expects the
              tiled result to match exactly and to produce the bottom-right cell below.
            </>
          }
          filename="tiled_matmul_lab.rs"
          runKey="ch40_ex_tiled_matmul"
          expectedOutput={"equal = true\ncell = 50.00"}
          helperText={
            <>
              Tip: keep the owner flat, walk the output in tile bands, and accumulate into the existing output cell. A
              2x2 input still demonstrates the same correctness rule as a larger blocked multiply.
            </>
          }
          initialCode={`#[derive(Debug, Clone, PartialEq)]
struct Matrix {
    rows: usize,
    cols: usize,
    data: Vec<f32>,
}

impl Matrix {
    fn from_vec(rows: usize, cols: usize, data: Vec<f32>) -> Self {
        Self { rows, cols, data }
    }

    fn zeros(rows: usize, cols: usize) -> Self {
        Self {
            rows,
            cols,
            data: vec![0.0; rows * cols],
        }
    }

    fn offset(&self, row: usize, col: usize) -> usize {
        row * self.cols + col
    }

    fn get(&self, row: usize, col: usize) -> f32 {
        self.data[self.offset(row, col)]
    }

    fn set(&mut self, row: usize, col: usize, value: f32) {
        let index = self.offset(row, col);
        self.data[index] = value;
    }
}

fn matmul_naive(a: &Matrix, b: &Matrix) -> Matrix {
    let mut out = Matrix::zeros(a.rows, b.cols);

    for i in 0..a.rows {
        for j in 0..b.cols {
            let mut acc = 0.0_f32;
            for k in 0..a.cols {
                acc += a.get(i, k) * b.get(k, j);
            }
            out.set(i, j, acc);
        }
    }

    out
}

fn matmul_tiled(a: &Matrix, b: &Matrix, tile: usize) -> Matrix {
    let _ = tile;
    Matrix::zeros(a.rows, b.cols)
}

fn approx_eq(left: &Matrix, right: &Matrix) -> bool {
    left.rows == right.rows
        && left.cols == right.cols
        && left
            .data
            .iter()
            .zip(&right.data)
            .all(|(l, r)| (l - r).abs() < 0.001)
}

fn main() {
    let a = Matrix::from_vec(2, 2, vec![1.0, 2.0, 3.0, 4.0]);
    let b = Matrix::from_vec(2, 2, vec![5.0, 6.0, 7.0, 8.0]);

    let naive = matmul_naive(&a, &b);
    let tiled = matmul_tiled(&a, &b, 2);

    println!("equal = {}", approx_eq(&naive, &tiled));
    println!("cell = {:.2}", tiled.get(1, 1));
}`}
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
            By the end of this page, you should be able to implement a correct dense baseline, add a tiled variant
            without hand-waving, choose sparse or dense representation from workload shape, and defend a CPU versus GPU
            tournament with fair rules and reproducible evidence.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch40_matrix_optimization_games/row_major_tiled_matmul.rs`
````
#[derive(Debug, Clone, PartialEq)]
struct Matrix {
    rows: usize,
    cols: usize,
    data: Vec<f32>,
}

impl Matrix {
    fn from_vec(rows: usize, cols: usize, data: Vec<f32>) -> Self {
        assert_eq!(data.len(), rows * cols);
        Self { rows, cols, data }
    }

    fn zeros(rows: usize, cols: usize) -> Self {
        Self {
            rows,
            cols,
            data: vec![0.0; rows * cols],
        }
    }

    fn offset(&self, row: usize, col: usize) -> usize {
        row * self.cols + col
    }

    fn get(&self, row: usize, col: usize) -> f32 {
        self.data[self.offset(row, col)]
    }

    fn set(&mut self, row: usize, col: usize, value: f32) {
        let index = self.offset(row, col);
        self.data[index] = value;
    }
}

fn matmul_naive(a: &Matrix, b: &Matrix) -> Matrix {
    assert_eq!(a.cols, b.rows);
    let mut out = Matrix::zeros(a.rows, b.cols);

    for i in 0..a.rows {
        for j in 0..b.cols {
            let mut acc = 0.0_f32;
            for k in 0..a.cols {
                acc += a.get(i, k) * b.get(k, j);
            }
            out.set(i, j, acc);
        }
    }

    out
}

fn matmul_tiled(a: &Matrix, b: &Matrix, tile: usize) -> Matrix {
    assert_eq!(a.cols, b.rows);
    let mut out = Matrix::zeros(a.rows, b.cols);
    let tile = tile.max(1);

    let mut ii = 0;
    while ii < a.rows {
        let mut kk = 0;
        while kk < a.cols {
            let mut jj = 0;
            while jj < b.cols {
                let i_end = (ii + tile).min(a.rows);
                let k_end = (kk + tile).min(a.cols);
                let j_end = (jj + tile).min(b.cols);

                for i in ii..i_end {
                    for k in kk..k_end {
                        let a_ik = a.get(i, k);
                        for j in jj..j_end {
                            let current = out.get(i, j);
                            out.set(i, j, current + a_ik * b.get(k, j));
                        }
                    }
                }

                jj += tile;
            }
            kk += tile;
        }
        ii += tile;
    }

    out
}

fn approx_eq(left: &Matrix, right: &Matrix) -> bool {
    left.rows == right.rows
        && left.cols == right.cols
        && left
            .data
            .iter()
            .zip(&right.data)
            .all(|(l, r)| (l - r).abs() < 0.001)
}

fn checksum(matrix: &Matrix) -> f32 {
    matrix.data.iter().copied().sum()
}

fn main() {
    let a = Matrix::from_vec(
        3,
        3,
        vec![
            1.0, 2.0, 0.0,
            0.0, 1.0, 3.0,
            2.0, 0.0, 1.0,
        ],
    );

    let b = Matrix::from_vec(
        3,
        3,
        vec![
            3.0, 1.0, 2.0,
            2.0, 1.0, 0.0,
            1.0, 4.0, 2.0,
        ],
    );

    let naive = matmul_naive(&a, &b);
    let tiled = matmul_tiled(&a, &b, 2);

    println!("naive == tiled = {}", approx_eq(&naive, &tiled));
    println!("c[1,2] = {:.2}", tiled.get(1, 2));
    println!("checksum = {:.2}", checksum(&tiled));
}
````

### File: `examples/ch40_matrix_optimization_games/sparse_frontier_csr.rs`
````
#[derive(Debug)]
struct CsrMatrix {
    rows: usize,
    cols: usize,
    indptr: Vec<usize>,
    indices: Vec<usize>,
    data: Vec<f32>,
}

impl CsrMatrix {
    fn nnz(&self) -> usize {
        self.data.len()
    }

    fn dense_bytes(&self) -> usize {
        self.rows * self.cols * std::mem::size_of::<f32>()
    }
}

fn advance_frontier(csr: &CsrMatrix, frontier: &[f32]) -> Vec<u8> {
    assert_eq!(frontier.len(), csr.rows);

    let mut next = vec![0_u8; csr.cols];

    for row in 0..csr.rows {
        if frontier[row] == 0.0 {
            continue;
        }

        let start = csr.indptr[row];
        let end = csr.indptr[row + 1];

        for edge in start..end {
            let col = csr.indices[edge];
            if csr.data[edge] != 0.0 {
                next[col] = 1;
            }
        }
    }

    next
}

fn render(bits: &[u8]) -> String {
    bits.iter()
        .map(|bit| bit.to_string())
        .collect::<Vec<_>>()
        .join(",")
}

fn main() {
    let graph = CsrMatrix {
        rows: 5,
        cols: 5,
        indptr: vec![0, 2, 3, 5, 6, 6],
        indices: vec![1, 2, 3, 3, 4, 4],
        data: vec![1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    };

    let frontier = vec![1.0, 0.0, 1.0, 0.0, 0.0];
    let next = advance_frontier(&graph, &frontier);

    println!("nnz = {}", graph.nnz());
    println!("next frontier = {}", render(&next));
    println!("dense bytes = {}", graph.dense_bytes());
}
````

### File: `examples/ch40_matrix_optimization_games/cpu_gpu_tournament_scoreboard.rs`
````
#[derive(Debug, Clone, Copy)]
struct RunSample {
    name: &'static str,
    wall_ms: f64,
    transfer_ms: f64,
    kernel_ms: f64,
}

fn speedup(baseline_ms: f64, candidate_ms: f64) -> f64 {
    baseline_ms / candidate_ms
}

fn transfer_share(sample: RunSample) -> f64 {
    sample.transfer_ms / sample.wall_ms
}

fn main() {
    let cpu = RunSample {
        name: "cpu_tiled",
        wall_ms: 14.0,
        transfer_ms: 0.0,
        kernel_ms: 14.0,
    };

    let gpu = RunSample {
        name: "gpu_batched",
        wall_ms: 6.0,
        transfer_ms: 2.0,
        kernel_ms: 3.0,
    };

    let winner = if gpu.wall_ms < cpu.wall_ms {
        gpu.name
    } else {
        cpu.name
    };

    println!("winner = {}", winner);
    println!("gpu speedup = {:.2}", speedup(cpu.wall_ms, gpu.wall_ms));
    println!("transfer share = {:.2}", transfer_share(gpu));
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -76,3 +76,5 @@ export { PageCh37CudaAndGpuAcceleration } from "./page-ch37-cuda-and-gpu-acceler
 export { PageCh37CudaAndGpuAccelerationExercises } from "./page-ch37-cuda-and-gpu-acceleration-exercises"
 export { PageCh38MerkleTreeGamesAndChallenges } from "./page-ch38-merkle-tree-games-and-challenges"
 export { PageCh38MerkleTreeGamesAndChallengesExercises } from "./page-ch38-merkle-tree-games-and-challenges-exercises"
 export { PageCh39GraphSearchGames } from "./page-ch39-graph-search-games"
 export { PageCh39GraphSearchGamesExercises } from "./page-ch39-graph-search-games-exercises"
+export { PageCh40MatrixOptimizationGames } from "./page-ch40-matrix-optimization-games"
+export { PageCh40MatrixOptimizationGamesExercises } from "./page-ch40-matrix-optimization-games-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -88,6 +88,8 @@ import {
   PageCh37CudaAndGpuAccelerationExercises,
   PageCh38MerkleTreeGamesAndChallenges,
   PageCh38MerkleTreeGamesAndChallengesExercises,
   PageCh39GraphSearchGames,
   PageCh39GraphSearchGamesExercises,
+  PageCh40MatrixOptimizationGames,
+  PageCh40MatrixOptimizationGamesExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -169,6 +171,8 @@ const PAGE_COMPONENTS = [
   PageCh37CudaAndGpuAccelerationExercises,
   PageCh38MerkleTreeGamesAndChallenges,
   PageCh38MerkleTreeGamesAndChallengesExercises,
   PageCh39GraphSearchGames,
   PageCh39GraphSearchGamesExercises,
+  PageCh40MatrixOptimizationGames,
+  PageCh40MatrixOptimizationGamesExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh40Output } from "./rust-simulator-ch40"
 import { simulateCh39Output } from "./rust-simulator-ch39"
 import { simulateCh38Output } from "./rust-simulator-ch38"
 import { simulateCh37Output } from "./rust-simulator-ch37"
@@ -1017,6 +1018,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch40Output = simulateCh40Output(code, key)
+  if (ch40Output !== null) return ch40Output
 
   const ch39Output = simulateCh39Output(code, key)
   if (ch39Output !== null) return ch39Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -29,6 +29,7 @@ import { DEFAULT_CODES_CH35 } from "./default-codes-ch35"
 import { DEFAULT_CODES_CH36 } from "./default-codes-ch36"
 import { DEFAULT_CODES_CH37 } from "./default-codes-ch37"
 import { DEFAULT_CODES_CH38 } from "./default-codes-ch38"
 import { DEFAULT_CODES_CH39 } from "./default-codes-ch39"
+import { DEFAULT_CODES_CH40 } from "./default-codes-ch40"
@@ -988,6 +989,28 @@ export const CHAPTERS: ChapterConfig[] = [
         description:
           "Implement BFS with stable indices, compare graph representations, and design maze, dependency, and distributed graph-search challenges",
         icon: "trophy",
       },
     ],
+  },
+  {
+    id: "ch40-matrix-optimization-games",
+    title: "Chapter 40 · Matrix Optimization Games",
+    icon: "book",
+    pages: [
+      {
+        id: "ch40-matrix-optimization-games",
+        title: "Matrix Optimization Games",
+        shortTitle: "Matrix Games",
+        description:
+          "Matrix storage layouts, cache-aware multiplication, SIMD opportunities, sparse vs dense tradeoffs, blocking and tiling, parallel matrix operations, GPU offload, and optimization challenge tracks",
+        icon: "book",
+        codeKeys: ["matrix_games_tiled_matmul", "matrix_games_sparse_frontier"],
+      },
+      {
+        id: "ch40-matrix-optimization-games-exercises",
+        title: "Chapter 40 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Implement naive and tiled multiplication variants, choose sparse or dense representations, and design a fair CPU vs GPU benchmark tournament",
+        icon: "trophy",
+      },
+    ],
   },
 ]
@@ -1444,5 +1467,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH36,
   ...DEFAULT_CODES_CH37,
   ...DEFAULT_CODES_CH38,
   ...DEFAULT_CODES_CH39,
+  ...DEFAULT_CODES_CH40,
 }
````
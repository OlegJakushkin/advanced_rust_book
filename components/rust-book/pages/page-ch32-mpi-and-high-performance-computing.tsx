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
    title: "MPI is process-based parallelism with explicit message movement",
    body: "Each rank is a separate process with its own address space. That means ownership does not cross ranks through references or shared memory. It crosses through explicit buffers and protocols.",
  },
  {
    title: "At HPC scale, layout usually matters more than syntax",
    body: "A flat contiguous buffer, a stable row partition, and one well-chosen collective often matter more than an abstract API shape. Rust helps most when the data layout is explicit.",
  },
  {
    title: "Hybrid designs are normal, not exotic",
    body: "A serious cluster job often uses MPI between ranks and threads inside each rank. Rust's ownership and Send/Sync rules still matter inside the rank, even though MPI itself is process-based.",
  },
]

const mpiConceptCards = [
  {
    title: "Rank and communicator",
    body: "A rank is one process inside one communicator. The communicator defines who can talk to whom. In practice, most programs start from `world`, then add sub-communicators only when topology or algorithm shape demands it.",
  },
  {
    title: "Point-to-point",
    body: "Use sends and receives when the communication pattern is sparse, irregular, or naturally pairwise. Keep the payload contiguous and the ownership boundary obvious.",
  },
  {
    title: "Collectives",
    body: "Use broadcast, scatter, gather, reduce, and allreduce when the whole communicator participates in one structured exchange. The main wins are less boilerplate and a clearer synchronization contract.",
  },
]

const processVsThreadCards = [
  {
    title: "MPI ranks are processes",
    body: "A rank does not borrow memory from another rank. There is no cross-rank `&T`, `Arc<T>`, or `Mutex<T>` story. Inter-rank ownership is always explicit data movement.",
  },
  {
    title: "Threads stay inside the rank",
    body: "Inside one rank, ordinary Rust concurrency rules still apply. `Send`, `Sync`, channels, atomics, and locks are relevant there exactly as they are in a non-MPI program.",
  },
  {
    title: "Do not confuse the two levels",
    body: "MPI solves distributed address spaces. Threads solve shared-address-space concurrency. Most production HPC systems use both, but they solve different problems and fail in different ways.",
  },
]

const crateCards = [
  {
    title: "The `mpi` crate",
    body: "The usual Rust ecosystem option is a safe wrapper over a system MPI implementation. In production that means your build and run environments must agree on the installed MPI stack.",
  },
  {
    title: "Raw bindings when needed",
    body: "If a wrapper does not expose one advanced feature you need, a lower-level binding layer is still possible. Treat that as an FFI decision, not as the default programming model.",
  },
  {
    title: "Cluster build reality",
    body: "Real jobs compile and run against cluster-provided MPI libraries, scheduler launchers, and node topology. Keep that environment assumption visible in your adapter and build layer.",
  },
]

const layoutRules = [
  "Prefer flat row-major buffers such as `Vec<f64>` for dense numeric work and for most scatter/gather patterns.",
  "Avoid `Vec<Vec<T>>` for dense matrices. It turns one predictable buffer into many allocations and makes collectives and FFI harder.",
  "Counts and displacements must match the unit the collective expects: rows, bytes, or typed elements. Write that contract down explicitly.",
  "If one library expects column-major data, either store column-major deliberately or pay the transposition cost consciously at the boundary.",
]

const serializationRules = [
  "Hot numeric MPI paths usually want typed contiguous buffers, not serde-driven envelopes.",
  "Serde, bincode-like formats, or compact control-plane messages are reasonable for irregular metadata or orchestration paths, not for allreduce on dense numerics.",
  "A control message can afford more schema ceremony than a hot inner-loop exchange. Keep those two boundaries separate.",
]

const collectiveCards = [
  {
    title: "Broadcast",
    body: "One root rank publishes one value or buffer to every participant. Good for config, iteration limits, small control data, and shared scalar parameters.",
  },
  {
    title: "Scatter and gather",
    body: "Use scatter when one rank owns a large buffer and should hand contiguous segments to others. Use gather for the reverse direction when local results must come back to one rank.",
  },
  {
    title: "Reduce and allreduce",
    body: "Use reduce when only one root needs the aggregate. Use allreduce when every rank needs the same final scalar or vector summary for the next step.",
  },
  {
    title: "All-to-all",
    body: "Use it only when every rank truly must exchange with every other rank. It is powerful and also one of the easiest ways to create a communication bottleneck by accident.",
  },
]

const hybridCards = [
  {
    title: "MPI between ranks, threads within the rank",
    body: "A common pattern is rank-per-socket or rank-per-NUMA domain, then Rayon or plain threads for local CPU work. That keeps inter-node traffic explicit and local CPU parallelism cheap.",
  },
  {
    title: "Avoid oversubscription",
    body: "If each rank starts too many threads, the node stops doing useful work and starts context-switching. The thread budget per rank is part of the job configuration, not a local detail.",
  },
  {
    title: "Keep local data ownership explicit",
    body: "Thread pools inside a rank still want owned chunks or well-scoped borrowed slices. MPI does not remove the normal Rust reasoning inside the rank.",
  },
]

const profilingCards = [
  {
    title: "Separate compute time from communication time",
    body: "Measure rank-local compute, queue or staging cost, and time blocked in collectives separately. One slow barrier often hides load imbalance rather than expensive arithmetic.",
  },
  {
    title: "Look for imbalance first",
    body: "If rank 0 finishes instantly and rank 7 arrives late to every collective, the job is often partitioned badly rather than implemented badly.",
  },
  {
    title: "Profile the boundary, not only the kernel",
    body: "Message size, packing, transposition, copy count, and collective frequency often dominate before the math kernel itself does.",
  },
]

const productionEnvironmentCards = [
  {
    title: "Cluster launchers and runtime match",
    body: "Build and run against the same MPI family and ABI expectations. A job that compiles against one implementation and launches against another can fail in ways that have nothing to do with Rust.",
  },
  {
    title: "Root-only logging is not enough",
    body: "Root logs are useful, but rank-tagged diagnostics and per-rank timers are often the only way to diagnose imbalance or topology mistakes.",
  },
  {
    title: "Containers help only if the ABI story stays honest",
    body: "A container can simplify environment management, but MPI launchers, network fabric, and host libraries still define the real deployment contract.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The layout and collective questions will feel familiar. The main Rust gain is that ownership inside each rank becomes easier to audit, especially in hybrid MPI plus threads designs.",
  },
  {
    title: "C# background",
    body: "Think less in terms of runtime object graphs and more in terms of flat buffers, phases, and explicit ownership. HPC code is usually calmer when the runtime story is boring.",
  },
  {
    title: "Go background",
    body: "Do not map MPI to channels. MPI is process-level message passing with typed collective operations and cluster launch semantics, not an in-process concurrency convenience layer.",
  },
]

const productionPatterns = [
  "Keep dense numeric payloads flat and contiguous. That is the easiest way to make MPI, caches, and FFI agree.",
  "Write one reusable partition function and test it well. Many HPC correctness bugs are off-by-one workload splits, not algebra bugs.",
  "Use collectives when the whole communicator truly participates. Use point-to-point when the graph is sparse or irregular.",
  "Treat hybrid MPI plus threads as two ownership layers: process-level message passing outside, thread-level Send/Sync rules inside.",
  "Measure bytes moved, collective count, task imbalance, and time spent waiting before rewriting kernels by instinct.",
  "Keep cluster build assumptions visible: MPI implementation, launcher, rank count, thread count, and topology policy should not be hidden folklore.",
]

const pitfalls = [
  "Treating MPI like shared-memory concurrency with more ceremony. Cross-rank data is always a buffer or protocol boundary.",
  "Sending nested or irregular layouts into collectives and hoping the receiver interprets them the same way.",
  "Using JSON or general-purpose serialization in hot numeric exchanges that should have stayed as flat typed buffers.",
  "Mixing MPI ranks and per-rank thread pools without budgeting total CPU use on the node.",
  "Profiling only rank 0 or only kernel math while communication, imbalance, or packing dominates elsewhere.",
  "Ignoring the system MPI environment until launch day. Cluster jobs fail from build and deployment mismatches more often than tutorial code suggests.",
]

export function PageCh32MpiAndHighPerformanceComputing() {
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
  const pageIndex = getPageIndexById("ch32-mpi-and-high-performance-computing")
  const chapter12PageIndex = getPageIndexById("ch12-matrices-and-multidimensional-data")
  const chapter22PageIndex = getPageIndexById("ch22-multithreading-in-rust")
  const chapter26PageIndex = getPageIndexById("ch26-task-libraries-and-parallel-execution")
  const chapter31PageIndex = getPageIndexById("ch31-distributed-task-execution")
  const exercisesPageIndex = getPageIndexById("ch32-mpi-and-high-performance-computing-exercises")
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
          Chapter 32 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          MPI in Rust is mostly about being explicit: process boundaries, flat buffers, collective contracts, and the
          point where cluster reality begins to dominate local language taste.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 12, 22, 26, and 31</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 12 established dense layout and matrix views. Chapter 22 separated processes, threads, and
                thread-safety inside one address space. Chapter 26 compared waiting-heavy orchestration with CPU pools.
                Chapter 31 showed that once work crosses process boundaries, recovery and replay matter. MPI sits across
                all four.
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
              <Button variant="outline" onClick={() => setCurrentPage(chapter31PageIndex)}>
                Chapter 31
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            You are porting a climate or simulation workload from C++ into Rust. One part sweeps large dense arrays. One
            part exchanges halo regions. One part reduces convergence scalars every iteration. The cluster team wants the
            same MPI launch model, the same node topology discipline, and a path to hybrid per-rank threading. Rust can
            do this well, but only if the program states what HPC code always cared about anyway: which rank owns which
            rows, which buffers are contiguous, and which synchronization costs are global rather than local.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Choose the data layout before choosing the abstraction vocabulary.</li>
              <li>Choose the partition function before tuning the collective pattern.</li>
              <li>Choose process count and per-rank thread count together, not independently.</li>
              <li>Profile communication, packing, and imbalance before blaming the arithmetic kernel.</li>
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
            <h4 className="font-semibold text-foreground mb-3">MPI concepts for Rust developers</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {mpiConceptCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`use mpi::traits::*;
let universe = mpi::initialize().unwrap();
let world = universe.world();
let rank = world.rank();
let size = world.size();`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Processes vs threads</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {processVsThreadCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Message passing at HPC scale</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  At small scale, many communication patterns look cheap enough to ignore. At cluster scale, collective
                  count, message size, synchronization frequency, and packing cost often dominate. A barrier inside a hot
                  loop is not a style choice. It is a global pacing decision across every rank.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is one reason Rust fits HPC work well. Once the buffers and ownership are explicit, the remaining
                  questions are the same ones HPC engineers already ask: what is contiguous, what is copied, and which
                  ranks are waiting for which other ranks?
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Rust MPI crates</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {crateCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Keep crate choice subordinate to system choice. The real dependencies are the installed MPI runtime, the
                launcher, the scheduler, and the fabric assumptions on the cluster.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Data layout for MPI</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {layoutRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`// row-major dense buffer
offset = row * cols + col

// rank-local contiguous row chunk
start_cell = start_row * cols
end_cell   = end_row * cols`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Serialization and binary protocols</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {serializationRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A useful rule is simple: the hotter the collective, the less general the payload should be. Dense numeric
                exchange wants flat typed buffers. Rich envelopes belong on colder control paths.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Collective operations</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {collectiveCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Hybrid MPI plus threads</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {hybridCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`rank-local CPU work -> Rayon or std::thread
inter-rank exchange  -> MPI send/recv or collectives`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling MPI programs</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {profilingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Rust in HPC production environments</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {productionEnvironmentCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
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
                The hardest MPI performance bug is often not one slow instruction. It is one wrong boundary: too many
                collectives, the wrong layout, one rank doing more work, or one node running too many local threads.
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
                <h4 className="font-semibold text-foreground">Example 1: block partitioning for dense row-major work</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This is the partition math each MPI rank applies before touching its local rows. In a real MPI program,
                  `rank` and `size` come from the communicator. The partition function itself stays the same.
                </p>
              </div>
              {codes.mpi_partition_dense_rows !== DEFAULT_CODES.mpi_partition_dense_rows && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("mpi_partition_dense_rows")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.mpi_partition_dense_rows}
              onChange={(newCode) => updateCode("mpi_partition_dense_rows", newCode)}
              onRun={() => runCode("mpi_partition_dense_rows")}
              output={outputs.mpi_partition_dense_rows ?? null}
              isRunning={isRunning === "mpi_partition_dense_rows"}
              filename="mpi_partition_dense_rows.rs"
              expectedOutput={"rank = 1\nrows = 3..6\nlocal rows = 3\nsubtotal = 126.0"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.mpi_partition_dense_rows}
              onRevert={() => resetCode("mpi_partition_dense_rows")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Partition</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Extra rows are distributed to the first ranks so the load stays balanced when the row count is not
                  divisible evenly.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Layout</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One flat buffer plus one row-major offset keeps both cache behavior and MPI send ranges simple.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Real translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The repository example file shows the same idea with real `mpi` crate calls and an allreduce.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: counts, displacements, and collective-friendly layout</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Many scatter and gather bugs reduce to getting one small table wrong. Keep counts in rows if that is
                  the algorithm, and convert to cells or bytes only when the collective boundary expects it.
                </p>
              </div>
              {codes.mpi_collective_counts_and_allreduce !== DEFAULT_CODES.mpi_collective_counts_and_allreduce && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("mpi_collective_counts_and_allreduce")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.mpi_collective_counts_and_allreduce}
              onChange={(newCode) => updateCode("mpi_collective_counts_and_allreduce", newCode)}
              onRun={() => runCode("mpi_collective_counts_and_allreduce")}
              output={outputs.mpi_collective_counts_and_allreduce ?? null}
              isRunning={isRunning === "mpi_collective_counts_and_allreduce"}
              filename="mpi_collective_counts_and_allreduce.rs"
              expectedOutput={"counts = [4, 3, 3]\ndispls = [0, 16, 28]\nsend cells = 12\nallreduce = 21"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.mpi_collective_counts_and_allreduce}
              onRevert={() => resetCode("mpi_collective_counts_and_allreduce")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Counts</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Row counts answer the load question first.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Displacements</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Collective APIs often want offsets in typed elements, not in rows.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Allreduce</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Every rank can receive the same final scalar when the next phase needs it locally.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Keep the hot numeric path flat and typed; send richer metadata elsewhere.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch32_mpi_and_high_performance_computing/
              </code>{" "}
              including real `mpi` crate examples for row partitioning, collective planning, and hybrid MPI plus Rayon
              execution.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to partition matrix rows across ranks, choose flat layouts for
            collectives, profile a communication-heavy workload conceptually, and decide where hybrid MPI plus threads is
            worth the extra complexity.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 32 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>MPI is process-based message passing, so cross-rank ownership is always a buffer or protocol boundary.</li>
            <li>Processes and threads solve different problems. Hybrid MPI plus threads is common, but the two levels should stay conceptually separate.</li>
            <li>Rust MPI work is usually easiest when dense payloads stay flat, contiguous, and explicit about layout.</li>
            <li>Serialization for hot numeric collectives should stay minimal; richer envelopes belong on colder orchestration paths.</li>
            <li>Collective choice, queueing inside ranks, thread budgets, and cluster build assumptions are all part of the production design.</li>
            <li>Profile communication, packing, and imbalance before blaming the arithmetic kernel or the language.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

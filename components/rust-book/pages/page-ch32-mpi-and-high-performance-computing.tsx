"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
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
    body: "A typical cluster job often uses MPI between ranks and threads inside each rank. Rust's ownership and Send/Sync rules still matter inside the rank, even though MPI itself is process-based.",
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
    body: "A rank does not borrow memory from another rank. There is no cross-rank `&T`, `Arc<T>`, or `Mutex<T>`. Inter-rank ownership is always explicit data movement.",
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
    title: "Containers help only if the ABI assumptions still match",
    body: "A container can simplify environment management, but MPI launchers, network fabric, and host libraries still define the real deployment contract.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You have probably written MPI in C++ already, so the collective vocabulary and the layout questions transfer directly. The shift is that inside each rank, the hybrid MPI-plus-threads code that used to rely on review discipline now has an enforced ownership story: the compiler audits which thread owns which slice, so the part of HPC that historically caused the subtle bugs becomes checkable.",
  },
  {
    title: "C# background",
    body: "Stop thinking in terms of a managed object graph that the runtime keeps alive for you. An MPI rank is a bare process: there is no shared heap across ranks, no garbage collector pausing all of them at once, and no implicit serialization. Model the work as flat buffers moving through explicit phases, and the performance behavior becomes something you can predict instead of profile-and-pray.",
  },
  {
    title: "Go background",
    body: "Do not map MPI onto goroutines and channels. A channel is in-process concurrency; an MPI collective is a synchronized exchange across separate OS processes that a cluster launcher started on different machines. The mental trap is reaching for a channel-shaped abstraction when the real boundary is a typed buffer crossing the network with its own counts and displacements.",
  },
  {
    title: "Python background",
    body: "If you are porting from NumPy and mpi4py, the algorithm carries over but the cost model inverts. In Python the expensive lines are the Python ones and you push work into C; in Rust the loop you write is the loop that runs, so you stop fighting the interpreter and start owning the buffer layout directly. Resist pickling rich objects into collectives the way mpi4py lets you: on hot numeric paths, keep the payload a flat typed slice.",
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
          A cluster job is not one program running faster. It is dozens or thousands of separate processes, on separate
          machines, agreeing on when to exchange data. This chapter is about writing the Rust half of that agreement:
          partitioning work into flat buffers, choosing collective operations that match the exchange you actually need,
          and keeping the cost of communication visible instead of buried.
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
            A scientific simulation that already runs on a cluster is being ported to Rust. The team wants to keep
            everything that works about the existing setup: the MPI launch model, the scheduler that places one rank per
            socket, and the per-rank threading that fills each socket with local CPU work. What they want from Rust is
            the part that has been fragile in the old code base, namely confidence about which buffer is owned by which
            rank and which thread, so that a layout mistake fails at compile time rather than as a silent wrong answer at
            scale.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            That goal turns into four concrete commitments, and the rest of the chapter is really an expansion of them.
            Partition the data into flat, contiguous buffers so a rank&apos;s share is a slice, not a graph. Use
            collective operations when the whole group participates in one structured exchange, and reserve point-to-point
            messages for the irregular cases. Keep general-purpose serialization off the hot numeric paths, where a flat
            typed buffer is both faster and easier to reason about. And measure communication separately from
            computation, because at cluster scale the time a job spends waiting in collectives is usually the number that
            decides whether it scales.
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
          <p className="text-sm text-muted-foreground leading-6">
            The single most useful idea to hold onto is that an MPI program has two completely different boundaries
            stacked on top of each other, and they obey different rules. The outer boundary is between ranks. A rank is a
            full operating-system process with its own address space, so nothing inside it is reachable from another rank
            except through data you explicitly send. The inner boundary is between threads inside one rank. There the
            familiar Rust concurrency model applies unchanged: shared references, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Send</code>,{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Sync</code>, channels, and locks all mean
            what they mean everywhere else. The diagram below is the shape worth memorizing before reading any further.
          </p>
          <MermaidDiagram
            chart={`flowchart TD
  subgraph Cluster
    subgraph Node0["Node 0"]
      R0["Rank 0 process"]
      R1["Rank 1 process"]
    end
    subgraph Node1["Node 1"]
      R2["Rank 2 process"]
      R3["Rank 3 process"]
    end
  end
  R0 -. MPI messages .- R1
  R1 -. MPI messages .- R2
  R2 -. MPI messages .- R3
  R0 --> T0["threads + owned slice"]
  R3 --> T3["threads + owned slice"]`}
            caption="Two boundaries: explicit messages between ranks (processes), ordinary Rust ownership between threads inside a rank."
          />
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
            <h4 className="font-semibold text-foreground mb-3">The three nouns every MPI program starts from</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              MPI has a large API surface, but almost everything is built from three ideas. A{" "}
              <strong className="text-foreground">communicator</strong> is the group of processes that are allowed to talk
              to each other. A <strong className="text-foreground">rank</strong> is one process&apos;s integer index inside
              that group. The <strong className="text-foreground">size</strong> is how many ranks the group has. Every
              partition decision in this chapter is just arithmetic on a rank and a size: rank 1 of 3 takes this slice,
              rank 2 of 3 takes the next one. The cards below name the building blocks, and the snippet after them is the
              opening of essentially every MPI program written with the Rust <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">mpi</code> crate.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {mpiConceptCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground leading-5 mt-4 mb-1">
              What to read for: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">initialize()</code> hands
              back a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">universe</code> whose lifetime is
              the MPI session, and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">rank</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">size</code> are the two numbers the rest
              of your code branches on.
            </p>
            <pre className="mt-2 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`use mpi::traits::*;
let universe = mpi::initialize().unwrap();
let world = universe.world();
let rank = world.rank();
let size = world.size();`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Why ranks and threads are not the same tool</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              This is the distinction that most often trips up engineers arriving from a shared-memory background. Both
              ranks and threads give you parallelism, so it is tempting to treat them interchangeably, but they solve
              different problems and fail in different ways. Ranks give you more memory and more machines at the price of
              having to move every shared byte explicitly. Threads give you cheap sharing at the price of having to reason
              about exclusive mutation. A real cluster job almost always uses both, and the skill is keeping clear about
              which one you are reaching for in any given line.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">Choosing a Rust MPI crate</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Rust does not ship its own MPI implementation, and it should not. MPI is a standard with several mature
              implementations (Open MPI, MPICH, and vendor variants) that are tuned for specific interconnects and already
              installed on the cluster. A Rust crate is a binding to whichever one is present, not a replacement for it.
              That framing matters because it tells you where your real dependency lives: not in <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cargo.toml</code>,
              but in the system library and launcher your job will actually link and run against.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">Why flat buffers win in MPI</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Data layout is the decision that quietly determines how hard everything else will be. MPI sends operate on
              contiguous regions described by a starting pointer and a count, and so do the caches and the FFI boundary
              into the system MPI library. A flat row-major buffer satisfies all three at once: a rank&apos;s rows are a
              single slice, the send is one range, and the CPU walks memory in order. The moment you reach for a nested
              structure such as a vector of vectors, you trade that single predictable buffer for many scattered
              allocations, and every collective and every FFI call now has to reassemble what should have stayed
              contiguous. The rules below are how to stay on the easy path.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {layoutRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground leading-5 mt-4 mb-1">
              The arithmetic that makes this work is one line: a cell&apos;s position in the flat buffer is{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">row * cols + col</code>, so a rank&apos;s
              row range maps to a cell range by multiplying both ends by <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">cols</code>.
            </p>
            <pre className="mt-2 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`// row-major dense buffer
offset = row * cols + col

// rank-local contiguous row chunk
start_cell = start_row * cols
end_cell   = end_row * cols`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">When to serialize and when not to</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Rust&apos;s serialization story is excellent, and that is exactly why it is worth saying clearly where it does
              not belong. A dense numeric exchange (an allreduce over a million doubles, repeated every iteration) should
              move as raw <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">f64</code> bytes, because the
              data already has a fixed shape and any envelope is pure overhead on the hottest path in the program. A control
              message that says &quot;reconfigure to this topology&quot; runs once and benefits from a real schema. The
              guideline below is just that split made explicit: match the ceremony of the payload to how often it crosses the
              wire.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">Collective operations and the shapes they make</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A collective is a single operation that every rank in a communicator calls together. The payoff over hand-rolled
              sends and receives is twofold: far less boilerplate, and a synchronization contract the MPI implementation can
              optimize as a whole (often using tree or ring algorithms you would not want to write by hand). The trick to
              choosing among them is to picture the direction the data flows. Broadcast pushes one buffer out to everyone;
              scatter splits one buffer into pieces; gather collects pieces back; reduce folds them into one value at the
              root; allreduce folds them and hands the result back to everyone. The diagram makes those four shapes concrete.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  subgraph Broadcast
    B0["root"] --> B1["rank 1"]
    B0 --> B2["rank 2"]
    B0 --> B3["rank 3"]
  end
  subgraph Scatter
    S0["root buffer"] --> S1["chunk 1"]
    S0 --> S2["chunk 2"]
    S0 --> S3["chunk 3"]
  end`}
              caption="Fan-out collectives: broadcast pushes one buffer to everyone, scatter splits one buffer into per-rank pieces."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The other two shapes run in the opposite direction, collecting data back toward the root:
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  subgraph Gather
    G1["local 1"] --> G0["root buffer"]
    G2["local 2"] --> G0
    G3["local 3"] --> G0
  end
  subgraph Allreduce
    A1["partial"] --> AS["sum"]
    A2["partial"] --> AS
    A3["partial"] --> AS
    AS --> AB["every rank"]
  end`}
              caption="Fan-in collectives: gather collects pieces back to the root, allreduce folds them then redistributes the result to every rank."
            />
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
            <h4 className="font-semibold text-foreground mb-3">Combining MPI ranks with per-rank threads</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The dominant production layout is not &quot;one rank per core.&quot; It is one rank per socket or per NUMA
              domain, with each rank running a thread pool (Rayon, or plain threads) across the cores it owns. The reasoning
              is economic: crossing the network is expensive, so you want as few ranks as the memory budget allows, and you
              fill each rank&apos;s cores with cheap shared-memory parallelism. This gives you two ownership layers to keep
              straight. Between ranks, ownership moves by message. Inside a rank, ownership is the ordinary Rust story of
              owned chunks and scoped borrowed slices handed to the pool. The one configuration mistake that wrecks this is
              oversubscription: if every rank spawns a full machine&apos;s worth of threads, the node thrashes on context
              switches instead of computing.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">Where the time actually goes</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The instinct from single-process work is to profile the arithmetic kernel, and in HPC that instinct is
              frequently wrong. A collective is a barrier: it does not complete until the slowest rank arrives. So when a
              profiler shows ranks blocked in an allreduce, that time is usually not the cost of the reduction itself, it is
              the cost of one rank having more work to do than the others. The first question to ask of a slow cluster job is
              therefore not &quot;which line is hot&quot; but &quot;are all the ranks finishing their local work at the same
              time.&quot; Measure compute, packing, and time-blocked-in-collectives as three separate numbers, and look at
              load imbalance before you touch the math.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">What the cluster environment demands</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A surprising share of failed cluster jobs have nothing to do with the algorithm and everything to do with the
              environment the job runs in. The binary must link against the same MPI family it launches against, the launcher
              and scheduler have to agree on how many ranks go where, and logging has to survive the fact that there are now
              many processes producing output at once. None of this is exotic, but it is easy to leave implicit until the
              first run at scale fails in a way that single-machine testing never reproduced. The cards below name the
              assumptions worth writing down before launch day.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {productionEnvironmentCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How to think about this coming from another language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            MPI predates Rust by decades and exists in C, C++, Fortran, and Python, so most readers arrive with some prior
            model of either MPI or of parallelism in their home language. The useful question is not &quot;what is the Rust
            API for X&quot; but &quot;what mental habit do I need to drop.&quot; Each card below is one such shift, not a
            library cheat sheet.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                <div className="font-semibold text-foreground mb-2">{comparison.title}</div>
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
                The hardest MPI performance bug is often not one slow instruction. It is one wrong boundary: too many
                collectives, the wrong layout, one rank doing more work, or one node running too many local threads.
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
                <h4 className="font-semibold text-foreground">Example 1: block partitioning for dense row-major work</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This is the partition math every MPI rank runs before it touches any data. In a real program{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">rank</code> and{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">size</code> come from the
                  communicator; here they are constants so the example runs standalone. The function is identical either way.
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
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              What to look at: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">block_range</code> turns
              the pair (rank, size) into a half-open row range, handing one extra row to each of the first few ranks so the
              eight rows split as 3, 3, 2 instead of leaving a remainder stranded. Then{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">local_sum</code> converts that row range
              into a cell range by multiplying by <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">cols</code>{" "}
              and sums only that slice. Follow the data through the three boxes below before reading the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  IN["rows=8, ranks=3, rank=1"] --> BR["block_range"]
  BR --> P["range 3..6 (3 rows)"]
  P --> CELLS["cells 9..18 = range x cols"]
  CELLS --> SUM["local_sum over slice"]
  SUM --> OUT["subtotal = 126.0"]`}
              caption="Rank and size in, a contiguous row range out, then a slice sum on only this rank's rows."
            />
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
                  A scatter or gather needs two parallel tables: how many elements go to each rank, and at what offset each
                  rank&apos;s slice begins. Most scatter and gather bugs are simply one of these tables computed in the wrong
                  unit. The discipline is to keep counts in the unit the algorithm thinks in (rows) and convert to the unit
                  the collective wants (cells) at exactly one place.
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
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              What to look at: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">row_counts</code> answers
              the load question in rows (10 rows over 3 ranks becomes 4, 3, 3). Then{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">displacements_in_cells</code> walks those
              counts once, multiplying by <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">cols</code> to
              produce the per-rank starting offset a real scatter would consume. The final allreduce is a separate fan-in
              that hands every rank the same total. The diagram traces those two tables and the reduction.
            </p>
            <MermaidDiagram
              chart={`flowchart TD
  RC["row_counts: 4, 3, 3"] --> D["displacements_in_cells (x cols)"]
  D --> DI["offsets: 0, 16, 28"]
  DI --> SC["scatter slices to ranks"]
  SC --> LC["each rank computes a partial"]
  LC --> AR["allreduce sum"]
  AR --> ALL["same total on every rank"]`}
              caption="Counts in rows, displacements in cells, then a scatter feeds local work that an allreduce folds back together."
            />
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

"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
  Network,
  Shield,
  TriangleAlert,
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
    title: "The capstone is about boundaries, not one clever worker",
    body: "Any one component here is something you have already built. The difficulty of the capstone lives between the components: the points where ownership changes hands, where delivery turns into at-least-once, where verification has to run, and where a profiler must separate time spent waiting in a queue from time spent doing real work. Get the boundaries right and the components fall out; get a clever worker right but leave the boundaries vague and the system fails in production in ways no single component can explain.",
  },
  {
    title: "One task envelope should explain the whole trip",
    body: "A durable task carries everything a future reader needs to reconstruct what happened: a stable identity, the attempt count, a trace identity, the shape of the workload, and a verification root. When those fields live only in a local variable in the API handler, replay and incident response have to guess at them later. Putting them on one owned envelope means the same record answers 'what was this', 'has it run before', and 'did the input change' at every hop.",
  },
  {
    title: "Local speed and distributed correctness are one design problem",
    body: "It is tempting to treat the graph search, the matrix optimization, and the optional accelerator path as separate performance projects. They are not. Each of them still has to fit broker semantics, idempotent completion, bounded worker pools, and observable rollout. A kernel that is twice as fast but cannot be safely retried, or cannot be told apart from queue wait in a trace, has not actually made the system better.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already think in queues, worker pools, and hot kernels, and RAII has trained you to care about who frees what. The shift here is that the ownership transfer is now a property the compiler checks at every hop of a distributed pipeline: API to broker, broker to worker, worker to durable result, CPU to GPU, and process to process. A payload that crosses a thread, a task, or a wire must be owned data that satisfies Send, not a pointer into request-local state you promise yourself is still alive.",
  },
  {
    title: "C# background",
    body: "Resist starting with a framework-shaped service: a DI container, a base service class, and ambient singletons resolved at runtime. The capstone stays calmer in Rust when it is one explicit domain model plus typed transport seams, with dependencies passed as owned values or handles you can see in the signature. There is no garbage collector to absorb a forgotten reference across an async boundary, so 'who keeps this alive until the worker finishes' becomes a design decision instead of a runtime accident.",
  },
  {
    title: "Go background",
    body: "Your service-decomposition instincts transfer directly, but two equivalences will mislead you. A broker queue is not a buffered channel with disk: it is a separate process with redelivery, acks, and at-least-once semantics you must design around. A Tokio task is not a goroutine: there is no runtime that quietly fixes shared-state ownership, so every spawn is an explicit move of owned data. Rust rewards making each queue, retry, and payload boundary visible in the type system and in metrics rather than trusting the runtime.",
  },
  {
    title: "Python background",
    body: "If your reflex is a Celery-style queue plus NumPy or PyTorch kernels, the building blocks map cleanly, but the discipline is stricter. Tokio is single-runtime concurrency without a GIL, so the dense graph and matrix kernels actually run in parallel and you, not an interpreter lock, decide where that parallelism is bounded. Task payloads must be typed and owned rather than loosely pickled dicts, which is what makes replay, verification, and schema evolution auditable instead of best-effort.",
  },
]

const domainModelSection = {
  title: "Domain model",
  body: "Everything downstream is shaped by this one type, so keep the outer contract small and durable. Split it in two: an envelope that owns identity and replay metadata, and a workload enum that names the real execution classes such as graph search or tiled matrix work. The envelope answers the operational questions (who, which attempt, which trace, is this a duplicate, does the input still match), and the enum answers the question the executor cares about (what kind of work is this). Keeping them separate means the transport never has to understand the compute, and the compute never has to understand the transport.",
  code: `#[derive(Debug, Clone)]
enum WorkloadSpec {
    GraphSearch { start: NodeId, goal: NodeId },
    MatrixTile { rows: usize, cols: usize, tile: usize },
}

#[derive(Debug, Clone)]
struct TaskEnvelope {
    task_id: String,
    tenant: String,
    attempt: u32,
    trace_id: String,
    dedupe_key: String,
    verification_root: [u8; 32],
    workload: WorkloadSpec,
}`,
}

const brokerSection = {
  title: "Message broker integration",
  body: "The broker is where the work stops being in-process and becomes at-least-once, so treat its rules as part of the design rather than as plumbing. Publish versioned envelopes, route by workload or shard, and acknowledge a message only after the durable effect or durable checkpoint has landed, never before. Retry and dead-letter policy are operational concerns that belong around the worker, not tangled into its inner business logic. The chapter on brokers covers the why; here the goal is to make those rules show up explicitly in the capstone.",
  bullets: [
    "Route graph and matrix work to separate queues when one slow class should not stall the other.",
    "Use stable message IDs or dedupe keys so duplicate delivery remains harmless.",
    "Keep publisher confirms, queue age, and retry rate visible to operators.",
  ],
  code: `let route = match envelope.workload {
    WorkloadSpec::GraphSearch { .. } => "tasks.graph",
    WorkloadSpec::MatrixTile { .. } => "tasks.matrix",
};

broker.publish(route, &envelope).await?;`,
}

const tokioSection = {
  title: "Async API service with Tokio",
  body: "The API edge does waiting-heavy work: it accepts the request, canonicalizes the input, computes or attaches the verification root, optionally persists submission state, and publishes one owned envelope. That is exactly the shape async is good at. The trap is concluding that async should spread inward. This is a thin Tokio shell wrapped around a synchronous domain core, and the graph and matrix kernels stay ordinary blocking Rust. Making every helper async to match the edge buys nothing and obscures where the real concurrency boundary is.",
  bullets: [
    "Use a semaphore or bounded channel so admission is already budgeted before the broker is saturated.",
    "Move owned payloads across `tokio::spawn` boundaries; do not borrow request-local data into later work.",
    "Treat join failure, broker failure, and validation failure as different operational events.",
  ],
  code: `let permit = semaphore.clone().acquire_owned().await?;
let envelope = build_envelope(request, trace_id)?;
let route = route_for(&envelope.workload);
broker.publish(route, &envelope).await?;
drop(permit);`,
}

const workerPoolSection = {
  title: "Worker pool",
  body: "A worker pool is defined by two things: who owns the next runnable item, and what counts as done. Keep both answers in one place. A single consumer can verify and dispatch, but the moment graph, matrix, and accelerator work share one undifferentiated pool, a slow class can quietly starve a fast one. Specialized lanes with their own bounded pools are how you stop that contention from being invisible. The structure matters more than raw speed: a pool with clear ownership and a clear completion rule can be made fast later, while a fast pool with muddy completion rules cannot be made correct later.",
  bullets: [
    "Keep one owner for mutable completion state and duplicate suppression.",
    "Bound local fan-out even when the broker already has prefetch or visibility limits.",
    "Use `JoinSet`, plain threads, Rayon, or specialist queues from workload shape, not from uniformity pressure.",
  ],
  code: `while let Some(delivery) = rx.recv().await {
    let envelope = verify_and_decode(delivery)?;
    match envelope.workload {
        WorkloadSpec::GraphSearch { start, goal } => {
            graph_tx.send(GraphSearchSpec { start, goal }).await?
        }
        WorkloadSpec::MatrixTile { rows, cols, tile } => {
            matrix_tx.send(MatrixTileSpec { rows, cols, tile }).await?
        }
    }
}`,
}

const merkleSection = {
  title: "Merkle-tree-backed task verification",
  body: "The point is not to prove cryptography sophistication. The point is to bind the worker to one canonical input set. Compute a root over the canonical task payload or over referenced chunks, then verify it before the worker performs the expensive side effect.",
  bullets: [
    "Version leaf encoding and odd-leaf policy exactly as you would for any other cross-service contract.",
    "Verify before durable effect, not after result commit.",
    "Store enough metadata for replay or dispute resolution: root, version, and optionally proof envelope details.",
  ],
  code: `struct VerificationEnvelope {
    task_id: String,
    tree_version: u16,
    verification_root: [u8; 32],
    leaf_count: u32,
}`,
}

const graphSection = {
  title: "Graph search workload",
  body: "The recurring mistake here is to model a graph as a web of nodes that hold references to their neighbors, which in Rust turns into a fight with the borrow checker the moment the graph mutates. Model it instead as one owner that holds the nodes plus stable integer handles that name them. The same representation works for BFS, Dijkstra, and A*, and because a handle is just a number, the worker payload is naturally serializable and safe to put on a queue.",
  bullets: [
    "Prefer a Vec of nodes plus a NodeId index for mutable sparse graphs, rather than reference-linked node objects.",
    "Expose frontier width, visited count, and hop or path cost in metrics so a slow search is explainable.",
    "Queue the search request itself, not borrowed node references or graph-local views that cannot cross a process boundary.",
  ],
}

const matrixSection = {
  title: "Matrix optimization workload",
  body: "Begin with the least clever thing that is correct: one flat row-major buffer and one straightforward CPU implementation whose output you can checksum. That baseline is what every later optimization is measured against. Tiling, sparse representations, and thread-level parallelism are real wins, but only once you can prove they produce the same numbers faster, and only when the workload is large or dense enough to justify the added complexity.",
  bullets: [
    "Keep the batch payload contiguous so the CPU, MPI, and GPU variants all share one clear host-side memory contract.",
    "Separate dense matrix work from sparse frontier-like work instead of hiding both behind one generic matrix object.",
    "Record a checksum or other deterministic output evidence before any performance claim is allowed to count.",
  ],
}

const accelerationSection = {
  title: "MPI or CUDA acceleration option",
  body: "Treat acceleration as a swappable engine behind a fixed contract, not as a second kind of task. The envelope, the verification root, and the completion semantics stay identical whether the work runs on one CPU core, across MPI ranks, or on a GPU. MPI earns its place when the dominant boundary is already cluster-scale decomposition; CUDA earns its place when batches are dense enough that the data transfer and kernel launch overhead are amortized. If neither is true, the plain CPU lane is not a fallback to be embarrassed about, it is the correct choice.",
  bullets: [
    "Keep a CPU or reduced-capacity fallback explicit for small or irregular work where an accelerator would lose to transfer overhead.",
    "Treat GPU queue age, transfer bytes, and launch count as first-class metrics, the same way you treat queue depth.",
    "Treat MPI as inter-process partitioning outside each rank, and ordinary Rust ownership rules inside each rank.",
  ],
}

const profilingSection = {
  title: "Profiling and observability",
  body: "When a distributed task is slow, the first job is to find out which layer is slow, not to start optimizing the kernel you happen to suspect. Instrument the path so end-to-end time decomposes into named segments: time waiting to enqueue, time waiting to be claimed, verification, execution, downstream publish, and durable completion. Once those segments are separately visible, the bottleneck usually names itself, and it is frequently queue wait rather than the inner loop everyone assumed.",
  bullets: [
    "Metrics: queue depth, oldest visible age, busy workers, retry rate, verification failure count, graph frontier width, matrix batch size, and fallback rate.",
    "Tracing: request submit, broker publish, queue claim, verification, graph or matrix execution, durable commit, and notify, all on one trace id.",
    "Profiles: CPU hot path, serialization cost, queue wait, blocking-pool pressure, and accelerator boundary cost.",
  ],
}

const refactorSection = {
  title: "Refactoring toward production quality",
  body: "Do not try to build the whole topology at once. Build it in milestones where each one leaves the system runnable, testable, and measurable, and where each one has an acceptance criterion you can actually check before moving on. The order is deliberate: get one correct path through a single process first, then make it survive the broker and replay, then specialize the lanes, and only then wire up the operator surface. Skipping ahead, for example adding a GPU lane before the single-process path is provably correct, is how a capstone ends up fast and wrong at the same time.",
  milestones: [
    {
      title: "Milestone 1 · Single-process reference path",
      body: "Implement typed envelopes, graph and matrix executors, and one durable completion API. Acceptance: deterministic unit tests and one correct end-to-end result.",
    },
    {
      title: "Milestone 2 · Brokered execution and idempotency",
      body: "Add versioned broker envelopes, dedupe key, bounded local worker admission, and durable finish-once logic. Acceptance: replay-safe integration tests and visible queue-age metrics.",
    },
    {
      title: "Milestone 3 · Specialized execution lanes",
      body: "Split graph and matrix queues or worker pools, then add optional MPI or CUDA lanes only where measured. Acceptance: same logical outputs plus workload-specific telemetry.",
    },
    {
      title: "Milestone 4 · Rollout and operator surface",
      body: "Add SLOs, burn alerts, shutdown tests, packaging lanes, and canary rules. Acceptance: one operator can explain one slow task from metrics to trace to durable record.",
    },
  ],
}

const productionPatterns = [
  "Keep the task envelope versioned, owned, and durable enough for replay: task ID, attempt, trace ID, dedupe key, verification root, and workload spec.",
  "Use Tokio for the waiting-heavy API and dispatch shell, but keep graph and matrix kernels in ordinary Rust, Rayon, MPI, or CUDA lanes chosen from measured workload shape.",
  "Bound every queue twice when needed: broker-side delivery or prefetch, then local in-process worker concurrency or channel capacity.",
  "Make duplicate completion harmless before you optimize throughput. Crash recovery and replay are part of the design center.",
  "Profile queue wait, verification, execution, and completion separately so the slow path is attributable.",
  "Test the capstone in layers: unit tests for workload kernels, integration tests for publish/claim/complete, and soak tests for retry, queue age, and drain behavior.",
]

const pitfalls = [
  "Borrowing request-local data into spawned work or broker envelopes. Distributed and async boundaries usually want owned payloads.",
  "Using one queue for fast graph jobs and slow matrix or GPU jobs, then calling the resulting tail-latency incident 'scheduler noise'.",
  "Verifying the Merkle root after the side effect instead of before it. That preserves none of the trust boundary you intended.",
  "Treating retries as free. Retry traffic is traffic and should share worker and queue budgets visibly.",
  "Optimizing graph or matrix kernels before measuring queue wait, reducer lag, or accelerator admission. The hottest local loop is often not the real capstone bottleneck.",
  "Packaging and deploying the capstone without a canary, queue-age alarms, or rollback artifact inventory. Distributed correctness is not only a code problem.",
]

const summaryPoints = [
  "A distributed Rust capstone is one composed system: typed domain model, broker boundary, Tokio API shell, bounded worker pools, verification policy, and measurable completion semantics.",
  "Graph and matrix workloads should remain explicit execution classes with their own storage and tuning assumptions.",
  "MPI and CUDA are optional execution lanes, not replacements for owned envelopes, idempotent completion, or queue budgets.",
  "Profiling and observability should separate queue wait, verification, execution, retry, and completion so the dominant latency layer stays obvious.",
  "Production quality arrives in milestones: correct single-process core, replay-safe broker path, specialized execution lanes, and rollout-ready telemetry and packaging.",
]

export function PageCh45CapstoneDistributedRustSystem() {
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
  const pageIndex = getPageIndexById("ch45-capstone-distributed-rust-system")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter30PageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const chapter31PageIndex = getPageIndexById("ch31-distributed-task-execution")
  const chapter32PageIndex = getPageIndexById("ch32-mpi-and-high-performance-computing")
  const chapter36PageIndex = getPageIndexById("ch36-distributed-tasks-profiling")
  const chapter37PageIndex = getPageIndexById("ch37-cuda-and-gpu-acceleration")
  const chapter38PageIndex = getPageIndexById("ch38-merkle-tree-games-and-challenges")
  const chapter33PageIndex = getPageIndexById("ch33-performance-oriented-rust")
  const chapter39PageIndex = getPageIndexById("ch39-graph-search-games")
  const chapter40PageIndex = getPageIndexById("ch40-matrix-optimization-games")
  const chapter43PageIndex = getPageIndexById("ch43-observability")
  const chapter44PageIndex = getPageIndexById("ch44-packaging-and-deployment")
  const exercisesPageIndex = getPageIndexById("ch45-capstone-distributed-rust-system-exercises")
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
          Chapter 45 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          The capstone assembles a distributed Rust service with bounded ingress, brokered work, replay-safe workers,
          verifiable payloads, compute executors, and observability. The business case is an auditable system that can be
          operated under load.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Builds on Chapters 25, 30, 31, 32, 36, 37, 38, 39, 40, 43, and 44
              </h3>
              <p className="text-sm text-muted-foreground leading-6">
                This chapter deliberately recombines the previous async, broker, distributed-task, Merkle, graph,
                matrix, profiling, observability, and deployment material into one coherent system. Treat it as an
                architecture review, not as a new disconnected topic.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter30PageIndex)}>
                Chapter 30
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter31PageIndex)}>
                Chapter 31
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter32PageIndex)}>
                Chapter 32
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter36PageIndex)}>
                Chapter 36
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter37PageIndex)}>
                Chapter 37
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter38PageIndex)}>
                Chapter 38
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter39PageIndex)}>
                Chapter 39
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter40PageIndex)}>
                Chapter 40
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Chapter 43
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter44PageIndex)}>
                Chapter 44
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A platform service accepts work over HTTP, routes it through a broker, verifies worker inputs, executes graph
            or matrix workloads, and optionally dispatches dense batches to MPI or CUDA lanes. The business requirement is
            a replay-safe, observable, and deployable architecture with explicit ownership, queue budgets, verification,
            and completion semantics.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            Every chapter up to this point handed you one piece of that sentence in isolation. The job now is to make the
            pieces agree with each other. The diagram below is the trip a single unit of work takes from a client request
            to a durable result. As you read the rest of the chapter, keep returning to it and ask the same question at
            each arrow: who owns the data on this side of the boundary, and what has to be true before it crosses?
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">One possible capstone topology</h4>
            </div>
            <MermaidDiagram
              chart={`flowchart TD\n  Client[Client request] --> API[Tokio API service]\n  API -->|owned envelope| Broker{Broker exchange}\n  Broker -->|tasks.graph| GQ[(graph queue)]\n  Broker -->|tasks.matrix| MQ[(matrix queue)]\n  GQ --> Verify[Verify root and dedupe]\n  MQ --> Verify\n  Verify --> Graph[Graph executor]\n  Verify --> Matrix[Matrix executor]\n  Matrix -.optional.-> Accel[MPI / CUDA lane]\n  Graph --> Done[Durable result and outbox]\n  Matrix --> Done\n  Accel --> Done\n  Done --> Notify[Notifier / downstream consumers]`}
              caption="One unit of work, traced end to end. The route splits fast graph jobs from heavy matrix jobs at the broker; verification happens before any expensive executor runs; durable completion is the single point that makes the work safe to forget."
            />
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>The capstone is one composed system: API shell, durable envelope, queue policy, worker lanes, verification, execution, and completion.</li>
              <li>Correctness starts with owned task boundaries and replay-safe finish-once state.</li>
              <li>Graph, matrix, MPI, and CUDA paths are execution lanes, not excuses to widen the outer contract.</li>
              <li>Rollout readiness requires profiling, observability, packaging, canary rules, and rollback artifacts alongside the code.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Capstone review questions</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Where does request-local data first become an owned durable envelope?</li>
              <li>What event makes work safe to forget: broker ack, durable result write, or finish-once checkpoint?</li>
              <li>Which workload classes deserve separate queues, worker pools, or specialist acceleration budgets?</li>
              <li>Which metric will tell you the real bottleneck is queueing, verification, execution, retry, or rollout policy?</li>
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
            <h3 className="text-lg font-semibold text-foreground">Pipeline walkthrough</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            The sections below walk the same pipeline left to right: the domain model that defines the unit of work, the
            broker that moves it, the Tokio shell that admits it, the worker pool that runs it, and the verification step
            that gates the expensive part. Each one is a boundary in the topology diagram above, and each one answers the
            ownership question for the data crossing it.
          </p>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{domainModelSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6">{domainModelSection.body}</p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{domainModelSection.code}</code>
            </pre>
            <p className="mt-3 text-sm text-muted-foreground leading-6">
              The important ownership rule is simple: the queue or broker carries an owned envelope. It does not carry a
              borrow into API-local request state. That single design choice removes a large amount of async and retry
              confusion immediately.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{brokerSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6">{brokerSection.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {brokerSection.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The whole routing decision is the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">match</code>{" "}
              on the workload variant: a graph job and a matrix job leave the same publisher but land in different queues.
              That one branch is what lets a slow matrix backlog grow without ever stalling a fast graph job behind it.
              Read the shape first, then the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Env[Owned envelope] --> Match{match workload}\n  Match -->|GraphSearch| RG[route = tasks.graph]\n  Match -->|MatrixTile| RM[route = tasks.matrix]\n  RG --> Pub[broker.publish]\n  RM --> Pub\n  Pub --> GQ[(graph queue)]\n  Pub --> MQ[(matrix queue)]`}
              caption="The workload variant chooses the route, and the route chooses the queue. Separate queues mean a slow class never blocks a fast one."
            />
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{brokerSection.code}</code>
            </pre>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{tokioSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6">{tokioSection.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {tokioSection.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The order of these four lines is the whole point. The handler waits for an admission permit before it builds
              anything, so backpressure is applied at the door rather than at the broker. It builds an owned envelope, not
              a borrow into the request, so the published work can outlive the handler. Trace the sequence below, then
              read the code: each step is one line.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant H as API handler\n  participant S as Semaphore\n  participant B as Broker\n  H->>S: acquire_owned (await)\n  S-->>H: permit (admission granted)\n  H->>H: build owned envelope\n  H->>B: publish(route, envelope)\n  B-->>H: confirm\n  H->>S: drop permit (slot freed)`}
              caption="Admission first, owned envelope second, publish third, release last. A bounded semaphore turns a burst into a wait instead of an overload."
            />
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{tokioSection.code}</code>
            </pre>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Revisit Tokio
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Revisit Observability
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{workerPoolSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6">{workerPoolSection.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {workerPoolSection.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              Notice what the dispatch loop does and does not do. It pulls one delivery, verifies and decodes it once,
              then sends the decoded spec down a workload-specific channel. It does not execute the graph or matrix work
              inline. That separation is what keeps the dispatcher thin and lets each lane have its own bounded pool.
              The diagram is the loop body; the code is the same thing written out.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Recv[rx.recv delivery] --> Verify[verify_and_decode]\n  Verify --> Branch{workload}\n  Branch -->|GraphSearch| GTx[graph_tx.send]\n  Branch -->|MatrixTile| MTx[matrix_tx.send]\n  GTx --> Recv\n  MTx --> Recv\n  GTx --> GPool[graph pool]\n  MTx --> MPool[matrix pool]`}
              caption="The consumer verifies once, then hands each workload to its own lane. The dispatcher never blocks on execution; the lanes absorb the cost."
            />
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{workerPoolSection.code}</code>
            </pre>
            <p className="mt-3 text-sm text-muted-foreground leading-6">
              A common production repair is exactly this: keep the dispatcher thin and the execution lanes specialized.
              Fast graph jobs and slow matrix or GPU jobs usually deserve separate budgets once the p99 latency matters,
              because a single shared pool lets the slow class quietly consume every worker the fast class needed.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{merkleSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6">{merkleSection.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {merkleSection.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The single rule that makes this worth doing is the position of the gate: recompute the root over the
              canonical input and compare it before the worker runs the expensive side effect, never after. If the roots
              disagree, the work stops and is dead-lettered instead of executing on input that drifted. The struct below
              is just the metadata you carry so that check is possible and auditable; the diagram is where it sits in the
              flow.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Claim[Claim delivery] --> Recompute[recompute root over input]\n  Recompute --> Cmp{root == envelope root?}\n  Cmp -->|yes| Exec[run expensive executor]\n  Cmp -->|no| DLQ[dead-letter, no side effect]\n  Exec --> Commit[durable result]`}
              caption="Verify before effect. A mismatch ends the trip with zero side effects; only a matching root reaches the executor."
            />
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{merkleSection.code}</code>
            </pre>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter38PageIndex)}>
                Revisit Merkle Trees
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Revisit Data Contracts
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{graphSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6">{graphSection.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {graphSection.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter39PageIndex)}>
                Revisit Graph Search
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter31PageIndex)}>
                Revisit Distributed Tasks
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{matrixSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6">{matrixSection.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {matrixSection.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter40PageIndex)}>
                Revisit Matrix Games
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter33PageIndex)}>
                Revisit Performance
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{accelerationSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6">{accelerationSection.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {accelerationSection.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter32PageIndex)}>
                Revisit MPI
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter37PageIndex)}>
                Revisit CUDA
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{profilingSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6">{profilingSection.body}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {profilingSection.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter36PageIndex)}>
                Revisit Distributed Profiling
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Revisit Observability
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">{refactorSection.title}</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">{refactorSection.body}</p>
            <div className="grid gap-4 lg:grid-cols-2">
              {refactorSection.milestones.map((milestone) => (
                <div key={milestone.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{milestone.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{milestone.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                This chapter deliberately ends with rollout and packaging because distributed correctness does not stop at
                code. The queue budget, telemetry surface, artifact shape, and rollback plan are part of the final system.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-2">How this lands depending on where you came from</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              You have almost certainly built something shaped like this capstone before: an ingress, a queue, a pool of
              workers, and some compute at the end. What changes in Rust is not the architecture but where the language
              forces a decision. The cards below name the mental-model shift, and the specific trap, for each background.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
            </div>
          </article>
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
                The capstone fails in production when the boundaries are optimized independently but specified poorly
                together. The root cause is usually contract drift: replay without idempotency, acceleration without queue
                budgets, or telemetry that observes only one layer of the path.
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
                  Example 1: task envelope, broker route, and verification root
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The API or submission shell emits one owned envelope with a workload-specific route and one explicit
                  verification root. This is the durable contract other processes will see.
                </p>
              </div>
              {codes.capstone_task_envelope_routing !== DEFAULT_CODES.capstone_task_envelope_routing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("capstone_task_envelope_routing")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Watch how the four printed lines come straight off one owned value. The example builds a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">TaskEnvelope</code>, derives the route
              from its workload variant, and reads the task id, route, root, and tenant back out. Run it to confirm the
              baseline, then change the workload to a matrix variant and watch the route flip to{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">tasks.matrix</code> without touching any
              other line. That is the whole submission contract in miniature.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Build[build envelope] --> Route[route_for workload]\n  Route --> Emit[print task / route / root / tenant]\n  Emit --> Out[durable contract]`}
              caption="One owned envelope in, one routed contract out. The route is a pure function of the workload variant."
            />
            <RustCodeEditor
              code={codes.capstone_task_envelope_routing}
              onChange={(newCode) => updateCode("capstone_task_envelope_routing", newCode)}
              onRun={() => runCode("capstone_task_envelope_routing")}
              output={outputs.capstone_task_envelope_routing ?? null}
              isRunning={isRunning === "capstone_task_envelope_routing"}
              filename="task_envelope_and_routing.rs"
              expectedOutput={"task = task-7\nroute = tasks.graph\nroot = 4242\ntenant = acme"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.capstone_task_envelope_routing}
              onRevert={() => resetCode("capstone_task_envelope_routing")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Owned envelope</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The queue receives one owned task contract rather than borrowed request-local state.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Broker route</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The route names the workload class, which makes queue splits and observability calmer later.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Verification</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The root is carried explicitly so the worker can reject drift before executing expensive side effects.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Multi-tenant identity</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Tenant or shard identity belongs on the envelope too, not only in one local API handler variable.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: worker pool executing graph and matrix workloads
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The worker pool owns a bounded queue, then dispatches two different workload classes without losing one
                  clear completion contract.
                </p>
              </div>
              {codes.capstone_worker_pool_workloads !== DEFAULT_CODES.capstone_worker_pool_workloads && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("capstone_worker_pool_workloads")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The three output lines map onto three facts: the pool completed every queued item, the graph lane produced
              a unit count, and the matrix lane produced a checksum. Follow the diagram one item at a time: each task is
              drained from the shared queue, dispatched to its lane, executed, and counted as complete. Run it, then add
              another graph or matrix task to the queue and watch only the matching tally and the completion count move.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Q[(bounded queue)] --> Pop[take next task]\n  Pop --> Kind{workload kind}\n  Kind -->|graph| G[graph executor -> units]\n  Kind -->|matrix| M[matrix executor -> checksum]\n  G --> C[completed += 1]\n  M --> C\n  C --> Q`}
              caption="One owner drains the queue and routes each item to a lane. Completed count, graph units, and matrix checksum are the three running tallies you see printed."
            />
            <RustCodeEditor
              code={codes.capstone_worker_pool_workloads}
              onChange={(newCode) => updateCode("capstone_worker_pool_workloads", newCode)}
              onRun={() => runCode("capstone_worker_pool_workloads")}
              output={outputs.capstone_worker_pool_workloads ?? null}
              isRunning={isRunning === "capstone_worker_pool_workloads"}
              filename="worker_pool_graph_and_matrix.rs"
              expectedOutput={"completed = 2\ngraph units = 10\nmatrix checksum = 40.0"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.capstone_worker_pool_workloads}
              onRevert={() => resetCode("capstone_worker_pool_workloads")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Queue owner</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The worker owns the next runnable item instead of scattering mutable completion state everywhere.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Graph lane</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Graph execution can keep stable handles and frontier metrics separate from dense numeric work.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Matrix lane</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Matrix work can later swap CPU, MPI, or CUDA executors without changing the outer task contract.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Completion</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The capstone should still record one durable finish-once checkpoint after these local results exist.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch45_capstone_distributed_rust_system/
              </code>{" "}
              including the two editor-backed examples plus one Tokio worker-topology sketch that shows how the API shell
              and bounded worker lane fit together outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to assemble the capstone architecture from earlier chapters, define
            implementation milestones and acceptance criteria, and profile then refactor the system from queue age,
            retry, and execution evidence rather than from intuition.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 45 Exercises
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

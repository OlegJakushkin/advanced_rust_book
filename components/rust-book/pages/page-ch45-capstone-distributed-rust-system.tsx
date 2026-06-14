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
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const architectureDiagram = `client
  -> Tokio API service
  -> versioned broker envelope
  -> queue shard
  -> verify root + dedupe gate
  -> worker pool
     -> graph executor
     -> matrix executor
     -> optional MPI / CUDA lane
  -> durable result + outbox
  -> notifier / downstream consumers`

const mentalModelPoints = [
  {
    title: "The capstone is a boundary composition exercise first",
    body: "The hard part is not writing one clever worker. It is deciding where ownership changes, where delivery becomes at-least-once, where verification happens, and where profiling should separate queue wait from execution time.",
  },
  {
    title: "One task envelope should explain the whole trip",
    body: "A durable task needs stable identity, retry metadata, trace identity, workload shape, and a verification root. If those fields are implicit or reconstructed later, replay and incident response both get harder.",
  },
  {
    title: "Local performance and distributed correctness must meet in one design",
    body: "Graph search, matrix optimization, and optional accelerator paths still have to fit broker semantics, idempotent completion, bounded worker pools, and observable rollout behavior.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You may already think in terms of queues, worker pools, and hot kernels. Rust's main correction is that the ownership transfer becomes explicit at every step: API to broker, broker to worker, worker to durable completion, CPU to GPU, and process to process.",
  },
  {
    title: "C# background",
    body: "Do not rebuild this as a framework-shaped service with ambient dependency injection first. Rust is calmer when the capstone is one explicit domain model plus typed transport seams, not one hierarchy of service objects.",
  },
  {
    title: "Go background",
    body: "A broker queue is not a channel with storage. A Tokio task is not a goroutine with invisible ownership repair. Rust rewards making every queue, retry, and payload boundary visible in code and metrics.",
  },
]

const domainModelSection = {
  title: "Domain model",
  body: "Keep the outer task contract small and durable. The envelope should own identity and replay metadata, while the workload enum should name real execution classes such as graph search or tiled matrix work.",
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
  body: "Publish versioned envelopes, route by workload or shard, and ack only after the durable effect or durable checkpoint. Keep transient retry and terminal dead-letter policy outside the worker's inner business logic.",
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
  body: "The API edge should accept the request, canonicalize input, compute or attach the verification root, persist submission state if required, and publish one owned envelope. This is a Tokio shell around a synchronous domain core, not a reason to make every helper async.",
  bullets: [
    "Use a semaphore or bounded channel so admission is already budgeted before the broker is saturated.",
    "Move owned payloads across `tokio::spawn` boundaries; do not borrow request-local data into later work.",
    "Treat join failure, broker failure, and validation failure as different operational events.",
  ],
  code: `let permit = semaphore.clone().acquire_owned().await?;
let envelope = build_envelope(request, trace_id)?;
broker.publish(&envelope).await?;
drop(permit);`,
}

const workerPoolSection = {
  title: "Worker pool",
  body: "A good worker pool owns clear queues and clear completion rules. One consumer can verify and dispatch, but specialized execution lanes often deserve their own bounded pools so graph, matrix, and accelerator work do not contend blindly.",
  bullets: [
    "Keep one owner for mutable completion state and duplicate suppression.",
    "Bound local fan-out even when the broker already has prefetch or visibility limits.",
    "Use `JoinSet`, plain threads, Rayon, or specialist queues from workload shape, not from uniformity pressure.",
  ],
  code: `while let Some(delivery) = rx.recv().await {
    let envelope = verify_and_decode(delivery)?;
    match envelope.workload {
        WorkloadSpec::GraphSearch(spec) => graph_tx.send(spec).await?,
        WorkloadSpec::MatrixTile(spec) => matrix_tx.send(spec).await?,
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
  body: "Model the graph as one owner plus stable handles. That keeps execution calm for BFS, Dijkstra, or A* and makes the worker payload naturally serializable.",
  bullets: [
    "Prefer `Vec<Node>` plus `NodeId` for mutable sparse graphs.",
    "Expose frontier width, visited count, and hop or path cost in metrics.",
    "Queue the search request, not borrowed node references or graph-local views.",
  ],
}

const matrixSection = {
  title: "Matrix optimization workload",
  body: "Start from one flat row-major representation and one correct CPU baseline. Add tiling, sparse representation, or thread-level parallelism only when the workload justifies it.",
  bullets: [
    "Keep the batch payload contiguous so CPU, MPI, and GPU variants all share one clear host-side contract.",
    "Separate dense matrix work from sparse frontier-like work instead of hiding both behind one generic matrix object.",
    "Record checksum or deterministic output evidence before performance claims count.",
  ],
}

const accelerationSection = {
  title: "MPI or CUDA acceleration option",
  body: "Acceleration is a replaceable execution lane, not a different task model. MPI fits when the dominant boundary is already cluster decomposition. CUDA fits when dense batches amortize transfer and launch cost. Both should preserve the same logical task envelope and completion contract.",
  bullets: [
    "Keep CPU fallback or reduced-capacity fallback explicit for small or irregular work.",
    "Treat GPU queue age, transfer bytes, and launch count as first-class metrics.",
    "Treat MPI as inter-process partitioning outside the rank, and ordinary Rust ownership rules inside each rank.",
  ],
}

const profilingSection = {
  title: "Profiling and observability",
  body: "Profile the capstone by latency layer and execution lane. End-to-end time should decompose into enqueue delay, claim delay, verification, execution, downstream publish, and durable completion.",
  bullets: [
    "Metrics: queue depth, oldest visible age, busy workers, retry rate, verification failure count, graph frontier width, matrix batch size, and fallback rate.",
    "Tracing: request submit, broker publish, queue claim, verification, graph or matrix execution, durable commit, and notify.",
    "Profiles: CPU hot path, serialization cost, queue wait, blocking-pool pressure, and accelerator boundary cost.",
  ],
}

const refactorSection = {
  title: "Refactoring toward production quality",
  body: "Build the capstone in milestones that each leave the system renderable, testable, and measurable.",
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
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">One possible capstone topology</h4>
            </div>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{architectureDiagram}</code>
            </pre>
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
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

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
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{workerPoolSection.code}</code>
            </pre>
            <p className="mt-3 text-sm text-muted-foreground leading-6">
              A common production repair is to keep the dispatcher thin and the execution lanes specialized. Fast graph
              jobs and slow matrix or GPU jobs usually deserve separate budgets if the p99 matters.
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
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
            <div className="grid gap-3 lg:grid-cols-3">
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

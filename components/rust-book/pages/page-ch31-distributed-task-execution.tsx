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
    title: "Distributed task execution is owned work plus recovery policy",
    body: "The task payload must become an owned, serializable handoff before another machine can run it. After that handoff, the hard design questions are not borrowing questions. They are delivery, retry, timeout, and replay questions.",
  },
  {
    title: "Exactly-once side effects are an application property, not a queue default",
    body: "The durable default is at-least-once processing. That means duplicates are normal and must be made harmless through idempotency keys, transactional checkpoints, or naturally repeat-safe handlers.",
  },
  {
    title: "Leases and queue budgets are part of the control plane",
    body: "A lease is a temporary ownership claim with an expiry. Visibility timeouts, retry budgets, worker concurrency caps, and queue depth are not tuning trivia. They are part of whether the system keeps moving under failure.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Think less about thread pools and more about replay-safe ownership across a process boundary. Once work is durable and remote, the hard bug is usually duplicate or lost effect, not raw pointer lifetime.",
  },
  {
    title: "C# background",
    body: "A durable queue is not the same thing as `Task` scheduling or a thread pool. The interesting design work is where the handler commits state, how it retries, and what metadata it carries for tracing and replay.",
  },
  {
    title: "Go background",
    body: "A distributed queue is not a channel with more latency. Channels coordinate memory-local owners. A distributed task system coordinates serialized work, failure recovery, and pacing across services or machines.",
  },
]

const taskQueueCards = [
  {
    title: "Task queues",
    body: "A task queue decouples submission time from execution time. That buys elasticity and failure isolation, but it also means queue depth, task age, and replay behavior become part of the service budget.",
  },
  {
    title: "Pull-based workers",
    body: "A pull model is the usual default. Workers claim visible tasks when they have capacity. That keeps admission explicit and makes leasing, prefetch, and fairness easier to reason about.",
  },
  {
    title: "Push-based dispatch",
    body: "Push is useful when one coordinator must assign work directly, but it centralizes more scheduling state. Use it when locality or specialized resource placement is the real requirement.",
  },
  {
    title: "Sharded work distribution",
    body: "Shard by tenant, key, or resource when one task stream would otherwise create hot contention or ordering ambiguity. Sharding is often a correctness tool as much as a scaling tool.",
  },
]

const deliveryCards = [
  {
    title: "At-least-once processing",
    body: "The system may deliver the same logical task more than once. That is the calm assumption for production review because crashes, leases, and redelivery all make it possible.",
  },
  {
    title: "Exactly-once side effects",
    body: "End-to-end exactly-once side effects usually require an application-level design: unique operation keys, dedupe storage committed with the effect, or a naturally repeat-safe update path.",
  },
  {
    title: "At-most-once processing",
    body: "At-most-once is simpler operationally, but it trades replay safety for loss risk. Use it only when dropping work is acceptable or when the task is already a soft signal rather than a durable obligation.",
  },
]

const leaseCards = [
  {
    title: "Leasing and visibility timeouts",
    body: "A lease says 'this worker owns the task for now.' A visibility timeout hides the task from other workers for that lease duration. If the worker crashes or misses the deadline, the task becomes claimable again.",
  },
  {
    title: "Lease duration is a risk tradeoff",
    body: "A short lease increases duplicate execution risk if work is slow. A long lease delays recovery from a dead worker. The right timeout follows task cost, heartbeat design, and operator tolerance for replay.",
  },
  {
    title: "Heartbeats and renewals",
    body: "Long-running tasks often renew their lease rather than claiming one enormous initial timeout. That keeps recovery reasonably fast without forcing needless redelivery for healthy long tasks.",
  },
]

const retryIsolationCards = [
  {
    title: "Distributed retries",
    body: "Retries should be explicit about class, count, and delay. Transient network failure, dependency throttling, and temporary resource pressure may justify retry. Malformed input and permanent rule violations usually do not.",
  },
  {
    title: "Failure isolation",
    body: "One noisy task class should not stall every worker lane. Split queues, concurrency caps, or worker pools by domain or tenant when replay or slowdown in one path would otherwise contaminate unrelated work.",
  },
  {
    title: "Retry traffic is still traffic",
    body: "A retry lane consumes queue slots, worker time, and downstream capacity. Count it explicitly. An uncapped retry stream is just delayed overload.",
  },
  {
    title: "Terminal failure paths",
    body: "Poison tasks need a terminal path: dead-letter queue, quarantine bucket, manual review lane, or explicit discard policy. Endless requeue is not resilience.",
  },
]

const aggregationGraphCards = [
  {
    title: "Result aggregation",
    body: "A distributed task system often needs one reducer or coordinator to collect partial results, track completion, and publish one final outcome. That aggregation path needs its own durability and timeout policy.",
  },
  {
    title: "Fan-in is a pacing boundary",
    body: "If ten workers can finish faster than one reducer can merge, the reducer becomes the bottleneck. Aggregation queues, partial checkpoints, and bounded merge concurrency matter under real load.",
  },
  {
    title: "Scheduling large task graphs",
    body: "Large DAG schedulers maintain a ready frontier: tasks whose dependencies are satisfied. The scheduler's real work is dependency tracking, fairness, and resource budgeting, not only topological correctness.",
  },
  {
    title: "Graph execution wants stable identities",
    body: "A task graph is easier to reason about when each node has one durable task ID, one trace lineage, and explicit dependency edges rather than implicit positional meaning.",
  },
]

const traceCards = [
  {
    title: "Distributed tracing",
    body: "Every task envelope should carry trace context, not only business payload. Queue wait, lease claim time, handler duration, downstream calls, and aggregation all belong in the same causal chain.",
  },
  {
    title: "Queue latency is a real span",
    body: "A task may be cheap to run but expensive to wait. Treat enqueue-to-claim delay as its own signal. Otherwise the trace only shows handler time and hides the true backlog story.",
  },
  {
    title: "Large task graphs need parent-child clarity",
    body: "A node should know whether it is a root, a child of one prior step, or a join point after several predecessors. That lineage matters for debugging critical paths and for replay tooling.",
  },
]

const profilingChecklist = [
  "Measure queue wait time separately from handler run time.",
  "Track lease expiry rate, redelivery rate, and idempotency-hit rate.",
  "Count local serialization, deserialization, and compression cost when tasks cross process boundaries.",
  "Profile reducer or aggregation hotspots, not only workers.",
  "Track worker saturation, retry amplification, and task graph frontier size.",
  "Inspect critical-path length in large DAG runs before assuming more workers will help.",
]

const productionPatterns = [
  "Keep task envelopes explicit: task ID, attempt, trace context, and versioned payload.",
  "Place the durable completion checkpoint next to the durable side effect so replay becomes harmless.",
  "Use leases and visibility timeouts for crash recovery, then cap local worker concurrency so one queue does not explode into an unbounded in-process flood.",
  "Isolate failure domains with sharded queues, per-stage budgets, or separate worker pools when one retry storm should not stall unrelated work.",
  "Make result aggregation an owned subsystem with its own backlog, timeout, and observability budget.",
  "Log and measure queue age, lease renewal lag, duplicate suppression, retry rate, and critical-path timing before the first incident teaches you anyway.",
]

const pitfalls = [
  "Treating the broker or queue as if it solved exactly-once semantics automatically.",
  "Choosing one visibility timeout for every task class, then discovering that short jobs and long jobs fail differently.",
  "Requeueing permanent failures forever because the transport API made it easy.",
  "Draining a distributed queue into unbounded local task creation and moving overload from the broker into your heap.",
  "Ignoring tracing context until a large task graph fails in the middle and nobody can reconstruct causal order quickly.",
  "Profiling only handler code while queue wait, serialization, or aggregation is the real bottleneck.",
]

export function PageCh31DistributedTaskExecution() {
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
  const pageIndex = getPageIndexById("ch31-distributed-task-execution")
  const chapter22PageIndex = getPageIndexById("ch22-multithreading-in-rust")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter26PageIndex = getPageIndexById("ch26-task-libraries-and-parallel-execution")
  const chapter30PageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const exercisesPageIndex = getPageIndexById("ch31-distributed-task-execution-exercises")
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
          Chapter 31 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Distributed task systems need durable handoff, leases, retries, idempotency, tracing, and recovery policy. This
          chapter models those requirements in Rust worker and queue boundaries.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 22, 25, 26, and 30</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 22 covered thread ownership and channels inside one process. Chapter 25 covered Tokio task
                orchestration and graceful shutdown. Chapter 26 separated waiting-heavy runtimes from CPU pools and bounded
                queues. Chapter 30 covered AMQP brokers and at-least-once delivery. This chapter generalizes those ideas to
                distributed task systems as a whole.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter22PageIndex)}>
                Chapter 22
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter26PageIndex)}>
                Chapter 26
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter30PageIndex)}>
                Chapter 30
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A media pipeline ingests uploads, transcodes variants, generates thumbnails, scans content, and publishes one
            final completion record. The business requirement is durable distributed work with leases, retry budgets,
            idempotent completion, graph-aware aggregation, and traceable recovery after worker failure.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Define the owned task envelope before choosing a queue backend.</li>
              <li>Choose delivery semantics assumptions next, usually at-least-once.</li>
              <li>Pick lease, retry, and failure-isolation policy before tuning throughput.</li>
              <li>Make tracing and profiling part of the scheduler contract, not an afterthought.</li>
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
            <h4 className="font-semibold text-foreground mb-3">Task queues and work distribution models</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {taskQueueCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`submit -> queued -> leased -> running -> acked
                 \\-> retry -> queued again
                 \\-> terminal failure -> dead-letter`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Exactly-once vs at-least-once processing</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {deliveryCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                When another engineer says “exactly once,” ask whether they mean transport delivery, handler execution, or
                durable side effects. Those are different claims.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Leasing and visibility timeouts</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {leaseCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Lease design is really failure-recovery design. A distributed worker should be assumed killable at any point.
                The queue recovers by lease expiry. The application recovers by idempotent completion.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Distributed retries and failure isolation</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {retryIsolationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Result aggregation and scheduling large task graphs</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {aggregationGraphCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`fetch -> parse -> { enrich, store } -> notify
frontier 0: fetch
frontier 1: parse
frontier 2: enrich, store
frontier 3: notify`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Distributed tracing</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {traceCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`struct TaskEnvelope {
    task_id: String,
    attempt: u32,
    trace_id: String,
    parent_span_id: Option<String>,
    dedupe_key: String,
}`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Distributed tasks profiling</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {profilingChecklist.map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A distributed task system often fails because it is profiled like an in-process function call. Queue wait,
                replay, serialization, and aggregation are the real cost centers more often than the task body alone.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Coming from C++, C#, or Go</h4>
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
                The hardest distributed-task bug is often not a worker crash. It is a silently wrong recovery model: replay
                without idempotency, retry without a budget, or tracing without queue-age visibility.
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
                <h4 className="font-semibold text-foreground">Example 1: lease queue with visibility timeout and idempotent completion</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One worker claims a task, misses its lease, and another worker reclaims it. The application-side
                  completion path still makes the duplicate harmless.
                </p>
              </div>
              {codes.distributed_tasks_lease_idempotent !== DEFAULT_CODES.distributed_tasks_lease_idempotent && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("distributed_tasks_lease_idempotent")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.distributed_tasks_lease_idempotent}
              onChange={(newCode) => updateCode("distributed_tasks_lease_idempotent", newCode)}
              onRun={() => runCode("distributed_tasks_lease_idempotent")}
              output={outputs.distributed_tasks_lease_idempotent ?? null}
              isRunning={isRunning === "distributed_tasks_lease_idempotent"}
              filename="lease_queue_idempotent_worker.rs"
              expectedOutput={"claimed = task-1\nredelivered = task-1\ncompleted = 1\nduplicates ignored = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.distributed_tasks_lease_idempotent}
              onRevert={() => resetCode("distributed_tasks_lease_idempotent")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Lease</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The queue records one temporary ownership claim plus a deadline.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Visibility</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The task disappears locally until the lease expires.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Replay</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A redelivery is expected behavior after lease expiry, not a surprise incident.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Idempotency</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Completion recording makes the second finish attempt harmless.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: task-graph scheduling, result aggregation, and trace propagation</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A tiny DAG scheduler runs tasks whose dependencies are complete, accumulates outputs, and keeps one trace
                  lineage for the whole graph.
                </p>
              </div>
              {codes.distributed_tasks_graph_trace !== DEFAULT_CODES.distributed_tasks_graph_trace && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("distributed_tasks_graph_trace")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.distributed_tasks_graph_trace}
              onChange={(newCode) => updateCode("distributed_tasks_graph_trace", newCode)}
              onRun={() => runCode("distributed_tasks_graph_trace")}
              output={outputs.distributed_tasks_graph_trace ?? null}
              isRunning={isRunning === "distributed_tasks_graph_trace"}
              filename="task_graph_scheduler_and_trace.rs"
              expectedOutput={"completed = 5\naggregate = 31\nfinal = notify\ntrace = trace-7"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.distributed_tasks_graph_trace}
              onRevert={() => resetCode("distributed_tasks_graph_trace")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Ready frontier</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Only dependency-satisfied nodes enter the runnable set.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Aggregation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Partial outputs roll into one final aggregate under one owner.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tracing</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One trace ID ties the graph together across several task boundaries.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Scaling note</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Large graphs need fairness, quotas, and persistence beyond this tiny demo.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch31_distributed_task_execution/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to design a lease-based worker, reason about at-least-once execution with
            idempotency, centralize retry and DLQ policy, and trace one distributed task graph end to end.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 31 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Distributed task execution begins with an owned task envelope and a recovery model, not with a queue brand.</li>
            <li>At-least-once processing is the durable default assumption; exactly-once side effects require application-level design.</li>
            <li>Leases and visibility timeouts are crash-recovery tools whose duration is a tradeoff, not a magic number.</li>
            <li>Retries, DLQs, and failure isolation belong in one explicit control plane instead of being copied into each handler.</li>
            <li>Result aggregation, task-graph scheduling, distributed tracing, and profiling all need their own visible budgets and metrics.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

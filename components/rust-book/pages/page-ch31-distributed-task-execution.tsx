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
    title: "A distributed task is owned work plus a recovery policy",
    body: "Before another machine can run your work, the payload has to leave your address space. It is serialized into bytes, written somewhere durable, and read back by a process that shares none of your stack. The moment that crossing happens, Rust's borrow checker stops helping you, because there is no longer a borrow to check. The questions that replace it are operational: how is the work delivered, what happens if delivery is duplicated, when does an in-flight task time out, and how is it replayed after a crash.",
  },
  {
    title: "Exactly-once side effects are something you build, not something the queue gives you",
    body: "Every durable broker you are likely to deploy promises at-least-once delivery, which is an honest way of saying it will sometimes deliver the same task twice. A worker can finish the work, crash before acknowledging it, and have the task redelivered to a peer. So the default truth on the wire is that duplicates are normal. End-to-end exactly-once is reached only at the application layer, through idempotency keys, a dedupe record committed in the same transaction as the effect, or a handler whose update is naturally repeat-safe.",
  },
  {
    title: "Leases, timeouts, and concurrency caps are the control plane, not tuning trivia",
    body: "A lease is a temporary ownership claim with an expiry: it says one worker owns this task for now, and if that worker goes quiet the task returns to the pool. Visibility timeouts, retry budgets, per-worker concurrency caps, and queue depth are not knobs you reach for after the system is built. Together they decide whether the system keeps moving when a worker dies, a dependency throttles, or the backlog spikes. Treat them as part of the design, reviewed like an API.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "In-process you reason about pointer lifetime and who calls delete. Across a queue boundary the value is serialized, copied, and may run twice, so the lifetime question is replaced by a replay question. The bug that hurts is no longer use-after-free; it is a side effect applied a second time after the first worker was presumed dead. Design the owned envelope and the idempotent commit, not the destructor.",
  },
  {
    title: "C# background",
    body: "A durable queue is not Task.Run, a ThreadPool, or even a hosted BackgroundService. Those schedule work inside one process that you trust to stay up. A distributed queue assumes the process will die mid-handler. The interesting code is therefore where the handler commits its state, how it classifies a retry, and what trace and dedupe metadata it carries so a different machine can finish the same logical job safely.",
  },
  {
    title: "Go background",
    body: "A distributed queue is not a buffered channel with more latency. A channel coordinates goroutines that share one address space and one lifetime; close it and everyone agrees the work is over. A task system coordinates serialized payloads across machines that fail independently, so leases, redelivery, and dead-lettering replace the close-and-range idiom. Worker count is admission control here, not just GOMAXPROCS.",
  },
  {
    title: "Python background",
    body: "If your reflex is Celery or RQ, the shift is that delivery is at-least-once by default rather than something the framework quietly handles. The @task decorator hides retry, ack, and visibility behind config; here you make those explicit in the envelope and the handler. Ordering is not guaranteed, results are not magically collected, and an unacked task will run again, so write handlers that are safe to repeat from the first line.",
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
          Once work leaves your process for another machine, the borrow checker can no longer help. What protects you
          instead is durable handoff, leases, retries, idempotency, and traceable recovery. This chapter shows how those
          requirements show up as concrete shapes in Rust worker and queue boundaries.
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
            A media platform ingests an upload, transcodes several quality variants, generates thumbnails, scans the
            content for policy violations, and finally publishes one completion record that the rest of the product reads.
            None of those steps run in the request that triggered them. They run on a fleet of workers that can be
            deployed, scaled, and killed at any moment. The business requirement is durable distributed work: leases so a
            dead worker's task is recovered, retry budgets so a flaky dependency does not turn into an infinite loop,
            idempotent completion so a redelivered task does not double-publish, graph-aware aggregation so the final
            record waits for every variant, and tracing so an operator can reconstruct what happened after the fact.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The trap for an engineer arriving from a single-process background is to reach for the queue brand first.
            The queue is the easy part. The hard part is the contract you wrap around it: what an in-flight task means,
            what a duplicate means, and what recovery looks like when a machine disappears mid-job. The decision order
            below puts that contract before the throughput tuning.
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
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            The shape of the whole scenario is a fan-out followed by a fan-in. One submission turns into several
            independent worker tasks, each pulling from the same durable queue, and a single coordinator waits for all of
            them before it writes the completion record. Hold this picture in mind for the rest of the chapter: the queue
            is the shared boundary, the workers are interchangeable and disposable, and the coordinator is the one place
            that knows the job is truly done.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Submit[Upload submitted] --> Q[(durable task queue)]\n  Q --> W1[transcode worker]\n  Q --> W2[thumbnail worker]\n  Q --> W3[content scan worker]\n  W1 --> Agg[completion coordinator]\n  W2 --> Agg\n  W3 --> Agg\n  Agg --> Done[publish completion record]`}
            caption="One upload fans out to disposable workers through a shared queue, then fans back in to a single coordinator that publishes the final record."
          />
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A task queue exists to separate the moment a request is made from the moment the work is done. The submitter
              writes a durable record and returns immediately; a worker picks the record up later, when it has capacity.
              That decoupling is what buys you elasticity and failure isolation, but it also means three things you used
              to ignore become part of your service budget: how deep the queue is, how old the oldest task is, and how a
              task that fails halfway gets replayed. The cards below contrast the common ways work is handed from queue to
              worker; the diagram after them is the lifecycle every one of those models has to implement.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {taskQueueCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              Every task moves through the same small state machine no matter which distribution model you pick. The two
              branches worth staring at are the loop back to <span className="font-medium text-foreground">Queued</span>{" "}
              on retry and the one-way exit to <span className="font-medium text-foreground">DeadLetter</span>. A system
              without that terminal exit will requeue a permanently broken task forever, which is the most common way a
              queue quietly turns into an infinite loop.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Queued: submit\n  Queued --> Leased: worker claims\n  Leased --> Running: handler starts\n  Running --> Acked: success\n  Running --> Queued: lease expires (crash)\n  Running --> Retry: transient failure\n  Retry --> Queued: requeue with backoff\n  Running --> DeadLetter: permanent failure\n  Acked --> [*]\n  DeadLetter --> [*]`}
              caption="The task lifecycle. Retry loops back to Queued; a lease expiry also returns the task to the pool; only DeadLetter and Acked are terminal."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Exactly-once vs at-least-once processing</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Delivery semantics describe what the system promises about how many times your handler runs for one logical
              task. There are three honest answers, and only one of them is the production default. At-least-once is what
              durable queues actually give you, because the safe move after a crash is to redeliver. At-most-once trades
              that safety for the risk of silently dropping work. True exactly-once across the whole path is not a setting
              you enable; it is something you assemble from at-least-once delivery plus deduplication you own.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A lease is how the queue answers the question every distributed system eventually faces: what happens to a
              task whose worker stopped responding. When a worker claims a task, the queue hands it a lease with an expiry
              and hides the task from everyone else for that window, which is the visibility timeout. As long as the
              worker is healthy it finishes the work and acknowledges the task before the lease runs out. If it crashes,
              the lease simply expires and the task becomes claimable again by a peer. Nothing detects the crash directly;
              the absence of an acknowledgement is the signal.
            </p>
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
                The queue recovers by lease expiry. The application recovers by idempotent completion. Those are two
                separate guarantees, and you need both: lease expiry alone gets the task run again, but only idempotent
                completion keeps the second run from doing damage.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Distributed retries and failure isolation</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Retry is the most over-applied tool in this whole space, because the transport usually makes blind requeue a
              one-line call. The discipline is to classify failures before you retry them. A timeout to a throttled
              dependency is worth another attempt after a backoff; a malformed payload or a rule violation will fail
              identically every time, so retrying it just burns capacity and delays the moment someone notices. The
              diagram below shows the second half of the discipline, isolation: keeping a noisy task class on its own
              queue and worker pool so its retry storm cannot starve the lanes that are still healthy.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  In[incoming task] --> C{classify failure}\n  C -->|transient| R[retry with backoff]\n  R -->|budget left| In\n  R -->|budget spent| DLQ[(dead-letter queue)]\n  C -->|permanent| DLQ`}
              caption="First half: retry is a budgeted loop. A transient failure retries with backoff while budget remains; a spent budget or a permanent failure goes to the dead-letter queue."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The second half is the isolation discipline. Classification decides whether a task retries; isolation
              decides where its retries run, so one noisy class cannot starve healthy lanes:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  In[incoming task] -.runs on.-> PoolA[domain A pool]\n  Other[noisy task class] -.isolated to.-> PoolB[domain B pool]`}
              caption="Second half: routing tasks of different classes onto separate worker pools keeps one retry storm contained to its own pool instead of starving the rest."
            />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Most real work is not one task; it is a small graph of tasks with dependencies. A scheduler for that graph
              does not run nodes in source order. It maintains a ready frontier, the set of nodes whose dependencies are
              all complete, and it only schedules from that frontier. When a node finishes, its outputs are folded into a
              running aggregate and any successors that just became unblocked join the frontier. The genuinely hard part
              is rarely the topological order; it is the bookkeeping around it, dependency tracking, fairness between
              graphs, resource quotas, and the fact that fan-in concentrates load on one reducer.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Read the diagram as a sequence of frontiers, not a static picture. The graph starts with{" "}
              <span className="font-medium text-foreground">fetch</span> alone in the frontier. Once it completes,{" "}
              <span className="font-medium text-foreground">parse</span> unblocks. Parsing then unblocks{" "}
              <span className="font-medium text-foreground">enrich</span> and{" "}
              <span className="font-medium text-foreground">store</span> together, which is where parallelism appears, and{" "}
              <span className="font-medium text-foreground">notify</span> is the join point that must wait for both before
              it can run. That final join is exactly the fan-in pacing boundary the cards warn about.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  fetch[fetch] --> parse[parse]\n  parse --> enrich[enrich]\n  parse --> store[store]\n  enrich --> notify[notify]\n  store --> notify`}
              caption="A four-frontier task graph. fetch then parse run alone; enrich and store run in parallel; notify is the join point that waits for both."
            />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              {aggregationGraphCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Distributed tracing</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              In one process a stack trace tells you the causal chain. Across a queue there is no shared stack, so the
              causal chain has to be carried inside the message itself. That is why a production task envelope holds more
              than the business payload: it carries the identity and lineage that let an operator stitch a span in one
              worker to its parent in another. The struct below is the minimum useful envelope. Note that{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">attempt</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">dedupe_key</code> are not tracing fields
              by accident; the same metadata that makes a task traceable also makes it safe to replay.
            </p>
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
    payload: Vec<u8>,
}`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling distributed tasks</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The reflex carried over from single-process work is to profile the handler, find the hot function, and
              optimize it. In a distributed task system that reflex usually points at the wrong thing. A task can be
              cheap to run and expensive to wait for, so the first number worth separating is queue wait time versus
              handler run time. After that, the costs that hide are the ones that only exist because work crosses a
              process boundary: serialization, redelivery, and the reducer that everything fans into.
            </p>
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
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Notes for C++, C#, Go, and Python engineers</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Most engineers arrive at distributed tasks with a mental model from another language's concurrency story, and
            the model is usually close enough to be dangerous. The shift is the same in every case: the primitives you
            trusted assumed one process with one lifetime, and a task system assumes many processes that fail
            independently. Each card below names the specific instinct to drop and the one to put in its place.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
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
          <p className="text-sm text-muted-foreground leading-6">
            These are the habits that separate a task system that survives its first incident from one that creates it.
            None of them are exotic; the value is in doing them before you need to, because each one is much cheaper to
            build in than to retrofit under load.
          </p>
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
          <p className="text-sm text-muted-foreground leading-6">
            Nearly every one of these starts as a reasonable assumption carried over from single-process work. They are
            listed not because they are obscure but because they are easy to ship and slow to notice, surfacing only when
            the system is already under the load that exposes them.
          </p>
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
          <p className="text-sm text-muted-foreground leading-6">
            Both examples are deliberately small enough to run in the editor, and each one models a flow we have already
            drawn. Read the short note and the diagram above each listing before the code, so the variables in the
            program map onto a shape you already recognize. Press Run first to anchor the baseline output, then change
            something and re-run.
          </p>

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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: this is the lease lifecycle from the core-concepts diagram, played out between two
              workers. Worker A claims the task and then goes quiet, so its lease expires and the queue hands the same
              task to worker B. The line that matters most is the completion check: when worker B finishes, it records
              the completion against the task ID, and a second completion for the same ID is simply ignored. That single
              guard is what turns an at-least-once delivery into an exactly-once side effect. Trace the sequence below,
              then find each step in the code.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant Q as Queue\n  participant A as Worker A\n  participant B as Worker B\n  participant S as Completion store\n  A->>Q: claim task-1 (lease starts)\n  Note over A: stalls, lease expires\n  Q->>B: redeliver task-1\n  B->>S: record completion(task-1)\n  S-->>B: first time, accepted\n  A->>S: record completion(task-1)\n  S-->>A: already done, ignored`}
              caption="Worker A's lease expires and task-1 is redelivered to B. Both workers try to complete, but the completion store dedupes by task ID, so the effect happens once."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the scheduler never iterates the nodes in declaration order. On each pass it builds the
              ready set, the nodes whose dependencies have all completed, runs them, folds their outputs into one
              aggregate, and repeats until nothing is left. Watch how the same trace ID rides along through every node so
              the whole run shares one lineage. The five nodes complete across four frontiers shown below;{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">notify</code> is the join that runs
              last because it depends on the parallel pair before it.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  fetch[fetch] --> parse[parse]\n  parse --> enrich[enrich]\n  parse --> store[store]\n  enrich --> notify[notify]\n  store --> notify\n  notify --> agg([aggregate = 31])`}
              caption="Example 2's graph. The scheduler advances frontier by frontier; outputs fold into one aggregate, and a single trace ID spans every node."
            />
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

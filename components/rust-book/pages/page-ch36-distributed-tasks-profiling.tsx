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
    title: "Distributed latency is layered",
    body: "A slow task is often not a slow handler. It may have waited in a queue, sat behind a saturated worker pool, retried several times, or stalled in a fan-in reducer before the final state changed.",
  },
  {
    title: "At-least-once delivery changes the profile",
    body: "Retries, lease expiry, and replay are part of the cost model. A queue can look healthy on average while duplicate work and retry amplification quietly destroy tail latency.",
  },
  {
    title: "One task ID should explain the whole trip",
    body: "If you cannot pivot from one queue-latency spike to one trace, then to one worker log line, then to one completion record, the profiling surface is still incomplete.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The profiler question is less about one hot function and more about one distributed control path. Queue wait, retries, and aggregation lag often dominate before one inner loop does.",
  },
  {
    title: "C# background",
    body: "Think less in terms of one async method chain and more in terms of explicit transport and worker boundaries. A task can be 'slow' even when no single handler frame is especially expensive.",
  },
  {
    title: "Go background",
    body: "A distributed queue is not a goroutine backlog with extra latency. It is an ownership, retry, and pacing boundary whose queue age and redelivery rate belong in the profile directly.",
  },
]

const latencyCards = [
  {
    title: "End-to-end latency",
    body: "Measure from enqueue or publish time to durable completion. That keeps queue wait, worker run time, downstream calls, and completion commit in one honest budget.",
  },
  {
    title: "Queue latency",
    body: "Enqueue-to-claim delay is usually the first backlog signal. If this span is invisible, your handler traces can look fine while the system is failing users in the queue.",
  },
  {
    title: "Worker saturation",
    body: "Count busy workers, runnable backlog, and oldest visible task age together. A worker pool at 100% utilization has no recovery slack when retries or slow tasks arrive.",
  },
]

const stormCards = [
  {
    title: "Retry storms",
    body: "Retries are traffic. When failure grows, requeues can multiply arrival rate faster than workers can drain it. Profile retry rate and retry age as first-class signals, not as debugging trivia.",
  },
  {
    title: "Tail latency",
    body: "The p99 task often pays for the slow shard, the long queue, or the overloaded reducer. Averages can remain calm while one tenant or one stage is already melting down.",
  },
]

const traceCards = [
  {
    title: "Distributed tracing",
    body: "Every task envelope should carry task ID, attempt, trace context, and lineage fields. Without them, queue wait and downstream hops disappear into unrelated dashboards.",
  },
  {
    title: "Make queue wait visible",
    body: "Record enqueue time, claim time, and handler start time. Queue wait is not an implementation detail. It is often the dominant latency bucket during overload.",
  },
  {
    title: "Trace task graphs, not only handlers",
    body: "A graph pipeline needs parent-child and fan-in lineage. The critical path may run through several queues and reducers before the final notification task appears.",
  },
]

const metricsDesignCards = [
  {
    title: "Counters",
    body: "Claimed, completed, retried, dead-lettered, duplicate-suppressed, and lease-expired counters tell you how work is really flowing.",
  },
  {
    title: "Gauges",
    body: "Visible queue depth, oldest visible age, in-flight tasks, busy workers, and reducer backlog show saturation and stuckness directly.",
  },
  {
    title: "Histograms",
    body: "Queue wait, run time, end-to-end latency, and lease-renewal lag are histogram-shaped questions. Tail visibility matters more than one average number.",
  },
  {
    title: "Label discipline",
    body: "Do not put trace IDs or task IDs into metric labels. Keep high-cardinality identity in logs and traces, and keep metrics aggregate enough to stay operable.",
  },
]

const correlationChecklist = [
  "Carry `task_id`, `attempt`, `trace_id`, `queue`, and `worker` through logs, traces, and completion storage.",
  "Attach the same timestamp vocabulary everywhere: enqueue, claim, start, finish, and ack or commit.",
  "Start incident review from one symptom, then pivot from metric spike to trace to logs rather than reading each tool in isolation.",
  "Treat queue age and duplicate suppression as cross-cutting signals, not as transport-only details.",
]

const taskGraphCards = [
  {
    title: "Critical path",
    body: "The useful total is not every stage added together. It is the longest dependency chain after queue wait and run time are both counted.",
  },
  {
    title: "Frontier size and fan-in",
    body: "A graph can look parallel on paper while one join step or one reducer queue becomes the real bottleneck under load.",
  },
  {
    title: "Per-edge queue cost",
    body: "Profile waiting between graph stages explicitly. A task graph with cheap handlers can still be slow because transitions between stages are under-budgeted.",
  },
]

const capacityCards = [
  {
    title: "Start from arrival rate and service time",
    body: "A rough planning rule is simple: worker demand grows with arrival rate times service time. Add headroom for retries and keep target utilization below the cliff where queue age explodes.",
  },
  {
    title: "Budget queue age, not only throughput",
    body: "A system can hit average throughput targets while oldest-message age still violates user or operator expectations. Capacity planning should include age and drain time objectives.",
  },
  {
    title: "Isolate slow classes",
    body: "Long GPU jobs, large DAG reducers, or poison-heavy tenants often deserve separate queues or worker pools so one failure mode does not saturate everything else.",
  },
]

const productionPatterns = [
  "Emit end-to-end, queue-wait, and run-time histograms together so backlog and handler cost can be separated quickly.",
  "Keep retry budgeting explicit: max attempts, backoff class, and terminal routing should be visible in code and dashboards.",
  "Carry stable lineage fields in every task envelope so logs, metrics, and traces can be correlated by one operational identity.",
  "Profile task graphs with critical-path and reducer metrics, not only with per-stage averages.",
  "Capacity-plan with retry traffic included. A retry lane without a budget is hidden load, not resilience.",
  "Review high-cardinality metrics aggressively. Task and trace identity belong in traces and logs, not in every counter label.",
]

const pitfalls = [
  "Treating handler duration as the whole latency story while queue wait is already dominating.",
  "Calling every saturation event a worker-count problem when retries or one slow queue class are the real amplifier.",
  "Publishing many detailed metrics with task-level labels until the monitoring system becomes the next incident.",
  "Tracing only the work after claim time and leaving enqueue-to-claim delay invisible.",
  "Profiling graph stages independently while the critical path actually runs through one join point or one reducer queue.",
  "Planning capacity from happy-path service time only and forgetting redelivery, duplicate suppression, and drain-time requirements.",
]

export function PageCh36DistributedTasksProfiling() {
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
  const pageIndex = getPageIndexById("ch36-distributed-tasks-profiling")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter26PageIndex = getPageIndexById("ch26-task-libraries-and-parallel-execution")
  const chapter30PageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const chapter31PageIndex = getPageIndexById("ch31-distributed-task-execution")
  const chapter35PageIndex = getPageIndexById("ch35-performance-profiling")
  const exercisesPageIndex = getPageIndexById("ch36-distributed-tasks-profiling-exercises")
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
          Chapter 36 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Distributed task profiling gets useful when you separate queue wait, worker run time, retries, and graph
          bottlenecks instead of calling the whole thing “slow work.”
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 25, 26, 30, 31, and 35</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 25 covered Tokio runtime behavior, Chapter 26 covered task orchestration and backpressure,
                Chapter 30 covered at-least-once broker delivery, Chapter 31 covered leases and distributed task graphs,
                and Chapter 35 covered profiling discipline. This chapter applies those ideas to distributed worker
                systems end to end.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter26PageIndex)}>
                Chapter 26
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter30PageIndex)}>
                Chapter 30
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter31PageIndex)}>
                Chapter 31
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter35PageIndex)}>
                Chapter 35
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A media pipeline looks healthy at first glance. Mean handler time is flat. CPU is not pegged. But users are
            still waiting. The real incident lives elsewhere: queue wait is rising, one slow class of retried tasks is
            saturating specialized workers, and the final reducer queue is turning one fan-out graph into one long tail.
            This is the reason to profile distributed tasks as a system rather than as one function.
          </p>
          <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
            <code className="font-mono text-foreground">{`submit -> queue wait -> lease claim -> handler run -> downstream call -> durable completion
           ^             ^                  ^                ^
           |             |                  |                |
       queue depth   queue latency     worker sat      end-to-end SLO`}</code>
          </pre>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Profile distributed work from enqueue to durable completion, not only inside the handler body.</li>
              <li>Treat queue wait, retry amplification, worker saturation, and graph fan-in as first-class latency layers.</li>
              <li>Use critical-path thinking for DAG workloads instead of trusting stage-local averages.</li>
              <li>Count retries as real traffic before sizing queues, workers, or accelerators.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Operator questions to keep asking</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Is user-visible latency dominated by waiting, execution, replay, or aggregation?</li>
              <li>Which metric should have paged first: queue age, retry rate, or worker saturation?</li>
              <li>Can one trace explain the full path from submit to completion for a single task?</li>
              <li>Which budget is actually exhausted right now: concurrency, queue capacity, downstream dependency, or specialist hardware?</li>
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
            <h4 className="font-semibold text-foreground mb-3">End-to-end latency, queue latency, and worker saturation</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {latencyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A practical rule is simple. If end-to-end latency rises while handler run time stays flat, the first next
                question is usually queueing or admission, not inner-loop CPU.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Retry storms and tail latency</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {stormCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A retry storm is often visible before it becomes catastrophic: retry rate rises, queue age rises, worker
                saturation rises, and the oldest visible message starts to drift far above the median.
              </p>
            </div>
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
    parent_task_id: Option<String>,
    queue: String,
}`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Metrics design</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {metricsDesignCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Correlating logs, metrics, and traces</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              {correlationChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The calm incident loop is usually: metric spike first, one representative trace second, worker and queue
                logs third, then one durable completion or retry record last.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling task graphs</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {taskGraphCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`fetch -> parse -> { enrich, store } -> notify
critical path = max(fetch+parse+enrich+notify, fetch+parse+store+notify)`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Capacity planning</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {capacityCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`rough_workers_needed ≈ arrival_rate * service_time / target_utilization
in_flight ≈ arrival_rate * time_in_system`}</code>
            </pre>
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
                The fastest way to misprofile a distributed worker system is to measure only handler CPU and call the rest
                “overhead.” Queue age, retries, fan-in, and replay often are the system.
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
                <h4 className="font-semibold text-foreground">
                  Example 1: end-to-end latency, queue latency, saturation, and retry rate
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The point is not one magic metric. The point is that queue wait, run time, and retry pressure belong in
                  one window summary before the incident page fills with guesses.
                </p>
              </div>
              {codes.distributed_profiling_latency_window !== DEFAULT_CODES.distributed_profiling_latency_window && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("distributed_profiling_latency_window")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.distributed_profiling_latency_window}
              onChange={(newCode) => updateCode("distributed_profiling_latency_window", newCode)}
              onRun={() => runCode("distributed_profiling_latency_window")}
              output={outputs.distributed_profiling_latency_window ?? null}
              isRunning={isRunning === "distributed_profiling_latency_window"}
              filename="latency_window_and_saturation.rs"
              expectedOutput={"e2e p95 = 460\nqueue p95 = 140\nworker saturation = 0.85\nretry rate = 0.15"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.distributed_profiling_latency_window}
              onRevert={() => resetCode("distributed_profiling_latency_window")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">End to end</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Queue wait plus run time gives a far better first diagnostic than handler time alone.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Queue</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The queue p95 is often the first overload signal visible to operators.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Saturation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Busy workers divided by total workers is simple, but it becomes useful only when read beside queue age.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Retry pressure</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Retry rate belongs in the same window because retries are load, not only failure bookkeeping.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: profile a task graph by critical path</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One graph stage can be locally fast and still sit on the longest path after queue time and dependency lag
                  are counted honestly.
                </p>
              </div>
              {codes.distributed_profiling_task_graph !== DEFAULT_CODES.distributed_profiling_task_graph && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("distributed_profiling_task_graph")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.distributed_profiling_task_graph}
              onChange={(newCode) => updateCode("distributed_profiling_task_graph", newCode)}
              onRun={() => runCode("distributed_profiling_task_graph")}
              output={outputs.distributed_profiling_task_graph ?? null}
              isRunning={isRunning === "distributed_profiling_task_graph"}
              filename="task_graph_critical_path.rs"
              expectedOutput={"critical path ms = 415\ntail stage = notify\nqueued ms = 115"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.distributed_profiling_task_graph}
              onRevert={() => resetCode("distributed_profiling_task_graph")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Critical path</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The longest dependency chain is the first scheduling story to explain, not the mean stage duration.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tail stage</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A join or notification stage often becomes the visible tail even when earlier stages look bigger on
                  paper.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Queued time</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Summed queue cost gives one quick signal for whether the graph is compute-bound or backlog-bound.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch36_distributed_tasks_profiling/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to design saturation metrics, trace a tail-latency incident, identify
            retry storm signals and mitigations, profile a task graph, and capacity-plan a distributed worker fleet.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 36 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Profile distributed work from enqueue to durable completion, not only inside the handler body.</li>
            <li>Queue latency, worker saturation, retry rate, and oldest visible age usually explain incidents faster than mean handler time.</li>
            <li>Tracing should include queue wait and graph lineage, not only one flat request span.</li>
            <li>Good metrics design separates low-cardinality aggregate signals from high-cardinality identity that belongs in logs and traces.</li>
            <li>Capacity planning should include retry traffic, reducer bottlenecks, and drain-time goals, not only happy-path throughput.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

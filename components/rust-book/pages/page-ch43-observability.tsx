"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
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

const mentalModelPoints = [
  {
    title: "Observability is about reconstructing causality, not only printing lines",
    body: "A production system is observable when another engineer can explain what happened, where time went, and which boundary failed without attaching a debugger to the live process.",
  },
  {
    title: "Logs, metrics, traces, and profiles answer different questions",
    body: "Logs are event records, metrics are aggregate signals, traces are causal timelines, and profiles are cost decomposition. A strong system uses all four deliberately instead of forcing one tool to impersonate the others.",
  },
  {
    title: "Rust makes observability boundaries explicit",
    body: "Owned envelopes, spawned task boundaries, queue handoffs, and typed errors are already visible in Rust code. Instrumentation becomes calmer when it follows those real ownership and execution boundaries.",
  },
]

const loggingCards = [
  {
    title: "Logging",
    body: "Use logs for discrete events: startup, config changes, retries, rejects, dead-letter transitions, FFI failures, and shutdown milestones. Logs explain what happened once a human already knows which path to inspect.",
  },
  {
    title: "Structured logs",
    body: "Prefer fields over prose when operators will filter or correlate later. `trace_id`, `task_id`, `tenant`, `queue`, `attempt`, `error_kind`, and `worker` are usually more useful than one long string.",
  },
  {
    title: "Log once at the operational boundary",
    body: "A duplicated error log at every layer is noise, not observability. Let lower layers return typed information; let the layer that owns the incident context emit the structured log.",
  },
]

const metricsCards = [
  {
    title: "Metrics",
    body: "Use metrics for low-cardinality aggregate signals: request rate, queue depth, oldest visible age, busy workers, retry rate, dead-letter count, and latency histograms.",
  },
  {
    title: "Latency and backpressure metrics",
    body: "Separate queue wait, handler run time, and end-to-end latency. If queue wait dominates, a faster handler may not move the real p99 enough to matter.",
  },
  {
    title: "Cardinality discipline",
    body: "Do not put `trace_id`, `task_id`, or user-provided IDs into metric labels. Keep per-item identity in logs and traces; keep metrics aggregate enough to stay queryable and affordable.",
  },
]

const tracingCards = [
  {
    title: "Tracing",
    body: "A trace is a causal path through the system. Spans should map to meaningful boundaries such as `handle_request`, `publish_order_event`, `claim_task`, or `gpu_score_batch`, not to every tiny helper by reflex.",
  },
  {
    title: "Async tracing",
    body: "Async code hides queue wait and task handoff unless you instrument explicitly. Wrap spawned work, queue consumers, retries, and blocking escapes with spans that carry stable request or task identity.",
  },
  {
    title: "Distributed tracing",
    body: "Once work crosses HTTP, brokers, or queues, trace context has to cross too. Treat `trace_id`, parent span identity, and attempt number as part of the message or header contract, not as incidental metadata.",
  },
]

const openTelemetryCards = [
  {
    title: "OpenTelemetry",
    body: "OpenTelemetry is the vendor-neutral model and export surface that lets logs, metrics, and traces leave the process in a consistent shape. In many Rust stacks, tracing and metrics are the first signals wired through it.",
  },
  {
    title: "Exporter and resource boundaries",
    body: "Keep exporter wiring, resource attributes, and collector configuration in the adapter layer. Your domain model should not know which backend receives spans or which metric sink the platform team prefers.",
  },
  {
    title: "Headers and envelopes",
    body: "For HTTP, queues, and task systems, carry trace context in headers or owned message envelopes. That boundary is where in-process spans become distributed traces.",
  },
]

const profilingCards = [
  {
    title: "Profiling in production",
    body: "Use sampling and continuous profiling for CPU and memory cost, not only local benchmarks. Profile the live shape: queue wait, serialization, blocking-pool pressure, FFI overhead, and task fan-out all count.",
  },
  {
    title: "Correlate profiles with traces",
    body: "A flame graph may show that serialization is wide, while tracing shows requests waited in a queue before serialization started. Use profiles and traces together when the system is layered.",
  },
  {
    title: "Rate-limit and scope heavy probes",
    body: "Production profiling should be low-overhead and targeted. Sample enough to explain the incident, but do not turn your observability stack into the next source of latency.",
  },
]

const alertingCards = [
  {
    title: "Alerting",
    body: "Alert on symptoms that predict user pain or operator action: error-budget burn, oldest message age, queue saturation, failed publish confirms, retry storms, and shutdown drain time.",
  },
  {
    title: "SLOs",
    body: "An SLO should bind one user-visible or operator-visible promise: success rate, end-to-end latency, freshness, or completion time. It is stronger when the corresponding metrics are already low-cardinality and stable.",
  },
  {
    title: "Burn-rate thinking",
    body: "Single error counts are often too noisy. Burn alerts over latency and success-rate windows usually tell a better story about whether the service is spending its budget too fast.",
  },
]

const refactorCards = [
  {
    signal: "Queue latency rises while handler p50 stays flat",
    refactor:
      "Bound admission, split worker pools, or add capacity at the saturated stage before touching local CPU logic.",
  },
  {
    signal: "Duplicate deliveries correlate with early acks",
    refactor:
      "Move the durable completion checkpoint or outbox write before the ack boundary so replay becomes harmless.",
  },
  {
    signal: "Trace context disappears after spawn or queue handoff",
    refactor:
      "Promote trace IDs and parent lineage into owned task envelopes and instrument the task boundary explicitly.",
  },
  {
    signal: "Logs are rich but impossible to correlate",
    refactor:
      "Standardize stable fields such as `trace_id`, `task_id`, `attempt`, `queue`, and `tenant`, then log once at the operational seam.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You may already separate profilers, logs, and metrics mentally. Rust adds one practical win: ownership and task boundaries are explicit enough that instrumentation can follow the real data flow instead of one inheritance tree or callback maze.",
  },
  {
    title: "C# background",
    body: "If `Activity` and structured logging are familiar, the Rust shift is mostly about explicit async and ownership seams. Context does not float as ambient runtime magic nearly as often; you carry it or instrument it on purpose.",
  },
  {
    title: "Go background",
    body: "If `context.Context` is your default trace carrier, the Rust analogue is usually one owned envelope plus one span boundary. The strong habit to keep is explicit propagation; the habit to drop is assuming logs alone will explain queue wait and replay.",
  },
]

const productionPatterns = [
  "Emit structured logs at operational seams and keep stable correlation fields flowing through HTTP, broker, task, and FFI boundaries.",
  "Publish low-cardinality metrics for backlog, queue age, latency, worker saturation, retries, and dead-letter behavior before the first incident needs them.",
  "Create spans around meaningful work units: requests, queue claims, handler execution, blocking escapes, GPU jobs, and reducer stages.",
  "Propagate trace context explicitly across async tasks and distributed envelopes instead of assuming it survives spawn, retry, or queue boundaries automatically.",
  "Treat OpenTelemetry exporter wiring as platform configuration and keep it out of domain logic and inner hot loops.",
  "Use SLOs and burn-rate alerts to turn raw telemetry into operator action, then refactor from the signal that really dominates the incident.",
]

const pitfalls = [
  "Logging everything and still learning nothing because the lines are unstructured, duplicated, or missing stable IDs.",
  "Adding high-cardinality labels such as `trace_id` or `task_id` to metrics and quietly breaking the monitoring system under load.",
  "Tracing only handler execution while leaving queue wait, task claim time, and retry spans invisible.",
  "Treating OpenTelemetry as a magic switch instead of a data model that still depends on deliberate field, resource, and propagation design.",
  "Alerting on local symptoms such as one exception counter while ignoring oldest-message age, queue saturation, or end-to-end success budget.",
  "Profiling the process in isolation and forgetting that the real incident may live in one saturated queue or one missing span across a distributed hop.",
]

const summaryPoints = [
  "Logs explain events, metrics explain aggregate health, traces explain causality, and profiles explain cost. Observability requires all four, used deliberately.",
  "Structured logs and explicit trace propagation are especially important in Rust because task, queue, and ownership boundaries are already visible and should stay attributable.",
  "Metrics for backlog, queue age, latency, worker saturation, retries, and duplicates are often more operationally useful than raw request counts alone.",
  "OpenTelemetry is the export and correlation layer; keep exporter wiring at the platform edge and keep stable context flowing through distributed boundaries.",
  "Alerting and SLOs should follow user-visible or operator-visible promises, then drive refactoring from the signal that really dominates the incident.",
]

export function PageCh43Observability() {
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
  const pageIndex = getPageIndexById("ch43-observability")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter30PageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const chapter31PageIndex = getPageIndexById("ch31-distributed-task-execution")
  const chapter35PageIndex = getPageIndexById("ch35-performance-profiling")
  const chapter36PageIndex = getPageIndexById("ch36-distributed-tasks-profiling")
  const chapter42PageIndex = getPageIndexById("ch42-testing-advanced-rust-systems")
  const exercisesPageIndex = getPageIndexById("ch43-observability-exercises")
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
          Chapter 43 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Observability is how a Rust service explains itself under load: structured events, bounded metrics, causal traces,
          and profiling data that still make sense once work crosses tasks, queues, and machines.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 25, 30, 31, 35, 36, and 42</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 25 covered Tokio task boundaries. Chapter 30 covered broker delivery and retry signals. Chapter 31
                made queue wait and replay part of distributed work. Chapters 35 and 36 separated profiling, tracing, and
                distributed latency analysis. Chapter 42 added deterministic test harnesses so observability signals can be
                asserted instead of admired.
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
              <Button variant="outline" onClick={() => setCurrentPage(chapter35PageIndex)}>
                Chapter 35
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter36PageIndex)}>
                Chapter 36
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter42PageIndex)}>
                Chapter 42
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A queue-backed scoring service starts missing its latency SLO after a routine rollout. CPU usage is ordinary.
            Handler p50 is calm. But oldest visible message age is rising, one retry lane is amplifying load, and traces
            stop at the spawned worker boundary so nobody can tell whether the queue or the handler actually owns the delay.
            The fix is not “add more logs.” The fix is to instrument the right boundary with the right signal and then refactor
            from evidence instead of folklore.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical incident loop</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Start from one symptom: queue age, retry rate, p99 latency, or error-budget burn.</li>
              <li>Pivot to one trace or structured log line using a stable ID.</li>
              <li>Separate queue wait, handler run time, downstream wait, and completion time.</li>
              <li>Refactor the dominant boundary, then re-measure the same signal to prove the fix actually mattered.</li>
            </ol>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Use logs for events, metrics for aggregate health, traces for causality, and profiles for cost.</li>
              <li>Keep stable IDs flowing across tasks, queues, retries, and durable completion records.</li>
              <li>Instrument queue wait, handler time, publish time, and failure paths separately.</li>
              <li>Turn telemetry into refactoring evidence by tying it to one operator-facing question at a time.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Signal-selection checklist</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Is the question about an event, an aggregate, a causal path, or a cost hotspot?</li>
              <li>Which IDs belong in logs and traces, and which labels must stay out of metrics?</li>
              <li>What should page first: burn rate, queue age, saturation, or one failure class?</li>
              <li>Which observable would prove the next refactor fixed the dominant boundary instead of the easiest code to edit?</li>
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
            <h4 className="font-semibold text-foreground mb-3">Logging and structured logs</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {loggingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`info!(
    trace_id = %trace_id,
    queue = "score-jobs",
    attempt = attempt,
    status = "retry",
    "resubmitting task after dependency timeout"
);`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Metrics</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {metricsCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A useful default split is counter + gauge + histogram: counters for accepted and retried work, gauges for
                queue depth and busy workers, histograms for queue wait, run time, and end-to-end latency.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">Tracing, async tracing, and distributed tracing</h4>
                <div className="grid gap-4 lg:grid-cols-3">
                  {tracingCards.map((card) => (
                    <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="font-medium text-foreground mb-2">{card.title}</div>
                      <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)} className="shrink-0">
                Revisit Chapter 25
              </Button>
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`let worker = tracing::info_span!("worker", worker = "gpu-a");

tokio::spawn(async move {
    handle_batch(job).instrument(worker).await
});`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">OpenTelemetry</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {openTelemetryCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`struct TaskEnvelope {
    task_id: String,
    trace_id: String,
    parent_span_id: Option<String>,
    queue: String,
    attempt: u32,
}`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">Profiling in production</h4>
                <div className="grid gap-4 lg:grid-cols-3">
                  {profilingCards.map((card) => (
                    <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="font-medium text-foreground mb-2">{card.title}</div>
                      <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="outline" onClick={() => setCurrentPage(chapter35PageIndex)} className="shrink-0">
                Revisit Chapter 35
              </Button>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Profiling belongs in an observability chapter because hot CPU, queue wait, lock contention, and serialization
                cost are often all part of the same incident. The best production profile is the one you can line up next to
                one trace and one SLO graph.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Alerting and SLOs</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {alertingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`// rough operator-facing signals
success_rate >= 99.5%
queue_oldest_visible_age < 2s
e2e_p95_ms < 400`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">Observability-driven refactoring</h4>
                <div className="grid gap-4 lg:grid-cols-2">
                  {refactorCards.map((card) => (
                    <div key={card.signal} className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Observed signal</div>
                      <div className="font-medium text-foreground mb-2">{card.signal}</div>
                      <p className="text-sm text-muted-foreground leading-6">{card.refactor}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="outline" onClick={() => setCurrentPage(chapter36PageIndex)} className="shrink-0">
                Revisit Chapter 36
              </Button>
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
                The most common observability failure is not “too little telemetry.” It is the wrong telemetry at the wrong
                boundary: unstructured logs, invisible queue wait, or metrics so high-cardinality that nobody can query them
                when the incident actually starts.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Worked examples</h3>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The browser runner summarizes instrumentation so output stays deterministic. In a real Cargo service, the same
              code would normally pair these spans with a subscriber or an OpenTelemetry bridge.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 1: instrument a Tokio worker with structured spans</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The request handler records structured fields, the worker adds a parent span, and the summary makes success,
                  failure, and last-seen trace identity explicit.
                </p>
              </div>
              {codes.observability_tracing_tokio_spans !== DEFAULT_CODES.observability_tracing_tokio_spans && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("observability_tracing_tokio_spans")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.observability_tracing_tokio_spans}
              onChange={(newCode) => updateCode("observability_tracing_tokio_spans", newCode)}
              onRun={() => runCode("observability_tracing_tokio_spans")}
              output={outputs.observability_tracing_tokio_spans ?? null}
              isRunning={isRunning === "observability_tracing_tokio_spans"}
              filename="tracing_tokio_worker.rs"
              expectedOutput={"instrumented = true\nprocessed = 2\nfailures = 1\nlast trace = req-9"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.observability_tracing_tokio_spans}
              onRevert={() => resetCode("observability_tracing_tokio_spans")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Structured logs</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The handler emits fields that are filterable later instead of burying `trace_id` and `route` inside prose.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Async tracing</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The worker span is explicit, so a later queue or task analysis still knows which runtime boundary owned the request.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Failure path</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One empty payload becomes one structured reject instead of one mysterious count drop somewhere in a dashboard.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: summarize latency, success rate, and alert state from one SLO window</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This is the kind of aggregate view an operator or an alert rule wants: end-to-end p95, success budget,
                  and whether the window already looks unhealthy.
                </p>
              </div>
              {codes.observability_metrics_slo_window !== DEFAULT_CODES.observability_metrics_slo_window && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("observability_metrics_slo_window")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.observability_metrics_slo_window}
              onChange={(newCode) => updateCode("observability_metrics_slo_window", newCode)}
              onRun={() => runCode("observability_metrics_slo_window")}
              output={outputs.observability_metrics_slo_window ?? null}
              isRunning={isRunning === "observability_metrics_slo_window"}
              filename="metrics_slo_window.rs"
              expectedOutput={"e2e p95 = 390\nsuccess rate = 0.9920\nalert = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.observability_metrics_slo_window}
              onRevert={() => resetCode("observability_metrics_slo_window")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Metrics</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Queue p95 and handler p95 are kept separate so end-to-end latency can be decomposed honestly.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Alerting</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One burn-style rule can combine latency, success rate, and saturation instead of paging on one raw error counter.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Refactoring hook</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A window like this tells you whether the next fix belongs in worker capacity, admission control, or handler code.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">examples/ch43_observability/</code> so
              the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to instrument a Tokio service with spans, design metrics for latency and
            backpressure, connect logs, metrics, and traces in one incident narrative, and turn SLOs into concrete alerts
            and refactoring decisions.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 43 Exercises
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

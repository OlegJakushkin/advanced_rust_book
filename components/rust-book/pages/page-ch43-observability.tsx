"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
  GitCompare,
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
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Observability is reconstructing causality, not just printing lines",
    body: "A system is observable when a second engineer, weeks later and without a debugger attached to the live process, can answer three questions from the data alone: what happened, where the time went, and which boundary failed. If the only way to understand an incident is to redeploy with more logging and wait for it to recur, the system is not observable yet. The goal is not volume of output; it is the ability to reconstruct the chain of cause and effect after the fact.",
  },
  {
    title: "Logs, metrics, traces, and profiles answer different questions",
    body: "These four are not interchangeable, and trying to make one do another's job is where most telemetry budgets are wasted. Logs are discrete event records (\"this happened, here are the fields\"). Metrics are pre-aggregated numbers cheap enough to keep forever (\"the rate is X\"). Traces are causal timelines that stitch one unit of work across boundaries. Profiles decompose cost — where CPU, allocation, and wall-clock time actually go. A strong system reaches for the right one per question instead of forcing logs to impersonate metrics or metrics to impersonate traces.",
  },
  {
    title: "Rust makes the boundaries worth instrumenting visible in the code",
    body: "In a garbage-collected service, the seams where work changes hands — a goroutine launch, a thread-pool dispatch, an async continuation — are often invisible in the source. In Rust, an owned envelope handed into tokio::spawn, a value moved across a channel, a typed Result crossing a function boundary, are all explicit in the text of the program. Instrumentation gets calmer and more accurate when you attach spans and fields to those real ownership and execution boundaries rather than sprinkling log lines wherever a bug once appeared.",
  },
]

const loggingCards = [
  {
    title: "Logs record discrete events",
    body: "Reach for a log when something notable happened once and you want a durable record of it: startup, a config change, a retry, a reject, a dead-letter transition, an FFI failure, a shutdown milestone. Logs are how you reconstruct a specific sequence after you already know roughly which code path to inspect. They are the wrong tool for answering \"how often\" or \"how slow on average\" — that is what metrics are for.",
  },
  {
    title: "Structure beats prose for anything you will query",
    body: "A line like \"failed to process job 91 for tenant acme on attempt 3\" reads fine to a human and is nearly useless to a query engine. Emit the same information as fields — trace_id, task_id, tenant, queue, attempt, error_kind, worker — and an operator can filter, group, and correlate at 3 a.m. without writing a regex. In Rust's tracing crate, fields are first-class arguments to the macro, so structured logging costs no more keystrokes than the prose version.",
  },
  {
    title: "Log once, at the boundary that owns the incident",
    body: "The most common logging anti-pattern is the same error reported at every layer it bubbles through, turning one failure into five lines that look like five failures. Let inner layers return typed errors and stay quiet; let the one layer that owns the request or task context — the handler, the consumer loop — emit a single structured log with the full picture. Typed Result values carry the information upward; logging is what you do once, where the decision is made.",
  },
]

const metricsCards = [
  {
    title: "Metrics are cheap aggregate signals",
    body: "A metric is a number the system updates continuously and a backend can store cheaply for a long time: request rate, queue depth, oldest-visible-message age, busy workers, retry rate, dead-letter count, latency histograms. Because they are pre-aggregated, metrics answer \"how much\" and \"how fast\" across the whole fleet without storing one record per event. They are your first look during an incident and the foundation every alert and SLO is built on.",
  },
  {
    title: "Measure the stages of latency separately",
    body: "End-to-end latency is a sum of distinct phases — time spent waiting in the queue, time spent running in the handler, time spent waiting on a downstream call. Record them as separate histograms. If queue wait dominates p99 and you spend a sprint shaving milliseconds off the handler, the user-visible number will barely move. Decomposed latency tells you which stage is actually expensive before you commit engineering time to the wrong one.",
  },
  {
    title: "Guard cardinality like a budget",
    body: "Every distinct combination of label values is a separate time series the backend must store and index. Put a trace_id, task_id, or a user-supplied id into a metric label and you can generate millions of series and take down your own monitoring under load. The rule is firm: per-item identity lives in logs and traces; metric labels stay low-cardinality — queue name, status class, worker pool — so the system stays queryable and affordable exactly when an incident makes you query it hardest.",
  },
]

const tracingCards = [
  {
    title: "A span is one meaningful unit of work",
    body: "A trace is the causal path one request or job takes through the system, built from nested spans. Open a span around boundaries that matter operationally — handle_request, publish_order_event, claim_task, gpu_score_batch — not around every tiny helper out of habit. Over-spanning buries the signal in noise and adds real overhead; the discipline is to span the seams where time is spent or where work changes hands, then let the timing and parent-child structure tell the story.",
  },
  {
    title: "Async hides handoffs unless you instrument them",
    body: "The moment work crosses a tokio::spawn, a channel, or a retry, the natural call stack disappears and so does any span that was implicitly active. A future that is not explicitly instrumented runs detached from its parent, and queue wait between enqueue and execution becomes invisible. Wrap spawned futures, queue consumers, retries, and blocking-pool escapes with spans that carry a stable request or task identity, so the gaps between handoffs show up as duration instead of vanishing.",
  },
  {
    title: "Distributed tracing is a propagation contract",
    body: "Once a request crosses an HTTP call, a message broker, or a task queue, the trace context has to cross with it or the trace simply ends at the wire. Treat trace_id, the parent span identity, and the attempt number as part of the message envelope or HTTP header contract — fields you serialize and parse on purpose — not as incidental metadata that happens to tag along. Propagation that is left to chance is the single most common reason traces fall apart at the most interesting moment.",
  },
]

const openTelemetryCards = [
  {
    title: "OpenTelemetry is a shared data model, not a backend",
    body: "OpenTelemetry (OTel) defines a vendor-neutral shape for logs, metrics, and traces and a standard way to export them, so the same instrumented code can ship to Jaeger today and a hosted backend tomorrow without rewriting the application. In a typical Rust stack you keep using the tracing crate as your instrumentation API and bridge it to OTel with a layer; tracing and metrics are usually the first signals teams wire through it. OTel is plumbing and convention — it does not decide what is worth measuring.",
  },
  {
    title: "Keep exporter wiring at the platform edge",
    body: "Exporter endpoints, resource attributes (service name, version, region), sampling rates, and collector configuration are deployment concerns. They belong in the startup/adapter layer where you build the subscriber, not threaded through domain code. A scoring function should not know which collector receives its spans any more than it should know the database connection string. Done right, swapping backends is a config change, and your business logic never imports a vendor SDK.",
  },
  {
    title: "Context crosses on headers and envelopes",
    body: "The place in-process spans become a distributed trace is the boundary where you serialize context out and parse it back in. For HTTP that is the W3C traceparent header; for brokers and task systems it is fields on the message envelope you own. This is exactly why a typed envelope carrying trace_id and parent_span_id is worth designing deliberately — it is the concrete artifact that turns two separate traces into one.",
  },
]

const profilingCards = [
  {
    title: "Profile the live shape, not just the bench",
    body: "A local microbenchmark measures one function under ideal conditions; production has queue wait, serialization, blocking-pool pressure, FFI overhead, and task fan-out all interacting. Continuous, sampling-based profilers (perf, pprof-style collectors) capture where CPU and allocation actually go on the running system at low overhead. The flame graph from production routinely contradicts the one from your laptop, and the production one is the truth that matters during an incident.",
  },
  {
    title: "A profile alone can point you at the wrong fix",
    body: "A flame graph might show serialization as a wide, expensive frame and tempt you to optimize the serializer. The trace for the same request may show that work sat in a queue for 800 ms before serialization ever started — the serializer is busy, not slow, and the real problem is admission. Read profiles next to traces: the profile tells you where CPU goes, the trace tells you whether that CPU was even on the critical path.",
  },
  {
    title: "Keep the probe cheaper than the incident",
    body: "Production profiling has to be low-overhead and scoped, or the observability stack becomes the next source of the latency you were trying to explain. Sample at a rate that is statistically enough to find the hotspot, scope heavy probes to the affected service or window, and ramp them down once you have the answer. The right amount of profiling is the least that still explains the incident.",
  },
]

const alertingCards = [
  {
    title: "Alert on symptoms, not on causes",
    body: "A good page predicts user pain or demands operator action: error-budget burn, oldest-message age climbing, queue saturation, failed publish confirms, retry storms, slow shutdown drain. Alerting on an internal cause — \"CPU is 80%\" — wakes people up for conditions that may be perfectly healthy. Alert on the thing the user or the operator actually feels, and let the dashboards explain the cause once a human is looking.",
  },
  {
    title: "An SLO is one explicit promise",
    body: "A service-level objective binds a single user- or operator-visible promise to a number: success rate above 99.5%, end-to-end p95 under 400 ms, data freshness under two minutes. It works best when it sits on metrics that are already low-cardinality and stable, because those are the ones you can compute reliably under load. The SLO is the contract; everything else — alerts, capacity decisions, refactoring priority — flows from whether you are keeping it.",
  },
  {
    title: "Burn rate beats raw counts",
    body: "Paging on a single error count is noisy: a brief blip looks identical to a sustained outage. Burn-rate alerting asks a better question — how fast is the service consuming its error budget over a window? A fast burn over a short window pages immediately; a slow burn over a long window opens a ticket. This separates \"the building is on fire\" from \"we are trending the wrong way,\" which is the distinction that keeps on-call sustainable.",
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
    body: "You already keep profilers, logs, and metrics in separate mental buckets, and you are used to context being whatever you manually thread through call sites. The shift in Rust is a pleasant one: ownership and task boundaries are visible in the type system, so instrumentation can follow the actual data flow instead of chasing it through an inheritance tree or a callback maze. The span you open maps to a move you can point at in the source.",
  },
  {
    title: "C# background",
    body: "If Activity and ILogger structured logging feel natural, most of the model transfers. The trap is ambient context. In .NET, the current Activity and AsyncLocal scope follow the await chain almost for free; in Rust there is far less runtime magic. A span does not automatically reattach itself across tokio::spawn — you instrument the spawned future on purpose with .instrument(span), or the child work runs orphaned.",
  },
  {
    title: "Go background",
    body: "Your instinct is to pass context.Context as the first argument and let it carry the deadline and trace id everywhere. Rust has no single ambient carrier. The analogue is usually one owned message envelope plus one explicit span at the boundary. Keep the habit of explicit propagation — it is exactly right — but drop the assumption that logs alone will reveal queue wait, retries, and replay. Those live in spans and metrics here.",
  },
  {
    title: "Python background",
    body: "Coming from logging plus an APM agent (OpenTelemetry, Datadog) that auto-instruments your framework, expect less magic and more wiring you can see. There is no import-time monkeypatch quietly tracing every handler. You name the spans and choose the fields yourself, which is more typing but means the trace reflects your boundaries, not a library's guess. The upside Rust adds: no GIL-shaped blind spots, and concurrency that is explicit enough to instrument honestly.",
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
          Observability is what lets you explain a production Rust service after the fact, without redeploying with more
          print statements. This chapter walks through the four signals an operator actually reaches for — structured
          logs, metrics, traces, and profiles — and ties them to service-level objectives and the boundaries Rust already
          makes visible in your code.
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
            A queue-backed scoring service misses its latency SLO right after a rollout, yet CPU usage and the handler&rsquo;s
            median runtime both look perfectly healthy. Nothing in the obvious dashboard is red. This is the everyday shape
            of a real incident: the symptom is visible but the cause is hidden behind a boundary you have not instrumented
            yet. The job for the rest of this chapter is to instrument the ownership and execution boundaries that can
            actually explain it — queue age, retry rate, worker saturation, trace propagation across the spawn, and where
            CPU time really goes.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical incident loop</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Good debugging under pressure follows a loop rather than a hunch. Notice the shape below: you always start
              from one symptom, pivot to a single trace or log line through a stable id, decompose the latency by stage,
              fix the stage that dominates, and then re-measure the <em>same</em> signal to prove the fix mattered. The
              loop is what stops you from optimizing the cheapest code to edit instead of the boundary that hurts.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Symptom["1. One symptom<br/>(p99, queue age, burn)"] --> Pivot["2. Pivot via stable id<br/>(trace or log line)"]\n  Pivot --> Decompose["3. Split latency by stage<br/>(wait / run / downstream)"]\n  Decompose --> Fix["4. Refactor dominant stage"]\n  Fix --> Remeasure["5. Re-measure same signal"]\n  Remeasure -->|still off| Symptom\n  Remeasure -->|fixed| Done(["Incident closed"])`}
              caption="The incident loop: start from a symptom, prove the fix on the same signal you started from."
            />
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
            <h4 className="font-semibold text-foreground mb-3">The four signals and the questions they answer</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Before the individual tools, hold the whole picture in view. One request enters the system and produces all
              four kinds of signal as it flows through. They are not redundant — each answers a question the others cannot.
              When you look at the diagram, notice that logs and traces are emitted <em>per request</em> (high detail, high
              cost), while metrics are aggregated across all requests (low detail, cheap to keep), and profiles sample the
              process as a whole. Matching the question to the signal is the entire skill.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Req["Incoming request"] --> Svc["Rust service"]\n  Svc --> L["Logs<br/>what happened (one event)"]\n  Svc --> T["Traces<br/>where time went (causal path)"]\n  L --> Op(["Operator answers the incident"])\n  T --> Op`}
              caption="First half: the per-request signals. Logs answer what happened; traces answer where the time went."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The other two signals are not emitted per request — metrics aggregate across every request and profiles
              sample the process as a whole — yet they feed the same operator answering the same incident:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Svc["Rust service"] --> M["Metrics<br/>how much / how fast (aggregate)"]\n  Svc --> P["Profiles<br/>where CPU and memory go (cost)"]\n  M --> Op(["Operator answers the incident"])\n  P --> Op`}
              caption="Second half: the fleet-wide signals. Metrics answer how much and how fast; profiles answer where the cost goes."
            />
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
              <code className="font-mono text-foreground">{`use tracing::Instrument; // required for .instrument()

let worker = tracing::info_span!("worker", worker = "gpu-a");

tokio::spawn(async move {
    handle_batch(job).instrument(worker).await
});`}</code>
            </pre>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">OpenTelemetry and crossing the wire</h4>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {openTelemetryCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4 mb-3">
              What to look at first: the struct below is the whole point. A producer finishes its span, copies the live
              trace_id and parent_span_id into a TaskEnvelope, and serializes it onto the queue. The consumer parses the
              envelope and re-opens a child span from those fields. Without this hand-off the consumer would start a brand
              new, unrelated trace and the timeline would split in two exactly where the work crossed the broker. The
              diagram shows that hand-off; the struct is the contract that makes it possible.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant P as Producer (span A)\n  participant Q as Broker queue\n  participant C as Consumer\n  P->>P: open span A (trace_id, span_id)\n  P->>Q: publish TaskEnvelope{trace_id, parent_span_id}\n  Q->>C: deliver envelope\n  C->>C: parse trace_id + parent_span_id\n  C->>C: open child span B under same trace\n  Note over P,C: one trace, two processes`}
              caption="The envelope carries trace context across the broker so the consumer continues the same trace instead of starting a new one."
            />
            <pre className="mt-2 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
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

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this maps from your background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Every one of these languages can be observed well — the concepts of logs, metrics, traces, and profiles are
            universal. What changes in Rust is mostly how much is automatic versus how much you wire on purpose. The
            recurring theme below is the same: there is less ambient context magic, so propagation and span boundaries
            become things you state explicitly rather than things the runtime threads for you. That is more work at the
            keyboard and far less mystery during an incident.
          </p>
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
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
            These are the habits that pay off before an incident rather than during one. The common thread is doing the
            cheap, deliberate work up front — naming fields, publishing the boring backlog metrics, propagating context
            across every handoff — so that when something breaks the data is already there to explain it.
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
            Almost every entry below is a case of the right idea applied to the wrong signal: detail where you needed
            aggregation, aggregation where you needed identity, or instrumentation that stopped exactly at the boundary
            that mattered. Read them as the failure modes of the four signals, not as a list of unrelated mistakes.
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
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at first: follow one request id through the nesting below before reading the code. The request
              span is the parent; when work is handed to the worker, the worker span is attached explicitly so it nests
              under the right request instead of running detached. The success and failure arms both stay inside that span,
              which is why the final summary can report processed, failures, and the last trace id with no ambiguity about
              which request each event belonged to. The code is the literal implementation of this tree.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  H["handle_request span<br/>fields: trace_id, route"] --> S{"spawn worker"}\n  S --> W["worker span<br/>(attached explicitly)"]\n  W --> OK["ok: processed + 1"]\n  W --> Err["empty payload: failures + 1<br/>structured reject"]\n  OK --> Sum["summary: processed / failures / last trace"]\n  Err --> Sum`}
              caption="The worker span nests under the request span on purpose, so every event stays attributable to one trace id."
            />
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
                  This is the kind of aggregate view an operator or an alert rule wants: a conservative latency budget,
                  success budget, and whether the window already looks unhealthy. Note that p95(queue) + p95(handler)
                  is an upper bound, not the true end-to-end p95 — percentiles are not additive.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at first: this is a small pipeline, not a clever algorithm. Two separate latency histograms
              (queue and handler) feed a conservative latency budget; accepted and failed counts feed a success rate; both
              results plus a saturation check feed one boolean alert. Trace the arrows in the diagram and you have already
              read the program — the code just turns each box into a few lines. The honest separation of queue p95 and
              handler p95 is the part worth dwelling on, because it is what lets you blame the right stage later.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  QP["queue p95"] --> Budget["latency budget<br/>upper bound,<br/>not true p95"]\n  HP["handler p95"] --> Budget\n  Acc["accepted count"] --> SR["success rate"]\n  Fail["failed count"] --> SR\n  Budget --> Alert{"over budget<br/>or below SLO?"}\n  SR --> Alert\n  Sat["saturation"] --> Alert\n  Alert -->|yes| Page(["alert = true"])\n  Alert -->|no| Ok(["healthy"])`}
              caption="The SLO window is a pipeline: separate latency stages and counts fold into one alert decision."
            />
            <RustCodeEditor
              code={codes.observability_metrics_slo_window}
              onChange={(newCode) => updateCode("observability_metrics_slo_window", newCode)}
              onRun={() => runCode("observability_metrics_slo_window")}
              output={outputs.observability_metrics_slo_window ?? null}
              isRunning={isRunning === "observability_metrics_slo_window"}
              filename="metrics_slo_window.rs"
              expectedOutput={"latency budget = 390\nsuccess rate = 0.9920\nalert = true"}
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

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
    title: "Latency is a stack of layers, not one number",
    body: "A slow task is rarely a slow handler. The same job can wait in a queue, sit behind a saturated worker pool, retry several times, and then stall in a fan-in reducer before its final state changes. Profiling distributed work means attributing the delay to a layer, not averaging it into a single duration that hides where the time went.",
  },
  {
    title: "At-least-once delivery is part of the cost model",
    body: "Once a broker can redeliver, retries, lease expiry, and replay stop being edge cases and become recurring traffic you must budget for. A queue can look perfectly healthy on its average while duplicate work and retry amplification quietly inflate the tail. If your cost model assumes each task runs exactly once, it is already wrong.",
  },
  {
    title: "One task ID should explain the whole trip",
    body: "The test for a complete profiling surface is a pivot, not a dashboard. Starting from one queue-latency spike, can you jump to the one trace it belongs to, then to the one worker log line that ran it, then to the one completion record that closed it? If any of those hops is missing, the surface still has a blind spot where incidents hide.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Your profiler instinct points at a hot function and a flame graph on one machine. Here the expensive thing is usually a distributed control path you cannot sample with perf: time spent waiting in a queue, time lost to retries, and time stalled in a fan-in reducer. The mental shift is to treat wall-clock spans across process boundaries as the unit of profiling, not CPU cycles inside one binary.",
  },
  {
    title: "C# background",
    body: "An async/await call chain feels like one continuous timeline, so it is tempting to read a task as a single method that happens to suspend. In a worker fleet the timeline is broken into explicit transport and worker boundaries that you must instrument by hand. A task can blow its budget while every individual handler frame is cheap, because the cost lives in the gaps between frames.",
  },
  {
    title: "Go background",
    body: "A distributed queue is not a buffered channel with more latency. A channel hands work to a goroutine in-process and forgets it; a broker queue is an ownership, retry, and pacing boundary where a message can be redelivered, leased twice, or aged for minutes. Queue age and redelivery rate are not background noise — they belong directly in the profile.",
  },
  {
    title: "Python background",
    body: "If your model is Celery or RQ, you already think in tasks, brokers, and retries — but the visibility usually stops at the worker process. Rust services make it cheap to carry typed envelopes and structured spans through the whole trip, so the shift is to instrument enqueue-to-completion as one budget rather than trusting per-worker timing and broker dashboards that never line up.",
  },
]

const latencyCards = [
  {
    title: "End-to-end latency",
    body: "Measure from enqueue or publish time to durable completion. That keeps queue wait, worker run time, downstream calls, and completion commit in one budget.",
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
    body: "The p99 task often pays for the slow shard, the long queue, or the overloaded reducer. Averages can remain calm while one tenant or one stage is already overloaded.",
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
          When work travels through brokers, leases, worker pools, and reducers, &ldquo;slow&rdquo; stops being a single
          number. This chapter is about taking the latency a user actually feels and splitting it into the layers that
          produced it &mdash; queue wait, worker execution, retries, fan-out, and downstream pressure &mdash; so a Rust
          service can point at the boundary that is really failing instead of guessing.
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
            A media-processing pipeline starts getting complaints that uploads take &ldquo;forever&rdquo; to finish, yet
            every dashboard the team trusts looks healthy. Handler time is flat. CPU is moderate. Error rates are normal.
            The handler traces show a job running in a few hundred milliseconds, exactly as designed. Despite all of that,
            the customer&rsquo;s clock keeps running long after the handler returned, because the part the team measured is
            only one stretch of a much longer trip.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The business requirement is to profile that whole trip, not just the handler. A submitted job waits in a
            queue, gets claimed under a lease, runs in a worker, calls a downstream service, possibly retries, and only
            then commits a durable completion record. Each of those segments has its own latency and its own failure
            mode, and the user-visible delay is their sum. The job of this chapter is to make every segment measurable so
            the team can say which one is actually eating the budget.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            Read the path below as a stopwatch with several intermediate splits. The arrows are where time accumulates;
            the labels underneath name the metric that watches each split. The single most common mistake is to stare at
            <span className="text-foreground"> handler run</span> while the real cost is sitting in
            <span className="text-foreground"> queue wait</span> or hiding inside a retry loop that the handler trace never
            shows.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Submit([submit]) --> Wait[queue wait]\n  Wait --> Claim[lease claim]\n  Claim --> Run[handler run]\n  Run --> Down[downstream call]\n  Down --> Done([durable completion])\n  Wait -.watched by.-> M1{{queue depth and age}}\n  Claim -.watched by.-> M2{{queue latency}}\n  Run -.watched by.-> M3{{worker saturation}}\n  Done -.watched by.-> M4{{end-to-end SLO}}`}
            caption="The user feels the whole left-to-right path. Each metric underneath watches one segment of it, so a spike can be assigned to a boundary instead of blamed on the handler by default."
          />
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              These three measurements are the backbone of everything else in the chapter, and they answer different
              questions. End-to-end latency tells you what the user feels. Queue latency tells you how long work waited
              before anyone touched it. Worker saturation tells you whether there is any headroom left to absorb the next
              burst. Read in isolation, each one can lie; read together, they triangulate the bottleneck.
            </p>
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
                The practical rule is short enough to keep on a sticky note: if end-to-end latency rises while handler
                run time stays flat, the time is being spent before the handler, not inside it. The first question is
                queueing or admission &mdash; backlog, lease contention, a closed pool &mdash; not inner-loop CPU. Reaching
                for a flame graph at that moment optimizes the one part of the system that was never slow.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Retry storms and tail latency</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A retry storm is a feedback loop, and that loop is what makes it dangerous. Some tasks start failing, the
              broker redelivers them, the redeliveries add to arrival rate, the higher arrival rate pushes workers past
              saturation, saturation causes more timeouts, and the timeouts produce more retries. The diagram below traces
              that cycle. Notice that the dashed edge feeds back into the top: nothing breaks the loop on its own, so it
              compounds until a budget or a circuit breaker cuts it.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Fail[some tasks fail] --> Redeliver[broker redelivers]\n  Redeliver --> Arrival[arrival rate climbs]\n  Arrival --> Sat[workers pass saturation]\n  Sat --> Timeout[more timeouts]\n  Timeout -.amplifies.-> Fail`}
              caption="A retry storm is a self-reinforcing cycle. Each lap raises arrival rate faster than workers can drain it, so retries are load before they are diagnostics."
            />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              {stormCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The good news is that a storm announces itself before it becomes catastrophic. Retry rate rises, queue age
                rises, worker saturation rises, and the oldest visible message drifts far above the median &mdash; usually
                in that order. If those four signals share a dashboard, you get minutes of warning instead of a page after
                the queue has already buried you.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Distributed tracing</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              In a single process, a tracing library can stitch spans together automatically because they share a call
              stack. The moment work crosses a broker, that stack is gone &mdash; the worker that picks up a message has no
              idea where it came from unless the message itself carries the context. So distributed tracing here is mostly
              a discipline about what you put in the task envelope. Every message has to carry enough identity to rejoin
              its trace on the other side.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {traceCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The envelope below is the minimum that makes correlation possible. The two fields most teams forget are the
              ones that matter most under load:
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">attempt</code>
              lets you separate the first try from the third when a storm hits, and
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">parent_task_id</code>
              is what lets a fan-out graph reassemble itself into a tree instead of a pile of unrelated spans.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Three shapes of metric answer three different kinds of question, and choosing the wrong shape is a common
              way to end up with dashboards that cannot answer the question you actually have. Counters answer &ldquo;how
              much of this happened?&rdquo; Gauges answer &ldquo;what is the level right now?&rdquo; Histograms answer
              &ldquo;what does the distribution look like, especially the tail?&rdquo; The fourth card is the one that
              keeps the system affordable: keep identity out of labels, because a counter with a per-task label is no
              longer a metric &mdash; it is a log line that your monitoring system cannot store.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Metrics, traces, and logs are three views of the same incident, and they are only useful together if a
              single identity threads through all three. The checklist below is really one idea repeated: pick a small set
              of fields and a shared timestamp vocabulary, then carry them everywhere so an operator can walk from an
              aggregate spike down to one concrete record without re-deriving the link by hand.
            </p>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              {correlationChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              That correlation buys you a calm, repeatable order of investigation under pressure. The point of the
              sequence below is the direction of travel: you start from the aggregate that paged you and narrow toward a
              single record, instead of reading four tools in parallel and trying to merge them in your head.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant Op as Operator\n  participant M as Metrics\n  participant T as Traces\n  participant L as Logs\n  participant C as Completion store\n  Op->>M: see the spike\n  M->>T: pick one representative trace\n  T->>L: open that worker and queue log\n  L->>C: read the retry or completion record\n  C-->>Op: full story for one task`}
              caption="The calm incident loop: aggregate spike first, one trace second, worker and queue logs third, one durable record last. Identity fields are what make each hop possible."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Profiling task graphs</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              When a job is a DAG rather than a single handler, the intuition that &ldquo;total time is the sum of the
              stages&rdquo; quietly becomes wrong. Stages that run in parallel overlap, so adding their durations
              double-counts time the system never spent. The number that predicts completion is the
              <span className="text-foreground"> critical path</span>: the longest dependency chain from start to finish.
              Everything off that path has slack and can get slower without anyone noticing &mdash; until it gets slow
              enough to become the new critical path.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Look at the graph below. After <span className="text-foreground">parse</span>, the work forks into
              <span className="text-foreground"> enrich</span> and <span className="text-foreground">store</span>, which run
              at the same time, and <span className="text-foreground">notify</span> waits for both. The completion time is
              governed by whichever fork is slower, not by their sum. That is exactly what the formula under the diagram
              computes: the max over the two competing chains, not the total of every box.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Fetch[fetch] --> Parse[parse]\n  Parse --> Enrich[enrich]\n  Parse --> Store[store]\n  Enrich --> Notify[notify]\n  Store --> Notify\n  Notify --> Done([done])`}
              caption="enrich and store run in parallel after parse, and notify joins them. The critical path is the slower of the two branches plus the shared head and tail, not the sum of all four stages."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Capacity planning for a worker fleet rests on two old results that are worth keeping in your head. The first
              is Little&rsquo;s Law: the average number of items in flight equals arrival rate times the time each item
              spends in the system. The second is the queueing cliff: as utilization approaches one, waiting time does not
              rise gently &mdash; it heads toward infinity. That is why the formulas below divide by a
              <span className="text-foreground"> target utilization</span> below one rather than sizing for exactly the
              average load. You are buying the headroom that keeps queue age finite when a burst or a retry wave arrives.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {capacityCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The two lines below are deliberately rough planning rules, not a simulator. The first sizes a pool from how
              fast work arrives and how long each task runs; the second estimates how much work is in flight at any moment.
              The trap to avoid is plugging in happy-path numbers &mdash; arrival rate has to include retry traffic, or the
              pool you size will be the one that triggers the storm it cannot survive.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`rough_workers_needed ≈ arrival_rate * service_time / target_utilization
in_flight ≈ arrival_rate * time_in_system`}</code>
            </pre>
          </div>

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this looks coming from another language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Most senior engineers arrive with a profiling reflex that worked well on their previous stack and quietly
            misleads them here. The shift is the same in every case: the expensive thing has moved out of one process and
            into the spaces between processes &mdash; queues, leases, retries, and joins &mdash; where your old tools cannot
            see it. These cards name the specific reframe each background needs, not a table of crate equivalents.
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
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Both examples are deliberately small enough to read in one sitting and to run in the editor below them. The
            first builds the four-signal window an operator should see at a glance; the second computes a critical path
            through a DAG. Run each one to confirm the baseline output, then change an input and watch which number moves.
            The goal is to feel how the metric reacts, not to memorize the arithmetic.
          </p>

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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the code takes one batch of completed-task samples and folds it down into four headline
              numbers. Follow the data flow in the diagram first &mdash; raw samples in on the left, four independent
              reductions in the middle (percentiles for the latencies, a ratio for saturation, a rate for retries), and the
              compact window an operator reads on the right. The key idea is that all four come out of the
              <span className="text-foreground"> same</span> sample window, which is what lets you compare them honestly.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Samples[(task samples)] --> E2E[p95 end-to-end]\n  Samples --> Q[p95 queue wait]\n  Samples --> Sat[busy / total]\n  Samples --> Retry[retried / claimed]\n  E2E --> Cont[four reductions, continue below]\n  Q --> Cont\n  Sat --> Cont\n  Retry --> Cont`}
              caption="Fan-out: one sample window splits into four independent reductions — percentiles for the latencies, a ratio for saturation, a rate for retries."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The four reductions then converge back into a single operator window:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cont[four reductions] --> E2E[p95 end-to-end]\n  Cont --> Q[p95 queue wait]\n  Cont --> Sat[busy / total]\n  Cont --> Retry[retried / claimed]\n  E2E --> Win[[operator window]]\n  Q --> Win\n  Sat --> Win\n  Retry --> Win`}
              caption="Fan-in: the four numbers fold back into one summary. Read together, they say whether the cost is waiting, running, capacity, or replay."
            />
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
                  are both counted.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: this is the graph from the concepts section above, but now each stage carries two costs
              instead of one &mdash; the time it waited in its queue plus the time it actually ran. The algorithm walks the
              DAG and, for every node, keeps the longest finishing time among its parents and adds the node&rsquo;s own
              queue and run cost. The diagram shows that per-stage accumulation. The answer is the largest finishing time
              at the end, and the stage that set it is the <span className="text-foreground">tail stage</span> to
              investigate first.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Fetch["fetch<br/>queue + run"] --> Parse["parse<br/>queue + run"]\n  Parse --> Enrich["enrich<br/>queue + run"]\n  Parse --> Store["store<br/>queue + run"]\n  Enrich --> Notify["notify<br/>queue + run"]\n  Store --> Notify\n  Notify --> CP{{"finish = max parent + own cost"}}`}
              caption="Each stage contributes queue wait plus run time. Walking the DAG and keeping the max parent finish at every join yields the critical path and names the tail stage."
            />
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

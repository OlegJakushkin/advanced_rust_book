"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { Button } from "@/components/ui/button"
import { RustPracticeCard } from "../rust-practice-card"

interface Exercise {
  number: number
  kind: string
  title: string
  objective: string
  starterPrompt: string
  prompts?: string[]
  acceptanceCriteria: string[]
  hints: string[]
}

const exercises: Exercise[] = [
  {
    number: 1,
    kind: "warm-up comprehension",
    title: "Pick logs, metrics, traces, or profiles from the symptom",
    objective:
      "Practice choosing the observability signal that answers the real incident question instead of defaulting to whichever tool is easiest to add first.",
    starterPrompt:
      "Classify four symptoms: a queue-backed request path misses p99 while handler p50 stays calm, a sudden spike in rejected payloads appears after one rollout, CPU on one reducer climbs while queue age stays flat, and one service-to-service hop keeps timing out only for one tenant.",
    prompts: [
      "Which symptom wants metrics first?",
      "Which symptom wants structured logs first?",
      "Which symptom wants a trace first?",
      "Which symptom wants a profile first?",
    ],
    acceptanceCriteria: [
      "You map each symptom to a primary signal with a concrete reason.",
      "You distinguish queue wait from handler CPU clearly.",
      "You avoid treating raw log volume as a substitute for one well-chosen metric or span.",
    ],
    hints: [
      "Start by asking whether the question is aggregate health, one event, one causal path, or one cost hotspot.",
      "A strong answer uses more than one tool eventually, but still picks a sane first one.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read a Tokio worker that lost trace context at spawn",
    objective:
      "Explain why one async service emits traces for local work but still cannot correlate queue claim, handler execution, and downstream publish under one path.",
    starterPrompt:
      "Review a worker loop that receives a task from `mpsc`, then does `tokio::spawn(handle(task))` without `info_span!`, without `.instrument(...)`, and without putting trace identity in the task envelope.",
    prompts: [
      "Which context is missing from the task boundary?",
      "What should the envelope carry if the task may cross queue or retry boundaries later?",
      "Would `#[instrument]` on the handler alone be enough?",
      "Which one summary line would you want the browser runner or a test harness to prove is now wired correctly?",
    ],
    acceptanceCriteria: [
      "You identify the missing spawn-boundary context precisely.",
      "You name at least one field such as `trace_id`, `route`, `task_id`, or `attempt` that should cross the boundary explicitly.",
      "You explain why handler spans alone are incomplete when queue or worker spans are missing.",
    ],
    hints: [
      "If the trace stops at `tokio::spawn`, the instrumentation boundary is too small.",
      "A task envelope is already a contract. Let it carry observability identity too.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Design metrics for backpressure and latency",
    objective:
      "Define a minimal but useful metric surface for a bounded Tokio or broker-backed service.",
    starterPrompt:
      "Design metrics for `accept -> queue -> worker -> publish`, with occasional retries and one bounded worker pool.",
    prompts: [
      "Which counters should exist for accepted work, completed work, retries, and duplicate suppression?",
      "Which gauges should exist for queue depth, oldest visible age, and busy workers?",
      "Which histograms should exist for queue wait, run time, and end-to-end latency?",
      "Which labels would you explicitly forbid because they create dangerous cardinality?",
    ],
    acceptanceCriteria: [
      "You propose at least one counter, one gauge, and one histogram family.",
      "You tie each metric to one operational question instead of only listing nouns.",
      "You forbid at least one high-cardinality label such as `trace_id` or `task_id`.",
    ],
    hints: [
      "The best metric set is small enough to operate and rich enough to explain one incident quickly.",
      "Queue age and queue depth together often tell a better story than throughput alone.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair async tracing and structured logs together",
    objective:
      "Refactor a worker path so logs and traces share enough identity to explain one retry or dead-letter path without guesswork.",
    starterPrompt:
      "A service currently logs `retrying task` and `dead-lettered` as plain strings, but the logs do not include `task_id`, `queue`, `attempt`, or `trace_id`, and the retry span is not linked to the original claim span.",
    prompts: [
      "Which fields should become structured log fields immediately?",
      "Which span relationship should be explicit across claim, retry, and terminal routing?",
      "How would you keep the extra fields low-cardinality enough for logs while still useful for traces?",
      "What should the single log-emitting boundary be for a permanent failure?",
    ],
    acceptanceCriteria: [
      "You add at least three structured fields that make correlation materially better.",
      "You describe one parent-child or retry-lineage tracing repair.",
      "You identify one boundary that should log the permanent failure once.",
    ],
    hints: [
      "The most useful log field is the one that lets you pivot to the trace or durable record immediately.",
      "A permanent failure path should not produce identical error logs at five layers.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Connect logs, metrics, and traces in one incident narrative",
    objective:
      "Practice telling one coherent production story from three signal types instead of reading each one in isolation.",
    starterPrompt:
      "Metrics show oldest visible age rising from 200 ms to 4 s. One trace shows a task waited 3.6 s before claim and then only 80 ms in the handler. Structured logs show the same task retried twice because a downstream store timed out.",
    prompts: [
      "Which layer actually dominates end-to-end latency here?",
      "Which metric should have paged first?",
      "Which trace fields or log fields make the retry path attributable?",
      "Which refactor would you test before touching handler CPU?",
    ],
    acceptanceCriteria: [
      "You identify queue wait and replay pressure, not handler CPU, as the dominant story.",
      "You cite at least one metric and one identity field that connect the evidence.",
      "You propose one refactor tied to the real bottleneck, such as retry budgeting, queue split, or more downstream capacity.",
    ],
    hints: [
      "This exercise is about causality, not about one favorite dashboard.",
      "If queue wait dominates already, optimizing 80 ms of handler CPU is probably not first.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Turn observability into SLOs, alerts, and refactoring policy",
    objective:
      "Design the outer observability contract for a service another team will operate under real failure and capacity pressure.",
    starterPrompt:
      "You are designing a scoring service with HTTP intake, an internal bounded queue, a GPU-backed worker lane, and a brokered outcome publisher. Operators require end-to-end latency and success SLOs plus a clear story for continuous profiling and OpenTelemetry export.",
    prompts: [
      "Which SLOs would you publish: success rate, oldest visible age, e2e latency, freshness, or a subset?",
      "Which alerts should fire from burn rate versus absolute queue age or worker saturation?",
      "Where should OpenTelemetry exporter wiring live relative to domain and transport code?",
      "Which profiling signals would you sample continuously and which would stay incident-driven?",
    ],
    acceptanceCriteria: [
      "You define at least two SLO-style promises that map to concrete metrics.",
      "You distinguish burn-style alerting from raw threshold alerting with one reason for each.",
      "You keep exporter or collector wiring at the platform edge instead of leaking it into domain logic.",
      "You mention at least one continuous profile signal and one incident-driven deeper measurement.",
    ],
    hints: [
      "An SLO is useful only if someone can still act on it.",
      "Exporter wiring is usually platform configuration, not business behavior.",
    ],
  },
]

const reviewQuestions = [
  "What does structured logging solve that plain text logs do not solve well?",
  "Why should queue wait be a first-class latency signal in async and distributed Rust services?",
  "What is the practical difference between trace identity and metric labels?",
  "Why is OpenTelemetry usually an export and propagation concern rather than a domain-model concern?",
  "How does observability-driven refactoring differ from profiling-driven local optimization?",
]

const workingLoop = [
  "Choose the signal from the question: event, aggregate, timeline, or cost.",
  "Keep stable IDs flowing through tasks, queues, retries, and durable completion records.",
  "Measure queue wait, run time, and end-to-end completion separately.",
  "Use metrics for aggregate health, traces for causal paths, and logs for event detail.",
  "Re-test the same incident story after the fix so the improvement is attributable.",
]

const observabilityChecklist = [
  "Structured log fields: trace_id, task_id, queue, attempt, tenant, error_kind.",
  "Metrics: queue depth, oldest visible age, busy workers, retry rate, end-to-end latency.",
  "Tracing: enqueue, claim, handler, downstream publish, retry, terminal route.",
  "SLOs: success rate and one user-visible latency or freshness budget.",
]

export function PageCh43ObservabilityExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch43-observability-exercises")
  const mainPageIndex = getPageIndexById("ch43-observability")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 43 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice observability the way it survives production review: explicit spans, low-cardinality metrics, structured
          logs, and incident narratives that connect all three on purpose.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as an incident and design review at the same time. The strongest answer does not stop
                at “add tracing.” It says which fields, which queue signals, which trace lineage, and which alert contract
                actually make the service operable.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 43
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Suggested working loop</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            {workingLoop.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Minimal observability checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {observabilityChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4">
          {exercises.map((exercise) => (
            <article key={exercise.number} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3 flex-col md:flex-row md:items-center mb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">
                    Exercise {exercise.number} · {exercise.kind}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{exercise.title}</h3>
                </div>
                <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                  Observability drill
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Objective</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{exercise.objective}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-primary" />
                    <h4 className="font-medium text-foreground">Starter prompt</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{exercise.starterPrompt}</p>
                  {exercise.prompts?.length ? (
                    <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                      {exercise.prompts.map((prompt) => (
                        <li key={prompt}>{prompt}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-border bg-card p-4">
                <h4 className="font-medium text-foreground mb-2">Acceptance criteria</h4>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {exercise.acceptanceCriteria.map((criterion) => (
                    <li key={criterion}>{criterion}</li>
                  ))}
                </ul>
              </div>

              <details className="mt-4 rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer list-none flex items-center gap-2 font-medium text-foreground">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Optional hints
                </summary>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {exercise.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </section>

        <RustPracticeCard
          title="Runnable lab · Instrument a Tokio worker with spans"
          description={
            <>
              Repair the starter so the handler is instrumented with span fields for{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">trace_id</code> and{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">route</code>, and so each task runs under
              an explicit worker span. The browser runner summarizes whether the span wiring is in place.
            </>
          }
          filename="trace_service_lab.rs"
          runKey="ch43_ex_trace_service"
          expectedOutput={"instrumented = true\nprocessed = 2\nlast trace = req-12"}
          helperText={
            <>
              Tip: add <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">#[instrument(...)]</code> to the
              handler with <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">trace_id</code> and{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">route</code> fields, create one{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">info_span!</code> for the worker, and run
              the future with <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">.instrument(...)</code>.
            </>
          }
          initialCode={`use tokio::sync::mpsc;
use tracing::{info_span, instrument, Instrument};

#[derive(Debug, Clone)]
struct Request {
    trace_id: &'static str,
    route: &'static str,
    bytes: usize,
}

async fn handle(request: Request) -> Result<usize, &'static str> {
    if request.bytes == 0 {
        return Err("empty payload");
    }

    Ok(request.bytes / 10)
}

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel::<Request>(4);

    tx.send(Request {
        trace_id: "req-11",
        route: "/score",
        bytes: 200,
    })
    .await
    .unwrap();

    tx.send(Request {
        trace_id: "req-12",
        route: "/health",
        bytes: 100,
    })
    .await
    .unwrap();

    drop(tx);

    let mut processed = 0_usize;
    let mut last_trace = "none";

    while let Some(request) = rx.recv().await {
        last_trace = request.trace_id;

        match handle(request).await {
            Ok(_) => processed += 1,
            Err(_) => {}
        }
    }

    println!("processed = {}", processed);
    println!("last trace = {}", last_trace);
}`}
        />

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Review questions</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {reviewQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">What success looks like</h3>
          <p className="text-sm text-muted-foreground leading-6">
            By the end of this page, you should be able to instrument Tokio work with spans, define metrics for backlog and
            latency that operators can actually use, connect logs, metrics, and traces into one incident story, and turn
            those signals into explicit SLO and refactoring decisions.
          </p>
        </section>
      </div>
    </div>
  )
}

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
    title: "Design metrics for worker saturation on purpose",
    objective: "Choose a small metric set that distinguishes healthy throughput from hidden backlog and retry amplification.",
    starterPrompt:
      "You run three worker pools: fast CPU tasks, slow GPU tasks, and a reducer pool. Decide which counters, gauges, and histograms each pool should expose.",
    prompts: [
      "Which counters describe admission, completion, retries, and duplicate suppression?",
      "Which gauges describe visible backlog, in-flight work, and oldest message age?",
      "Which histograms describe queue wait, run time, and end-to-end latency?",
      "Which labels would create dangerous cardinality if you added them mechanically?",
    ],
    acceptanceCriteria: [
      "You include at least one counter, one gauge, and one histogram family with a clear reason.",
      "You distinguish worker saturation from queue saturation explicitly.",
      "You name at least one label you would forbid, such as task ID or trace ID.",
    ],
    hints: [
      "A good metric set tells you whether the pain is admission, execution, or replay.",
      "Low-cardinality aggregate signals belong in metrics. Per-task identity belongs elsewhere.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace a tail-latency incident across logs, metrics, and traces",
    objective: "Practice reconstructing one slow path when mean handler time still looks calm.",
    starterPrompt:
      "Metrics show queue age rising. Handler p50 is flat. A trace shows one task waited 900 ms before claim and only 70 ms in the handler. Logs show the same task retried twice before success.",
    prompts: [
      "Which system layer is actually dominating end-to-end latency here?",
      "Which metric should have alerted earlier than handler p50?",
      "Which log fields or trace fields make the retry path attributable to one task?",
      "What first mitigation would you test before optimizing handler CPU?",
    ],
    acceptanceCriteria: [
      "You identify queue wait or replay, not handler CPU, as the dominant layer.",
      "You choose at least one metric and one identity field that make the incident explainable.",
      "You propose one mitigation tied to the real bottleneck, such as worker budget, retry cap, or queue split.",
    ],
    hints: [
      "If queue wait is already dominant, a faster handler may not move the p99 enough to matter.",
      "The most useful answer names one task identity and one queue identity.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement a retry-storm window summary",
    objective: "Compute worker saturation, retry rate, and a storm flag from one profiling window.",
    starterPrompt:
      "Implement helpers over `WindowStats` so one profiling sample can report saturation, retry rate, and whether the window already looks storm-like.",
    prompts: [
      "Use worker saturation as busy workers divided by total workers.",
      "Use retry rate as retried work divided by claimed work.",
      "Make the storm rule explicit with one saturation threshold and one retry-rate threshold.",
      "Keep the helper side-effect free so the lab stays easy to test.",
    ],
    acceptanceCriteria: [
      "The helper computes saturation and retry rate correctly.",
      "The storm rule is visible in code rather than hidden in prose.",
      "The runnable lab prints the expected saturation, retry rate, and storm flag.",
    ],
    hints: [
      "This is a metric and policy drill, not a transport drill.",
      "The point is to make the threshold logic reviewable.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a profiling surface that hides queue latency",
    objective: "Add the missing instrumentation and IDs so traces and logs can explain backlog instead of only handler execution.",
    starterPrompt:
      "A worker system emits handler spans but never records enqueue time, claim time, or the queue name in any structured field.",
    prompts: [
      "Which timestamps belong in the task envelope or trace events?",
      "Which log fields should appear on both the enqueue and worker side?",
      "Would you model queue wait as one explicit span or as derived time between two events?",
      "How would you keep the extra data low-cost enough for the hot path?",
    ],
    acceptanceCriteria: [
      "You add or describe enqueue and claim visibility explicitly.",
      "You include at least one stable correlation field such as task ID or trace ID.",
      "You mention one cost-control tactic, such as aggregate metrics plus sampled detailed traces.",
    ],
    hints: [
      "You do not need all detail at full volume. You do need enough detail to explain one incident path.",
      "If the queue name is invisible, multi-queue tail analysis gets much harder.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Profile a task graph by critical path instead of average stage time",
    objective: "Replace stage-local averages with graph-aware signals that reveal reducer lag and join bottlenecks.",
    starterPrompt:
      "A DAG pipeline shows acceptable mean time in every worker stage, yet end-to-end time keeps growing as fan-out width increases.",
    prompts: [
      "Which graph signal should you add: critical-path time, frontier size, reducer backlog, or all three?",
      "Where does queue wait belong in the graph accounting?",
      "How would you prove a join stage is the real bottleneck rather than one upstream worker?",
      "What would you sample or trace to keep the graph story attributable?",
    ],
    acceptanceCriteria: [
      "You include at least one graph-aware signal beyond per-stage averages.",
      "You keep queue wait inside the graph story rather than outside it.",
      "You propose one attribution field or trace pattern for fan-out and fan-in nodes.",
    ],
    hints: [
      "A graph can be locally healthy and globally slow at the same time.",
      "The critical path is the first honest simplification.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Capacity-plan a distributed worker fleet with retries and slow-stage isolation",
    objective: "Choose queue splits, worker budgets, and observability targets from arrival rate, service time, and failure profile.",
    starterPrompt:
      "You are designing `ingest -> parse -> enrich -> store -> notify`, with 180 task submissions per second, one long-running specialist stage, and a requirement that oldest visible age stay under 2 seconds in steady state.",
    prompts: [
      "Which stage deserves its own queue or worker pool instead of sharing one global budget?",
      "How would you include retry traffic in the worker estimate?",
      "Which metrics would tell you that the 2-second oldest-age budget is about to fail?",
      "What drain-time or shutdown goal belongs in the same capacity plan?",
    ],
    acceptanceCriteria: [
      "You define at least one queue or worker split deliberately.",
      "You include retries in the capacity story instead of treating them as rare noise.",
      "You mention at least three observability hooks such as oldest visible age, busy workers, retry rate, or reducer backlog.",
      "You include one shutdown or drain-time target alongside steady-state throughput.",
    ],
    hints: [
      "Capacity planning without replay traffic usually underestimates the real budget.",
      "Oldest visible age is often a better operational target than average queue depth alone.",
    ],
  },
]

const reviewQuestions = [
  "Why is queue latency often a better first incident signal than mean handler time?",
  "What makes a retry storm a load-amplification problem instead of only an error-rate problem?",
  "Why should task ID and trace ID stay out of metric labels but stay present in logs and traces?",
  "What does critical-path time explain that stage-local averages do not explain?",
  "Why should capacity planning include drain time and retry traffic, not only steady-state throughput?",
]

const workingLoop = [
  "Choose one operational identity first: task ID, attempt, queue, and trace lineage.",
  "Measure queue wait, run time, and end-to-end completion separately.",
  "Count retries as real traffic before you size workers or queues.",
  "Use metrics for aggregate signals, traces for one causal path, and logs for event detail.",
  "Re-run the same incident story after the fix so the improvement is measurable and attributable.",
]

export function PageCh36DistributedTasksProfilingExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch36-distributed-tasks-profiling-exercises")
  const mainPageIndex = getPageIndexById("ch36-distributed-tasks-profiling")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 36 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice distributed task profiling the way it survives review: explicit queue-latency signals, honest retry
          accounting, graph-aware tracing, and capacity plans built from real budgets.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as an incident or design review. The strongest answer does not stop at “add
                monitoring.” It says which latency bucket is missing, which IDs connect the evidence, and which budget or
                policy should change after the diagnosis.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 36
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
                  Distributed profiling drill
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
          title="Runnable lab · Retry-storm window summary"
          description={
            <>
              Repair the starter so one profiling window reports worker saturation, retry rate, and whether the window
              already looks storm-like. The checker expects the exact output below.
            </>
          }
          filename="retry_storm_window_lab.rs"
          runKey="ch36_ex_retry_storm_window"
          expectedOutput={"saturation = 0.90\nretry rate = 0.40\nstorm = true"}
          helperText={
            <>
              Tip: keep the functions pure. A clean rule is enough here: saturation as busy divided by total, retry rate
              as retried divided by claimed, and storm true only when both cross visible thresholds.
            </>
          }
          initialCode={`#[derive(Debug, Clone, Copy)]
struct WindowStats {
    claimed: u32,
    retried: u32,
    busy_workers: u32,
    total_workers: u32,
}

fn saturation(_stats: &WindowStats) -> f64 {
    0.0
}

fn retry_rate(_stats: &WindowStats) -> f64 {
    0.0
}

fn retry_storm(_stats: &WindowStats) -> bool {
    false
}

fn main() {
    let stats = WindowStats {
        claimed: 100,
        retried: 40,
        busy_workers: 9,
        total_workers: 10,
    };

    println!("saturation = {:.2}", saturation(&stats));
    println!("retry rate = {:.2}", retry_rate(&stats));
    println!("storm = {}", retry_storm(&stats));
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
            By the end of this page, you should be able to design a useful saturation surface, trace one tail-latency
            incident across metrics, logs, and traces, identify retry storm signals early, and defend one capacity plan
            with explicit worker, queue, and drain-time budgets.
          </p>
        </section>
      </div>
    </div>
  )
}

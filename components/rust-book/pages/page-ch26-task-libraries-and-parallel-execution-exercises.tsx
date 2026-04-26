"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
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
    title: "Choose Tokio, Rayon, Crossbeam, or futures utilities from the workload",
    objective: "Practice mapping scheduling shape to the library that matches it instead of treating concurrency libraries as interchangeable.",
    starterPrompt:
      "Classify four cases: a TCP accept loop with many idle sockets, a large batch scoring pass over numeric data, a thread-based pipeline with bounded handoff between worker stages, and a local set of futures you want to poll as they complete without spawning each one.",
    prompts: [
      "Which case wants Tokio tasks because waiting is the dominant cost?",
      "Which case wants Rayon because CPU saturation over one data set is the real job?",
      "Which case wants Crossbeam because thread-based coordination and bounded queues are the model?",
      "Which case wants `FuturesUnordered` because the futures themselves are the unit of composition?",
    ],
    acceptanceCriteria: [
      "You assign each workload to a plausible primary tool and justify it with scheduling shape.",
      "You distinguish spawned tasks from locally composed futures clearly.",
      "You keep CPU-bound and IO-bound workloads separate instead of solving both with one library by reflex.",
    ],
    hints: [
      "Start with the dominant cost: waiting or CPU.",
      "Then ask whether the unit is a spawned task, a local future, a pool job, or a channel message.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find CPU-bound work left on Tokio workers",
    objective: "Read a task orchestration path and identify where `spawn_blocking`, Rayon, or a dedicated pool should replace inline CPU work.",
    starterPrompt:
      "A Tokio request handler reads from a socket, parses a large batch, computes a heavy checksum inline, then awaits a database call and publishes to a queue.",
    prompts: [
      "Which steps are naturally async waits and should stay on the runtime?",
      "Which step monopolizes a runtime worker and should move out of the ordinary async path?",
      "Would `spawn_blocking` be enough here, or is a real CPU pool more honest if the batch stage dominates the service?",
      "Which production metric would confirm runtime starvation or blocking-pool overload?",
    ],
    acceptanceCriteria: [
      "You separate waiting-heavy steps from CPU-heavy steps clearly.",
      "You move at least one step to `spawn_blocking` or a CPU pool with a reason.",
      "You mention one observability hook such as runtime latency, queue depth, or blocking-pool backlog.",
    ],
    hints: [
      "Async is not the same as parallel CPU work.",
      "The right boundary often appears where owned input can move into a blocking closure or pool job cleanly.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement a bounded worker queue",
    objective: "Build a small queue boundary where admission is explicit and producer speed cannot grow memory without limit.",
    starterPrompt:
      "Implement a small worker handoff using either `tokio::sync::mpsc::channel` with a capacity or `crossbeam::channel::bounded`, then count accepted jobs and one retryable job explicitly.",
    prompts: [
      "Keep the queue capacity visible in code.",
      "Move owned work items through the queue rather than sharing mutable state directly.",
      "Count a retryable item separately from accepted normal work.",
      "Add a small cancellation flag or stop condition.",
    ],
    acceptanceCriteria: [
      "The design uses a bounded queue rather than an unbounded default.",
      "Work crosses the boundary by ownership transfer.",
      "The runnable lab prints the expected capacity, accepted count, retry count, and cancellation flag.",
    ],
    hints: [
      "A bounded queue is already a policy decision. Keep it visible.",
      "If the queue owns admission, the producer should not need a broad shared lock to publish work.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair async orchestration with cancellation and retry",
    objective: "Refactor a spawned-task pipeline so cancellation and retry policy live in one visible orchestration layer.",
    starterPrompt:
      "You inherit a Tokio service that spawns child tasks but has no stop signal and retries failed work by recursively calling itself from inside the task body.",
    prompts: [
      "Where should the stop signal live: `watch`, `oneshot`, timeout, or explicit abort handle?",
      "Where should the retry counter and backoff policy live so the task body stays small?",
      "Would `JoinSet` or `FuturesUnordered` make completion handling easier to centralize?",
      "How will the service stop admitting work before draining in-flight tasks?",
    ],
    acceptanceCriteria: [
      "You move retry budgeting out of ad hoc recursion and into one orchestration policy.",
      "You add an explicit cancellation or shutdown path.",
      "You choose either spawned-task orchestration or local-future orchestration with a reason tied to the workload.",
    ],
    hints: [
      "A retry loop hidden inside the task body is often harder to cap and harder to observe.",
      "Cancellation is easier to reason about when admission, draining, and timeouts are one visible control flow.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Choose thread pools and backpressure for a mixed service",
    objective: "Map waiting-heavy, CPU-heavy, and coordination-heavy stages to the right pools and admission controls.",
    starterPrompt:
      "You are designing `accept -> parse -> enrich -> persist -> publish`, with bursty traffic, a CPU-heavy enrichment stage, and operator requirements for clean rolling shutdown.",
    prompts: [
      "Which stages stay on Tokio runtime workers and which move to a CPU pool or `spawn_blocking`?",
      "Which internal queues should be bounded, and where should a semaphore or concurrency cap sit?",
      "Would the enrichment stage rather use Rayon directly than a large number of small blocking tasks?",
      "What metrics would you require before calling the design production-ready?",
    ],
    acceptanceCriteria: [
      "You place at least one bounded queue or concurrency cap deliberately.",
      "You choose a real CPU boundary rather than leaving enrichment inline on runtime workers.",
      "You mention at least two observability hooks such as queue depth, in-flight task count, blocking-pool backlog, or shutdown latency.",
    ],
    hints: [
      "One service can legitimately use Tokio and Rayon together.",
      "The budget should follow the expensive stage, not only the front-door accept loop.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design a task API another team can operate safely",
    objective: "Make cancellation, ownership, retry, and result shape explicit in the public API of a task-oriented subsystem.",
    starterPrompt:
      "You are publishing a library for internal teams to submit work to a background pipeline. The library may run on Tokio for IO-heavy users and use CPU pools for batch-heavy users.",
    prompts: [
      "What does the submission API own, and what should it borrow only locally?",
      "How will callers specify or inherit queue capacity, concurrency caps, or retry budget?",
      "How does the API surface cancellation: drop semantics, signal handles, timeout wrappers, or explicit stop methods?",
      "What outcome type should callers receive so success, retryable failure, and cancellation are distinguishable?",
    ],
    acceptanceCriteria: [
      "You define an owned submission boundary rather than a lifetime-heavy spawned-work API.",
      "You make at least one resource budget visible to callers or configuration.",
      "You give callers a clear cancellation path and a structured outcome type.",
      "You mention one testing hook and one observability hook for the API.",
    ],
    hints: [
      "A task library is easier to operate when the budgets are first-class rather than hidden constants.",
      "The cleanest API usually makes success, retry, and cancellation explicit at the type level or in a clearly named result enum.",
    ],
  },
]

const reviewQuestions = [
  "What practical signal tells you a workload wants Tokio instead of Rayon?",
  "When is `FuturesUnordered` calmer than `JoinSet`, and when is the reverse true?",
  "Why is a bounded queue already an API and overload decision, not only an implementation detail?",
  "What is the difference between cancellation as task drop, cancellation as explicit signal, and retry as policy?",
  "Why should CPU-heavy work have its own budget even inside an async service?",
]

const workingLoop = [
  "Name the dominant cost first: waiting, CPU, or coordination.",
  "Choose the unit second: spawned task, local future, pool job, or channel message.",
  "Make queue capacity, concurrency cap, and retry budget visible before the service is already overloaded.",
  "Add cancellation and shutdown sequencing before rollout, not after the first draining incident.",
]

export function PageCh26TaskLibrariesAndParallelExecutionExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 51
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 26 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice choosing task libraries and pool boundaries the way they appear in production: bounded admission, owned
          work handoff, explicit retries, and clear cancellation paths.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a workload-and-boundary review. The strongest answer identifies the scheduling model,
                the ownership handoff, the queue or pool budget, and the stop story before it reaches for a library name.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(50)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 26
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
                  Task orchestration drill
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
          title="Runnable lab · Bounded queue with retry and cancellation"
          description={
            <>
              Repair the starter so the queue stays bounded, retryable work is counted explicitly, and the flow exposes a
              visible cancellation flag. The checker expects the exact output below.
            </>
          }
          filename="bounded_queue_retry_lab.rs"
          runKey="ch26_ex_bounded_queue_retry"
          expectedOutput={"capacity = 2\naccepted = 2\nretried = 1\ncancelled = true"}
          helperText={
            <>
              Tip: keep the queue capacity at{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">2</code>, increment the retry counter in
              the <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">"retry"</code> branch, and make the
              stop condition explicit by setting <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">cancelled</code>{" "}
              to <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">true</code>.
            </>
          }
          initialCode={`fn main() {\n    let (tx, rx) = crossbeam::channel::bounded::<&'static str>(2);\n\n    let worker = std::thread::spawn(move || {\n        let mut accepted = 0;\n        let mut retried = 0;\n        let mut cancelled = false;\n\n        while let Ok(job) = rx.recv() {\n            if job == "retry" {\n                retried += 0;\n            } else {\n                accepted += 1;\n            }\n        }\n\n        (accepted, retried, cancelled)\n    });\n\n    tx.send("parse").unwrap();\n    tx.send("retry").unwrap();\n    tx.send("flush").unwrap();\n    drop(tx);\n\n    let (accepted, retried, cancelled) = worker.join().unwrap();\n\n    println!("capacity = {}", 2);\n    println!("accepted = {}", accepted);\n    println!("retried = {}", retried);\n    println!("cancelled = {}", cancelled);\n}`}
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
            By the end of this page, you should be able to choose Tokio, Rayon, Crossbeam, or futures utilities from real
            execution shape, implement a bounded handoff queue, centralize retry and cancellation policy, and describe task
            APIs in terms of ownership, budgets, and observable behavior rather than only in terms of library calls.
          </p>
        </section>
      </div>
    </div>
  )
}

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
    title: "Assemble the capstone architecture from earlier chapters",
    objective:
      "Practice mapping earlier book topics into one distributed system without inventing extra abstraction layers first.",
    starterPrompt:
      "Sketch `HTTP request -> canonicalize -> compute verification root -> publish task -> claim task -> execute graph or matrix workload -> durable completion -> notify` as one Rust system.",
    prompts: [
      "Which boundaries are Tokio task boundaries, and which are broker or queue boundaries?",
      "Where does the task first have to become fully owned?",
      "Which subsystem should own duplicate suppression and durable finish-once state?",
      "Where do graph, matrix, and optional accelerator lanes enter the picture?",
    ],
    acceptanceCriteria: [
      "You identify at least one owned message boundary and one async runtime boundary clearly.",
      "You place duplicate suppression at the durable completion boundary rather than in a fragile local cache only.",
      "You separate the execution lanes from the transport and verification lanes explicitly.",
    ],
    hints: [
      "The queue boundary is usually the first place borrowed request-local state becomes dishonest.",
      "A good answer names owners, not only components.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Review a flawed capstone delivery path",
    objective:
      "Spot the production mistakes that appear when a distributed design compiles but its ownership and failure model are still wrong.",
    starterPrompt:
      "You inherit an API handler that borrows request data into spawned work, publishes to one shared queue for all workloads, acks broker delivery before durable result storage, and records no trace or dedupe key in the envelope.",
    prompts: [
      "Which line or boundary turns borrowed data into an eventual lifetime bug or design lie?",
      "Why does one shared queue create avoidable tail-latency coupling between fast and slow workloads?",
      "Why is ack-before-store a correctness bug rather than only a telemetry bug?",
      "Which missing fields make replay, tracing, or idempotency weaker than they need to be?",
    ],
    acceptanceCriteria: [
      "You identify at least three concrete design failures, not only one vague 'needs refactoring' note.",
      "You explain one ownership bug, one backpressure or queueing bug, and one correctness or replay bug.",
      "You propose a repair for each category.",
    ],
    hints: [
      "Try to classify each issue as ownership, pacing, correctness, or observability.",
      "The most important bug is usually the one that loses work or duplicates side effects under crash.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Define implementation milestones and acceptance criteria",
    objective:
      "Break the capstone into reviewable milestones so the repository stays coherent and measurable after each step.",
    starterPrompt:
      "Propose four milestones for building the capstone in order: a single-process reference implementation, a brokered path, specialized worker lanes, and production rollout hardening.",
    prompts: [
      "What must be working at the end of each milestone?",
      "Which tests belong to each milestone: unit, integration, soak, or replay?",
      "Which telemetry should exist before the next milestone begins?",
      "Which architectural decisions must remain stable across all milestones, such as the task envelope shape?",
    ],
    acceptanceCriteria: [
      "You define at least four milestones with one clear completion condition each.",
      "You attach at least one test or verification lane to each milestone.",
      "You preserve one stable task envelope or durable contract across the whole plan.",
    ],
    hints: [
      "A milestone is useful only if another engineer can tell when it is done.",
      "Keep the durable contract stable earlier than the internal executor implementation.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair worker idempotency and queue budgets",
    objective:
      "Refactor the capstone when duplicate execution and mixed-latency queues are already hurting correctness and p99.",
    starterPrompt:
      "Metrics show duplicate completions during lease expiry and queue age spikes whenever matrix jobs arrive in bursts. Repair the design before tuning kernels.",
    prompts: [
      "Where should finish-once state live so a replay stays harmless?",
      "Should graph and matrix work split into separate queues or worker pools?",
      "Which local queues should be bounded, and where should admission push back instead of buffering forever?",
      "What regression test would prove the refactor fixed the replay path?",
    ],
    acceptanceCriteria: [
      "You place idempotent completion in one durable owner or store.",
      "You isolate at least one slow workload class from a fast one.",
      "You add or propose one bounded queue or concurrency cap explicitly.",
      "You define one replay or duplicate-suppression test.",
    ],
    hints: [
      "Correctness usually gets fixed before throughput.",
      "A queue split is often a pacing repair as much as a performance repair.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Profile and refactor the capstone from evidence",
    objective:
      "Turn one latency incident into a measurement-first refactoring plan instead of a guess-driven rewrite.",
    starterPrompt:
      "One production window shows queue p95 at 800 ms, worker run time at 70 ms, retry rate at 0.25, and one saturated accelerator lane while CPU graph workers remain mostly idle.",
    prompts: [
      "Which layer is the dominant bottleneck right now?",
      "Which metric should have paged first, and which trace should you inspect next?",
      "Which refactor should come before any graph or matrix kernel optimization?",
      "What before-and-after signals would prove the repair moved the real bottleneck?",
    ],
    acceptanceCriteria: [
      "You identify queueing or accelerator admission, not local handler CPU, as the current dominant story.",
      "You choose at least one metric and one trace or log field for the next diagnostic step.",
      "You propose one refactor tied directly to the evidence, such as queue split, worker budget change, or retry classification repair.",
      "You name at least two validation signals after the change.",
    ],
    hints: [
      "A 70 ms handler is rarely the first optimization target if queue wait is already 800 ms.",
      "Retry rate belongs in the capacity story, not only in the error story.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose rollout, acceleration, and failure isolation policy",
    objective:
      "Design the final production posture for the capstone so operators can canary, rollback, and contain slow specialist lanes.",
    starterPrompt:
      "You are releasing the capstone with optional CPU-only, MPI-assisted, and CUDA-assisted execution paths. Operators require canary rollout, rollback artifacts, and an explicit policy for replay after worker crash.",
    prompts: [
      "Which execution path should be the stable fallback when specialist lanes are saturated or unavailable?",
      "Which artifact or configuration knobs must be visible during canary so teams know which lane is active?",
      "How will you isolate retry storms in one specialist lane from the rest of the system?",
      "What telemetry or health gates must pass before promotion from canary to broad rollout?",
    ],
    acceptanceCriteria: [
      "You define one safe fallback path and one specialist path selection rule.",
      "You include at least one failure-isolation mechanism such as queue split, worker-pool split, or retry-lane split.",
      "You include at least two rollout gates tied to concrete telemetry, such as queue age, retry rate, verification failures, or durable completion lag.",
      "You mention one rollback artifact or operator action that does not depend on rebuilding from memory during the incident.",
    ],
    hints: [
      "A capstone is not rollout-ready until the fallback path is boring and explicit.",
      "Specialist acceleration without isolation is just another outage amplifier.",
    ],
  },
]

const milestoneChecklist = [
  "Milestone 1: single-process reference core with typed envelopes, graph and matrix executors, and deterministic unit tests.",
  "Milestone 2: broker publish, claim, durable finish-once checkpoint, and replay-safe integration tests.",
  "Milestone 3: specialized worker lanes, bounded queues, and optional accelerator or cluster paths behind the same task contract.",
  "Milestone 4: full observability, packaging lanes, canary policy, rollback artifacts, and soak tests under retry and backlog pressure.",
]

const reviewQuestions = [
  "Where should the capstone first cross from borrowed request data into an owned durable envelope?",
  "Why should duplicate suppression live near durable completion rather than only in one in-memory worker cache?",
  "What is the practical difference between profiling queue wait and profiling worker run time in this system?",
  "Why should specialist graph, matrix, MPI, or CUDA lanes still preserve one stable outer task contract?",
  "What makes an implementation milestone useful instead of decorative?",
]

const workingLoop = [
  "Draw the task envelope and ownership boundaries first.",
  "Name the durable completion rule second: when is work safe to forget?",
  "Split slow and fast workload classes before tuning inner kernels.",
  "Profile queue wait, execution, retry, and completion separately.",
  "Attach rollout and rollback requirements to the same artifact plan before calling the capstone done.",
]

export function PageCh45CapstoneDistributedRustSystemExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch45-capstone-distributed-rust-system-exercises")
  const mainPageIndex = getPageIndexById("ch45-capstone-distributed-rust-system")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 45 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice the capstone the way a staff-level design review would: architecture first, milestones second, queue
          and replay policy third, then profiling and rollout from evidence.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a capstone review. The best answer does not say only “use Tokio” or “use a
                broker.” It says who owns the task, when the result becomes durable, how replay stays harmless, which
                workload classes deserve separate budgets, and what telemetry proves the system is healthy.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 45
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Milestone checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {milestoneChecklist.map((item) => (
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
                  Capstone drill
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
          title="Runnable lab · Verified dispatcher"
          description={
            <>
              Repair the starter so only verified tasks are dispatched and the workload is routed to the correct broker
              key. This keeps the browser exercise small while still testing the capstone's core control-path idea:
              verification before execution.
            </>
          }
          filename="verified_dispatcher_lab.rs"
          runKey="ch45_ex_capstone_dispatcher"
          expectedOutput={"accepted = 2\nrejected = 1\nlast route = tasks.matrix"}
          helperText={
            <>
              Tip: make <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">should_run</code> depend on the
              verification flag, then route graph work to{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">tasks.graph</code> and matrix work to{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">tasks.matrix</code>.
            </>
          }
          initialCode={`#[derive(Debug, Clone, Copy)]
enum Workload {
    Graph,
    Matrix,
}

#[derive(Debug, Clone, Copy)]
struct TaskEnvelope {
    task_id: &'static str,
    verified: bool,
    workload: Workload,
}

fn route(_task: &TaskEnvelope) -> &'static str {
    "tasks.unknown"
}

fn should_run(_task: &TaskEnvelope) -> bool {
    false
}

fn main() {
    let tasks = [
        TaskEnvelope {
            task_id: "graph-1",
            verified: true,
            workload: Workload::Graph,
        },
        TaskEnvelope {
            task_id: "matrix-1",
            verified: true,
            workload: Workload::Matrix,
        },
        TaskEnvelope {
            task_id: "reject-1",
            verified: false,
            workload: Workload::Graph,
        },
    ];

    let mut accepted = 0_u32;
    let mut rejected = 0_u32;
    let mut last_route = "none";

    for task in tasks {
        if should_run(&task) {
            accepted += 1;
            last_route = route(&task);
        } else {
            rejected += 1;
        }
    }

    println!("accepted = {}", accepted);
    println!("rejected = {}", rejected);
    println!("last route = {}", last_route);
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
            By the end of this page, you should be able to break the capstone into milestones, explain its owned task and
            completion boundaries, spot the queue and replay mistakes that matter before local kernel tuning, and defend a
            rollout-ready architecture with concrete budgets and measurable acceptance criteria.
          </p>
        </section>
      </div>
    </div>
  )
}

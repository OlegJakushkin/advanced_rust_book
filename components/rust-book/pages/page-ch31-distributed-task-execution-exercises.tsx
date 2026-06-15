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
    title: "Classify delivery semantics and idempotency obligations",
    objective: "Practice choosing at-most-once, at-least-once, or effectively exactly-once side effects from business tolerance rather than slogan.",
    starterPrompt:
      "Classify four workloads: a thumbnail regeneration job, a billing capture, a cache warmup, and a periodic analytics refresh.",
    prompts: [
      "Which workload can tolerate occasional loss and therefore may accept at-most-once behavior?",
      "Which workload must tolerate replay and therefore needs idempotency even under at-least-once delivery?",
      "Which workload can be naturally repeat-safe because it overwrites one deterministic final state?",
      "Which workload would force you to define a durable dedupe or checkpoint boundary explicitly?",
    ],
    acceptanceCriteria: [
      "You separate delivery semantics from business side-effect semantics clearly.",
      "You identify at least one task that is naturally repeat-safe and one that needs explicit dedupe state.",
      "You avoid claiming exactly-once as a queue property by itself.",
    ],
    hints: [
      "Ask what happens if the same logical work runs twice.",
      "A strong answer talks about side effects, not only about transport labels.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read a lease timeline like an incident reviewer",
    objective: "Explain what happened when one worker timed out, another reclaimed the task, and the first worker later came back.",
    starterPrompt:
      "Worker A claims task-7, its lease expires, Worker B reclaims task-7, Worker A finally reports success, then Worker B also reports success.",
    prompts: [
      "Which event makes duplicate execution normal instead of surprising?",
      "Where should idempotent completion state live so only one success is accepted?",
      "What visibility-timeout or heartbeat change would reduce replay without delaying recovery too much?",
      "Which metric would tell you that the lease duration is badly matched to real handler time?",
    ],
    acceptanceCriteria: [
      "You explain the duplicate execution path from the lease-expiry timeline concretely.",
      "You place dedupe or completion recording at the durable side-effect boundary.",
      "You mention at least one tuning or observability signal such as lease-expiry rate or task age.",
    ],
    hints: [
      "A lease expiry is a recovery event, not a correctness bug by itself.",
      "The bug appears only if the completion path is not idempotent.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Build a lease-based worker with idempotent completion",
    objective: "Implement the core mechanics of redelivery after timeout and duplicate-safe completion recording.",
    starterPrompt:
      "Complete a tiny in-memory queue so timed-out work returns to visibility and a second completion attempt becomes a harmless duplicate.",
    prompts: [
      "Requeue the task only when the current time is past the deadline. The starter contains a reversed condition, so your first task is to find and flip it.",
      "Record completion in a set keyed by task ID.",
      "Return a boolean from completion so the caller can tell whether this was the first successful application or a duplicate.",
      "Keep the queue owner as one struct instead of scattering state globally.",
    ],
    acceptanceCriteria: [
      "The queue requeues timed-out work correctly.",
      "Completion recording is idempotent.",
      "The runnable lab prints the expected redelivery, completed count, and duplicate status.",
    ],
    hints: [
      "The two key repairs are one requeue condition and one set insert.",
      "Use the set insert result directly if you want the calmest duplicate signal.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Centralize distributed retries and poison-task policy",
    objective: "Repair a design that copied retry loops into several handlers and requeues permanent failure forever.",
    starterPrompt:
      "Three handlers each retry internally with slightly different attempt limits, and every permanent validation error is still requeued.",
    prompts: [
      "Which facts should one shared retry policy own: max attempts, retryable classes, backoff, terminal routing?",
      "Which failures should be dead-lettered immediately?",
      "Where should local in-process retry bookkeeping end and queue-level requeue policy begin?",
      "How would you make the policy testable without a live broker or queue service?",
    ],
    acceptanceCriteria: [
      "You centralize retry classification and visible attempt budgeting.",
      "You separate transient retryable failure from permanent terminal failure.",
      "You mention one test strategy such as table-driven classification or DLQ routing tests.",
    ],
    hints: [
      "If the same retry logic appears in three places, it already wants one home.",
      "Poison-task handling is a transport and policy question, not a random handler branch.",
    ],
  },
  {
    number: 5,
    kind: "design or analysis",
    title: "Trace a distributed task graph end to end",
    objective: "Make one task graph observable enough that queue wait, handler work, and fan-in are all attributable.",
    starterPrompt:
      "A DAG pipeline runs `fetch -> parse -> { enrich, store } -> notify`, but traces only show the inner handler spans and not the time spent waiting in queues.",
    prompts: [
      "Which IDs should every task envelope carry?",
      "Where should parent-child lineage be recorded for fan-out and fan-in nodes?",
      "Which span or event should represent queue wait before a worker actually starts the handler?",
      "What metric would tell you the graph is bottlenecked at aggregation rather than at worker execution?",
    ],
    acceptanceCriteria: [
      "You include a stable task or message ID plus trace lineage fields.",
      "You represent queue wait as a first-class trace or metric concept.",
      "You mention at least one graph-specific profiling signal such as frontier size, reducer lag, or critical-path time.",
    ],
    hints: [
      "If queue wait is invisible, the trace is incomplete.",
      "Graph tracing needs lineage, not only one flat request ID.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose queue topology, aggregation, tracing, and profiling for a production task service",
    objective: "Map the full distributed-task control plane for a real system with several failure and scaling modes.",
    starterPrompt:
      "You are designing `upload -> transcode variants -> scan -> persist metadata -> notify`, with bursty uploads, one long-running GPU step, and strict operator requirements around replay and incident forensics.",
    prompts: [
      "Which stages deserve their own queue or shard boundary?",
      "Where should leases be renewed instead of just lengthened?",
      "How will final aggregation decide when the whole graph is complete?",
      "Which tracing fields, queue metrics, and duplicate metrics would you require before rollout?",
      "Where would you isolate slow GPU retries so they do not stall the rest of the platform?",
      "Which two metrics would tell you whether a slow run is bottlenecked at the GPU transcode step or at the aggregation reducer?",
    ],
    acceptanceCriteria: [
      "You choose at least one queue or shard split deliberately.",
      "You define a lease or renewal policy for the long-running step.",
      "You describe one result-aggregation rule and one failure-isolation rule.",
      "You mention at least three observability hooks such as queue age, redelivery rate, reducer lag, trace lineage, or duplicate suppression hits.",
      "You name two metrics that distinguish a GPU-step bottleneck from an aggregation-reducer bottleneck, such as per-stage handler time versus reducer lag at the join.",
    ],
    hints: [
      "The cleanest answer gives every expensive stage a visible budget and a visible failure policy.",
      "A long-running specialist worker is often a stronger argument for leasing discipline than for a longer global timeout.",
    ],
  },
]

const reviewQuestions = [
  "Why is at-least-once delivery the calm default assumption for distributed task systems?",
  "What is the practical difference between a lease expiry and a processing bug?",
  "Why should retries and terminal failure paths be centralized instead of copied into each handler?",
  "What makes queue wait time a first-class profiling signal?",
  "Why does a large task graph need explicit lineage and aggregation policy rather than one flat success counter?",
]

const workingLoop = [
  "Name the durable side effect first, then place completion recording next to it.",
  "Assume replay is normal and design duplicate suppression on purpose.",
  "Bound retries and define the terminal path before the task goes live.",
  "Trace queue wait, handler execution, and aggregation as separate stages.",
  "Make one queue budget and one worker budget visible for each expensive stage.",
]

export function PageCh31DistributedTaskExecutionExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch31-distributed-task-execution-exercises")
  const mainPageIndex = getPageIndexById("ch31-distributed-task-execution")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 31 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice distributed task execution the way it behaves in production: lease-based ownership, at-least-once
          replay, bounded retry, explicit aggregation, and traceable task graphs.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a recovery-and-observability review. The strongest answer says where the durable
                effect lives, where the dedupe checkpoint lives, how replay is handled, and what metrics would prove the
                design healthy.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 31
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
                  Distributed task drill
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
          title="Runnable lab · Lease timeout plus idempotent completion"
          description={
            <>
              Repair the starter so timed-out work becomes visible again and duplicate completion is harmless. The checker
              expects the exact output below.
            </>
          }
          filename="lease_idempotent_lab.rs"
          runKey="ch31_ex_lease_idempotent"
          expectedOutput={"redelivered = task-1\ncompleted = 1\nduplicate = true"}
          helperText={
            <>
              Tip: make <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">requeue_if_timed_out</code>{" "}
              push the task back only after the deadline, and make{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">finish_once</code> return the result of
              inserting the task ID into the completed set.
            </>
          }
          initialCode={`use std::collections::{HashSet, VecDeque};\n\n#[derive(Debug, Clone)]\nstruct Task {\n    id: &'static str,\n}\n\nstruct Queue {\n    visible: VecDeque<Task>,\n    completed: HashSet<&'static str>,\n    now: u64,\n}\n\nimpl Queue {\n    fn claim(&mut self) -> Option<Task> {\n        self.visible.pop_front()\n    }\n\n    fn requeue_if_timed_out(&mut self, task: Task, deadline: u64) {\n        if self.now < deadline {\n            self.visible.push_back(task);\n        }\n    }\n\n    fn finish_once(&mut self, task: &Task) -> bool {\n        false\n    }\n}\n\nfn main() {\n    let mut queue = Queue {\n        visible: VecDeque::new(),\n        completed: HashSet::new(),\n        now: 0,\n    };\n\n    queue.visible.push_back(Task { id: "task-1" });\n\n    let first = queue.claim().unwrap();\n    queue.now = 6;\n    queue.requeue_if_timed_out(first.clone(), 5);\n\n    let redelivery = queue.claim().unwrap();\n    let _first_apply = queue.finish_once(&redelivery);\n    let duplicate_apply = queue.finish_once(&redelivery);\n\n    println!("redelivered = {}", redelivery.id);\n    println!("completed = {}", queue.completed.len());\n    println!("duplicate = {}", !duplicate_apply);\n}`}
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
            By the end of this page, you should be able to design a lease-based distributed worker, explain why
            at-least-once replay is normal, centralize retry and terminal-failure policy, and trace one task graph through
            queue wait, worker execution, and final aggregation without hand-waving.
          </p>
        </section>
      </div>
    </div>
  )
}

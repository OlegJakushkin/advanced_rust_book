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
    title: "Narrate the invalidation event before proposing a fix",
    objective: "Practice explaining why a reference into a vector stops being the right handle once the vector may grow.",
    starterPrompt:
      "A function borrows `let first = &workers[0];`, then later appends more workers with `push`, and finally reads `first.name`. Explain the failure in operational terms.",
    prompts: [
      "What does the vector own?",
      "What does the borrowed reference point into?",
      "Why is the problem not merely 'the borrow checker being strict'?",
    ],
    acceptanceCriteria: [
      "You explain that the reference points into the vector's current buffer.",
      "You state that growth may relocate the buffer and therefore invalidate the old address story.",
      "You propose at least one valid repair such as using an index, ending the borrow sooner, or changing representation.",
    ],
    hints: [
      "Start with the owner: the vector owns the buffer.",
      "Then ask what `push` is allowed to do to that buffer.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find the hidden shape change",
    objective: "Read a small loop and identify which operation changes vector shape or element positions.",
    starterPrompt:
      "Review a loop that stores `&sessions[i]` in a temporary, then calls either `reserve`, `insert`, `remove`, or `sort_by_key` later in the same flow. Identify which operations threaten reference validity and why.",
    prompts: [
      "Which operations may relocate storage?",
      "Which operations may keep the same buffer but still shift positions?",
      "Which handle type would stay meaningful after each operation?",
    ],
    acceptanceCriteria: [
      "You distinguish relocation hazards from position-shift hazards.",
      "You explain that both categories are dangerous for borrowed element references held too long.",
      "You choose a more durable handle such as an index or ID where appropriate.",
    ],
    hints: [
      "Address stability and logical identity are related, but they are not the same thing.",
      "Sorting may preserve allocation yet still break position-based assumptions.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Return an index handle instead of assuming reference stability",
    objective:
      "Refactor a helper so callers keep a durable index rather than an element reference or a mistaken post-push length.",
    starterPrompt:
      "Implement `enqueue(tasks: &mut Vec<Task>, name: &str) -> usize` so the returned handle identifies the newly pushed task correctly even if the vector later grows.",
    prompts: [
      "Keep the return type as `usize`.",
      "Do not return a borrowed reference.",
      "Make the handle point at the inserted task, not at the next free slot.",
    ],
    acceptanceCriteria: [
      "The function returns the inserted task's index.",
      "The sample output shows the first inserted task after additional pushes.",
      "The design remains valid even if the vector grows later.",
    ],
    hints: [
      "The correct index exists either just before the push or as `len() - 1` immediately after it.",
      "A durable handle should survive future vector growth as long as reordering policy is understood.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Convert a reference-heavy graph edge into IDs",
    objective:
      "Replace stored references into a vector-backed node list with an ID or index design Rust can move and maintain safely.",
    starterPrompt:
      "You inherit a parser graph that stores nodes in a `Vec<Node>` and also stores `&Node` edges inside other nodes. Refactor the relationship into indices or typed IDs.",
    prompts: [
      "Where do you store the nodes?",
      "What do edges store instead of references?",
      "How does lookup recover a borrowed view when needed?",
    ],
    acceptanceCriteria: [
      "Your redesign removes long-lived references into the vector.",
      "Edges store indices, IDs, or another stable logical handle.",
      "You explain how the owner vector reborrows the node by handle at use time.",
    ],
    hints: [
      "The owner of the collection should usually also be the place where reborrowing happens.",
      "Typed IDs are often easier to review than naked `usize` values in larger systems.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Implement safe mutation while iterating",
    objective: "Repair a loop that inspects a vector and also changes its shape in the same pass.",
    starterPrompt:
      "A retry scheduler scans jobs, appends follow-up work for failed jobs, and removes expired jobs in one loop. Rewrite the flow safely.",
    prompts: [
      "Which edits can happen in place with `iter_mut`?",
      "Which edits should move into a second pass?",
      "Would `retain`, `drain`, or rebuilding be clearer than manual index juggling?",
    ],
    acceptanceCriteria: [
      "You separate inspection from shape-changing edits, or choose a standard library pattern that does so safely.",
      "You explain why one pass with live element borrows plus shape changes is the real problem.",
      "Your final design does not depend on cloning the whole vector just to escape the issue.",
    ],
    hints: [
      "Collect indices, IDs, or commands first.",
      "Then apply the structural edits once no element borrow remains active.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose Vec<T>, Vec<Box<T>>, or arena-style storage for a registry",
    objective:
      "Select the right collection representation for a production registry with concrete stability and performance requirements.",
    starterPrompt:
      "You are designing a long-lived connection registry for `accept -> authenticate -> route -> retry -> drop`. Some components need fast scans, some need durable handles, and a plugin boundary may require stable addresses.",
    prompts: [
      "Which parts of the system only need contiguous scanning?",
      "Which parts need stable logical handles rather than direct references?",
      "Does any subsystem truly need stable element addresses?",
      "What cost are you willing to pay in allocation or indirection?",
    ],
    acceptanceCriteria: [
      "You justify one representation as the default and explain where another becomes necessary.",
      "You distinguish stable logical handles from stable memory addresses.",
      "You name at least one tradeoff involving cache locality, allocation count, or API complexity.",
      "You avoid choosing a heavier representation without an actual requirement for it.",
    ],
    hints: [
      "Start with the simplest owner that meets the semantics.",
      "Plain vectors are often right until stable addressability or deletion semantics make them insufficient.",
    ],
  },
]

const reviewQuestions = [
  "What exactly does a borrowed element reference from a vector point into?",
  "Why are index handles often the default durable handle for `Vec<T>`?",
  "What is the difference between stable logical identity and stable memory address?",
  "When is `Vec<Box<T>>` a better fit than plain `Vec<T>`?",
  "Why do two-phase loops often produce the clearest vector mutation code?",
]

const workingLoop = [
  "Ask whether the vector's shape may change while the handle is alive.",
  "If yes, decide whether the handle should become an index, ID, or stable-address allocation.",
  "If the algorithm both inspects and reshapes, split the work into phases.",
  "State the tradeoff you accepted: contiguous layout, extra allocation, stable handles, or simpler mutation flow.",
]

export function PageCh06OwnershipInsideVectorsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch06-ownership-inside-vectors-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 06 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice the collection-level ownership choices that keep vector code calm under growth, reordering, and
          production mutation patterns.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a handle-design review. Do not start with syntax. Start with the question
                &quot;what survives the next vector mutation?&quot; Then decide whether the right answer is a short borrow, an
                index, a typed ID, or a different representation entirely.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(10)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 06
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
                  Collection design drill
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
          title="Runnable lab · Exercise 3"
          description={
            <>
              Repair <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">enqueue</code> so it returns the
              inserted task&apos;s index, not the next free slot. The checker expects the first task to remain addressable by
              handle even after later pushes.
            </>
          }
          filename="task_handle_lab.rs"
          runKey="ch06_ex_task_index"
          expectedOutput={"first = billing\ntotal = 3"}
          helperText={
            <>
              Tip: the correct answer is either the length <em>before</em> the push or{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">len() - 1</code> immediately after it.
              The point is not arithmetic. The point is returning a durable index handle.
            </>
          }
          initialCode={`#[derive(Debug)]\nstruct Task {\n    name: String,\n}\n\nfn enqueue(tasks: &mut Vec<Task>, name: &str) -> usize {\n    tasks.push(Task {\n        name: name.to_string(),\n    });\n    tasks.len()\n}\n\nfn main() {\n    let mut tasks = Vec::with_capacity(1);\n    let first = enqueue(&mut tasks, "billing");\n    enqueue(&mut tasks, "search");\n    enqueue(&mut tasks, "indexer");\n\n    println!("first = {}", tasks[first].name);\n    println!("total = {}", tasks.len());\n}`}
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
            By the end of this page, you should be able to explain vector reference failures as concrete storage and
            handle problems, switch naturally between references and indices based on mutation shape, and choose
            stable-address patterns only when the underlying semantics truly require them.
          </p>
        </section>
      </div>
    </div>
  )
}

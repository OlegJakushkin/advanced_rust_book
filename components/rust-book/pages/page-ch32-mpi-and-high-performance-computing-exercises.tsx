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
    title: "Choose process partitioning and collective shape from the algorithm",
    objective: "Practice deciding how a dense matrix workload should be split across ranks before any low-level optimization begins.",
    starterPrompt:
      "You must run a row-wise dense matrix pass on 10,000 rows across 6 ranks, then compute one global convergence scalar every iteration.",
    prompts: [
      "Would you partition by rows, by columns, or by tiles first, and why?",
      "Which collective is the honest fit for the final convergence scalar: reduce or allreduce?",
      "What would change if every rank needs the scalar for the next iteration instead of only rank 0?",
    ],
    acceptanceCriteria: [
      "You choose a plausible first partitioning strategy and justify it from access pattern.",
      "You distinguish reduce from allreduce by who needs the final answer.",
      "You keep the explanation in terms of layout and synchronization, not only in terms of API names.",
    ],
    hints: [
      "Start from how the data is walked in memory.",
      "Then ask who really needs the aggregate result afterward.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find the `Vec<Vec<T>>` mistake before the collective boundary",
    objective: "Read a dense MPI preparation path and explain why nested allocation is the wrong default before scatter or gather.",
    starterPrompt:
      "A teammate stores a dense matrix as `Vec<Vec<f64>>`, then tries to scatter row blocks to ranks and gather results back into the same shape.",
    prompts: [
      "What extra allocations and pointer indirections does the nested shape create?",
      "Why does one flat `Vec<f64>` plus explicit row counts simplify the collective boundary?",
      "When would the nested shape still be honest because the data is truly ragged?",
    ],
    acceptanceCriteria: [
      "You explain the dense-layout cost of `Vec<Vec<T>>` precisely.",
      "You recommend one flat buffer for the dense case with a reason tied to collectives.",
      "You name one case where nested ownership is still the right shape.",
    ],
    hints: [
      "The question is dense versus ragged, not elegant syntax versus ugly syntax.",
      "Collectives are easiest when the payload is already contiguous.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement a balanced block partition for matrix rows",
    objective: "Build the row-partition helper every MPI rank needs so remainder rows are distributed predictably.",
    starterPrompt:
      "Implement `block_range(rows, ranks, rank)` so rows are split as evenly as possible and early ranks absorb the remainder.",
    prompts: [
      "Return a start row and an end row.",
      "Keep the end exclusive.",
      "Use the same helper for all ranks instead of special-casing rank 0 and hoping the rest line up.",
      "Verify the local cell count for rank 2 when `rows = 11`, `ranks = 4`, and `cols = 5`.",
    ],
    acceptanceCriteria: [
      "The helper distributes the remainder rows to the lowest ranks.",
      "Every range is half-open and non-overlapping.",
      "The runnable lab prints the expected ranges and rank-2 cell count.",
    ],
    hints: [
      "This is the same balanced block distribution many real MPI codes use.",
      "One good formula is cheaper than many ad hoc branches.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Choose flat counts and displacements for a collective",
    objective: "Replace row-thinking confusion with the exact units the collective boundary expects.",
    starterPrompt:
      "You inherit a scatter path that computes row counts correctly but passes row displacements to a collective that expects element displacements.",
    prompts: [
      "Where should the conversion from rows to cells happen?",
      "How do you compute cumulative displacements for a row-major buffer?",
      "What test would catch the bug before it hits a full cluster run?",
    ],
    acceptanceCriteria: [
      "You convert counts or offsets into the same units the collective API expects.",
      "You explain the cumulative-displacement rule clearly.",
      "You mention at least one focused correctness test such as a tiny uneven matrix with known slices.",
    ],
    hints: [
      "Rows are an algorithm concept. Collectives often operate in typed elements or bytes.",
      "Tiny uneven shapes are usually the best bug traps here.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Profile communication-heavy HPC work conceptually before rewriting it",
    objective: "Practice building a measurement plan for an MPI program whose slowdown may come from imbalance or collectives rather than from arithmetic.",
    starterPrompt:
      "A solver slowed down after a mesh change. Every rank still finishes the same kernel code path, but total runtime rose sharply.",
    prompts: [
      "Which timers would you place around local compute, halo exchange, and collective convergence steps?",
      "Which signals would distinguish load imbalance from too-frequent communication?",
      "What would you log or trace per rank so rank 0 does not hide the slowest participant?",
    ],
    acceptanceCriteria: [
      "You separate compute, communication, and wait time explicitly.",
      "You mention at least one rank-local signal and one cross-rank signal.",
      "You avoid jumping straight to kernel micro-optimization before the communication story is clear.",
    ],
    hints: [
      "A slower mesh often changes partition shape before it changes arithmetic intensity.",
      "The important question is who is waiting for whom, and where.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose hybrid MPI plus threads and cluster deployment policy deliberately",
    objective: "Map ranks, local threads, queue budgets, and profiling hooks to one realistic cluster workload.",
    starterPrompt:
      "You are designing `load block -> local compute -> allreduce convergence -> write checkpoint`, with CPU-heavy kernels, one read-mostly lookup table per rank, and a cluster policy that limits cores per node tightly.",
    prompts: [
      "Would you run more ranks per node, more threads per rank, or a balanced mix?",
      "Which local work stays inside a Rayon or thread pool within the rank?",
      "Where would you keep shared immutable data with `Arc<T>` only inside the rank, and where would MPI remain the inter-rank boundary?",
      "What metrics would you require for node-level oversubscription, imbalance, and collective cost before rollout?",
    ],
    acceptanceCriteria: [
      "You choose a plausible hybrid or non-hybrid deployment shape with a reason tied to topology and kernel behavior.",
      "You distinguish intra-rank shared immutable state from inter-rank communication clearly.",
      "You mention at least three observability hooks such as CPU oversubscription, collective wait time, queue depth, or per-rank throughput.",
    ],
    hints: [
      "A hybrid design is only good if the total core budget per node stays honest.",
      "Rust thread rules still matter inside each rank even when MPI solves the cross-process side.",
    ],
  },
]

const reviewQuestions = [
  "Why is MPI primarily a process model rather than a shared-memory model?",
  "Why do flat contiguous buffers simplify collective operations so much?",
  "What is the practical difference between reduce and allreduce in an iterative solver?",
  "Why is a balanced partition helper worth testing as a first-class component?",
  "What signals tell you an MPI program is communication-bound instead of compute-bound?",
  "Why can hybrid MPI plus threads become slower if you ignore total core budgeting on the node?",
]

const workingLoop = [
  "State the layout first: dense row-major, dense column-major, ragged, or sparse.",
  "State the partition second: rows, columns, or tiles, plus remainder policy.",
  "State the collective third: who participates and who needs the result afterward.",
  "Profile compute, communication, and idle wait separately before tuning the kernel.",
]

export function PageCh32MpiAndHighPerformanceComputingExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch32-mpi-and-high-performance-computing-exercises")
  const mainPageIndex = getPageIndexById("ch32-mpi-and-high-performance-computing")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 32 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice MPI design from workload shape: balanced row partitioning, flat collective buffers, hybrid
          rank-plus-thread boundaries, and profiling plans that expose where the cluster is really waiting.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a communication and layout review. The best answer does not stop at “use MPI.” It
                says how rows are partitioned, what the collective units are, where ownership changes, and which metrics
                would prove the job is healthy.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 32
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
                  MPI and HPC drill
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
          title="Runnable lab · Balanced block partition for matrix rows"
          description={
            <>
              Repair the partition helper so remainder rows are distributed to the earliest ranks. The browser runner is
              single-process, but this is the same partition math you would call from each real MPI rank.
            </>
          }
          filename="mpi_block_partition_lab.rs"
          runKey="ch32_ex_block_partition"
          expectedOutput={
            "rank 0 = 0..3\nrank 1 = 3..6\nrank 2 = 6..9\nrank 3 = 9..11\ncells rank2 = 15"
          }
          helperText={
            <>
              Tip: keep the range half-open, use the same helper for every rank, and let the first{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">rows % ranks</code> ranks absorb one
              extra row each.
            </>
          }
          initialCode={`#[derive(Debug, Clone, Copy)]
struct Partition {
    start_row: usize,
    end_row: usize,
}

fn block_range(rows: usize, ranks: usize, rank: usize) -> Partition {
    let rows_per_rank = rows / ranks;
    let start = rank * rows_per_rank;
    let end = start + rows_per_rank;

    Partition {
        start_row: start,
        end_row: end,
    }
}

fn main() {
    let rows = 11_usize;
    let ranks = 4_usize;
    let cols = 5_usize;

    for rank in 0..ranks {
        let part = block_range(rows, ranks, rank);
        println!("rank {} = {}..{}", rank, part.start_row, part.end_row);
    }

    let part = block_range(rows, ranks, 2);
    println!("cells rank2 = {}", (part.end_row - part.start_row) * cols);
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
            By the end of this page, you should be able to partition dense work across ranks predictably, reason clearly
            about collective units and buffer layout, choose where hybrid threading helps inside each rank, and build a
            measurement plan that exposes communication cost and imbalance before you touch the kernel math.
          </p>
        </section>
      </div>
    </div>
  )
}

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
    title: "Choose CPU, Rayon, MPI, or CUDA from the workload",
    objective: "Practice selecting the execution model that matches the dominant cost instead of treating acceleration tools as interchangeable.",
    starterPrompt:
      "Classify four workloads: a tiny request-local transform over one 4 KB buffer, a one-node dense batch score over host memory, a multi-node domain-decomposed solver, and a dense batched tensor operation with high arithmetic intensity.",
    prompts: [
      "Which workload should stay on CPU because transfer and launch would dominate?",
      "Which workload wants Rayon because the data already lives on one node?",
      "Which workload wants MPI because the dominant partition is already process-level?",
      "Which workload wants CUDA because dense math can amortize the host-device boundary?",
    ],
    acceptanceCriteria: [
      "You choose at least one workload for CPU, one for Rayon, one for MPI, and one for CUDA.",
      "You justify the GPU case with transfer or launch amortization, not only with the word 'parallel'.",
      "You keep CPU-bound and waiting-bound questions separate.",
    ],
    hints: [
      "Start with arithmetic intensity and batch size.",
      "Then ask whether the real boundary is host memory, one node, or many nodes.",
    ],
  },
  {
    number: 2,
    kind: "estimation",
    title: "Estimate transfer cost before discussing the kernel",
    objective: "Translate one matrix job into bytes on the bus before you start tuning arithmetic.",
    starterPrompt:
      "A service offloads one `f32` matrix multiply with A, B, and C each sized 4096 by 4096, transferring A and B to the device and C back once.",
    prompts: [
      "How many bytes does one 4096 by 4096 `f32` matrix occupy?",
      "What is the total HtoD plus DtoH traffic for the whole call?",
      "Why is this boundary less painful for GEMM than for tiny vector add?",
    ],
    acceptanceCriteria: [
      "You compute or approximate the total traffic at about 201,326,592 bytes, or about 192 MiB.",
      "You explain why dense high-intensity math amortizes the boundary better than tiny low-intensity work.",
      "You still name launch or synchronization overhead as a separate cost category.",
    ],
    hints: [
      "A matrix has `rows * cols` elements and each `f32` is 4 bytes.",
      "The point is not exact decimal formatting. The point is whether the workload can pay for the transfer.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Sketch a safe Rust wrapper around a launch boundary",
    objective: "Build the host-side wrapper that validates shape and launch config before one small unsafe region.",
    starterPrompt:
      "Implement a small `build_config` and `validate_buffers` pair, then call one `unsafe fn raw_launch(...)` only after those checks succeed.",
    prompts: [
      "Reject mismatched buffer lengths.",
      "Reject zero-length launches and zero threads per block.",
      "Return a Rust `Result` from the checked boundary.",
      "Keep the unsafe region smaller than the validation logic around it.",
    ],
    acceptanceCriteria: [
      "The wrapper checks buffer shape before the unsafe call.",
      "The wrapper computes block count from length and threads per block.",
      "The wrapper returns a Rust `Result` rather than a vague boolean.",
      "The runnable lab prints the expected blocks, threads, and success flag.",
    ],
    hints: [
      "This is the same wrapper discipline used around FFI and unsafe elsewhere in the book.",
      "The GPU boundary is not special here. The invariants still belong in the safe wrapper.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a tiny-kernel service path that lost to the CPU",
    objective: "Refactor a design that launches too often, copies too much, and synchronizes too eagerly.",
    starterPrompt:
      "A service copies one small vector to the device, launches one kernel, waits immediately, copies the result back, and repeats that whole cycle per request item.",
    prompts: [
      "Which fix should come first: batch work, fuse kernels, reuse device buffers, or keep the path on CPU?",
      "What signal would tell you the path is launch-bound rather than kernel-bound?",
      "When is the best repair to not use the GPU at all for this route?",
    ],
    acceptanceCriteria: [
      "You identify at least one batching or fusion repair and one CPU fallback condition.",
      "You explain the path in terms of transfer, launch, and synchronization overhead rather than only 'GPU is faster'.",
      "You mention at least one profiling signal such as launch count, queue wait, or transfer time.",
    ],
    hints: [
      "The simplest win is often fewer launches.",
      "The second simplest win is not offloading work that is too small to amortize the trip.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Profile a CUDA workload before rewriting the kernel",
    objective: "Separate transfer-bound, launch-bound, sync-bound, and kernel-bound cases clearly.",
    starterPrompt:
      "A profiling report says kernel time is 2 ms, host-device copies are 11 ms, queue wait is 6 ms, and total wall time is 24 ms for one batch scorer.",
    prompts: [
      "Which category dominates the first diagnosis?",
      "Which rewrite is probably premature because the report points elsewhere?",
      "What next measurement would you take inside the dominant category?",
    ],
    acceptanceCriteria: [
      "You identify transfer or admission cost, not kernel math, as the dominant issue.",
      "You reject at least one likely but wrong optimization target such as low-level kernel tuning first.",
      "You propose one next measurement and one validation metric after the fix.",
    ],
    hints: [
      "If copies and queue wait dominate, shaving kernel arithmetic is not the first win.",
      "Wall time should drive the next question first.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Integrate a GPU worker into an async and distributed service",
    objective: "Make queue budget, retry policy, and device ownership explicit when the GPU becomes a shared specialist subsystem.",
    starterPrompt:
      "You are designing `ingest -> parse -> score on GPU -> persist -> notify`, with bursty traffic, one device per host, and a requirement that duplicate replay stay harmless after crash recovery.",
    prompts: [
      "Where should the bounded GPU queue sit, and what does it own?",
      "When should the async side hand over owned data to the GPU worker?",
      "How will you separate transient GPU retry from terminal failure or CPU fallback?",
      "What metrics would you require before rollout?",
    ],
    acceptanceCriteria: [
      "You define one explicit bounded GPU admission point.",
      "You move owned payloads across the async-to-GPU boundary rather than borrowed request-local views.",
      "You describe one idempotency or duplicate-safe completion rule for replay after crash or lease expiry.",
      "You mention at least three observability hooks such as queue age, transfer bytes, launch count, or fallback rate.",
    ],
    hints: [
      "Treat the GPU like a scarce worker pool, not like a free helper thread.",
      "The cleanest design makes queueing, retries, and replay policy visible before the first incident.",
    ],
  },
]

const reviewQuestions = [
  "What kinds of workloads actually amortize host-device transfer and launch cost well?",
  "Why is a safe Rust wrapper around a kernel launch mostly an ownership and invariant story?",
  "What is the practical difference between host memory ownership and device memory ownership?",
  "Why are queue wait and launch count often more useful than one isolated kernel timing?",
  "When is CUDA the wrong choice even when a kernel itself is efficient?",
  "Why should device memory be modeled as an explicit owner handle rather than a borrowed pointer into host memory?",
]

const workingLoop = [
  "Count bytes, launches, and sync points before tuning arithmetic.",
  "Keep host-side ownership explicit and device-side ownership modeled as a separate handle.",
  "Shrink the unsafe launch region until the invariants are obvious to a reviewer.",
  "Treat the GPU as a bounded specialist worker inside async or distributed systems.",
]

export function PageCh37CudaAndGpuAccelerationExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch37-cuda-and-gpu-acceleration-exercises")
  const mainPageIndex = getPageIndexById("ch37-cuda-and-gpu-acceleration")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 37 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice CUDA design the way it survives production review: explicit transfer budgeting, checked launch wrappers,
          and GPU admission policy that still makes sense inside a larger Rust system.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a throughput-and-boundary review. The best answer does not say only “GPU = fast.”
                It says how many bytes cross the boundary, what the launch invariants are, and which queue or retry budget
                keeps the device usable under real load.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 37
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
                  CUDA design drill
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
          title="Runnable lab · Safe launch wrapper"
          description={
            <>
              Repair the starter so the wrapper validates equal lengths, rejects zero-sized launches, computes block count
              from length and threads per block, and only then reports a successful launch.
            </>
          }
          filename="safe_launch_wrapper_lab.rs"
          runKey="ch37_ex_safe_kernel_wrapper"
          expectedOutput={"blocks = 8\nthreads = 128\nlaunch ok = true"}
          helperText={
            <>
              Tip: the block formula should be a ceiling division, not a plain truncating division. Keep the shape check in
              the safe wrapper and let the raw launch stay small.
            </>
          }
          initialCode={`#[derive(Debug, Clone, Copy)]
struct LaunchConfig {
    threads_per_block: u32,
    blocks: u32,
}

fn validate_buffers(a_len: usize, b_len: usize, out_len: usize) -> Result<(), &'static str> {
    // TODO: reject zero-length buffers and mismatched lengths before any launch.
    Err("not implemented")
}

fn build_config(a_len: usize, threads_per_block: u32) -> LaunchConfig {
    // TODO: derive the block count from a_len with ceiling division.
    LaunchConfig {
        threads_per_block,
        blocks: 0,
    }
}

unsafe fn raw_launch(_config: LaunchConfig, _len: usize) {
    // SAFETY: callers reach this only after validate_buffers confirmed equal,
    // nonzero lengths and build_config produced a nonzero launch config.
}

fn main() {
    let len = 1_024_usize;
    let threads_per_block = 128_u32;

    let config = build_config(len, threads_per_block);
    let launch_ok = match validate_buffers(len, len, len) {
        Ok(()) => {
            unsafe { raw_launch(config, len); }
            true
        }
        Err(_) => false,
    };

    println!("blocks = {}", config.blocks);
    println!("threads = {}", config.threads_per_block);
    println!("launch ok = {}", launch_ok);
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
            By the end of this page, you should be able to choose CPU, Rayon, MPI, or CUDA from workload shape, estimate
            host-device boundary cost before offload, wrap a kernel launch behind a checked Rust API, and reason about GPU
            admission and replay policy in the same operational language you use for the rest of the system.
          </p>
        </section>
      </div>
    </div>
  )
}

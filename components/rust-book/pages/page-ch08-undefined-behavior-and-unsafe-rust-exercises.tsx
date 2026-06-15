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
    title: "Name the invariant before the pointer",
    objective: "Translate one unsafe operation into explicit preconditions instead of vague confidence.",
    starterPrompt:
      "A helper builds `slice::from_raw_parts(ptr, len)` from a raw pointer returned by a packet parser. State the invariants that must hold before that slice is valid.",
    prompts: [
      "What must be true about nullability, alignment, and bounds?",
      "What lifetime story makes the returned slice valid?",
      "What aliasing story must still hold if the slice is shared or mutable?",
    ],
    acceptanceCriteria: [
      "You name pointer validity conditions such as non-null when required, alignment, and readable memory for `len` elements.",
      "You explain that the produced slice cannot outlive the real owner of the backing allocation.",
      "You mention aliasing requirements that would apply if references are created from the raw pointer.",
    ],
    hints: [
      "Start with: what memory is this pointer allowed to refer to right now?",
      "Then ask: for how long is that still true?",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Find the UB risks in a raw-pointer copy helper",
    objective: "Practice spotting the real missing proof obligations in a pointer-based routine.",
    starterPrompt:
      "Review a function that takes `dst: *mut u8`, `src: *const u8`, and `len: usize`, loops with pointer arithmetic, and is exposed as a safe public function that performs no validation of its raw-pointer arguments before use.",
    prompts: [
      "Which caller obligations are currently undocumented?",
      "Should the function stay safe, become `unsafe fn`, or be redesigned around slices?",
      "Where could null, lifetime, writability, or bounds assumptions fail?",
    ],
    acceptanceCriteria: [
      "You identify multiple missing obligations rather than saying only 'raw pointers are dangerous.'",
      "You explain why a safe public API is wrong if the callee cannot actually enforce those obligations.",
      "You propose either an `unsafe fn` contract or a safe redesign using slices or owned buffers.",
    ],
    hints: [
      "Ask whether the callee can validate the entire contract or only part of it.",
      "If the caller must uphold the truth, the API shape should say so.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Wrap unsafe internals in a safe public API",
    objective: "Implement a checked wrapper that writes a fixed four-byte marker only when the buffer is large enough.",
    starterPrompt:
      "Implement `write_magic(buf: &mut [u8]) -> Result<(), &'static str>` so buffers shorter than four bytes return `Err(\"buffer too small\")`, and valid buffers become `RST!` through a small unsafe raw-pointer write block.",
    prompts: [
      "Keep the public signature safe.",
      "Check the length before any unsafe write happens.",
      "Write the bytes `82, 83, 84, 33` into positions `0..4`.",
    ],
    acceptanceCriteria: [
      "Short buffers return `Err(\"buffer too small\")` exactly.",
      "Long enough buffers return `Ok(())` and contain the marker `RST!`.",
      "The unsafe region stays small and depends on an explicit length check.",
      "Your unsafe block is preceded by a `// SAFETY:` comment that names the precondition the length check established.",
    ],
    hints: [
      "The unsafe block should begin only after the precondition is already true.",
      "This is the classic shape of a safe abstraction over unsafe internals.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Move `assume_init` to the only valid place",
    objective: "Repair a `MaybeUninit` design that treats uninitialized storage as a finished value too early.",
    starterPrompt:
      "You inherit code that creates `MaybeUninit<[u32; 4]>`, calls `assume_init()` immediately after declaring the storage (or casts the result to a mutable pointer to write through it), leaving some elements uninitialized. Refactor the flow so initialization becomes explicit and ordered correctly. Note: this exercise uses `[u32; 4]` rather than the `[u8; 4]` from the chapter example; the discipline is identical, only the element type and stride change.",
    prompts: [
      "Where should writes occur relative to `assume_init`?",
      "What must be true before the final array exists as a real `[u32; 4]`?",
      "How would you explain the bug to a reviewer in one sentence?",
    ],
    acceptanceCriteria: [
      "You keep the value inside `MaybeUninit` storage until all elements are written.",
      "You call `assume_init` only after full initialization is complete.",
      "You explain that reading the value early would treat uninitialized memory as a valid typed value.",
    ],
    hints: [
      "The repair is usually about order, not about adding more unsafe.",
      "A valid `T` exists only when every invariant of `T` is already true.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Decide whether the function should be safe or unsafe",
    objective: "Separate APIs whose callers must uphold invariants from APIs whose callees can enforce them internally.",
    starterPrompt:
      "Audit `fn view<'a>(ptr: *const u8, len: usize) -> &'a [u8]`. Decide whether it should remain safe, become `unsafe fn`, or be replaced by a different signature altogether.",
    prompts: [
      "Can the function verify the pointer is valid for an arbitrary `'a`?",
      "Is the returned lifetime actually tied to a real owner?",
      "Would a signature based on `&[u8]` or an owned buffer express the truth more honestly?",
    ],
    acceptanceCriteria: [
      "You explain why the callee cannot manufacture an arbitrary valid lifetime from a raw pointer.",
      "You propose a more honest API shape, not only a slogan about safety.",
      "You distinguish caller-held obligations from callee-enforced checks clearly.",
    ],
    hints: [
      "If the type claims more than the implementation can prove, the API is lying.",
      "Raw pointers plus arbitrary returned references are where lifetime fiction becomes dangerous quickly.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Wrap an FFI boundary without exporting C mistakes",
    objective: "Design a Rust-facing wrapper around a C API while keeping the rest of the system in ordinary safe Rust.",
    starterPrompt:
      "A C library returns `*const c_char` error messages and `*mut Record` results. Design the Rust wrapper layer for a service that parses input, calls the library, retries failures, and eventually frees native resources.",
    prompts: [
      "Where does unsafe live: in every caller, or in one adapter layer?",
      "How do you translate nullability, ownership transfer, and string validity into Rust types?",
      "What is the plan for cleanup and for preventing unwinding assumptions from staying fuzzy at the boundary?",
    ],
    acceptanceCriteria: [
      "You isolate unsafe code in one adapter or wrapper layer.",
      "You translate raw pointer contracts into Rust concepts such as `Option`, `Result`, owned types, or borrowed views with clear lifetimes.",
      "You describe who owns native resources and who releases them.",
      "You mention at least one failure mode involving invalid strings, null pointers, or mismatched cleanup.",
    ],
    hints: [
      "Good wrapper layers convert C contracts into Rust truths early.",
      "If the rest of the codebase still manipulates raw pointers directly, the boundary is probably too wide.",
    ],
  },
]

const reviewQuestions = [
  "What does an `unsafe` block let you do, and what does it not excuse?",
  "Why is a data race undefined behavior in Rust rather than merely an unlucky concurrency bug?",
  "What is the difference between a raw pointer and a reference in terms of promises made to the optimizer?",
  "Why is `MaybeUninit<T>` the right model for not-yet-valid storage?",
  "When should an API be `unsafe fn` instead of a safe function with internal unsafe code?",
]

const workingLoop = [
  "Write the invariant first: bounds, alignment, initialization, aliasing, lifetime, and thread assumptions.",
  "Decide whether the caller or the callee owns the obligation.",
  "Shrink the unsafe region until the review surface is small enough to reason about line by line.",
  "Make the public API tell the truth about who must uphold what.",
]

export function PageCh08UndefinedBehaviorAndUnsafeRustExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch08-undefined-behavior-and-unsafe-rust-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 08 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice the habits that make unsafe code survivable in production: name the invariant, choose the right API
          boundary, and keep the proof smaller than the bug it prevents.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a safety review, not a syntax quiz. A strong answer states the invariant, names
                who enforces it, and chooses an API shape that makes the truth visible to callers.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(getPageIndexById("ch08-undefined-behavior-and-unsafe-rust"))}
              className="gap-2 shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 08
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Suggested unsafe-code review loop</h3>
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
                  Safety drill
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
              Implement{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">write_magic</code> as a safe public API
              over a small unsafe raw-pointer write block. The checker expects short buffers to fail explicitly and valid
              buffers to become <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">RST!</code>.
            </>
          }
          filename="write_magic_lab.rs"
          runKey="ch08_ex_write_magic"
          expectedOutput={'short = Err("buffer too small")\nvalue = Ok(())\nbuf = RST!'}
          helperText={
            <>
              Note: the starter code is deliberately unsound. It performs an unconditional four-byte write, so calling
              it on a three-byte buffer writes one byte past the allocation, which is undefined behavior in real Rust.
              Your task is to add the length guard before the unsafe block runs. The unsafe block should depend on a
              precondition that is already true when the first pointer write runs.
            </>
          }
          initialCode={`fn write_magic(buf: &mut [u8]) -> Result<(), &'static str> {\n    let ptr = buf.as_mut_ptr();\n\n    unsafe {\n        ptr.add(0).write(82);\n        ptr.add(1).write(83);\n        ptr.add(2).write(84);\n        ptr.add(3).write(33);\n    }\n\n    Ok(())\n}\n\nfn main() {\n    let mut short = vec![0u8; 3];\n    let mut ok = vec![0u8; 4];\n\n    println!(\"short = {:?}\", write_magic(&mut short));\n    println!(\"value = {:?}\", write_magic(&mut ok));\n    println!(\"buf = {}\", std::str::from_utf8(&ok).unwrap());\n}`}
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
            By the end of this page, you should be able to read a small unsafe block as a set of concrete proof
            obligations, decide honestly whether those obligations belong to caller or callee, and wrap raw-pointer or
            FFI internals in a Rust-facing API that does not export hidden UB risk to the rest of the system.
          </p>
        </section>
      </div>
    </div>
  )
}

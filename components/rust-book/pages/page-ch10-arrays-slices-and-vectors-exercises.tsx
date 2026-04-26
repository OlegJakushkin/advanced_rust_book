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
    title: "Choose array, slice, vector, or inline-first storage from the workload",
    objective: "Practice selecting the right contiguous-storage tool from semantics rather than habit.",
    starterPrompt:
      "Choose a representation for each case: a 16-byte protocol header, a read-only checksum helper, a dynamically accumulated retry batch, and a tiny hot list of usually three tags.",
    prompts: [
      "Which case has compile-time fixed length as part of the invariant?",
      "Which case only needs a borrowed view?",
      "Which case truly needs owned growth?",
      "Which case might justify an inline-first representation only after profiling?",
    ],
    acceptanceCriteria: [
      "You choose `[T; N]` for the semantically fixed-size case.",
      "You choose `&[T]` or `&mut [T]` for the borrowed-algorithm case.",
      "You choose `Vec<T>` for the owned growable batch.",
      "You treat inline-first storage as conditional on measurement rather than as a default style choice.",
    ],
    hints: [
      "Start with ownership and size invariants before talking about performance.",
      "A good answer separates API shape from storage shape.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read `len` and `capacity` operationally",
    objective: "Explain what a vector knows now versus what it can hold before another allocation may be needed.",
    starterPrompt:
      "Review a small helper that builds a `Vec<u64>` with `with_capacity(1024)`, pushes 600 items, and logs both `len()` and `capacity()`.",
    prompts: [
      "What does `len()` tell you exactly?",
      "What does `capacity()` tell you exactly?",
      "Why is `capacity() == 1024` not a portable design assumption for every vector in the system?",
    ],
    acceptanceCriteria: [
      "You explain `len()` as the count of logically present initialized elements.",
      "You explain `capacity()` as allocation budget before the next growth step may be needed.",
      "You explicitly reject using an exact growth factor or exact capacity folklore as a correctness assumption.",
    ],
    hints: [
      "One number is occupancy. The other is allocation slack.",
      "The language contract is not 'trust whatever a blog post said about growth factors.'",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Write the function over slices, not vectors",
    objective: "Design an algorithm around a borrowed contiguous view so callers keep control over storage.",
    starterPrompt:
      "Implement `fn window_sum(values: &[u32]) -> u32` so it sums the provided window and works for both an array subslice and a vector subslice.",
    prompts: [
      "Keep the parameter type exactly as `&[u32]`.",
      "Do not allocate a new vector just to sum.",
      "Use either iterator-style code or a small explicit loop.",
    ],
    acceptanceCriteria: [
      "The function signature stays `fn window_sum(values: &[u32]) -> u32`.",
      "The function returns `54` for `&fixed[2..5]` and `18` for `&dynamic[..3]` in the lab.",
      "The implementation does not require ownership of a `Vec<u32>`.",
    ],
    hints: [
      "The whole point is that callers may have arrays, vectors, or subslices and the function should not care.",
      "A reduction over a slice is usually one line in Rust.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Benchmark preallocation versus push-only growth honestly",
    objective: "Measure whether capacity planning changes your workload enough to matter.",
    starterPrompt:
      "Build a small benchmark harness that pushes the same number of elements into two vectors: one created with `Vec::new()` and one created with `Vec::with_capacity(n)`.",
    prompts: [
      "Run the same workload many times in release mode.",
      "Keep the pushed element type and loop shape identical between the two variants.",
      "Record at least wall-clock timing and final capacity for both runs.",
    ],
    acceptanceCriteria: [
      "Your harness compares the same workload under two allocation strategies.",
      "You run it under conditions that reduce obvious noise, such as repeated iterations and release settings.",
      "You report observations rather than assuming preallocation always matters equally.",
      "You call out one tradeoff: simpler code, allocation count, or realistic workload fidelity.",
    ],
    hints: [
      "A benchmark is only useful if the workload is actually comparable.",
      "Do not confuse a toy microbenchmark with a production decision, but do use it to validate intuition.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Repair a structural-mutation bug without changing the API lie",
    objective: "Fix code that keeps a borrowed slice alive while reshaping the underlying vector.",
    starterPrompt:
      "A helper takes `let hot = &buffer[..4];`, then `buffer.push(99);`, then still reads from `hot`. Refactor the flow without pretending the original borrow should survive structural mutation.",
    prompts: [
      "Can the borrowed work happen earlier?",
      "Should the code copy a tiny fixed header into an array before the push if it truly needs that data later?",
      "Would two phases make the buffer and borrow lifetime easier to review?",
    ],
    acceptanceCriteria: [
      "Your repair ends the active borrow before structural mutation, or copies the tiny truly-needed subset into independent storage deliberately.",
      "You explain the failure in terms of borrowing a view into storage that may change, not in terms of compiler stubbornness.",
      "You do not keep the old slice alive across the vector growth path.",
    ],
    hints: [
      "A slice is a view into existing storage, not a durable reservation of future layout.",
      "If later code really needs a tiny fixed piece, a small copied array may be the honest repair.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose the right contiguous-storage design for three real workloads",
    objective: "Make explicit tradeoffs among fixed shape, borrowed view, owned growth, inline-first storage, and locality.",
    starterPrompt:
      "You are designing three subsystems: a packet parser with fixed headers, a metrics engine that scans rolling numeric windows, and a request pipeline that accumulates retryable jobs.",
    prompts: [
      "Which subsystem wants arrays because the bound is semantically fixed?",
      "Which subsystem wants slice-first APIs because the caller already owns the data?",
      "Which subsystem wants owned vectors and where does preallocation make sense?",
      "Would any subsystem justify an inline-first representation, and what measurement would have to prove it first?",
    ],
    acceptanceCriteria: [
      "You name one concrete representation for each subsystem and justify it with workload shape.",
      "You discuss locality or contiguous scans for at least one subsystem.",
      "You justify at least one preallocation decision with a real upper bound rather than a guess.",
      "You keep inline-first storage as a measured optimization rather than a stylistic preference.",
    ],
    hints: [
      "Do not answer only with type names. Explain the operational reason each choice fits.",
      "A strong answer mentions shape, ownership, mutation, and locality together.",
    ],
  },
]

const reviewQuestions = [
  "When is `[T; N]` the right type rather than `Vec<T>`?",
  "Why is `&[T]` usually a better function parameter than `&Vec<T>`?",
  "What is the practical difference between `len()` and `capacity()`?",
  "Why should production code avoid depending on a specific vector growth factor?",
  "What workload characteristics make contiguous storage especially attractive?",
]

const workingLoop = [
  "State whether the algorithm needs fixed shape, borrowed access, or owned growth.",
  "Write the narrowest honest API shape first, usually `&[T]` or `&mut [T]` for pure algorithms.",
  "If allocation behavior matters, decide whether you have a real upper bound before reaching for preallocation.",
  "If a fancy representation appears, name the measured problem it solves before keeping it.",
]

export function PageCh10ArraysSlicesAndVectorsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch10-arrays-slices-and-vectors-exercises")
  const mainPageIndex = getPageIndexById("ch10-arrays-slices-and-vectors")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 10 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice the contiguous-storage decisions that shape serious Rust code: fixed arrays, slice-first APIs, vector
          capacity planning, and workload-driven representation choices.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as an API and representation review. The right answer is not “always use slices” or
                “always preallocate.” The right answer is the narrowest honest shape for the workload plus a clear story
                about ownership, locality, and allocation.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 10
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
                  Storage drill
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
          title="Runnable lab · Slice-first implementation"
          description={
            <>
              Implement{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">window_sum</code> over a slice so the
              same function works for an array window and a vector window. The checker expects the exact signature{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">fn window_sum(values: &[u32]) -&gt; u32</code>.
            </>
          }
          filename="window_sum_lab.rs"
          runKey="ch10_ex_window_sum"
          expectedOutput={"fixed = 54\ndynamic = 18"}
          helperText={
            <>
              Tip: keep the parameter as a slice and sum what you were handed. The caller already decided whether the
              backing storage is an array, a vector, or a subslice of either.
            </>
          }
          initialCode={`fn window_sum(values: &[u32]) -> u32 {\n    values[0]\n}\n\nfn main() {\n    let fixed = [4_u32, 8, 15, 16, 23, 42];\n    let dynamic = vec![3_u32, 6, 9, 12];\n\n    println!("fixed = {}", window_sum(&fixed[2..5]));\n    println!("dynamic = {}", window_sum(&dynamic[..3]));\n}`}
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
            By the end of this page, you should be able to choose among arrays, slices, vectors, and inline-first storage
            from workload shape, write slice-first functions without narrowing callers unnecessarily, and discuss vector
            capacity planning with concrete operational language instead of folklore.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch10_arrays_slices_and_vectors/slice_first_api.rs`
````
fn tail_sum(values: &[u64], take: usize) -> u64 {
    let start = values.len().saturating_sub(take);
    values[start..].iter().copied().sum()
}

fn main() {
    let fixed = [3_u64, 5, 8, 13];
    let dynamic = vec![1_u64, 2, 3, 4, 5, 6];

    println!("fixed tail = {}", tail_sum(&fixed, 2));
    println!("dynamic tail = {}", tail_sum(&dynamic, 3));
}
````

### File: `examples/ch10_arrays_slices_and_vectors/vec_capacity_and_growth.rs`
````
fn collect_even_scaled(ids: &[u32]) -> Vec<u32> {
    let mut out = Vec::with_capacity(ids.len());

    for &id in ids {
        if id % 2 == 0 {
            out.push(id * 10);
        }
    }

    out
}

fn main() {
    let ids = [10_u32, 11, 12, 13, 14];
    let mut out = collect_even_scaled(&ids);

    println!("len = {}", out.len());
    println!("can fit two more = {}", out.len() + 2 <= out.capacity());

    out.extend([200, 220]);
    println!("last = {}", out.last().copied().unwrap());
}
````

### File: `explainer.md`
````diff
--- explainer.md
+++ explainer.md
@@ -1,103 +1,45 @@
-# Task 9 explainer
+# Task 10 explainer
 
 ## Repository convention used
 
-The task brief named markdown chapter targets, but this repository's source of truth is the React/Next book template under:
+The task brief named markdown chapter targets, but this repository’s actual source of truth is the existing React/Next book template under:
 
 - `components/rust-book/pages/`
 - `components/rust-book/types.ts`
 - `components/rust-book/index.tsx`
 - `examples/`
 
-So I followed the existing repository convention instead of creating unused markdown chapter files.
+So I stayed with the established TSX page convention and the `examples/` folder convention rather than introducing unused markdown chapter files.
 
 ## What changed
 
-### New chapter pages
-Added the Chapter 09 page pair in the established TSX page format:
+### Added the missing Chapter 10 exercise page
+Created:
 
-- `components/rust-book/pages/page-ch09-smart-pointers-and-pinning.tsx`
-- `components/rust-book/pages/page-ch09-smart-pointers-and-pinning-exercises.tsx`
+- `components/rust-book/pages/page-ch10-arrays-slices-and-vectors-exercises.tsx`
 
-These pages include:
+This follows the repository’s existing chapter-exercise page pattern and includes:
 
-- opening scenario
-- mental model
-- core concepts
-- production patterns
-- pitfalls and tradeoffs
-- worked examples
-- exercises
-- summary
+- six progressive exercises
+- warm-up, code-reading, implementation, debugging/refactoring, and design scenarios
+- a runnable `RustPracticeCard` lab
+- review questions
+- a success summary
+- navigation back to the main Chapter 10 page
 
-### Navigation and page registration
-Updated the page registry so Chapter 09 appears in the book flow and table of contents:
+### Added Chapter 10 example source files
+Created:
 
-- `components/rust-book/pages/index.ts`
-- `components/rust-book/index.tsx`
-- `components/rust-book/types.ts`
+- `examples/ch10_arrays_slices_and_vectors/slice_first_api.rs`
+- `examples/ch10_arrays_slices_and_vectors/vec_capacity_and_growth.rs`
 
-### Example source files
-Added standalone Rust example files under the repository's example convention:
+These match the established example-folder naming convention already used by earlier chapters.
 
-- `examples/ch09_smart_pointers_and_pinning/rc_weak_tree.rs`
-- `examples/ch09_smart_pointers_and_pinning/pin_box_and_poll.rs`
+### Updated explainer
+Replaced the old Task 9 explainer with this Task 10 explainer so the repository notes now match the current task.
 
-### Default editor code
-Added chapter-specific default editor code in a small companion file to avoid inflating `types.ts`:
+## What I intentionally did not change
 
-- `components/rust-book/default-codes-ch09.ts`
+The repository state already contained the Chapter 10 main page and its supporting integration in the app-level book flow, including the relevant chapter page, default editor code, simulator support, and chapter registration. I preserved that existing work and made only the focused additions still needed for this task.
 
-`types.ts` now imports and merges those defaults.
-
-### Simulator support
-Added chapter-specific simulator output handling in a companion file:
-
-- `components/rust-book/rust-simulator-ch09.ts`
-
-And wired it into:
-
-- `components/rust-book/rust-simulator.ts`
-
-This keeps the existing simulator architecture intact while making the new chapter runnable and checkable.
-
-### Syntax highlighting support
-Extended code highlighting/editor type lists for the new chapter concepts in:
-
-- `components/rust-code-editor.tsx`
-
-## ToC mapping
-
-The chapter content maps directly to the requested source sections:
-
-1. `Box<T>: heap ownership`
-2. `Rc<T>: single-threaded shared ownership`
-3. `Arc<T>: thread-safe shared ownership`
-4. `RefCell<T>: runtime borrow checking`
-5. `Cell<T> and interior mutability`
-6. `Mutex<T> and ownership under synchronization`
-7. `Weak<T> and cyclic references`
-8. `Pin<T> and immovable values`
-9. `Pin<Box<T>> and Pin<&mut T>`
-10. `Choosing the right pointer type`
+## ToC mapping for this task
 
-## Exercise coverage
+The exercise page and examples align with the requested Chapter 10 source sections:
 
-The exercise page includes progressive drills covering:
-
-- pointer-type selection
-- breaking an `Rc` graph back-edge with `Weak`
-- `Cell` vs `RefCell` vs `Mutex`
-- `Arc<Mutex<T>>` tradeoffs
-- why async futures may require pinning
-
-It also includes a runnable lab with explicit acceptance via simulator output.
+1. Fixed-size arrays
+2. Slices as views
+3. `Vec<T>` internals
+4. Capacity, allocation, and growth
+5. Iterators over arrays, slices, and vectors
+6. Mutation patterns
+7. Small-vector optimizations
+8. Cache locality and contiguous storage
 
 ## Assumptions
 
 - Page indices for the new chapter are:
-  - Chapter 09 main page: `16`
-  - Chapter 09 exercises page: `17`
+  - Chapter 10 main page: `18`
+  - Chapter 10 exercises page: `19`
 - Cross-links only target chapters that already exist in the repository.
-- I did not create markdown files because they would not be used by the existing app template.
-- I kept the build/navigation model consistent with the prior completed chapters.
+- I did not create standalone markdown chapter files because this repository renders book content from TSX pages, not mdbook-style markdown.
+- I preserved the existing build and navigation model and made only the focused additions required to complete Task 10.
````
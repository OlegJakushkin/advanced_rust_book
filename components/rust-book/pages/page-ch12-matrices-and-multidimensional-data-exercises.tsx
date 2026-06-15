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
    title: "Choose row-major, column-major, jagged, or sparse from the workload",
    objective: "Practice choosing a matrix representation from access pattern and boundary contract rather than habit.",
    starterPrompt:
      "Classify four workloads: image scanlines processed left-to-right, a foreign column-major solver boundary, a truly ragged set of variable-length feature rows, and a mostly-empty recommendation matrix.",
    prompts: [
      "Which workload wants row-major dense storage?",
      "Which workload should preserve or adapt to column-major semantics at the boundary?",
      "Which workload is genuinely jagged and therefore not a dense matrix at all?",
      "Which workload should move toward a sparse format instead of forcing dense storage?",
    ],
    acceptanceCriteria: [
      "You distinguish dense row-major, dense column-major, jagged, and sparse representations clearly.",
      "You justify each choice with access pattern or interop contract, not only preference.",
      "You explicitly reject `Vec<Vec<T>>` as the default answer for dense numeric data.",
    ],
    hints: [
      "Start with physical layout, not only with indexing syntax.",
      "A strong answer says why the boundary wants the chosen representation.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Replace `Vec<Vec<T>>` with flat storage conceptually before coding",
    objective: "Read a nested-vector design and explain exactly which costs disappear when the storage becomes flat.",
    starterPrompt:
      "You inherit `Vec<Vec<f32>>` for a dense scoring matrix and the hot path walks every row in full. Explain what changes if the storage becomes `Vec<f32>` plus `rows` and `cols`.",
    prompts: [
      "Which allocations disappear?",
      "What happens to row placement and cache behavior?",
      "What becomes easier at FFI or accelerator boundaries?",
      "Which convenience from nested vectors do you lose?",
    ],
    acceptanceCriteria: [
      "You call out multiple allocations and per-row indirection as real costs of `Vec<Vec<T>>`.",
      "You explain why one flat buffer improves predictable traversal and interop.",
      "You mention at least one tradeoff, such as losing easy ragged-row support.",
    ],
    hints: [
      "This is not a morality exercise. Name the costs and the lost conveniences precisely.",
      "Contiguous storage and jagged flexibility are solving different problems.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement a row-major `Matrix<T>` wrapper over `Vec<T>`",
    objective: "Build a dense owner that makes layout explicit and exposes row-major indexing.",
    starterPrompt:
      "Implement `Matrix<T>` with `from_elem`, `offset`, `get`, `set`, and `row` over one flat `Vec<T>`.",
    prompts: [
      "Use row-major indexing exactly.",
      "Keep `get` returning `Option<&T>`.",
      "Keep `row` returning `Option<&[T]>` without copying.",
      "Make the storage length equal to `rows * cols`.",
    ],
    acceptanceCriteria: [
      "The matrix stores one flat `Vec<T>` and shape metadata.",
      "The offset formula is row-major.",
      "The row slice borrows directly from the owned buffer.",
      "The runnable lab prints the expected cell value, row sum, and total cell count.",
    ],
    hints: [
      "The row-major offset formula is `row * cols + col`.",
      "A row view is just a slice range into the flat buffer.",
    ],
  },
  {
    number: 4,
    kind: "design",
    title: "Design a matrix view without copying data",
    objective: "Replace a clone-heavy submatrix helper with a borrowed view that carries enough metadata to interpret the same storage.",
    starterPrompt:
      "A helper currently builds a fresh `Vec<T>` for every 2D window extracted from a larger flat buffer. Redesign it as a borrowed view.",
    prompts: [
      "Which metadata does the view need: rows, cols, stride, offset?",
      "What does the view borrow from?",
      "How does the accessor compute the element position safely?",
      "When is copying still the right answer instead of a borrowed view?",
    ],
    acceptanceCriteria: [
      "Your redesign borrows the existing buffer rather than allocating by default.",
      "You include the metadata needed to interpret the view correctly.",
      "You explain one case where copying remains legitimate, such as ownership transfer across a long-lived boundary.",
    ],
    hints: [
      "The view should explain layout, not own it.",
      "Stride matters once the view is smaller than the full parent matrix width.",
    ],
  },
  {
    number: 5,
    kind: "design",
    title: "Choose between const generics and runtime dimensions honestly",
    objective: "Separate fixed-invariant shapes from merely common shapes.",
    starterPrompt:
      "Review three cases: a 3x3 image kernel, a 4x4 transform matrix in a graphics or simulation path, and a batch-sized score matrix whose dimensions come from request input.",
    prompts: [
      "Which cases want const generics because the shape is part of the invariant?",
      "Which case wants runtime dimensions because shape varies per request or batch?",
      "What tradeoff do you accept by making shape part of the type?",
    ],
    acceptanceCriteria: [
      "You choose const generics only where fixed shape is semantically real.",
      "You choose runtime dimensions for the request-sized or batch-sized case.",
      "You explain at least one tradeoff involving API specificity, monomorphization, or call-site simplicity.",
    ],
    hints: [
      "\"Often 4x4\" and \"must be 4x4\" are not the same statement.",
      "Fixed shape in the type is strongest when the invariant is truly global to the API.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose dense, sparse, and interop boundaries for a production pipeline",
    objective: "Make layout choices across parsing, dense computation, sparse assembly, and foreign-library calls.",
    starterPrompt:
      "You are designing `ingest dense features -> normalize rows -> extract windows -> call a foreign solver -> build a sparse recommendation graph -> ship results to a GPU stage`.",
    prompts: [
      "Which stages want dense flat storage and which want sparse formats?",
      "Where are borrowed views enough and where must data become owned?",
      "Which boundary must be explicit about row-major versus column-major layout?",
      "What would you test and profile first to avoid blaming math for boundary costs?",
    ],
    acceptanceCriteria: [
      "You choose at least one dense and one sparse representation deliberately.",
      "You identify the foreign-library or GPU boundary as an ownership and layout boundary.",
      "You describe at least one test strategy and one profiling hook, such as scalar reference checks, transposition timing, or copy-count measurement.",
      "You justify one tradeoff involving locality, conversion cost, or API complexity.",
    ],
    hints: [
      "The slowest part may be packing or copying, not the kernel.",
      "A strong answer names the owner and layout contract at each subsystem edge.",
    ],
  },
]

const reviewQuestions = [
  "Why is a flat `Vec<T>` usually a stronger dense-matrix default than `Vec<Vec<T>>`?",
  "What is the real difference between row-major and column-major in production code?",
  "When is a matrix view the right abstraction, and when should you copy instead?",
  "What makes const generics appropriate for some matrix shapes but not for request-sized batches?",
  "Which safety invariant must be true before you hand a matrix buffer to a foreign solver or GPU runtime?",
  "Why should sparse format choice follow traversal and interop needs instead of default taste?",
]

const workingLoop = [
  "Name the physical layout before you name the abstraction.",
  "Decide whether the next stage needs ownership or only a view.",
  "If the boundary is foreign or accelerated, write down the layout contract explicitly.",
  "Measure copies, repacking, and traversal order before blaming the arithmetic kernel.",
]

const interopReviewChecklist = [
  "Write down the layout contract before the foreign call: row-major, column-major, stride, and scalar type.",
  "Write down the ownership contract before the foreign call: borrowed buffer, owned staging buffer, or device transfer.",
  "Compare against a small scalar reference path before trusting the accelerated result.",
  "Profile copies, transposes, and transfers separately from the kernel itself.",
  "If a sparse format appears, justify it from traversal or interop needs rather than taste.",
]

export function PageCh12MatricesAndMultidimensionalDataExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch12-matrices-and-multidimensional-data-exercises")
  const mainPageIndex = getPageIndexById("ch12-matrices-and-multidimensional-data")
  const chapter08PageIndex = getPageIndexById("ch08-undefined-behavior-and-unsafe-rust")
  const chapter10PageIndex = getPageIndexById("ch10-arrays-slices-and-vectors")
  const chapter11PageIndex = getPageIndexById("ch11-hash-maps-and-sets")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 12 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice making matrix and multidimensional-data decisions explicit: storage layout, borrowed views, fixed-size
          kernels, sparse formats, and foreign-library boundaries.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat these as representation and boundary reviews. The answer is rarely just “use a matrix crate.” The
                better answer explains layout, ownership, traversal pattern, and interop cost in one coherent story.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 12
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Interop review checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {interopReviewChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Relevant refreshers</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 08 is the right refresher for unsafe and FFI invariants. Chapter 10 is the right refresher for
                contiguous storage and slice-first APIs. Chapter 11 is the right refresher for workload-aware
                data-structure choice, which the dense-versus-sparse decisions build on. Revisit them before the interop
                and view exercises if the layout boundary still feels fuzzy.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter08PageIndex)}>
                Chapter 08
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter10PageIndex)}>
                Chapter 10
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter11PageIndex)}>
                Chapter 11
              </Button>
            </div>
          </div>
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
                  Matrix design drill
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
          title="Runnable lab · Row-major `Matrix<T>` wrapper"
          description={
            <>
              Repair the starter so the matrix is truly row-major and rows are exposed as borrowed slices without copying.
              The checker expects the correct value at <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">a01</code>,
              the correct sum for row 1, and the correct total cell count.
            </>
          }
          filename="row_major_matrix_lab.rs"
          runKey="ch12_ex_row_major_matrix"
          expectedOutput={"a01 = 7\nrow1 sum = 16\ncells = 6"}
          helperText={
            <>
              Tip: the starter intentionally mixes up row-major and column-major thinking. The matrix is 2x3, so a
              column-major formula gives the wrong answer. Fix the offset first, then fix the row-slice start calculation.
            </>
          }
          initialCode={`#[derive(Debug)]\nstruct Matrix<T> {\n    rows: usize,\n    cols: usize,\n    data: Vec<T>,\n}\n\nimpl<T: Clone> Matrix<T> {\n    fn from_elem(rows: usize, cols: usize, value: T) -> Self {\n        Self {\n            rows,\n            cols,\n            data: vec![value; rows * cols],\n        }\n    }\n}\n\nimpl<T> Matrix<T> {\n    fn offset(&self, row: usize, col: usize) -> usize {\n        col * self.rows + row\n    }\n\n    fn get(&self, row: usize, col: usize) -> Option<&T> {\n        if row < self.rows && col < self.cols {\n            Some(&self.data[self.offset(row, col)])\n        } else {\n            None\n        }\n    }\n\n    fn set(&mut self, row: usize, col: usize, value: T) {\n        let index = self.offset(row, col);\n        self.data[index] = value;\n    }\n\n    fn row(&self, row: usize) -> Option<&[T]> {\n        if row < self.rows {\n            let start = row * self.rows;\n            Some(&self.data[start..start + self.cols])\n        } else {\n            None\n        }\n    }\n}\n\nfn main() {\n    let mut m = Matrix::from_elem(2, 3, 0_i32);\n    m.set(0, 0, 10);\n    m.set(0, 1, 7);\n    m.set(0, 2, 30);\n    m.set(1, 0, 3);\n    m.set(1, 1, 8);\n    m.set(1, 2, 5);\n\n    let row1_sum: i32 = m.row(1).unwrap().iter().copied().sum();\n\n    println!(\"a01 = {}\", m.get(0, 1).copied().unwrap());\n    println!(\"row1 sum = {}\", row1_sum);\n    println!(\"cells = {}\", m.data.len());\n}`}
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
            By the end of this page, you should be able to explain why a dense matrix often wants flat storage, design a
            view without copying data, choose const generics only when shape is truly part of the invariant, and reason
            clearly about sparse and foreign-library boundaries before the profiler forces the conversation.
          </p>
        </section>
      </div>
    </div>
  )
}

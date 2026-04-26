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
    title: "Name the unit before you design it",
    objective: "Practice distinguishing package, crate, module, workspace, and public API surface without hand-waving.",
    starterPrompt:
      "You inherit a repository with an API service, a worker, shared domain models, and a CLI. Classify which parts should be packages, which should be crates, and which should remain modules inside one crate.",
    prompts: [
      "Which boundary is only organizational and therefore should stay a module?",
      "Which boundary justifies a separate crate because of dependency or API isolation?",
      "Which boundary belongs at workspace scope rather than crate scope?",
    ],
    acceptanceCriteria: [
      "You distinguish package, crate, module, and workspace correctly.",
      "You justify at least one decision by dependency isolation rather than folder preference.",
      "You identify at least one case where a module is cheaper than a new crate.",
    ],
    hints: [
      "Ask what the compiler builds, what Cargo manages, and what callers should be allowed to import.",
      "A directory boundary is not automatically a crate boundary.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read the public surface from a module tree",
    objective: "Infer what is public, what remains internal, and where refactoring freedom still exists.",
    starterPrompt:
      "Given a crate root that re-exports `pub use domain::OrderId;` and `pub use service::OrderService;`, with adapters hidden under internal modules, explain what downstream callers can rely on and what they should not know about.",
    prompts: [
      "What path would a downstream crate import?",
      "Which internal module names may change without breaking callers?",
      "Why is `pub(crate)` often a better first choice than `pub`?",
    ],
    acceptanceCriteria: [
      "You identify the stable import path at the crate root.",
      "You explain how re-exporting hides internal layout and preserves refactoring room.",
      "You describe the maintenance cost of widening visibility too early.",
    ],
    hints: [
      "Think about what another crate sees, not what the current file sees.",
      "A public path is an API promise even if it felt temporary when written.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Create a workspace layout for a multi-crate product",
    objective: "Design a realistic Rust workspace for a product with multiple binaries and shared domain logic.",
    starterPrompt:
      "Sketch the top-level layout for a system with `api`, `worker`, `domain`, and `adapters` components. Use a workspace root plus packages and explain which crates own which dependencies.",
    prompts: [
      "Which package should contain the shared domain types?",
      "Which packages should depend on network or database crates?",
      "Which package should remain free of infrastructure dependencies?",
    ],
    acceptanceCriteria: [
      "Your layout includes a workspace root and multiple packages.",
      "The domain crate stays isolated from infrastructure dependencies.",
      "The API and worker binaries depend inward rather than the core depending outward.",
      "You explain one tradeoff involving build times, API stability, or dependency hygiene.",
    ],
    hints: [
      "If a crate can stay free of HTTP and database types, that is usually a good sign.",
      "Think in dependency direction, not just file organization.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a feature flag matrix without turning Cargo into a mode engine",
    objective: "Fix a design that uses features for mutually exclusive operational modes.",
    starterPrompt:
      "A crate has features `sqlite`, `postgres`, and `memory`, and the code assumes exactly one is enabled. Refactor the design so additive features remain sane and invalid combinations are handled explicitly.",
    prompts: [
      "Which parts should stay compile-time options?",
      "Which parts belong in runtime configuration instead?",
      "How would you reject impossible combinations early?",
    ],
    acceptanceCriteria: [
      "You explain why mutually exclusive operational modes are awkward as Cargo features.",
      "You preserve additive capability where it makes sense.",
      "You propose an explicit validation strategy for impossible combinations.",
    ],
    hints: [
      "Cargo resolves one feature set for the build graph, not per request or per environment.",
      "A runtime enum is often cleaner than a compile-time feature war.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Choose a dependency policy for shared crates",
    objective: "Decide which crates may depend on infrastructure libraries and which crates must remain clean.",
    starterPrompt:
      "Your domain crate currently imports an HTTP status type, a database error type, and a tracing crate because it was faster during prototyping. Redesign the dependency policy for long-term maintainability.",
    prompts: [
      "Which dependencies move outward into adapter crates?",
      "Which types should be translated at the boundary instead of leaking inward?",
      "Where would you allow a shared utility crate, and where would you avoid it?",
    ],
    acceptanceCriteria: [
      "You move protocol and storage dependencies out of the core domain crate.",
      "You explain at least one translation boundary where infrastructure types should be converted.",
      "You justify any remaining shared utility dependency rather than using it as a default bucket.",
    ],
    hints: [
      "Core crates should know business concepts first and infrastructure concepts last.",
      "A shared crate is only helpful when it removes duplication without becoming a junk drawer.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Write the CI command pack for the chapter examples",
    objective: "Define the baseline commands a serious Rust workspace should run for formatting, linting, testing, and benchmarking.",
    starterPrompt:
      "Pretend the chapter examples live inside a real Cargo workspace. Write the command sequence you would put into CI and explain what each command protects against.",
    prompts: [
      "Which command gives the fastest structural feedback?",
      "Which command enforces formatting consistency?",
      "Which command should fail on lint warnings?",
      "How will benchmarking fit in without pretending every repository already has a benchmark harness?",
    ],
    acceptanceCriteria: [
      "Your command pack includes check, test, formatting, and linting.",
      "You mention benchmark execution conditionally rather than assuming every repo already has benches.",
      "You explain why `--workspace`, `--all-targets`, or `--all-features` matter where used.",
    ],
    hints: [
      "Think of the command pack as team muscle memory, not only as CI decoration.",
      "A good answer is specific enough to paste into a pipeline later.",
    ],
  },
]

const reviewQuestions = [
  "What is the operational difference between a package and a crate?",
  "When should you create a new crate instead of a new module?",
  "Why is `pub(crate)` often a better default than `pub`?",
  "What kinds of choices belong in Cargo features, and what kinds usually belong in runtime configuration?",
  "Why should benchmarking be explicit rather than assumed?",
]

const commandPack = [
  "cargo check --workspace",
  "cargo test --workspace --all-targets",
  "cargo fmt --all --check",
  "cargo clippy --workspace --all-targets --all-features -- -D warnings",
  "cargo bench  # when the workspace defines benchmark targets",
]

export function PageCh03ProjectStructureAndToolingExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch03-project-structure-and-tooling-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 03 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice the repository-level decisions that make Rust codebases easier to evolve: boundaries, visibility,
          features, dependencies, and the command pack a mature team can trust.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat these exercises as design reviews in miniature. The current repository is a web app, so the Cargo
                layouts and commands are reference architecture for the Rust repositories you would create around this
                material. Use the acceptance criteria as your spec and explain tradeoffs in concrete operational terms.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(4)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 03
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Baseline command pack</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {commandPack.map((command) => (
              <li key={command}>
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">{command}</code>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground leading-5">
            Exercise 6 asks you to justify this set, tighten it, and explain when the benchmark step should exist.
          </p>
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
                  Architecture drill
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
          title="Runnable lab · Feature matrix repair"
          description={
            <>
              Model a small backend-selection matrix. The checker expects zero selections and double selections to fail
              with the same explicit error, while single selections return the chosen backend.
            </>
          }
          filename="feature_matrix_lab.rs"
          runKey="ch03_ex_feature_matrix"
          expectedOutput={
            'none = Err("choose exactly one backend")\ns3 = Ok("s3")\nlocal = Ok("local")\nboth = Err("choose exactly one backend")'
          }
          helperText={
            <>
              Think of the booleans as a design proxy for Cargo feature toggles. Invalid combinations should be rejected
              deliberately instead of drifting deeper into the codebase.
            </>
          }
          initialCode={`fn selected_backend(s3: bool, local: bool) -> Result<&'static str, &'static str> {\n    if s3 {\n        return Ok("s3");\n    }\n\n    if local {\n        return Ok("local");\n    }\n\n    Err("not configured")\n}\n\nfn main() {\n    println!("none = {:?}", selected_backend(false, false));\n    println!("s3 = {:?}", selected_backend(true, false));\n    println!("local = {:?}", selected_backend(false, true));\n    println!("both = {:?}", selected_backend(true, true));\n}`}
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
            By the end of this page, you should be able to separate package, crate, and module decisions cleanly, design
            a multi-crate workspace without dependency drift, explain why visibility is an API commitment, keep feature
            design additive, and write the baseline tool commands a production Rust repository should treat as normal.
          </p>
        </section>
      </div>
    </div>
  )
}

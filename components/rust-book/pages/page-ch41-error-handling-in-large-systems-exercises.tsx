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
    title: "Choose Option, Result, panic, or process abort from the caller's ability to act",
    objective: "Practice separating ordinary absence, recoverable failure, and broken invariants before one error type grows into a junk drawer.",
    starterPrompt:
      "Classify four events: an optional request header is missing, a database call times out, a user attempts an invalid state transition, and an internal invariant says two states cannot coexist but now both do.",
    prompts: [
      "Which event is local absence best modeled as Option first?",
      "Which events are recoverable and should become Result with a typed error?",
      "Which event is an invariant break more honestly modeled as panic or crash policy?",
      "Where would you translate the typed error if the next boundary is HTTP, AMQP, or FFI?",
    ],
    acceptanceCriteria: [
      "You distinguish Option, Result, and panic in operational terms rather than by style.",
      "You classify at least one domain failure separately from one infrastructure failure.",
      "You explain one translation step at a boundary instead of assuming the same contract survives everywhere unchanged.",
    ],
    hints: [
      "Ask first what the caller can still do next.",
      "If the process state is broken, the question may no longer be 'how do I return an error?'",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Separate domain and infrastructure errors in one service path",
    objective: "Read one mixed error surface and decide which variants belong to the domain layer, which belong to adapters, and which belong to top-level translation.",
    starterPrompt:
      "A billing service currently returns `anyhow::Result<()>` from deep inside the domain model and mixes `invalid transition`, `SQL timeout`, and `missing queue channel` into one free-form message chain.",
    prompts: [
      "Which failures belong in a domain error enum and why?",
      "Which failures belong in infrastructure or adapter errors and why?",
      "Where should anyhow still remain useful after the separation?",
      "Which caller actions become easier once the surface is typed again?",
    ],
    acceptanceCriteria: [
      "You move at least one business-rule failure out of the infrastructure bucket.",
      "You keep anyhow or an equivalent aggregated error layer only where pattern matching has stopped being useful.",
      "You name at least one caller action that typed separation enables, such as retry, reject, or dead-letter.",
    ],
    hints: [
      "A typed contract is most useful where the next layer still branches on it.",
      "A service shell can still aggregate rich context after lower layers stay typed.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Convert panic-based parsing into typed errors",
    objective: "Replace unwrap-driven control flow with a small typed contract that distinguishes missing input from invalid input.",
    starterPrompt:
      "Refactor `parse_port` so it returns `Result<u16, ConfigError>` with separate `MissingPort` and `InvalidPort` variants instead of panicking.",
    prompts: [
      "Keep the error type small and specific.",
      "Use `ok_or` or an equivalent explicit missing-input branch.",
      "Use `map_err` or an equivalent parse-failure branch.",
      "Return the parsed port directly on success instead of logging inside the helper.",
    ],
    acceptanceCriteria: [
      "The parser no longer panics for routine invalid input.",
      "Missing and malformed input are distinguishable in the return type.",
      "The runnable lab prints the expected missing, invalid, and success cases.",
    ],
    hints: [
      "This is the same contract repair many real config loaders need first.",
      "A small enum is often enough to make the whole caller path calmer.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Add context to async task propagation",
    objective: "Repair a spawned async path so join failure, inner failure, and boundary context stay separate and reviewable.",
    starterPrompt:
      "You inherit `tokio::spawn(async move { do_work(job).await })` followed by `.await?`, but the resulting error text never says whether the task failed to join or the inner operation failed after joining.",
    prompts: [
      "Where should you add context before the spawn boundary and after the await?",
      "Why is `JoinHandle<Result<T, E>>` a two-layer error surface instead of one?",
      "Which fields belong in the context message: job ID, queue name, attempt, resource name?",
      "When should cancellation be modeled distinctly from ordinary inner failure?",
    ],
    acceptanceCriteria: [
      "You describe the join layer and the inner error layer separately.",
      "You add at least one useful context message at the operation layer and one at the task layer.",
      "You explain one case where cancellation or shutdown should not be collapsed into a generic timeout string.",
    ],
    hints: [
      "A task panic is not the same incident as a typed adapter or domain failure.",
      "Context should name the operation, not just repeat the same low-level noun again.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Translate a Rust error contract across FFI without leaking internals",
    objective: "Replace a foreign-facing Rust-shaped error surface with one the other runtime can actually consume and stabilize.",
    starterPrompt:
      "A native plugin boundary currently exposes `pub extern \"C\" fn run(ptr: *const u8, len: usize) -> anyhow::Result<u64>`.",
    prompts: [
      "Which public boundary types should replace anyhow::Result here?",
      "How will null input, invalid UTF-8, and internal failure be distinguished?",
      "Which error detail should stay inside the Rust-side log or trace instead of escaping directly over the ABI?",
      "How would you test the status boundary with a tiny native harness?",
    ],
    acceptanceCriteria: [
      "You translate the boundary into status codes, out parameters, or another explicit ABI-safe contract.",
      "You distinguish at least two foreign-visible failure classes clearly.",
      "You keep richer Rust internals behind the wrapper instead of leaking them as the public ABI story.",
    ],
    hints: [
      "Another runtime cannot safely consume your internal anyhow chain as if it were a stable public type.",
      "Boring ABI contracts are a feature, not a failure of imagination.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design one error contract for HTTP, queue workers, and a native plugin",
    objective: "Make retryability, caller action, boundary translation, and logging discipline explicit across several large-system seams at once.",
    starterPrompt:
      "You are designing `HTTP request -> domain check -> async worker -> database -> native risk plugin -> publish outcome`, and you want another team to operate the failure modes without reverse-engineering your code.",
    prompts: [
      "Which failures should be visible as domain errors, infrastructure errors, and top-level service errors?",
      "Which failures are retryable, which are terminal, and where should that policy live?",
      "Which boundary should log the error, and which boundary should only translate and return it?",
      "What trace or log fields belong on every failure path to make the incident reconstructable later?",
    ],
    acceptanceCriteria: [
      "You define at least one domain error, one infrastructure error, and one translated service or transport contract.",
      "You make retryable versus terminal classification explicit instead of relying on message text.",
      "You identify one boundary that logs and another that only translates to avoid duplicate noise.",
      "You mention at least two observability fields such as request ID, task ID, attempt, queue, or plugin call name.",
    ],
    hints: [
      "A large-system error model is easier to operate when retry policy and logging policy are visible in different places on purpose.",
      "The same failure should not need five log lines before an operator can tell what actually happened.",
    ],
  },
]

const reviewQuestions = [
  "When is Option enough, and when should the boundary promote absence into Result?",
  "Why are domain errors and infrastructure errors worth keeping distinct even if both eventually become one HTTP response or one queue outcome?",
  "What is the practical split between thiserror and anyhow in a large Rust system?",
  "Why does a spawned task usually create a two-layer error surface rather than one?",
  "Why should a boundary usually log once rather than at every layer that propagates the same error upward?",
]

const workingLoop = [
  "State the caller action first: retry, reject, translate, or crash.",
  "Keep typed errors near the layer that still understands them.",
  "Add context at IO, task, queue, and FFI boundaries where meaning changes.",
  "Translate only when the contract really changes.",
  "Log once with structure, then re-measure whether the incident is now explainable from one trace and one log path.",
]

export function PageCh41ErrorHandlingInLargeSystemsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch41-error-handling-in-large-systems-exercises")
  const mainPageIndex = getPageIndexById("ch41-error-handling-in-large-systems")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 41 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice error handling the way it survives review: typed boundaries, async context, FFI translation, and
          caller-visible contracts that stay useful after the first incident.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a contract review. The strongest answer does not stop at “return Result.” It says
                which layer owns the typed error, which layer adds context, which layer translates the contract, and which
                layer should log the event once.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 41
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
                  Error contract drill
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
          title="Runnable lab · Replace panic-based parsing with typed errors"
          description={
            <>
              Repair the starter so routine invalid input becomes a typed{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Result</code> instead of a panic. The
              checker expects distinct variants for missing and invalid ports, plus a successful parse for{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">8080</code>.
            </>
          }
          filename="typed_error_lab.rs"
          runKey="ch41_ex_typed_errors"
          expectedOutput={"missing = Err(MissingPort)\nbad = Err(InvalidPort)\nok = Ok(8080)"}
          helperText={
            <>
              Tip: keep the enum small, use <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">ok_or</code>{" "}
              or an explicit <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">match</code> for the
              missing case, and map parse failure into{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">ConfigError::InvalidPort</code> without
              using <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">unwrap</code>.
            </>
          }
          initialCode={`#[derive(Debug, PartialEq, Eq)]
enum ConfigError {
    MissingPort,
    InvalidPort,
}

fn parse_port(raw: Option<&str>) -> Result<u16, ConfigError> {
    let text = raw.unwrap();
    Ok(text.parse::<u16>().unwrap())
}

fn main() {
    println!("missing = {:?}", parse_port(None));
    println!("bad = {:?}", parse_port(Some("oops")));
    println!("ok = {:?}", parse_port(Some("8080")));
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
            By the end of this page, you should be able to convert panic-based logic into a typed contract, separate domain
            and infrastructure failures without hand-waving, add context across async task boundaries, and translate the
            result into HTTP, broker, or FFI-facing surfaces another senior engineer can operate confidently.
          </p>
        </section>
      </div>
    </div>
  )
}

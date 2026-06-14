"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Refactoring in Rust is usually a boundary correction first",
    body: "The code gets more idiomatic when ownership, borrowing, error flow, and variant shape match what the program actually does. Syntax polish matters less than stating clearly who owns data and which boundary may fail.",
  },
  {
    title: "Translate intent, not the old language surface",
    body: "A direct port from C++, C#, or Go often preserves the wrong abstraction. Rust wants separate tools for data shape, behavior, visibility, and concurrency boundaries. The refactor succeeds when those concerns stop being collapsed into one mechanism.",
  },
  {
    title: "Good idiomatic refactors usually get simpler and more testable together",
    body: "Removing panic-based control flow, fake inheritance, unnecessary clones, and lifetime-heavy return types often produces code that is easier to benchmark, easier to review, and easier to test with small seams.",
  },
]

const refactorPasses = [
  {
    title: "Pass 1 · Make ownership and errors explicit",
    body: "Replace implicit or panic-based control flow with explicit ownership transfer and `Result`-based failure. This is where most lifetime noise and clone pressure begin to fall away.",
  },
  {
    title: "Pass 2 · Simplify the data model",
    body: "Collapse fake object hierarchies into structs, enums, and traits chosen by real domain shape. Closed sets become enums. Open seams become traits. Shared state becomes composition.",
  },
  {
    title: "Pass 3 · Tighten the operational boundary",
    body: "Once the data and error model are explicit, improve ergonomics, decide what truly becomes async, and leave a thin seam for tests, observability, and production profiling.",
  },
]

const coreSections = [
  {
    title: "Refactoring C++-style Rust",
    body: "The common C++-style porting mistake is to preserve class shape, pointer shape, and out-parameter shape even when the Rust version should just move values or return them by value. Rust usually gets calmer when one owner is obvious, mutation scope is shorter, and internal abstraction stays generic rather than immediately becoming runtime dispatch.",
    bullets: [
      "Return values instead of out-parameters when the callee creates the result.",
      "Use ordinary structs and enums before introducing pointer-heavy identity.",
      "Prefer trait bounds for internal reusable logic; monomorphization keeps dispatch static where the concrete type is already known.",
    ],
  },
  {
    title: "Refactoring Go-style error handling",
    body: "A Go-shaped port often hides failure in sentinel values, `(T, bool)` pairs, or log-and-continue branches. Rust is stronger when routine failure is `Result`, callers use `?` to propagate it, and domain errors get names instead of becoming strings at the earliest possible site.",
    bullets: [
      "Reserve `panic!` for bugs or violated internal invariants, not malformed user input.",
      "Keep domain errors in domain language and translate infrastructure errors at the edge.",
      "If the function may fail in a normal way, make that explicit in the return type.",
    ],
    code: `fn parse_port(raw: Option<&str>) -> Result<u16, ConfigError> {
    let text = raw.ok_or(ConfigError::MissingPort)?;
    text.parse::<u16>().map_err(|_| ConfigError::InvalidPort)
}`,
  },
  {
    title: "Refactoring C#-style object hierarchies",
    body: "A direct C# port often produces base structs, public fields, and wide trait-object graphs because a class hierarchy existed before. In Rust, shared data is usually just a field, shared behavior is usually a trait, and closed runtime state is usually an enum.",
    bullets: [
      "Move shared reusable fields into composed helper structs.",
      "Keep representation private and expose invariant-preserving methods.",
      "Do not widen everything to `dyn Trait` just to imitate virtual methods.",
    ],
  },
  {
    title: "Replacing inheritance with traits and enums",
    body: "Use traits for open behavior and enums for closed variants. That choice does more work than any inheritance translation because it decides whether the compiler can check exhaustiveness and whether callers know the concrete type at compile time.",
    bullets: [
      "Use enums for closed command sets, workflow state, transport modes, and AST variants.",
      "Use traits when several implementations are semantically real across time or deployment.",
      "Use `dyn Trait` only when runtime heterogeneity is actually required by one collection or boundary.",
    ],
    code: `enum DeliveryMode {
    Immediate,
    Retry,
}

trait Notifier {
    fn notify(&self, order_id: u64) -> String;
}`,
  },
  {
    title: "Removing unnecessary clones",
    body: "Unnecessary cloning is usually a boundary smell, not only a local inefficiency. The first question is whether the callee needed independent ownership at all. If it only needed read access, the correct refactor is often a borrowed parameter. If it did need independence, the clone may be perfectly valid.",
    bullets: [
      "Borrow first on read-only paths: `&str`, `&[T]`, `&Path`, `&T`.",
      "Keep explicit clones where duplication is semantically real or operationally cheap enough.",
      "Remember that `Arc::clone` adds a shared owner; it is not the same thing as deep-cloning inner data.",
    ],
  },
  {
    title: "Reducing lifetime complexity",
    body: "Many lifetime annotations disappear when the ownership model improves. Long-lived structs usually want owned fields. Helpers that build normalized labels or joined strings usually want owned returns. Borrow where the owner is nearby; own where the data crosses storage, queue, cache, or async boundaries.",
    bullets: [
      "Return `String` when the function constructs new text.",
      "Store owned data in long-lived structs unless the type is intentionally a view.",
      "Treat explicit lifetime noise as a design signal before treating it as a syntax problem.",
    ],
    code: `// before
fn build_label<'a>(service: &'a str, route: &'a str) -> &'a str { /* wrong model */ }

// after
fn build_label(service: &str, route: &str) -> String {
    format!("{}::{}", service, route)
}`,
  },
  {
    title: "Extracting safe abstractions from unsafe code",
    body: "Unsafe refactors are most successful when the public API becomes safer than the original. Shrink the `unsafe` block until it contains only the raw operation, check the invariants before entering it, and document the proof with a `// SAFETY:` comment another engineer can re-derive quickly.",
    bullets: [
      "Keep bounds, contiguity, aliasing, and lifetime checks outside the unsafe block when possible.",
      "If the caller must uphold the contract, make the function `unsafe fn` and document it explicitly.",
      "Do not export a safe API that depends on undocumented unsafe preconditions.",
    ],
    code: `pub fn write_header(buf: &mut [u8]) -> Result<(), HeaderError> {
    if buf.len() < 4 {
        return Err(HeaderError::TooSmall);
    }

    unsafe {
        // SAFETY: length checked above, exclusive mutable slice guarantees no aliasing writes.
        buf.as_mut_ptr().add(0).write(b'R');
    }

    Ok(())
}`,
  },
  {
    title: "Improving API ergonomics",
    body: "Idiomatic Rust APIs say what the callee needs, not what the caller happened to store. That usually means `&str` instead of `&String`, `&[T]` instead of `&Vec<T>`, focused constructors instead of broad public fields, and return types that express fallibility or closed state directly.",
    bullets: [
      "Accept borrowed views for inputs and return owned values when the result should survive independently.",
      "Keep trait bounds focused on required capability rather than naming heavyweight concrete types too early.",
      "Use enums and small error types to make call sites readable under pressure.",
    ],
  },
  {
    title: "Refactoring synchronous code into async code",
    body: "Do not start by sprinkling `async` across pure logic. First make the sync boundary explicit: owned inputs where work crosses tasks, owned outputs where results cross `await`, and explicit error types. Then make the IO boundary async and keep pure parsing, validation, and domain logic synchronous where possible.",
    bullets: [
      "Return owned values across `await` boundaries rather than borrowed references into repository or request storage.",
      "Add `Send` only when the future or captured data must cross threads on a multithreaded executor; add `Sync` only when shared references must be thread-safe.",
      "Most business-facing async refactors should not expose `Pin`; `Pin` usually stays inside lower-level future machinery and framework boundaries.",
    ],
    code: `async fn load_and_store<R, C>(repo: &R, cache: &C, id: OrderId) -> Result<(), AppError>
where
    R: OrderRepository,
    C: OrderCache,
{
    let order = repo.load(id).await?;
    cache.store(order).await?;
    Ok(())
}`,
  },
  {
    title: "Refactoring for testability",
    body: "Testability improves when side effects move to the edges and the core becomes a small number of pure or nearly pure functions. In Rust, this usually means injecting clocks, notifiers, repositories, or transport adapters through a narrow trait or generic seam, then keeping the state machine in plain data and return values.",
    bullets: [
      "Use enums for closed state transitions and test them exhaustively.",
      "Inject time, IO, and notification seams with traits or generics only where the boundary is real.",
      "Prefer return values over hidden logging or global mutation so tests can assert behavior directly.",
    ],
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already know RAII, value categories, and zero-cost intent. The refactor usually improves when you stop preserving pointer-heavy class shape and instead let Rust make ownership transfer, enum state, and generic capability seams explicit.",
  },
  {
    title: "Go background",
    body: "You already know small interfaces and service boundaries. The refactor usually improves when normal failure becomes `Result`, borrowed inputs stay local, and async or cross-thread work receives owned values rather than ambient references.",
  },
  {
    title: "C# background",
    body: "You already know interface-driven design and layered services. The refactor usually improves when you stop looking for inheritance and instead split shared state, shared behavior, and closed workflow state into composition, traits, and enums.",
  },
]

const cloneAuditChecklist = [
  "Is this clone preserving a real independent owner, or only silencing a borrow error?",
  "Could the callee take `&str`, `&[T]`, or `&T` instead?",
  "If duplication is required, is `Clone` clearer than shared ownership through `Arc`?",
  "Will the clone show up in a hot path, queue boundary, or retry fan-out where profiling should confirm the cost?",
]

const asyncRefactorChecklist = [
  "Keep parsing, normalization, and domain decisions synchronous until real IO or scheduling forces `async`.",
  "Return owned values from repositories and adapters before the first `await` crosses the boundary.",
  "Decide whether spawned work really needs `Send`; do not add thread bounds decoratively.",
  "Measure the shape change: allocation count, queue depth, latency, and cancellation behavior all matter more than keyword count.",
]

const testabilityPatterns = [
  "Pure helper functions for parsing, normalization, and decision rules.",
  "Small trait or generic seams for clocks, repositories, notifiers, and transport adapters.",
  "Enums for closed workflow states so tests can assert exhaustive transitions.",
  "Thin async shells around synchronous domain cores so test doubles stay small.",
]

const productionPatterns = [
  "Refactor in passes: ownership and errors first, data model second, async and ergonomics third.",
  "Prefer owned domain values at storage, cache, queue, retry, and async boundaries.",
  "Use traits and `dyn Trait` separately: generic trait bounds for internal reusable logic, `dyn Trait` for actual runtime heterogeneity.",
  "Keep unsafe refactors verifiable by shrinking the unsafe surface and moving checks into the safe wrapper.",
  "Profile after the refactor. Removing clones, narrowing errors, and flattening object hierarchies should be validated with allocation, latency, and readability wins, not only intuition.",
]

const pitfalls = [
  "Porting the old class tree first and asking ownership questions later. In Rust, that sequence is usually backward.",
  "Replacing every inconvenient borrow with `.clone()` before deciding whether the callee needed ownership at all.",
  "Using `panic!` as routine parse or configuration control flow because the original Go or C++ path logged and continued.",
  "Returning borrowed data from async or repository boundaries and then fighting lifetimes instead of fixing the ownership model.",
  "Making everything async after a refactor even when only one IO edge actually suspends.",
  "Leaving test seams broad and object-heavy when a small enum, pure function, or focused trait would have been easier to review and benchmark.",
]

const summaryPoints = [
  "Idiomatic Rust refactoring starts by correcting ownership, fallibility, and data shape rather than by polishing syntax.",
  "C++-style, C#-style, and Go-style ports usually improve when plain structs, enums, traits, and explicit `Result` boundaries replace inherited or implicit control flow.",
  "Removing clones and reducing lifetime noise usually comes from better ownership boundaries, not from clever annotations.",
  "Safe wrappers over unsafe internals, slice-first or `&str`-first APIs, and thin async shells are all ergonomics moves with real operational payoff.",
  "A good refactor should make the code easier to test, easier to profile, and easier to review quickly.",
]

export function PageCh17RefactoringTowardIdiomaticRust() {
  const {
    codes,
    updateCode,
    resetCode,
    outputs,
    setOutput,
    isRunning,
    setIsRunning,
    markPageComplete,
    setCurrentPage,
  } = useBook()
  const pageIndex = getPageIndexById("ch17-refactoring-toward-idiomatic-rust")
  const chapter04PageIndex = getPageIndexById("ch04-ownership-borrowing-and-lifetimes")
  const chapter07PageIndex = getPageIndexById("ch07-copying-data-vs-cloning-data")
  const chapter08PageIndex = getPageIndexById("ch08-undefined-behavior-and-unsafe-rust")
  const chapter14PageIndex = getPageIndexById("ch14-interfaces-in-rust-traits")
  const chapter15PageIndex = getPageIndexById("ch15-oop-models-in-rust")
  const chapter16PageIndex = getPageIndexById("ch16-domain-driven-design-in-rust")
  const exercisesPageIndex = getPageIndexById("ch17-refactoring-toward-idiomatic-rust-exercises")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  const runCode = (key: string) => {
    setIsRunning(key)
    setTimeout(() => {
      const output = simulateRustExecution(codes[key], key)
      setOutput(key, output)
      setIsRunning(null)
    }, 650)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          Chapter 17 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Idiomatic Rust refactoring reduces operational risk by clarifying ownership, error flow, data shape, and
          execution boundaries. This chapter turns review findings into small, verifiable code changes.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 04, 07, 08, 14, 15, and 16</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Ownership from Chapter 04, clone economics from Chapter 07, safe abstraction boundaries from Chapter 08,
                traits from Chapter 14, enum-versus-trait modeling from Chapter 15, and aggregate boundaries from Chapter
                16 all feed directly into good Rust refactoring work.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter04PageIndex)}>
                Chapter 04
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter07PageIndex)}>
                Chapter 07
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter08PageIndex)}>
                Chapter 08
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter14PageIndex)}>
                Chapter 14
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter15PageIndex)}>
                Chapter 15
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter16PageIndex)}>
                Chapter 16
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A mature service has accumulated pointer-heavy objects, panic-based parsing, sentinel failures, public mutable
            records, and broad runtime dispatch. The business requirement is a staged refactor that makes ownership,
            fallibility, state shape, and test seams explicit before optimizing syntax or async structure.
          </p>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {refactorPasses.map((pass) => (
              <div key={pass.title} className="rounded-lg border border-border bg-card p-4">
                <h4 className="font-semibold text-foreground mb-2">{pass.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{pass.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {mentalModelPoints.map((point) => (
              <div key={point.title} className="rounded-lg border border-border bg-card p-4">
                <h4 className="font-semibold text-foreground mb-2">{point.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{point.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="grid gap-4">
            {coreSections.map((section) => (
              <article key={section.title} className="rounded-xl border border-border bg-card p-5">
                <h4 className="font-semibold text-foreground mb-3">{section.title}</h4>
                <p className="text-sm text-muted-foreground leading-6">{section.body}</p>
                {section.bullets?.length ? (
                  <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
                {section.code ? (
                  <pre className="mt-4 rounded-lg border border-border bg-muted/30 px-3 py-3 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{section.code}</code>
                  </pre>
                ) : null}
              </article>
            ))}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">What to unlearn by background</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">Clone audit checklist</h4>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {cloneAuditChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">Async refactor checklist</h4>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {asyncRefactorChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">Testability patterns</h4>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {testabilityPatterns.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Production patterns</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {productionPatterns.map((pattern) => (
              <div key={pattern} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">{pattern}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Pitfalls and tradeoffs</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {pitfalls.map((pitfall) => (
              <div key={pitfall} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">{pitfall}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="h-5 w-5 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                An idiomatic Rust refactor is not a contest to remove every `clone`, every trait object, or every async
                call. It is a contest to make the remaining ones obviously correct, operationally justified, and easy to
                review.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 1: replace panic-based loading with an owned Result boundary
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The refactor keeps borrowed input local, moves normalized output into an owned struct, and turns routine
                  failure into a small error enum.
                </p>
              </div>
              {codes.refactoring_result_owned_api !== DEFAULT_CODES.refactoring_result_owned_api && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("refactoring_result_owned_api")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.refactoring_result_owned_api}
              onChange={(newCode) => updateCode("refactoring_result_owned_api", newCode)}
              onRun={() => runCode("refactoring_result_owned_api")}
              output={outputs.refactoring_result_owned_api ?? null}
              isRunning={isRunning === "refactoring_result_owned_api"}
              filename="result_owned_boundary.rs"
              expectedOutput={"endpoint = billing@127.0.0.1:443\nrequires tls = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.refactoring_result_owned_api}
              onRevert={() => resetCode("refactoring_result_owned_api")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Go-style repair</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Missing or invalid ports become ordinary <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result</code> errors,
                  not panics or sentinel values.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Lifetime repair</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The returned endpoint owns its normalized bind address, so the caller is not coupled to input buffer
                  lifetime.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">API result</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The signature now says exactly what the caller gets and exactly how failure is represented.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: replace hierarchy pressure with enum state and a narrow test seam
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A closed mode becomes an enum, a notifier becomes a small trait seam, and the processor becomes easy to
                  test with a fake implementation.
                </p>
              </div>
              {codes.refactoring_traits_enums_testable !== DEFAULT_CODES.refactoring_traits_enums_testable && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("refactoring_traits_enums_testable")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.refactoring_traits_enums_testable}
              onChange={(newCode) => updateCode("refactoring_traits_enums_testable", newCode)}
              onRun={() => runCode("refactoring_traits_enums_testable")}
              output={outputs.refactoring_traits_enums_testable ?? null}
              isRunning={isRunning === "refactoring_traits_enums_testable"}
              filename="traits_enums_testable.rs"
              expectedOutput={"charged = order-7\nnotified = email:order-7\nprocessed = 1"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.refactoring_traits_enums_testable}
              onRevert={() => resetCode("refactoring_traits_enums_testable")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">C#-style repair</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The closed delivery mode is an enum, not a polymorphic class family with runtime type checks.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Trait seam</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The notifier boundary is small enough to swap with a fake in tests without dragging in broad framework
                  state.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Static dispatch</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The generic processor keeps dispatch static until a real runtime plugin boundary actually appears.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch17_refactoring_toward_idiomatic_rust/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to refactor a non-idiomatic module in three passes, replace panic-based
            routines with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result</code>-based APIs,
            reduce lifetime noise by changing ownership, and design async and test seams deliberately.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 17 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {summaryPoints.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

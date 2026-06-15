"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "An error is a contract, not a string to read later",
    body: "When a function returns a failure, it is making a promise to its caller about what went wrong, what kind of failure it was, and what action still makes sense. In a small program you can get away with a printable message; in a large system that contract is the load-bearing part, because some other layer has to decide whether to retry, reject, translate, or give up. Design the contract first and let the message follow from it, not the other way around.",
  },
  {
    title: "Let the caller's next move pick the error shape",
    body: "Before you reach for a type, ask what the code one level up will do with the failure. If absence is ordinary and the caller only needs a local branch, an Option is enough. If the caller can retry, map, classify, log with structure, or surface the failure to a user, that is a Result with a meaningful error type. A panic is reserved for the cases where there is no sensible next move at all because a program invariant has been violated.",
  },
  {
    title: "Each boundary wants the error shaped differently",
    body: "An async task, a message broker, a C ABI, an HTTP handler, and a storage adapter each expect failures in their own vocabulary. The calmest large systems do not force one universal error type through all of them; they let every layer keep an error type it can reason about and translate only at the boundary where the contract genuinely changes. Translation is a deliberate act, performed once, at a named seam.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Stop reaching for exceptions and the invisible unwind path as your normal failure channel. In Rust the failure type is part of the function signature, so whether a call can fail, what kind of failure it is, and who is responsible for handling it are all visible at the call site rather than discovered when something throws three frames away. The trap is treating a Result like a checked exception you must immediately rethrow; instead, design the error type so the caller has a real decision to make.",
  },
  {
    title: "C# background",
    body: "Drop the instinct toward one ambient exception hierarchy that everything inherits from. A rejected business rule, a request timeout, and a background task that panicked are three different operational events, and Rust rewards keeping them as distinct typed variants instead of collapsing them into a shared base class. The mental shift is that you classify failures at design time, in the type, rather than at catch time, in a chain of catch blocks.",
  },
  {
    title: "Go background",
    body: "You already make failure explicit in return values, so the half-step is comfortable. The thing that is different is how far Rust pushes typed classification: rather than accumulating wrapped strings that the next layer has to substring-match, a senior Rust codebase keeps a small enum close to the layer that can still act on the failure. Think less err != nil with a formatted message, more a variant the caller can pattern-match and route.",
  },
  {
    title: "Python background",
    body: "There is no implicit propagate-until-something-catches behavior at the HTTP edge, and no convention of catching a broad Exception near the top. Fallibility is in the type, and the question driving everything is what the caller can still do: retry, reject with a 4xx, dead-letter, or surface a 5xx. The trap is wanting one giant error type that mirrors a broad except; Rust prefers narrow typed errors near the domain and one rich wrapper only at the very top.",
  },
]

const resultOptionCards = [
  {
    title: "Result and Option",
    body: "Option models ordinary absence. Result models actionable failure. The common repair is to keep Option local, then promote it to Result at the boundary where missing data stops being routine and starts being a contract violation.",
    code: `let raw = ports.get(service);
// service: &str -> String for the owned MissingService { service: String } field
let port = raw.ok_or(StoreError::MissingService { service: service.to_string() })?;`,
  },
  {
    title: "Error enums",
    body: "Typed enums keep failures reviewable. They let you distinguish invalid state, not found, permission denied, timeout, and retry exhaustion without forcing every caller to parse log text or inspect strings.",
    code: `enum DomainError {
    EmptyOrder { order_id: String },
    CreditLimitExceeded,
}`,
  },
]

const crateCards = [
  {
    title: "thiserror",
    body: "Use thiserror for typed error contracts in libraries, domains, adapters, and public seams. It keeps Display implementations readable while preserving structured variants another layer can still match on or translate.",
    code: `#[derive(Debug, Error)]
enum InfraError {
    #[error("order {order_id} not found in store")]
    MissingOrder { order_id: String },
}`,
  },
  {
    title: "anyhow",
    body: "Use anyhow for top-level application orchestration, binaries, workers, CLI entry points, and jobs where rich context is more important than downstream pattern matching. It is usually a boundary aggregation tool, not a domain-model replacement.",
    code: `let config = load_config()
    .context("loading worker config")?;`,
  },
]

const contextNotes = [
  "Context should explain the operation that failed, not restate the same low-level error text at every layer.",
  "Prefer context at boundary crossings: opening a file, fetching from a store, waiting on a task, decoding a message, calling an FFI function, or publishing to a broker.",
  "Add IDs and resource names in context only when they help operators correlate the failure later.",
  "Preserve the original source error. Context should add meaning, not erase the chain.",
]

const recoverabilityCards = [
  {
    title: "Recoverable errors",
    body: "Bad input, missing configuration, a rejected domain action, one temporary dependency failure, or a timed-out queue claim are all ordinary failures. They belong in Result or an equivalent explicit contract the caller can branch on.",
  },
  {
    title: "Unrecoverable errors",
    body: "Use panic for bugs, broken invariants, and states the process cannot safely continue from: impossible enum states, internal corruption, or violated unsafe preconditions. A panic is not a user-facing validation strategy.",
  },
]

const asyncBoundaryNotes = [
  "A spawned task often creates two error layers: the task join result and the inner task result.",
  "Add context both before and after await points when the boundary changes meaning. `loading manifest` and `manifest task failed` are different operational events.",
  "If an error crosses a multithread runtime task boundary, the owned error value usually needs Send + Sync + 'static. That constraint is design feedback, not decoration.",
  "Cancellation and shutdown are not 'success with no value'. Decide whether the caller should see cancellation distinctly from ordinary failure.",
]

const asyncSnippet = `let manifest = tokio::spawn(async {
    read_artifact("manifest")
        .await
        .context("loading manifest")
})
.await
.context("manifest task failed")??;`

const ffiNotes = [
  "Do not leak Rust enums, anyhow::Error, or panic semantics directly across a C ABI boundary.",
  "Translate to status codes, explicit out parameters, and documented ownership rules.",
  "Keep the rich Rust error inside the safe side of the wrapper. The foreign side gets the smallest contract it can actually honor.",
  "If the boundary is public or long-lived, treat the status space itself like a versioned contract.",
]

const ffiSnippet = `#[repr(C)]
pub enum Status {
    Ok = 0,
    NullPtr = 1,
    InvalidUtf8 = 2,
    EmptyInput = 3,
}

#[unsafe(no_mangle)]
pub extern "C" fn first_segment_len(
    ptr: *const u8,
    len: usize,
    out_len: *mut usize,
) -> Status { /* ... */ }`

const layeringCards = [
  {
    title: "Domain errors",
    body: "Domain errors use domain language: empty order, invalid transition, insufficient quota, duplicate command, unsupported state. They should not mention SQL, HTTP, AMQP, or TCP.",
  },
  {
    title: "Infrastructure errors",
    body: "Infrastructure errors describe failed boundaries: timeout, missing row, connection refused, task join failed, queue unavailable, serialization failure. They are not business rules even if the business feels the effect.",
  },
  {
    title: "Application or service errors",
    body: "A service layer often combines both, then chooses translation for the next boundary: HTTP status, broker nack, CLI exit code, or FFI status code. This is where classification becomes operational policy.",
  },
]

const loggingRules = [
  "Log once at the boundary that makes the event operationally relevant. Avoid logging the same failure at five layers on the way back up.",
  "Include operation name, stable IDs, attempt number, queue or resource name, and classification when those fields help incident response.",
  "Do not log expected domain rejection at error severity just because it returned Result. A rejected business command may be info, warn, or a client-visible response instead.",
  "Prefer structured fields over string-only logs when retries, queues, or distributed tracing are involved.",
  "If you return the error to another layer that will log it with more context, avoid eager log-and-return duplication.",
]

const contractRules = [
  "Expose only the error detail the caller can act on. Internal storage-driver text is rarely a good public API contract.",
  "Keep retryable versus terminal failure explicit somewhere visible. The caller should not infer it from a substring match in one message.",
  "Prefer small enums over giant catch-all error bags at layer boundaries. If a variant exists, it should mean something specific.",
  "If the public contract must stay stable across teams or languages, translate internal crates and variants at the boundary instead of leaking them.",
]

const productionPatterns = [
  "Start from caller action: retry, reject, dead-letter, map to status code, or crash. Then shape the error contract to support that action directly.",
  "Use typed enums for domain and infrastructure boundaries, then aggregate with anyhow or another richer wrapper only at the top-level orchestration layer when pattern matching stops being useful.",
  "Add context at IO, task, queue, and process boundaries. That is where a low-level failure becomes an operational event with a name.",
  "Treat JoinHandle<Result<T, E>> and FFI status translation as explicit two-layer error boundaries, not as incidental mechanics.",
  "Log once with enough structure to debug the incident later, and keep stable IDs flowing through the error path from request or task submission to durable completion.",
]

const pitfalls = [
  "Returning anyhow::Error from deep domain code because it felt faster. That usually erases caller action and leaves the next layer matching on text.",
  "Using panic for malformed input, missing rows, timeout, or other ordinary failure just because another language used exceptions there.",
  "Logging every error at every layer, then drowning the incident channel in five copies of the same failure with slightly different wording.",
  "Ignoring the join layer in async task failure and only handling the inner Result. A panicked or cancelled task is not the same event as a typed business or adapter error.",
  "Exporting Rust-shaped errors over FFI or public contracts and discovering too late that another runtime cannot safely consume or stabilize them.",
]

const summaryPoints = [
  "Option is for local absence; Result is for actionable failure; panic is for broken invariants or unrecoverable process state.",
  "Typed error enums keep domain and infrastructure failures distinct enough for callers to react honestly.",
  "thiserror is usually the right tool for typed boundary contracts; anyhow is usually the right tool for top-level orchestration context.",
  "Async task joins, FFI wrappers, brokers, and HTTP APIs are translation boundaries that deserve explicit error contracts.",
  "Good large-system error handling logs with structure, preserves source context, and exposes only the contract the next layer can actually use.",
]

export function PageCh41ErrorHandlingInLargeSystems() {
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
  const pageIndex = getPageIndexById("ch41-error-handling-in-large-systems")
  const chapter16PageIndex = getPageIndexById("ch16-domain-driven-design-in-rust")
  const chapter17PageIndex = getPageIndexById("ch17-refactoring-toward-idiomatic-rust")
  const chapter24PageIndex = getPageIndexById("ch24-coroutines-futures-and-async-rust")
  const chapter28PageIndex = getPageIndexById("ch28-cpp-integration")
  const chapter30PageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const chapter40PageIndex = getPageIndexById("ch40-matrix-optimization-games")
  const exercisesPageIndex = getPageIndexById("ch41-error-handling-in-large-systems-exercises")
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
          Chapter 41 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          In a system with many layers, error handling stops being about formatting one message and becomes interface
          design. This chapter treats Rust errors as production contracts: how to keep domain failures, infrastructure
          failures, retry policy, and operator context distinct, and how to translate between them only where the meaning
          actually changes.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 16, 17, 24, 28, 30, and 40</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 16 established domain invariants and domain errors. Chapter 17 introduced Result-first refactoring.
                Chapter 24 explained async state machines and await boundaries. Chapter 28 covered FFI translation. Chapter
                30 covered retries and dead-letter policy at broker boundaries. Chapter 40 is the concrete reminder that
                even a specialist numeric subsystem fails in ways a caller must act on: a singular matrix or a
                non-converging solve is a typed Result the caller can fall back from, not a panic, and that is the same
                contract thinking this chapter applies across every boundary.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter16PageIndex)}>
                Chapter 16
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter17PageIndex)}>
                Chapter 17
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter24PageIndex)}>
                Chapter 24
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter28PageIndex)}>
                Chapter 28
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter30PageIndex)}>
                Chapter 30
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter40PageIndex)}>
                Chapter 40
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Picture a multi-tenant billing platform. A request arrives over HTTP, the service publishes some internal work
            to a broker, it calls a native risk-scoring plugin over a C ABI, and it fans out a handful of async enrichment
            tasks before answering. A single charge can therefore fail in five different vocabularies at once: a business
            rule can reject it, a database row can be missing, the broker can be unreachable, the native plugin can return
            a status code, and a spawned task can panic. The job of this chapter is to keep those vocabularies from
            bleeding into each other.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-6">
            The requirement the team agrees on is one error policy per boundary. Domain errors stay in domain language and
            never mention SQL or TCP. Infrastructure errors stay actionable so a caller can retry or dead-letter. Retries
            are classified explicitly rather than guessed from a message. And every failure is logged exactly once, at the
            layer where it becomes operationally meaningful, with stable identifiers an operator can correlate later. The
            diagram below shows where those translation boundaries sit.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Client -->|HTTP| Handler\n  Handler --> Service\n  Service --> Domain[domain rules]\n  Service --> Store[(database)]\n  Service --> Broker[[message broker]]\n  Service --> Plugin[native risk plugin]\n  Service --> Tasks[async enrichment]`}
            caption="Request path: one charge fans out from the service into five dependencies, each speaking its own vocabulary."
          />
          <p className="text-sm text-muted-foreground leading-6">
            Each of those five dependencies can fail differently. The return path collapses those failures back into a
            single caller-facing contract:
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Domain[domain rules] -->|domain error| Service\n  Store[(database)] -->|infra error| Service\n  Broker[[message broker]] -->|infra error| Service\n  Plugin[native risk plugin] -->|status code| Service\n  Tasks[async enrichment] -->|join + inner| Service\n  Service -->|one translated error| Handler\n  Handler -->|status code + log once| Client`}
            caption="Return path: the service is the single seam where five vocabularies are translated into one caller-facing contract and logged once."
          />
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Ask what the caller can still do: retry, reject, translate, or crash.</li>
              <li>Keep Option local unless absence itself has become a contract violation.</li>
              <li>Keep typed errors close to the layer that still understands them.</li>
              <li>Add context at IO, task, queue, and FFI boundaries where meaning changes.</li>
              <li>Log once, with structure, at the boundary that makes the event operationally relevant.</li>
            </ol>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The in-browser editors simulate output so you can focus on contract shape. In a real Cargo project, the
              worked examples use ecosystem crates such as <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">thiserror</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">anyhow</code>, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">tokio</code>.
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Choose Option, Result, or panic from the caller&apos;s next action, not from style preference.</li>
              <li>Keep domain errors, infrastructure errors, and transport-facing errors distinct until the contract truly changes.</li>
              <li>Add context where meaning changes: IO, task joins, queues, FFI, and process boundaries.</li>
              <li>Log once at the boundary that makes the event operationally meaningful.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Caller-action checklist</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Should the caller retry, reject, translate, dead-letter, or crash?</li>
              <li>Does the next layer still need typed classification, or is rich top-level context enough?</li>
              <li>Is this failure local absence, recoverable error, or broken invariant?</li>
              <li>Which stable IDs must travel with the error so an operator can reconstruct the incident later?</li>
            </ul>
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

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How to think about this coming from another language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Most senior engineers do not arrive at Rust error handling with a blank slate; they arrive with an exception
            habit, a runtime habit, or an err-string habit. The shift that matters is not which crate to import. It is
            where failure becomes visible and who is responsible for deciding what happens next. Find your background
            below and read the trap as much as the rule.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                <div className="font-semibold text-foreground mb-2">{comparison.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Choosing between Option, Result, and a typed enum</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              These three are not interchangeable styles; they encode three different statements about a failure. An{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Option</code> says a value may simply be
              absent and that absence is unremarkable. A{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result</code> says the operation can
              fail in a way the caller is expected to handle. A typed error enum goes one step further and says the caller
              may need to tell those failures apart. The common repair in real code is to keep an Option local and promote
              it into a typed Result at exactly the boundary where missing data stops being routine and becomes a contract
              violation.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {resultOptionCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A reliable large-system rule is simple: if the caller needs classification, use a typed error. If the
                caller only needs one local branch on absence, Option is often enough. Promote absence into a typed Result
                exactly where the contract becomes meaningful.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">When to reach for thiserror and when to reach for anyhow</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              These two crates are not competitors; they answer different questions and most production systems use both.
              The deciding factor is whether a downstream layer still needs to branch on the error. If it does, you want a
              named enum with named variants, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">thiserror</code> generates the tedious{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Display</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">From</code> boilerplate while keeping the
              structure intact. If the only remaining job is to attach context and surface or log the failure, a single
              opaque <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">anyhow::Error</code> with a rich
              context chain is lighter and just as honest.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {crateCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                This is the usual operational split: typed enums when a downstream layer still branches on the error, rich
                context wrappers when the boundary is already top-level orchestration and the next action is mostly logging,
                surfacing, or exiting.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Adding context without burying the source</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Context is the answer to the question an operator will ask at 3 a.m.: what was the system trying to do when
              this failed? A low-level error like &quot;file not found&quot; is true but useless on its own; wrapped with
              &quot;loading worker config&quot; it becomes diagnosable. The discipline is to add context at the moments
              where meaning changes and to add it once, never re-stating the same low-level text at every frame on the way
              up.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {contextNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Recoverable versus unrecoverable failures</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The dividing line is not how serious the failure feels; it is whether any caller, anywhere up the stack, has
              a sensible response. Bad input, a rejected business action, or one flaky dependency all have responses, so
              they belong in a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result</code>. A
              violated invariant has no sensible response because the program is now in a state it was designed never to
              reach, and that is the narrow place a panic is correct. The decision usually flows like this.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  A[A call can fail] --> B{Is absence just normal?}\n  B -->|yes| C[Option]\n  B -->|no| D{Can any caller respond?}\n  D -->|retry / reject / translate| E[Result with typed error]\n  D -->|nothing sensible to do| F{Is a program invariant broken?}\n  F -->|yes| G[panic]\n  F -->|no| E`}
              caption="Route by the caller's options, not by how alarming the failure sounds. Panic is the dead end reserved for broken invariants."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {recoverabilityCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A panic is not Rust's version of a normal business exception. It is the language saying the program's own
                assumptions are broken badly enough that continuing may be wrong.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Errors that cross an async task boundary</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              When you spawn a task, you create two stacked failure layers, and a lot of bugs come from forgetting the
              outer one. The inner layer is whatever the task body returns: an IO error, a domain rejection, an{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">anyhow::Error</code>. The outer layer is
              the join result, which tells you whether the task even finished normally or instead panicked or was
              cancelled. A panicked task is a different operational event from a missing file, and collapsing them into one
              string hides exactly the distinction an operator needs. The snippet below is worth reading carefully: notice
              the two separate <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.context(...)</code>{" "}
              calls and the double <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">??</code> at the
              end, which unwraps the join layer first and then the inner layer.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {asyncBoundaryNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <MermaidDiagram
                  chart={`flowchart TD\n  Spawn[tokio spawn] --> Body[task body runs]\n  Body -->|inner result| Inner{Ok or Err}\n  Inner -->|Ok| Joined[returns to join]\n  Inner -->|Err: context loading manifest| Joined\n  Spawn --> Join{Join result}\n  Join -->|panic or cancel| JoinErr[context manifest task failed]\n  Join -->|finished| Joined\n  Joined -->|unwrap join then inner| Caller[caller sees one error]`}
                  caption="A spawned task has a join layer and an inner layer; the double ?? unwraps both, and each gets its own context."
                />
                <pre className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{asyncSnippet}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  The key lesson is that async failures usually have a task layer and an operation layer. Handle both
                  deliberately instead of collapsing them into one generic timeout or one generic string.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Errors that cross a C ABI boundary</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A C ABI cannot carry a Rust enum, an{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">anyhow::Error</code>, or the unwinding
              that a panic implies; letting any of those escape across the boundary is undefined behavior, not a missed
              opportunity for richness. So the boundary becomes a deliberate narrowing: the rich error stays on the Rust
              side, and the foreign caller receives the smallest contract it can actually honor, usually a small{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">#[repr(C)]</code> status enum plus
              out-parameters. In the code below, look at the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Status</code>{" "}
              enum: each variant is an integer the other runtime can switch on, and the detailed Rust reason never leaves
              the wrapper.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              One requirement is not optional: wrap the inner work in{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">std::panic::catch_unwind</code> and map a
              caught panic to a generic status code. If any inner function can panic, letting that unwind escape across the
              C ABI is undefined behavior, so the wrapper must catch it at the boundary and turn it into an ordinary
              status. The diagram shows that catch step explicitly.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {ffiNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <MermaidDiagram
                  chart={`flowchart TD\n  Rich["rich Rust error"] --> Wrap["extern C wrapper"]\n  Wrap -->|catch_unwind| Wrap\n  Wrap -->|map to integer| Status["repr C status enum"]\n  Wrap -->|fill out param| Out["out pointer"]\n  Status --> Foreign["C, C-sharp, Python caller"]\n  Out --> Foreign\n  Rich -.stays behind boundary.-> Wrap`}
                  caption="The detailed error stays on the Rust side; the foreign caller sees only a status code and out-parameters."
                />
                <pre className="mt-3 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{ffiSnippet}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  This is deliberately boring. That is a virtue. The richer Rust-side error chain should stay behind the
                  wrapper where another Rust layer can still use it safely.
                </p>
                <p className="mt-2 text-xs text-muted-foreground leading-5">
                  The <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">#[unsafe(no_mangle)]</code>{" "}
                  attribute-wrapper syntax assumes the Rust 2024 edition (rustc 1.82 or newer). On older toolchains,
                  write the bare <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">#[no_mangle]</code>{" "}
                  attribute instead.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Keeping domain errors and infrastructure errors apart</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              This is the single distinction that keeps a large error model from rotting. A domain error speaks the
              language of the business: an order is empty, a transition is invalid, a quota is exhausted. An infrastructure
              error speaks the language of the machinery: a row is missing, a connection was refused, a task join failed.
              The two stay separate as they travel up, and the service layer is the one place that combines them and
              decides how the next boundary should see the result, whether that is an HTTP status, a broker nack, or a CLI
              exit code. The layering looks like this.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  D[Domain layer] -->|domain error: empty order| S[Service layer]\n  I[Infrastructure layer] -->|infra error: row missing| S\n  S -->|classify + translate| T{Next boundary}\n  T --> Cont[continues below]`}
              caption="Domain and infrastructure errors stay distinct until the service layer, where classification becomes operational policy."
            />
            <p className="text-sm text-muted-foreground leading-6">
              From that single classify-and-translate point, the service shapes the failure for whichever boundary comes
              next:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  T{Next boundary} --> H[HTTP status]\n  T --> B[broker nack / dead-letter]\n  T --> C[CLI exit code]\n  T --> F[FFI status code]`}
              caption="The one classification point fans out into a per-boundary contract: HTTP status, broker nack, CLI exit code, or FFI status code."
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {layeringCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Logging a failure once, at the right layer</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The most common logging mistake in a layered system is not too little logging; it is the same failure logged
              five times on its way up, each line slightly reworded, until the incident channel is a hall of mirrors. The
              cure is to pick the one layer where the failure becomes operationally meaningful, log it there with
              structured fields, and let every layer below simply return the error. Severity should track the caller&apos;s
              reality too: a rejected business command is not an error-level event just because it came back as a{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Result</code>.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {loggingRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Designing the error contract you expose to callers</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              A public error contract is an API surface, and it ages like one. The discipline is to expose only what the
              caller can act on, to keep the retryable-versus-terminal distinction visible somewhere other than a substring
              of a message, and to resist the catch-all error bag that means nothing in particular. When the contract has
              to stay stable across teams or languages, translate your internal crates and variants at the boundary rather
              than leaking them, because once another runtime depends on a variant you can no longer freely rename it.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              {contractRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
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
                The hardest production mistake is often not one missing match arm. It is a failure contract that never said
                which layer owned retry, which layer owned translation, and which layer should have logged the incident only
                once.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Both editors simulate their output so you can focus on the shape of the contract rather than on toolchain
            setup. Read the short pointer and the diagram above each listing first, then run the code and try changing the
            inputs to see how the error path reshapes.
          </p>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 1: separate domain and infrastructure errors with typed contracts
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The service boundary preserves domain language for invalid business state and infrastructure language for
                  missing storage state, then translates both into one service-facing error enum.
                </p>
              </div>
              {codes.error_handling_typed_contracts !== DEFAULT_CODES.error_handling_typed_contracts && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("error_handling_typed_contracts")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: trace one charge through the function. The store lookup starts life as an{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Option</code>, gets promoted into an
              infrastructure error when the row is missing, while the empty-order check raises a domain error in business
              language. Both reach the service layer, which folds them into a single service-facing enum without erasing
              which layer actually failed. The flow is below; the code follows.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Lookup[store.get order] -->|Some| Check{order has lines?}\n  Lookup -->|None: ok_or| Infra[infra error: not found]\n  Check -->|no| Domain[domain error: empty order]\n  Check -->|yes| Total[compute total]\n  Infra --> Service[service error enum]\n  Domain --> Service\n  Total -->|Ok 4200| Caller[caller]\n  Service -->|preserves source layer| Caller`}
              caption="Absence becomes an infra error; an invalid order becomes a domain error; the service enum carries both without losing which layer failed."
            />
            <RustCodeEditor
              code={codes.error_handling_typed_contracts}
              onChange={(newCode) => updateCode("error_handling_typed_contracts", newCode)}
              onRun={() => runCode("error_handling_typed_contracts")}
              output={outputs.error_handling_typed_contracts ?? null}
              isRunning={isRunning === "error_handling_typed_contracts"}
              filename="domain_and_infrastructure_errors.rs"
              expectedOutput={
                "ok = 4200\nmissing = order ord-missing not found in store\nempty = order ord-empty has no lines"
              }
              showResultComparison={true}
              originalCode={DEFAULT_CODES.error_handling_typed_contracts}
              onRevert={() => resetCode("error_handling_typed_contracts")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Result and Option</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The store lookup is locally an Option, then promoted into a typed infrastructure error at the service
                  boundary.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Typed enums</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Domain and infrastructure failures stay distinct enough that the next layer can still map or retry them
                  honestly.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Contract design</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The caller sees one service error type, but the error chain still preserves which layer actually failed.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: add context across async boundaries without losing the source error
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The top-level async path uses anyhow for orchestration context, while the underlying IO error still
                  survives inside the chain. The spawned task boundary is handled explicitly.
                </p>
              </div>
              {codes.error_handling_async_context !== DEFAULT_CODES.error_handling_async_context && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("error_handling_async_context")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: there are two paths through this code. The manifest path succeeds and returns{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">ready</code>. The lockfile path fails at
              the IO layer with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">missing blob</code>,
              and the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.context(&quot;loading
              lockfile&quot;)</code> call wraps it so the final message reads as a chain rather than a bare cause. Notice
              the original IO reason is still visible at the tail; context adds meaning, it does not replace the source.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Run[run async path] --> M[load manifest]\n  Run --> L[load lockfile]\n  M -->|Ok| MOut[manifest = ready]\n  L -->|Err: missing blob| Ctx[context: loading lockfile]\n  Ctx -->|wraps, keeps source| Out[loading lockfile: missing blob]\n  MOut --> Caller[caller]\n  Out --> Caller`}
              caption="The success path returns a value; the failure path attaches operation context while the underlying IO reason survives in the chain."
            />
            <RustCodeEditor
              code={codes.error_handling_async_context}
              onChange={(newCode) => updateCode("error_handling_async_context", newCode)}
              onRun={() => runCode("error_handling_async_context")}
              output={outputs.error_handling_async_context ?? null}
              isRunning={isRunning === "error_handling_async_context"}
              filename="async_context_propagation.rs"
              expectedOutput={"manifest = ready\nfailed = loading lockfile: missing blob"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.error_handling_async_context}
              onRevert={() => resetCode("error_handling_async_context")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">anyhow</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The application shell can keep one rich error channel because the next action is mostly context, logging,
                  and exit or translation.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Task boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The join layer and the inner operation layer are both visible, so a panicked task would not be confused
                  with a missing artifact.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Context chain</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The context tells operators which operation failed without replacing the underlying IO reason.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch41_error_handling_in_large_systems/
              </code>{" "}
              including a small FFI status-boundary example alongside the two in-browser worked examples.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to convert panic-based logic into typed errors, separate domain and
            infrastructure failures, add context across async boundaries, and design one error contract that survives
            queues, FFI, and public APIs.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 41 Exercises
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

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
    title: "Errors are contracts between layers, not strings for later archaeology",
    body: "A good Rust error design tells the caller what failed, what kind of failure it was, and what action still makes sense. In a large system, that contract matters more than the formatting of one message.",
  },
  {
    title: "Choose the error shape from the caller's needs",
    body: "Use Option when local absence is normal and the caller only needs branch control. Use Result when the caller can retry, map, classify, log, or surface the failure. Use panic only for violated invariants or unrecoverable process state.",
  },
  {
    title: "Every boundary adds translation pressure",
    body: "Async tasks, brokers, FFI, HTTP, and storage adapters all want errors shaped a little differently. Rust is calmest when each layer keeps its own error type and only translates at the boundary that actually changes the contract.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Rust does not use exceptions as the ordinary systems-programming control path. Result<T, E> is explicit in the signature, so recoverability, retry, and translation decisions stay visible instead of being hidden in unwind behavior.",
  },
  {
    title: "C# background",
    body: "Think less in terms of one ambient exception hierarchy and more in terms of layer-specific contracts. A domain rule violation, a timeout, and a task join failure are different operational events and should usually stay different in Rust.",
  },
  {
    title: "Go background",
    body: "Rust overlaps with Go by making normal failure explicit in return values, but it pushes harder on typed classification. Instead of a growing pile of wrapped strings, a senior Rust codebase usually keeps richer enums close to the layer that can still act on them.",
  },
]

const resultOptionCards = [
  {
    title: "Result and Option",
    body: "Option models ordinary absence. Result models actionable failure. The common repair is to keep Option local, then promote it to Result at the boundary where missing data stops being routine and starts being a contract violation.",
    code: `let raw = ports.get(service);
let port = raw.ok_or(StoreError::MissingService { service: service.into() })?;`,
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
          Large systems need error contracts that separate domain failures, infrastructure failures, retry policy, and
          operator context. This chapter covers Rust error handling as a production interface.
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
                30 covered retries and dead-letter policy at broker boundaries. Chapter 40 reminded us that even specialist
                subsystems still need clear operational contracts when they fail.
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
            A multi-tenant billing platform accepts HTTP requests, publishes internal work, calls a native risk plugin,
            and fans out async enrichment tasks. The business requirement is one error policy per boundary: domain errors
            remain domain language, infrastructure errors remain actionable, retries are classified, and operator context
            is logged once with stable identifiers.
          </p>
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

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Result and Option; error enums</h4>
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
            <h4 className="font-semibold text-foreground mb-3">thiserror and anyhow</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Context propagation</h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {contextNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Recoverable vs unrecoverable errors</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Error handling across async boundaries</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {asyncBoundaryNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{asyncSnippet}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  The key lesson is that async failures often have a transport layer and a task layer. Handle both
                  deliberately instead of collapsing them into one generic timeout or one generic string.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Error handling across FFI</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {ffiNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{ffiSnippet}</code>
                </pre>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  This is deliberately boring. That is a virtue. The richer Rust-side error chain should stay behind the
                  wrapper where another Rust layer can still use it safely.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Domain errors vs infrastructure errors</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Logging errors correctly</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {loggingRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Designing error contracts</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {contractRules.map((rule) => (
                <div key={rule} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{rule}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
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

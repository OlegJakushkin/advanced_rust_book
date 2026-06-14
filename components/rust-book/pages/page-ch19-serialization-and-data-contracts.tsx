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
    title: "Serialization is a boundary contract, not a dump of your in-memory structs",
    body: "A wire format answers a boundary question: what must another process, language, file, or browser observe? That is often narrower and more stable than the full Rust domain model.",
  },
  {
    title: "Serde derives remove boilerplate, but they do not remove design choices",
    body: "The traits are easy to derive. The hard part is choosing field names, optionality, defaults, version markers, and which parts of the model may evolve without breaking old readers.",
  },
  {
    title: "Version tolerance is mostly about restraint",
    body: "Additive changes, explicit defaults, stable field names, and clear envelopes age better than clever schema tricks. The safest contract is usually the most boring one.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Think less about raw layout dumping and more about stable contracts. Rust can serialize rich types ergonomically, but a network or storage boundary still wants an explicit schema story rather than ambient struct layout.",
  },
  {
    title: "C# background",
    body: "If you are used to attribute-driven data contracts, Serde will feel familiar. The important Rust correction is that ownership and borrowing still matter at the boundary, especially for zero-copy reads and long-lived stored values.",
  },
  {
    title: "Go background",
    body: "Go makes JSON structs easy to ship quickly. Rust asks one more question: which data is wire-facing, which data is domain-facing, and where should the owned handoff happen after parsing finishes?",
  },
]

const formatCards = [
  {
    title: "JSON",
    body: "Best when humans, APIs, logs, and debugging matter more than payload size. Verbose, but operationally easy to inspect and diff.",
  },
  {
    title: "YAML",
    body: "Useful for operator-facing configuration and hand-edited documents. Powerful, but easy to make ambiguous or whitespace-sensitive.",
  },
  {
    title: "TOML",
    body: "A strong fit for configuration with a calmer data model than YAML. Less attractive as a general event stream format.",
  },
  {
    title: "MessagePack",
    body: "A compact binary cousin of JSON-like data. Good when the structure stays document-oriented but text overhead is too large.",
  },
  {
    title: "CBOR",
    body: "A self-describing binary format with good Serde support. Often attractive for control planes, edge devices, and structured binary payloads.",
  },
]

const binaryFormatCards = [
  {
    title: "Rust-centric compact binaries",
    body: "Formats such as bincode- or postcard-style encodings can be very compact and fast inside controlled Rust systems, but they need extra care when long-term or cross-language compatibility matters.",
  },
  {
    title: "Schema-first binaries",
    body: "Protocol Buffers, FlatBuffers, and similar formats trade some convenience for stronger explicit contracts across languages and services.",
  },
  {
    title: "Archive and zero-copy formats",
    body: "rkyv-style archived representations can be excellent for in-process caches, memory-mapped data, and read-heavy workloads, but they raise the bar on layout and evolution discipline.",
  },
]

const evolutionCards = [
  {
    title: "Add fields with defaults",
    body: "New optional fields age better than changing the meaning of old required fields. `#[serde(default)]` is a practical compatibility tool.",
  },
  {
    title: "Rename with aliases, then remove later",
    body: "If a field name must change, keep the reader tolerant first. Aliases are often cheaper than forcing every old producer to move at once.",
  },
  {
    title: "Version the envelope, not only your deployment notes",
    body: "A `schema_version` or explicit event type envelope makes compatibility visible to code, logs, and tests.",
  },
  {
    title: "Keep wire DTOs separate when the domain must move faster",
    body: "A dedicated wire type prevents transport concerns from distorting the domain model or leaking deprecated fields deep into business code.",
  },
]

const zeroCopyCards = [
  {
    title: "Borrow from the input buffer when the lifetime is truly local",
    body: "Serde can deserialize borrowed `&str`, `&[u8]`, or `Cow<'de, str>` from formats that support borrowing. This is strongest when the input buffer clearly outlives the parsed view.",
  },
  {
    title: "Own before queue, cache, async, or retry boundaries",
    body: "A borrowed view is often perfect for parse-time validation and normalization. It is usually the wrong shape for a job that crosses threads, tasks, or storage boundaries.",
  },
  {
    title: "Zero-copy is a boundary optimization, not a religion",
    body: "If borrowing makes the whole subsystem lifetime-heavy, a small owned conversion at the boundary is often cheaper than carrying lifetime complexity everywhere.",
  },
]

const distributedPatterns = [
  "Use explicit envelopes for domain events and commands: event kind, schema version, IDs, timestamps, and payload.",
  "Treat wire DTOs as contracts. Do not let internal enum reshaping silently redefine the protocol.",
  "Add compatibility tests with sample payloads from old producers and new readers before changing the contract in production.",
  "Prefer deterministic field names and explicit units such as cents, milliseconds, or UTC timestamps.",
  "Log serialization failures with enough context to identify the contract, version, and offending message without dumping sensitive payloads blindly.",
]

const wasmFfiCards = [
  {
    title: "WASM boundaries",
    body: "At the browser edge, you usually choose between structured JS-value translation and text or binary payloads. The right question is which boundary is easiest for JavaScript to consume and for Rust to validate.",
  },
  {
    title: "FFI boundaries",
    body: "Do not serialize raw Rust memory layout across a C ABI boundary by accident. Prefer explicit byte buffers, explicit lengths, or `repr(C)` types when the ABI contract is fixed and simple.",
  },
  {
    title: "Boundary honesty",
    body: "If the foreign side wants bytes, give it bytes with a documented format. If it wants a stable ABI struct, give it a stable ABI struct. Do not make one mechanism pretend to be the other.",
  },
]

const productionPatterns = [
  "Keep a stable wire contract separate from the richer internal domain model when evolution pressure differs across those layers.",
  "Prefer additive evolution: optional fields, defaults, aliases, and explicit envelopes are calmer than hard breaking changes.",
  "Use custom serializers for boundary-specific concerns such as money strings, compact IDs, or timestamp normalization instead of distorting the internal model.",
  "Reserve zero-copy deserialization for local parse-time boundaries where the borrowed lifetime is actually helpful and contained.",
  "For distributed systems, make compatibility part of CI with golden payloads, downgrade tests, and round-trip tests on representative messages.",
]

const pitfalls = [
  "Deriving `Serialize` and `Deserialize` directly on every domain struct and calling that the contract. It often freezes transport concerns into the wrong layer.",
  "Changing field meaning in place instead of adding a new field or a new envelope version.",
  "Returning borrowed deserialized views from async or queue-facing code and then fighting lifetime errors that are really ownership errors.",
  "Choosing a compact binary format because it benchmarks well locally while ignoring cross-language readers, debugging cost, or incident response needs.",
  "Treating JSON as the default for every boundary, including FFI and high-rate internal messages where another format or a raw byte contract is the better fit.",
  "Assuming zero-copy deserialization is universally available or automatically faster once the whole system cost is counted.",
]

export function PageCh19SerializationAndDataContracts() {
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
  const pageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter08PageIndex = getPageIndexById("ch08-undefined-behavior-and-unsafe-rust")
  const chapter14PageIndex = getPageIndexById("ch14-interfaces-in-rust-traits")
  const chapter16PageIndex = getPageIndexById("ch16-domain-driven-design-in-rust")
  const chapter18PageIndex = getPageIndexById("ch18-generics-instead-of-templates")
  const exercisesPageIndex = getPageIndexById("ch19-serialization-and-data-contracts-exercises")
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
          Chapter 19 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Serialization defines the contract between Rust services, files, queues, and external clients. This chapter
          covers versioned payloads, schema ownership, compatibility, and explicit transport boundaries.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 08, 14, 16, and 18</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 08 established FFI and unsafe boundary discipline. Chapter 14 covered traits, which matter because
                Serde is trait-driven. Chapter 16 gave us domain events and aggregates worth serializing. Chapter 18 covered
                generics and associated types, which help explain why transport wrappers and wire DTOs stay composable.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter08PageIndex)}>
                Chapter 08
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter14PageIndex)}>
                Chapter 14
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter16PageIndex)}>
                Chapter 16
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter18PageIndex)}>
                Chapter 18
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            An order system publishes events to a public API, an internal event stream, a browser-facing module, and a
            native integration boundary. The business requirement is a separate data contract for each consumer, with
            explicit format choice, schema versioning, owned handoff rules, and compatibility tests for mixed deployments.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">Repository note</h4>
            <p className="text-sm text-muted-foreground leading-6">
              The in-browser editor simulates output so you can focus on contract shape. In a real Cargo project, these
              examples assume Serde plus the chosen format crate such as <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">serde_json</code>,
              a YAML/TOML adapter, or a binary format adapter.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">Serde fundamentals</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Serde gives Rust a pair of core traits: <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Serialize</code>{" "}
                  and <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Deserialize</code>. Derive macros
                  remove boilerplate, but the design still lives in field names, tagging strategy, defaults, borrowing, and
                  which model is even allowed to cross the boundary.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`#[derive(Serialize, Deserialize)]
struct Envelope<T> {
    schema_version: u16,
    payload: T,
}`}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A strong default is to separate internal domain types from wire-facing DTOs when evolution pressure differs.
                  Your aggregate may want one shape. Your public event or API contract may want another. Serde makes the
                  conversion pleasant, which means you do not need to force one type to do both jobs badly.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">JSON, YAML, TOML, MessagePack, and CBOR</h4>
            <div className="grid gap-4 lg:grid-cols-5">
              {formatCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The useful decision is not “which format is best?” It is “which format fits this boundary’s human-readability,
                payload size, compatibility, and debugging needs?” A public API and an internal control-plane message do not
                have to make the same trade.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Binary serialization formats</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {binaryFormatCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Schema evolution</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {evolutionCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A compatibility break is not only a code change. It is a deployment coordination problem. Make the version
                boundary visible in data, tests, and logs before a mixed producer-consumer rollout forces emergency repair.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Version-tolerant models</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Version tolerance is usually about reader discipline. Readers should survive additive fields, tolerate
                  missing optional fields with defaults, and keep deprecated aliases around long enough to drain old
                  producers safely.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A practical pattern is this: internal domain type on one side, wire DTO on the other, plus explicit
                  conversion. That makes compatibility work visible and prevents one old wire compromise from contaminating
                  the core model forever.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Custom serializers and deserializers</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Custom serializers are for boundary-specific representation: money as decimal text, compact IDs, legacy
                  booleans, or normalized timestamps. The goal is to keep the internal model honest while still meeting an
                  external contract.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`#[serde(
    serialize_with = "cents_as_decimal",
    deserialize_with = "decimal_as_cents"
)]
amount_cents: u64,`}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Custom logic belongs at the edge. Do not store a decimal money string in the domain only because one API
                  contract needed it. Keep the internal unit cheap and precise, then translate at serialization time.
                </p>
                <p className="mt-3 text-sm text-muted-foreground leading-6">
                  Be careful with naive split-on-dot money parsing: it is a classic correctness trap. The fractional part
                  must be validated as exactly two digits, or scaled by its length, before being added to the whole part.
                  A reader that accepts <code className="px-1 rounded bg-muted font-mono text-xs">"12.5"</code> as 1205
                  cents has silently lost money.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Zero-copy deserialization</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {zeroCopyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The operational rule is simple. Borrow while parsing if that reduces copying locally. Own the data once the
                message crosses a wider subsystem boundary.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Serialization for distributed systems</h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {distributedPatterns.map((pattern) => (
                <div key={pattern} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{pattern}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Serialization for WASM and FFI boundaries</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {wasmFfiCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">prior instincts that help and mislead</h4>
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
                The most expensive serialization bug is often not a parser crash. It is a silent contract drift between
                producer and consumer that still compiles, still deploys, and only breaks when mixed versions meet.
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
                <h4 className="font-semibold text-foreground">Example 1: a versioned domain event envelope</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The envelope carries explicit versioning, and the event payload stays tagged so readers can tell what
                  happened without guessing from field shape.
                </p>
              </div>
              {codes.serialization_contracts_versioned_event !== DEFAULT_CODES.serialization_contracts_versioned_event && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("serialization_contracts_versioned_event")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.serialization_contracts_versioned_event}
              onChange={(newCode) => updateCode("serialization_contracts_versioned_event", newCode)}
              onRun={() => runCode("serialization_contracts_versioned_event")}
              output={outputs.serialization_contracts_versioned_event ?? null}
              isRunning={isRunning === "serialization_contracts_versioned_event"}
              filename="versioned_domain_event.rs"
              expectedOutput={"schema = 2\nkind = created\ntotal cents = 4200"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.serialization_contracts_versioned_event}
              onRevert={() => resetCode("serialization_contracts_versioned_event")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Envelope</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">schema_version</code> and event ID
                  make the contract visible to code and logs.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tagged enum</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The payload declares its kind explicitly instead of forcing consumers to infer it from a field pattern.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Version tolerance</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Optional envelope fields can be added with defaults without destabilizing older readers immediately.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: custom money format plus borrowed fields</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The wire format wants decimal text. The internal model wants cents. The deserialized view borrows request
                  text until the boundary decides whether ownership is needed.
                </p>
              </div>
              {codes.serialization_contracts_custom_zero_copy !== DEFAULT_CODES.serialization_contracts_custom_zero_copy && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("serialization_contracts_custom_zero_copy")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.serialization_contracts_custom_zero_copy}
              onChange={(newCode) => updateCode("serialization_contracts_custom_zero_copy", newCode)}
              onRun={() => runCode("serialization_contracts_custom_zero_copy")}
              output={outputs.serialization_contracts_custom_zero_copy ?? null}
              isRunning={isRunning === "serialization_contracts_custom_zero_copy"}
              filename="custom_serializer_and_zero_copy.rs"
              expectedOutput={"request = req-7\nroute = /checkout\namount cents = 1250"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.serialization_contracts_custom_zero_copy}
              onRevert={() => resetCode("serialization_contracts_custom_zero_copy")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Custom serializer</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The boundary gets decimal text without forcing the domain to store money as strings.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Borrowed view</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The request ID and route can borrow from the input buffer while parsing stays local.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Boundary choice</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The next subsystem can still choose to own the fields before queueing or storing the event.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch19_serialization_and_data_contracts/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to round-trip a versioned domain event, add a custom Serde serializer,
            design a zero-copy parse boundary, and choose different contracts for distributed systems, WASM, and FFI edges.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 19 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Serde removes boilerplate, but the real work is still contract design.</li>
            <li>JSON, YAML, TOML, MessagePack, CBOR, and binary formats make different tradeoffs across readability, size, and interoperability.</li>
            <li>Schema evolution is easiest when you prefer additive changes, defaults, aliases, and explicit envelopes.</li>
            <li>Custom serializers protect the internal model from transport-specific compromises.</li>
            <li>Zero-copy deserialization is useful at local parse boundaries, but owned handoff is usually better at wider system boundaries.</li>
            <li>WASM and FFI edges need explicit contracts just as much as distributed systems do, even when the transport is not a network protocol.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
````

### File: `components/rust-book/pages/page-ch19-serialization-and-data-contracts-exercises.tsx`
```tsx
"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
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
    title: "Separate the domain model from the wire contract",
    objective: "Practice deciding which fields belong in a stable transport DTO and which belong only in the internal Rust model.",
    starterPrompt:
      "An order service has an internal aggregate with inventory state, pricing rules, and retry metadata, but it publishes only an order-created event to other services.",
    prompts: [
      "Which fields belong in the event contract and which should stay internal?",
      "Which fields need stable names and explicit units at the wire boundary?",
      "What would you version in the envelope rather than only in code comments?",
    ],
    acceptanceCriteria: [
      "You keep transport-facing fields narrower than the full aggregate.",
      "You name at least one field that should stay internal to the service.",
      "You explain why a schema version or explicit event kind belongs in the contract.",
    ],
    hints: [
      "The wire contract is for consumers, not for reproducing your full aggregate internals.",
      "A good answer treats the DTO as a public promise.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read a schema evolution change like a rollout reviewer",
    objective: "Explain whether a contract change is additive, risky, or breaking and how to stage it safely.",
    starterPrompt:
      "Review three changes: adding `trace_id: Option<String>`, renaming `customer` to `customer_id`, and changing `total_cents: u64` into a decimal string field.",
    prompts: [
      "Which change is additive and easiest to tolerate with defaults?",
      "Which rename wants aliases or a staged migration path?",
      "Which representation change is the riskiest because it redefines field meaning?",
    ],
    acceptanceCriteria: [
      "You classify additive versus breaking changes clearly.",
      "You propose at least one compatibility tactic such as defaults, aliases, or a new field name.",
      "You explain one rollout or mixed-version risk concretely.",
    ],
    hints: [
      "Changing a field's meaning is usually more dangerous than adding a new optional field.",
      "Think about mixed producers and consumers, not only one codebase at one revision.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Round-trip a versioned domain event",
    objective: "Implement a small tagged event envelope that serializes and deserializes cleanly.",
    starterPrompt:
      "Define an envelope with `schema_version` and a tagged payload enum, then serialize and deserialize an `OrderEvent::Created` value.",
    prompts: [
      "Use a tagged enum for the payload kind.",
      "Keep the schema version explicit on the envelope.",
      "Print the decoded version, kind, and total.",
    ],
    acceptanceCriteria: [
      "The event is serializable and deserializable through Serde.",
      "The contract contains an explicit version field.",
      "The runnable lab prints the expected version, kind, and total.",
    ],
    hints: [
      "This exercise is about contract shape first, not clever parsing.",
      "A tagged enum is often the calmest event model for a closed event set.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Add a custom Serde serializer without warping the domain",
    objective: "Represent a boundary-specific wire shape while keeping the internal Rust type honest.",
    starterPrompt:
      "A partner API wants money as decimal text such as `\"12.50\"`, but your domain model stores cents as `u64`. Add a custom serializer and deserializer.",
    prompts: [
      "Where should the conversion logic live?",
      "Why is a custom Serde hook better than storing decimal strings in the aggregate?",
      "How would you test the round-trip and malformed-input paths?",
    ],
    acceptanceCriteria: [
      "You keep the internal field as cents or another precise domain-safe type.",
      "You describe a custom serializer or deserializer boundary clearly.",
      "You mention both round-trip tests and invalid-input tests.",
    ],
    hints: [
      "Transport representation and domain representation are allowed to differ.",
      "The serializer is where that difference becomes explicit.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Design a zero-copy deserialization boundary",
    objective: "Choose where borrowed fields are useful and where ownership must take over.",
    starterPrompt:
      "A request parser reads JSON from a network buffer, validates fields, and then sends work to an async queue.",
    prompts: [
      "Which parse-time struct could borrow from the buffer with `&str` or `Cow<'a, str>`?",
      "At which point should the validated message become fully owned?",
      "Why is returning the borrowed parse view across the async queue usually the wrong model?",
    ],
    acceptanceCriteria: [
      "You use borrowing for a local parse or validation view only where the owner is clear and nearby.",
      "You choose an owned handoff before the queue or async boundary.",
      "You explain the tradeoff in ownership and lifetime terms, not only performance folklore.",
    ],
    hints: [
      "Zero-copy is strongest when the input buffer obviously outlives the parser view.",
      "Queues, retries, and tasks are ownership boundaries.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose a contract strategy for distributed systems, WASM, and FFI",
    objective: "Practice selecting a format and boundary model from the consumer's needs rather than from one default habit.",
    starterPrompt:
      "You must expose one event stream to other services, one config file to operators, one browser-facing boundary to WASM, and one C ABI boundary to a native library.",
    prompts: [
      "Which boundary wants a text format and which wants a compact binary or structured JS-value bridge?",
      "Which boundary should avoid Serde-driven bytes entirely and instead use an explicit ABI layout or byte buffer contract?",
      "What compatibility or observability tests would you require before rollout?",
    ],
    acceptanceCriteria: [
      "You choose at least two different contract strategies for different boundaries.",
      "You treat the FFI boundary as an ABI design problem, not merely as another JSON endpoint.",
      "You name at least one compatibility test and one observability hook such as sample payload replay, decode error metrics, or version-tag logging.",
    ],
    hints: [
      "Different consumers justify different contract shapes.",
      "A browser, another service, and a C library rarely want the same thing for the same reasons.",
    ],
  },
]

const reviewQuestions = [
  "What is the difference between deriving Serde traits and designing a stable data contract?",
  "Why are additive fields plus defaults often safer than in-place semantic changes?",
  "When should a wire DTO diverge from the internal domain model?",
  "What is the real ownership question behind zero-copy deserialization?",
  "Why is FFI usually an ABI problem before it is a serialization problem?",
]

const workingLoop = [
  "State the boundary first: file, API, event stream, browser bridge, or native ABI.",
  "Choose the wire shape second: field names, explicit versions, optionality, and units.",
  "Only then choose the format: JSON-like, config-like, compact binary, or explicit ABI bytes.",
  "If borrowing appears, name the owner that keeps the parsed view valid and the point where ownership must take over.",
]

export function PageCh19SerializationAndDataContractsExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 37
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 19 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice serialization the way it appears in production: versioned contracts, custom wire representations,
          zero-copy parse boundaries, and explicit decisions about which contract belongs on which edge.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a contract review. The best answer does not only say “Serde can do that.” It says
                which shape the boundary needs, how the contract evolves, and where ownership should change from borrowed
                parse views into stable owned values.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(36)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 19
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
                  Contract drill
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
          title="Runnable lab · Versioned event round-trip"
          description={
            <>
              Repair the starter so the event envelope is explicitly versioned, the payload is tagged with{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">kind</code>, and the created event
              round-trips with the expected total.
            </>
          }
          filename="versioned_event_lab.rs"
          runKey="ch19_ex_versioned_event"
          expectedOutput={"version = 2\nkind = created\ntotal cents = 4200"}
          helperText={
            <>
              Tip: the checker looks for an explicit schema version of{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">2</code>, a tagged payload enum, a JSON
              round-trip through <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">serde_json</code>, and
              the created event total of <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">4200</code>.
            </>
          }
          initialCode={`use serde::{Deserialize, Serialize};\n\n#[derive(Debug, Serialize, Deserialize)]\nenum OrderEvent {\n    Created {\n        order_id: String,\n        total_cents: u64,\n    },\n    Cancelled {\n        order_id: String,\n    },\n}\n\n#[derive(Debug, Serialize, Deserialize)]\nstruct EventEnvelope {\n    schema_version: u16,\n    payload: OrderEvent,\n}\n\nfn main() {\n    let envelope = EventEnvelope {\n        schema_version: 0,\n        payload: OrderEvent::Created {\n            order_id: String::from(\"ord-7\"),\n            total_cents: 0,\n        },\n    };\n\n    let json = serde_json::to_string(&envelope).unwrap();\n    let decoded: EventEnvelope = serde_json::from_str(&json).unwrap();\n\n    let (kind, total_cents) = match decoded.payload {\n        OrderEvent::Created { total_cents, .. } => (\"unknown\", total_cents),\n        OrderEvent::Cancelled { .. } => (\"cancelled\", 0),\n    };\n\n    println!(\"version = {}\", decoded.schema_version);\n    println!(\"kind = {}\", kind);\n    println!(\"total cents = {}\", total_cents);\n}`}
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
            By the end of this page, you should be able to defend a wire contract separately from the domain model, stage
            a schema change without hand-waving, apply a custom serializer at the edge, and decide clearly when borrowed
            parse views stop being helpful and owned data should take over.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch19_serialization_and_data_contracts/versioned_domain_event.rs`
````
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum OrderEvent {
    Created {
        order_id: String,
        customer_id: String,
        total_cents: u64,
    },
    Cancelled {
        order_id: String,
        reason: Option<String>,
    },
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
struct EventEnvelope {
    schema_version: u16,
    #[serde(default)]
    trace_id: Option<String>,
    event_id: String,
    payload: OrderEvent,
}

fn main() {
    let envelope = EventEnvelope {
        schema_version: 2,
        trace_id: None,
        event_id: String::from("evt-100"),
        payload: OrderEvent::Created {
            order_id: String::from("ord-7"),
            customer_id: String::from("cust-9"),
            total_cents: 4200,
        },
    };

    let json = serde_json::to_string(&envelope).unwrap();
    let decoded: EventEnvelope = serde_json::from_str(&json).unwrap();

    let kind = match &decoded.payload {
        OrderEvent::Created { .. } => "created",
        OrderEvent::Cancelled { .. } => "cancelled",
    };

    let total_cents = match decoded.payload {
        OrderEvent::Created { total_cents, .. } => total_cents,
        OrderEvent::Cancelled { .. } => 0,
    };

    println!("schema = {}", decoded.schema_version);
    println!("kind = {}", kind);
    println!("total cents = {}", total_cents);
}
````

### File: `examples/ch19_serialization_and_data_contracts/custom_serializer_and_zero_copy.rs`
````
use std::borrow::Cow;

use serde::{Deserialize, Deserializer, Serialize, Serializer};

fn cents_as_decimal<S>(value: &u64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    let text = format!("{}.{:02}", value / 100, value % 100);
    serializer.serialize_str(&text)
}

fn decimal_as_cents<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    let text = Cow::<str>::deserialize(deserializer)?;
    let (units, cents) = text
        .split_once('.')
        .ok_or_else(|| serde::de::Error::custom("expected decimal amount"))?;

    if cents.len() != 2 {
        return Err(serde::de::Error::custom(
            "expected exactly two fractional digits",
        ));
    }

    let whole = units.parse::<u64>().map_err(serde::de::Error::custom)?;
    let frac = cents.parse::<u64>().map_err(serde::de::Error::custom)?;

    Ok(whole * 100 + frac)
}

#[derive(Debug, Serialize, Deserialize)]
struct BorrowedAudit<'a> {
    #[serde(borrow)]
    request_id: &'a str,
    #[serde(borrow)]
    route: Cow<'a, str>,
    #[serde(
        serialize_with = "cents_as_decimal",
        deserialize_with = "decimal_as_cents"
    )]
    amount_cents: u64,
}

fn main() {
    let raw = "{\"request_id\":\"req-7\",\"route\":\"/checkout\",\"amount_cents\":\"12.50\"}";
    let audit: BorrowedAudit<'_> = serde_json::from_str(raw).unwrap();

    println!("request = {}", audit.request_id);
    println!("route = {}", audit.route);
    println!("amount cents = {}", audit.amount_cents);
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -31,4 +31,8 @@ export { PageCh15OopModelsInRust } from "./page-ch15-oop-models-in-rust"
 export { PageCh15OopModelsInRustExercises } from "./page-ch15-oop-models-in-rust-exercises"
 export { PageCh16DomainDrivenDesignInRust } from "./page-ch16-domain-driven-design-in-rust"
 export { PageCh16DomainDrivenDesignInRustExercises } from "./page-ch16-domain-driven-design-in-rust-exercises"
 export { PageCh17RefactoringTowardIdiomaticRust } from "./page-ch17-refactoring-toward-idiomatic-rust"
 export { PageCh17RefactoringTowardIdiomaticRustExercises } from "./page-ch17-refactoring-toward-idiomatic-rust-exercises"
+export { PageCh18GenericsInsteadOfTemplates } from "./page-ch18-generics-instead-of-templates"
+export { PageCh18GenericsInsteadOfTemplatesExercises } from "./page-ch18-generics-instead-of-templates-exercises"
+export { PageCh19SerializationAndDataContracts } from "./page-ch19-serialization-and-data-contracts"
+export { PageCh19SerializationAndDataContractsExercises } from "./page-ch19-serialization-and-data-contracts-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -43,6 +43,10 @@ import {
   PageCh16DomainDrivenDesignInRust,
   PageCh16DomainDrivenDesignInRustExercises,
   PageCh17RefactoringTowardIdiomaticRust,
   PageCh17RefactoringTowardIdiomaticRustExercises,
+  PageCh18GenericsInsteadOfTemplates,
+  PageCh18GenericsInsteadOfTemplatesExercises,
+  PageCh19SerializationAndDataContracts,
+  PageCh19SerializationAndDataContractsExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -78,6 +82,10 @@ const PAGE_COMPONENTS = [
   PageCh16DomainDrivenDesignInRust,
   PageCh16DomainDrivenDesignInRustExercises,
   PageCh17RefactoringTowardIdiomaticRust,
   PageCh17RefactoringTowardIdiomaticRustExercises,
+  PageCh18GenericsInsteadOfTemplates,
+  PageCh18GenericsInsteadOfTemplatesExercises,
+  PageCh19SerializationAndDataContracts,
+  PageCh19SerializationAndDataContractsExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,5 @@
+import { simulateCh19Output } from "./rust-simulator-ch19"
+import { simulateCh18Output } from "./rust-simulator-ch18"
 import { simulateCh17Output } from "./rust-simulator-ch17"
 import { simulateCh16Output } from "./rust-simulator-ch16"
 import { simulateCh15Output } from "./rust-simulator-ch15"
@@ -995,6 +997,12 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch19Output = simulateCh19Output(code, key)
+  if (ch19Output !== null) return ch19Output
+
+  const ch18Output = simulateCh18Output(code, key)
+  if (ch18Output !== null) return ch18Output
 
   const ch17Output = simulateCh17Output(code, key)
   if (ch17Output !== null) return ch17Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -7,6 +7,8 @@ import { DEFAULT_CODES_CH14 } from "./default-codes-ch14"
 import { DEFAULT_CODES_CH15 } from "./default-codes-ch15"
 import { DEFAULT_CODES_CH16 } from "./default-codes-ch16"
 import { DEFAULT_CODES_CH17 } from "./default-codes-ch17"
+import { DEFAULT_CODES_CH18 } from "./default-codes-ch18"
+import { DEFAULT_CODES_CH19 } from "./default-codes-ch19"
 
 export interface PageConfig {
   id: string
@@ -424,6 +426,34 @@ export const CHAPTERS: ChapterConfig[] = [
         description:
           "Refactor panic-based code into Result-based code, reduce lifetime noise, remove unnecessary clones, and improve test seams",
         icon: "trophy",
+      },
+    ],
+  },
+  {
+    id: "ch18-generics-instead-of-templates",
+    title: "Chapter 18 · Generics Instead of Templates",
+    icon: "book",
+    pages: [
+      {
+        id: "ch18-generics-instead-of-templates",
+        title: "Generics Instead of Templates",
+        shortTitle: "Generics",
+        description:
+          "Rust generics vs templates, monomorphization, trait bounds, where clauses, associated types, const generics, and performance tradeoffs",
+        icon: "book",
+        codeKeys: ["generics_batch_bounds", "generics_associated_types_const"],
+      },
+      {
+        id: "ch18-generics-instead-of-templates-exercises",
+        title: "Chapter 18 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Translate template-style helpers into Rust generics, simplify traits with associated types, and implement const-generic fixed-size types",
+        icon: "trophy",
+      },
+    ],
+  },
+  {
+    id: "ch19-serialization-and-data-contracts",
+    title: "Chapter 19 · Serialization and Data Contracts",
+    icon: "book",
+    pages: [
+      {
+        id: "ch19-serialization-and-data-contracts",
+        title: "Serialization and Data Contracts",
+        shortTitle: "Serialization",
+        description:
+          "Serde fundamentals, wire formats, schema evolution, custom serializers, zero-copy deserialization, and boundary contracts for distributed systems, WASM, and FFI",
+        icon: "book",
+        codeKeys: ["serialization_contracts_versioned_event", "serialization_contracts_custom_zero_copy"],
+      },
+      {
+        id: "ch19-serialization-and-data-contracts-exercises",
+        title: "Chapter 19 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Round-trip versioned events, add custom serializers, design zero-copy boundaries, and choose format strategies deliberately",
+        icon: "trophy",
       },
     ],
   },
@@ -860,5 +890,7 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH14,
   ...DEFAULT_CODES_CH15,
   ...DEFAULT_CODES_CH16,
   ...DEFAULT_CODES_CH17,
+  ...DEFAULT_CODES_CH18,
+  ...DEFAULT_CODES_CH19,
 }
 
 export interface BookState {
````
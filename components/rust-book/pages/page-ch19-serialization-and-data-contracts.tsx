"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A wire format is a contract, not a snapshot of your structs",
    body: "Serialization answers a boundary question: what must another process, language, file, or browser actually observe about this value? That answer is usually narrower and far more stable than your full Rust domain model. The moment data leaves your binary it becomes something a separate team, an older deployment, or a different language depends on, and you no longer get to change it just because a refactor is convenient. Designing the contract first, and deriving the types from it, keeps that dependency honest.",
  },
  {
    title: "Derives remove boilerplate, not design choices",
    body: "Adding `#[derive(Serialize, Deserialize)]` is trivial, which is precisely the risk: it makes the hard decisions invisible. Field names, optionality, default values, enum tagging strategy, borrowing, and version markers are all still choices you are making, whether or not you think about them. The derive writes the mechanical code; you still own the schema, and the schema is the part that has to survive contact with production.",
  },
  {
    title: "Version tolerance is mostly restraint",
    body: "The contracts that age well are the boring ones: add fields instead of repurposing them, give new fields defaults, keep old names alive as aliases, and put a visible version marker on the envelope. Clever schema tricks tend to win the first review and lose the first mixed-version rollout. When in doubt, choose the change that an old reader can ignore safely over the one that forces every producer and consumer to deploy in lockstep.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Your instinct may be to dump struct memory or hand-roll a binary reader, where the hard part is byte layout and endianness. Rust pushes you the other way: the wire format is a declared contract derived from types, not a reinterpretation of in-memory bytes. The shift is to stop treating serialization as a memory operation and start treating it as an API whose field names and optionality you version deliberately.",
  },
  {
    title: "C# background",
    body: "Attribute-driven contracts from System.Text.Json or DataContract carry over almost directly to Serde's derive plus field attributes, so the mechanics feel familiar. The correction is that there is no garbage collector to absorb the lifetime of a parsed value: ownership and borrowing still apply at the boundary, which is exactly what makes zero-copy reads possible and what forces you to decide who owns a deserialized value before it crosses a thread or a queue.",
  },
  {
    title: "Go background",
    body: "Go makes 'put json tags on a struct and ship it' the default, and that one struct usually serves both the domain and the wire. Rust lets you do the same with one derive, but its real question is whether you should: when transport pressure and domain pressure differ, a separate wire DTO with an explicit conversion is the calmer design. The trap is letting the wire struct quietly become your domain model.",
  },
  {
    title: "Python background",
    body: "Coming from Pydantic, dataclasses, or pickle, validation and parsing feel like runtime concerns that happen when data arrives. Serde moves most of that into the type and the derive, so a successful parse already means the shape is correct. The shift is that there is no implicit duck typing at the boundary and no ambient runtime to keep a borrowed view alive; you state the contract in types and you decide explicitly when a borrowed parse becomes an owned value.",
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
            Serialization is where a Rust program stops being a self-contained world of owned values and starts being one
            participant in a larger system. Inside the process you have rich types, lifetimes, and a compiler that proves
            things hold together. The instant a value is written to a socket, a file, or a queue, all of that disappears,
            and what remains is bytes plus an implicit agreement about how to read them. That agreement is the data
            contract, and most serialization pain in production is really a contract that drifted without anyone deciding
            it should.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-6">
            The running example for this chapter is an order system that emits the same domain events to four very
            different consumers. A public HTTP API needs human-readable, debuggable JSON. An internal event stream wants
            something compact and fast. A browser module across a WASM boundary needs a shape JavaScript can consume
            cheaply. A native integration across an FFI boundary needs an explicit byte contract rather than accidental
            Rust memory layout. One domain model, four boundaries, four trade-offs.
          </p>
          <p className="mt-3 text-sm text-muted-foreground leading-6">
            Look at where each contract lives in the diagram below: the domain model stays in the center, and each edge
            translates it into a format chosen for that consumer. The point is that no single edge dictates the shape of
            the core. The two runnable examples later in the chapter cover the first two boundaries, the JSON API and the
            internal event stream; the WASM and FFI edges are discussed in prose and cards, because illustrating them
            faithfully needs a real Cargo project with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">wasm-bindgen</code> or
            a C ABI rather than the in-browser editor.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  D[Order domain model] --> P[Public API DTO]\n  D --> E[Internal event DTO]\n  P -->|JSON| Api[External clients]\n  E -->|compact binary| Stream[Event consumers]`}
            caption="The first two boundaries: a human-readable JSON API and a compact internal event stream, both derived from the same core."
          />
          <p className="text-sm text-muted-foreground leading-6">
            The same domain model also feeds two foreign-runtime boundaries:
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  D[Order domain model] --> W[WASM view]\n  D --> F[FFI byte buffer]\n  W -->|JsValue or JSON| Browser[Browser module]\n  F -->|repr C or bytes| Native[Native integration]`}
            caption="The WASM and FFI boundaries, again derived from the same core. Four edges, four contracts, and none of them dictates the shape of the center."
          />
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
            <h3 className="text-lg font-semibold text-foreground">Three design principles</h3>
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
            <h3 className="text-lg font-semibold text-foreground">How this maps from other languages</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Every senior engineer arrives with serialization instincts that are mostly correct and quietly misleading in
            one specific spot. The list below names the mental-model shift, not a crate-to-library translation table. The
            recurring theme is the same one that runs through the rest of Rust: ownership and lifetime do not stop
            mattering at the boundary, and the wire shape is a contract you design rather than a side effect of your
            in-memory layout.
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
            <h3 className="text-lg font-semibold text-foreground">Format choices, schema evolution, and boundary contracts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Serde: two traits and a format layer</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Serde is built on two traits, <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Serialize</code>{" "}
              and <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Deserialize</code>, plus a clean split
              between your data model and the concrete format. Your type knows how to describe itself as a sequence of
              fields and values; a format crate such as <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">serde_json</code> or a binary
              adapter knows how to turn that description into bytes and back. This is why one derive can target JSON, YAML,
              MessagePack, or CBOR without rewriting the type: the type talks to an abstract data model, and the format sits
              underneath it.
            </p>
            <p className="mt-3 text-sm text-muted-foreground leading-6">
              The trace from a Rust value to bytes runs through this abstract model. Notice that the format is a swappable
              layer at the bottom, not something baked into your struct.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  V[Your Rust value] -->|Serialize| M[Serde data model]\n  M --> J[serde_json bytes]\n  M --> C[CBOR bytes]\n  M --> Mp[MessagePack bytes]\n  J -->|Deserialize| V2[Your Rust value]\n  C -->|Deserialize| V2\n  Mp -->|Deserialize| V2`}
              caption="One Serialize/Deserialize implementation talks to an abstract data model; the concrete format is a layer you swap underneath it."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Derive macros generate the trait implementations, but the design still lives in the attributes: field
                  names, enum tagging strategy, defaults, borrowing, and which model is even allowed to cross the boundary.
                  A generic envelope is a common starting shape because it lets a stable wrapper carry many payload types
                  without re-deriving the wrapper for each one.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`#[derive(Serialize, Deserialize)]
struct Envelope<T> {
    schema_version: u16,
    payload: T,
}`}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  A strong default is to separate internal domain types from wire-facing DTOs when evolution pressure differs.
                  Your aggregate may want one shape. Your public event or API contract may want another. Serde makes the
                  conversion pleasant, which means you do not have to force one type to do both jobs badly. The cost of a
                  second type and a <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">From</code> impl is
                  usually far lower than the cost of a domain refactor that silently changes a public payload.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">JSON, YAML, TOML, MessagePack, and CBOR</h4>
            <p className="text-sm text-muted-foreground leading-6">
              These five formats all map cleanly onto Serde's data model, so the choice between them is rarely about what
              Rust can express. It is about who reads the bytes and under what pressure. JSON, YAML, and TOML are text:
              easy to diff, log, and hand-edit, which matters enormously during an incident. MessagePack and CBOR are
              binary cousins of the same document model: smaller and faster to parse, at the cost of needing a tool to
              inspect. The decision usually collapses to two axes, human readability and payload size, with compatibility
              and tooling as tie-breakers.
            </p>
            <p className="mt-3 text-sm text-muted-foreground leading-6">
              Before the cards, look at the decision as a fork rather than a ranking. There is no single best format; there
              is a best format for a given boundary.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Start[Pick a format for this boundary] --> Q1{Must a human read it?}\n  Q1 -->|Yes| Q2{Config or data stream?}\n  Q2 -->|Config| Toml[TOML or YAML]\n  Q2 -->|Data or API| Json[JSON]\n  Q1 -->|No| Bin[Binary, see next fork]`}
              caption="First fork: if a human must read the bytes, the answer is a text format keyed on config versus data."
            />
            <p className="text-sm text-muted-foreground leading-6">
              When the boundary does not need to be human-readable, the binary branch forks again:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Bin[Binary boundary] --> Q3{Same document model, smaller?}\n  Q3 -->|Yes| Cbor[MessagePack or CBOR]\n  Q3 -->|Need cross-language schema| Schema[Schema-first binary]`}
              caption="Second fork: a binary boundary chooses between a compact document format and a schema-first contract. The format question is keyed on who reads the bytes and how much size matters, not a single winner."
            />
            <div className="grid gap-4 lg:grid-cols-5">
              {formatCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The useful decision is not “which format is best?” It is “which format fits this boundary’s human-readability,
                payload size, compatibility, and debugging needs?” A public API and an internal control-plane message do not
                have to make the same trade, and there is no rule that one service must speak only one format.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Binary serialization formats</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Once a boundary no longer needs to be human-readable, a different set of formats opens up, and they sort
              roughly by how much they commit to in exchange for speed and size. Rust-centric compact encodings are the
              fastest to adopt and the least portable. Schema-first formats cost you an interface-definition step but buy
              you a contract that other languages can compile against. Archived, zero-copy representations go furthest:
              they let you read a value straight out of a mapped buffer without parsing, in return for the strictest layout
              and evolution discipline. The cards move left to right along that same axis of convenience versus
              cross-language and durability guarantees.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6">
              Contracts change, and the only question is whether old and new code can coexist during the change. The safe
              moves are the ones an old reader can survive without being redeployed first. Adding an optional field with a
              default is invisible to existing readers. Renaming a field is safe only if you keep the old name as an alias
              until every producer has moved. Changing the meaning of an existing field is the dangerous one, because it
              compiles, deploys, and corrupts data silently. The diagram below traces what a tolerant reader does when it
              meets each kind of change.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  R[Reader parses a message] --> A{New optional field present?}\n  A -->|Missing| Def[Use serde default]\n  A -->|Present| Keep[Read it]\n  R --> B{Field was renamed?}\n  B -->|Old name| Alias[serde alias maps it]\n  B -->|New name| Keep\n  Def --> Ok[Parse succeeds]\n  Keep --> Ok\n  Alias --> Ok`}
              caption="Added and renamed fields are survivable: a missing optional field falls back to a default, and a renamed field is mapped by an alias."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The same tolerant reader also handles fields it does not recognize at all:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  R[Reader parses a message] --> C{Unknown extra field?}\n  C -->|Yes| Ignore[Ignore unless deny_unknown_fields]\n  Ignore --> Ok[Parse succeeds]`}
              caption="An unknown extra field is ignored unless deny_unknown_fields is set. The change that breaks a tolerant reader is repurposing an existing field, which has no safe edge in either half."
            />
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
            <p className="text-sm text-muted-foreground leading-6">
              Some formats let a deserialized value borrow directly from the input buffer instead of copying each string
              out. A field typed as <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&amp;str</code> or{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cow&lt;&apos;de, str&gt;</code> can point
              into the bytes you parsed, which avoids allocation and copying on a hot path. The catch is pure Rust: the
              borrowed view cannot outlive the buffer it points into. That is fine for parse-time validation, and wrong the
              moment the value needs to live on a queue, in a cache, or across an await point. The decision is therefore
              about lifetime, and the diagram makes the fork explicit.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Buf[Input buffer] -->|borrow| View[Parsed view with lifetime]\n  View --> Q1{Crosses thread, queue, or await?}\n  Q1 -->|No, stays local| Use[Validate and use in place]\n  Q1 -->|Yes| Own[Convert to owned value]\n  Own --> Send[Safe to send, store, or queue]\n  Use --> Drop[Drop before buffer is freed]`}
              caption="Borrow while the buffer is alive and the work stays local; convert to owned the moment the value must outlive the buffer or cross a boundary."
            />
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
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Serialization for distributed systems</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6">
              Across a network, the contract is no longer a convenience; it is the interface. Producers and consumers
              deploy on different schedules, so at any instant an old producer may be sending messages to a new consumer or
              the reverse. The patterns below all serve one goal: make the contract and its version explicit in the data,
              in the tests, and in the logs, so that a version skew is something you detect rather than something that
              detects you in production.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6">
              Not every boundary is a network, but every boundary still has a contract. At the WASM edge you are handing
              data to JavaScript, and the choice is whether to translate into a structured JS value or pass a text or
              binary payload that JavaScript parses. At the FFI edge you are handing data to C, and the cardinal rule is to
              never let Rust&apos;s in-memory layout become the contract by accident: a struct&apos;s field order and padding are
              implementation details until you pin them with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">repr(C)</code> or
              replace them with an explicit byte buffer and length. The honest move at either edge is to decide what the
              foreign side actually wants and give it exactly that.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {wasmFfiCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the envelope wraps the payload and carries the version, while the inner enum is internally
              tagged with <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">#[serde(tag = &quot;kind&quot;)]</code>{" "}
              so the kind travels inside the JSON object rather than being inferred from which fields happen to be present.
              Trace the round trip below before reading the code: serialize to JSON, parse back, then match on the tag.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Env[EventEnvelope schema 2] --> Ser[serde_json to_string]\n  Ser --> Json[JSON with kind inside payload]\n  Json --> De[serde_json from_str]\n  De --> Env2[EventEnvelope]\n  Env2 --> Match{match payload kind}\n  Match -->|created| Out[read total_cents]\n  Match -->|cancelled| Zero[total 0]`}
              caption="The version rides on the envelope and the kind rides inside the tagged payload, so a reader recovers both from the bytes without guessing."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: two boundary concerns sit side by side on one struct. The{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">amount_cents</code> field routes through a
              custom serializer pair so the wire sees decimal text while the domain keeps an exact integer, and the string
              fields are typed to borrow from the input buffer. Follow how the raw JSON splits into a borrowed view plus a
              converted integer below.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Raw["raw JSON bytes"] --> Parse[serde_json from_str]\n  Parse -->|borrow| Id["request_id: &str"]\n  Parse -->|borrow| Route["route: Cow str"]\n  Parse -->|deserialize_with| Conv[decimal_as_cents]\n  Conv --> Amt["amount_cents: u64 = 1250"]\n  Id --> View[BorrowedAudit tied to raw]\n  Route --> View\n  Amt --> View`}
              caption="The custom deserializer converts '12.50' into 1250 cents, while the string fields stay borrowed from the raw buffer the BorrowedAudit is tied to."
            />
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
            <li>Whatever language you came from, the shift is the same: the wire shape is a contract you design, and ownership and lifetime still matter at the boundary.</li>
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

"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Rust answers type identity, not open-ended object inspection",
    body: "The runtime questions Rust will answer for you are deliberately small: 'is this erased value really a RequestContext?' and 'can I recover the concrete type I stored?' It will not, by default, hand you a list of a struct's fields, walk its methods, or read attributes off a live value the way a managed runtime does. The information a reflective runtime keeps around at execution time is, in Rust, mostly consumed by the compiler and then discarded, because monomorphization has already specialized the code that needed it.",
  },
  {
    title: "Any and TypeId belong at narrow erased seams",
    body: "There are a few places where erased storage is genuinely the right model: a per-request extension bag, a typed registry keyed by concrete type, a plugin host that occasionally needs to recover one specific implementation. Those are seams, not the body of an application. The vast majority of code should keep its types visible and lean on ordinary structs, enums, and trait methods, where the compiler can still check the relationships for you.",
  },
  {
    title: "If metadata matters, model it or generate it on purpose",
    body: "When you find yourself wishing for reflection, the question to ask is what you actually want to do with the metadata. Field labels, plugin capabilities, a JSON Schema for an admin page, a descriptor a client can read at startup: these are all better expressed as explicit data or as an artifact generated at compile time from the source that already knows the shape. Reflection guesses the answer at runtime; a descriptor states it, can be reviewed, and cannot drift away from a type the way an inferred name can.",
  },
]

const limitedReflectionCards = [
  {
    title: "No built-in field walking",
    body: "Safe Rust does not ship a general runtime API to enumerate struct fields, discover methods, or inspect arbitrary layout details.",
  },
  {
    title: "Layout and code generation stay explicit",
    body: "Rust leans on monomorphization, static dispatch, and explicit data layout. Broad runtime reflection would pull more assumptions into runtime metadata.",
  },
  {
    title: "Most real needs are narrower",
    body: "In production, you usually need one of four things: type identity, safe downcasting, compile-time code generation, or explicit metadata. Those are smaller problems than general reflection.",
  },
]

const anyTypeIdCards = [
  {
    title: "`TypeId`",
    body: "A concrete runtime type identity inside one process and one build. Good for type-keyed registries. Wrong as a network or storage key.",
    code: `TypeId::of::<RequestContext>()`,
  },
  {
    title: "`Any`",
    body: "Type erasure plus checked recovery of one known concrete type. Useful when a container must store heterogeneous values behind one erased boundary.",
    code: `value.downcast_ref::<RequestContext>()`,
  },
  {
    title: "`'static` matters",
    body: "`Any` is usually about `'static` concrete types. Borrowed data with shorter lifetimes is usually the wrong fit for long-lived erased storage.",
    code: `fn insert<T: 'static>(&mut self, value: T)`,
  },
]

const downcastCards = [
  {
    title: "Borrowed downcast",
    body: "Use `&dyn Any` with `downcast_ref::<T>()` when the erased container keeps ownership and callers only need a shared borrow.",
    code: `let ctx = value.downcast_ref::<RequestContext>();`,
  },
  {
    title: "Mutable downcast",
    body: "Use `&mut dyn Any` with `downcast_mut::<T>()` when one erased owner stores the value and a specialized path needs to update it.",
    code: `let budget = value.downcast_mut::<RetryBudget>();`,
  },
  {
    title: "Owned downcast",
    body: "Use `Box<dyn Any>::downcast::<T>()` when ownership should move back to the concrete type.",
    code: `match boxed.downcast::<RetryBudget>() { /* ... */ }`,
  },
]

const traitReflectionCards = [
  {
    title: "Use trait methods for the common path",
    body: "If every caller wants a plugin name, kind, or capability list, make those ordinary trait methods. Do not force callers to downcast for data the trait could expose directly.",
    code: `fn metadata(&self) -> PluginMetadata;`,
  },
  {
    title: "Add `as_any` only where recovery is occasionally useful",
    body: "A small `as_any()` bridge lets a narrow edge recover one known concrete type without turning the whole design into downcast-driven control flow.",
    code: `fn as_any(&self) -> &dyn Any;`,
  },
  {
    title: "Keep the erased boundary small",
    body: "A small plugin trait plus explicit metadata is easier to review than a pseudo-reflective trait with many hidden type assumptions.",
    code: `Vec<Box<dyn Plugin>>`,
  },
]

const macroCards = [
  {
    title: "Derives are compile-time structural introspection",
    body: "Macros inspect Rust syntax and emit more Rust before type checking. That is compile-time generation, not runtime reflection.",
    code: `#[derive(Serialize, Deserialize)]`,
  },
  {
    title: "Compiler-built labels are diagnostic tools",
    body: "Helpers such as `stringify!`, `module_path!`, and `type_name::<T>()` are useful for logs and debug output. They are not stable external schema keys.",
    code: `std::any::type_name::<T>()`,
  },
  {
    title: "Generate descriptors when source already knows the shape",
    body: "If plugin descriptors or schema can be derived from source types, prefer compile-time generation over runtime field walking.",
    code: `stringify!(OrderEvent)`,
  },
]

const schemaCards = [
  {
    title: "Generate schemas from wire DTOs",
    body: "Public contracts usually want transport-focused DTOs, not full aggregates. Generate JSON Schema or OpenAPI-style descriptions from those DTOs and keep the domain freer to evolve.",
  },
  {
    title: "Treat schema as an artifact",
    body: "A schema artifact is useful for docs, client generation, validation, and compatibility testing. It should not tempt you to use `TypeId` or `type_name()` as protocol identifiers.",
  },
]

const pluginCards = [
  {
    title: "Reflection-like plugin systems should advertise metadata directly",
    body: "A plugin can return a descriptor with name, kind, capabilities, version, and config format. That is clearer than asking the runtime to inspect plugin fields.",
  },
  {
    title: "Downcasting is an escape hatch, not the main API",
    body: "A central registry may occasionally recover one concrete plugin for a specialized path. The common path should still be trait methods and explicit descriptors.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "The closest thing you already know is RTTI: typeid and dynamic_cast give you runtime type identity and a checked downcast, and that is almost exactly what TypeId and Any provide. The shift is that there is no Boost.Hana, no reflection TS to lean on, and no field walking at all; the structural introspection you might have reached for at compile time moves into the derive-macro system instead of templates.",
  },
  {
    title: "C# background",
    body: "This is the largest mental adjustment. System.Reflection lets you enumerate members, read attributes, and construct types by name at runtime, and a lot of C# library design assumes that power. Rust gives you none of it by default. The instinct to scan a type for [Attribute]-decorated members has to be retrained into either a derive macro that emits the code at compile time or an explicit descriptor you write once and the compiler keeps honest.",
  },
  {
    title: "Go background",
    body: "Go's reflect package is the everyday tool for generic-ish code, struct-tag parsing, and serializers, so 'just reflect over it' is a normal reflex. Rust does not offer a runtime field walk, and the idioms that Go solves with reflection are solved here with traits, generics, and serde's derive instead. Expect to declare the shape rather than discover it.",
  },
  {
    title: "Python background",
    body: "Everything is introspectable at runtime in Python: __dict__, getattr, dir(), decorators that rewrite classes on import. Rust removes that whole layer. There is no object whose attributes you can list at runtime; the value you stored in a typemap can only be recovered as the one concrete type you ask for by name. Dynamic-attribute habits become explicit data and compile-time generation.",
  },
]

const explicitMetadataMatrix = [
  {
    need: "Store one arbitrary value in a request or context bag",
    tool: "`TypeId` + `Any` typemap",
    note: "Good inside one process when the set of concrete recovered types is known.",
  },
  {
    need: "Special-case one concrete implementation behind a trait object",
    tool: "`as_any()` + `downcast_ref`",
    note: "Use only at narrow edges. Keep common behavior on the trait itself.",
  },
  {
    need: "Human-readable labels in logs or diagnostics",
    tool: "`type_name::<T>()` or `stringify!`",
    note: "Useful for diagnostics. Do not persist as a contract key.",
  },
  {
    need: "Admin docs, field lists, or client-facing schema",
    tool: "Compile-time schema generation",
    note: "Generate from DTOs or descriptors instead of inspecting live values at runtime.",
  },
  {
    need: "Plugin names, capabilities, and config details",
    tool: "Explicit `PluginMetadata` struct",
    note: "Make important metadata a normal API, not a value inferred at runtime.",
  },
]

const productionPatterns = [
  "Use `Any` and `TypeId` only where erased heterogeneous storage is genuinely the right model: request extensions, typed registries, and similar narrow seams.",
  "If erased storage crosses threads, make the boundary explicitly thread-safe with `dyn Any + Send + Sync` or another `Send`/`Sync` owner.",
  "Prefer trait methods and explicit descriptor structs for plugin systems, admin surfaces, and operator-facing metadata.",
  "Generate schemas and descriptors at compile time from transport types when the source shape is already known.",
  "Keep protocol keys, storage keys, and migration identifiers explicit. Never derive them from `TypeId` or `type_name()`.",
]

const pitfalls = [
  "Building ordinary business logic around repeated downcasts. That usually means a trait, enum, or explicit descriptor is missing.",
  "Using `TypeId` or `type_name::<T>()` as a serialized or persisted contract key. They are process-local or compiler-facing tools, not stable public identifiers.",
  "Expecting `Any` to work for borrowed non-`'static` data and then fighting the type system instead of fixing the ownership model.",
  "Recreating C#-style field inspection needs with strings and macros when the real answer is an explicit metadata struct or a generated schema.",
  "Storing heterogeneous erased values across thread boundaries without making `Send` and `Sync` part of the contract.",
  "Letting a plugin system infer important metadata instead of requiring plugins to declare it directly.",
]

export function PageCh21ReflectionAndTypeIntrospection() {
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
  const pageIndex = getPageIndexById("ch21-reflection-and-type-introspection")
  const chapter14PageIndex = getPageIndexById("ch14-interfaces-in-rust-traits")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter20PageIndex = getPageIndexById("ch20-metaprogramming")
  const exercisesPageIndex = getPageIndexById("ch21-reflection-and-type-introspection-exercises")
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
          Chapter 21 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Runtime introspection is limited in Rust, so production systems need explicit metadata and generated
          descriptors. This chapter covers trait-based inspection, registries, and schema surfaces.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 14, 19, and 20</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 14 introduced traits and trait objects. Chapter 19 covered schema and wire contracts. Chapter 20
                covered compile-time metaprogramming. Reflection and introspection in Rust sit across those boundaries.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter14PageIndex)}>
                Chapter 14
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter20PageIndex)}>
                Chapter 20
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A service platform needs typed request extensions, plugin capability metadata, and admin-facing schema
            descriptors. The business requirement is narrow introspection: use TypeId and Any only for type-keyed
            registries, expose plugin metadata as ordinary trait methods, and generate schema artifacts where field
            structure must be documented.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Start with ordinary structs, enums, and trait methods.</li>
              <li>If one container truly must store heterogeneous values, consider `Any` plus `TypeId`.</li>
              <li>If the source code already knows the shape, prefer macros or schema generation at compile time.</li>
              <li>If operators or plugins need metadata, make that metadata an explicit API.</li>
            </ol>
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
            <h4 className="font-semibold text-foreground mb-3">The four tools, and what each one is for</h4>
            <p className="text-sm text-muted-foreground leading-6">
              It helps to see the whole landscape before the details, because &ldquo;reflection&rdquo; in Rust is not
              one feature but four narrow tools that solve four different problems. Two of them work at runtime and two
              of them work at compile time. The runtime pair,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">TypeId</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Any</code>, gives you type identity
              and checked recovery of a value you erased on purpose. The compile-time pair, derive macros and
              compiler-built labels such as{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">type_name</code>, lets the source code
              that already knows a type&rsquo;s shape emit new code or descriptors before the program runs. Almost every
              real need maps onto one of these four; the trap is reaching for a fifth that does not exist.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  N[I want to introspect a type] --> Q{When do I know the type?}\n  Q -->|At runtime, erased| R[Runtime tools]\n  Q -->|At build time, in source| C[Compile-time tools]\n  R --> T1[TypeId: identity key]\n  R --> T2[Any: checked downcast]\n  C --> T3[derive macros: emit code]\n  C --> T4[type_name / stringify: labels]`}
              caption="The first question is when you know the type: erased at runtime, or visible in source at build time. Each answer leads to its own pair of tools."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Two of those four tools are routinely misused as stable identifiers. The second half marks which ones:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  T1[TypeId: identity key] -.weak as.-> X[Not a schema or protocol key]\n  T4[type_name / stringify: labels] -.weak as.-> X`}
              caption="TypeId and the compiler-built labels are process-local or diagnostic only; neither is a stable schema or protocol key, so the dotted edges warn against persisting them."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Why Rust has limited runtime reflection</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The absence of broad reflection is a design choice, not a missing feature. Rust specializes generic code
              by monomorphization and resolves most calls statically, which means the per-type metadata a reflective
              runtime would need to keep alive has usually been compiled away by the time the program runs. Carrying it
              anyway would add weight to every binary and pull assumptions that belong in source into runtime tables.
              The practical consequence is the three cards below: there is no field walk, layout and codegen stay
              explicit, and the needs people actually have turn out to be narrower than &ldquo;reflect over anything.&rdquo;
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {limitedReflectionCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Any and TypeId: erase a type, then recover it safely</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">TypeId</code> is a small,
              copyable token that uniquely identifies one concrete type, valid within a single process and a single
              build of your program. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Any</code> is
              the trait that lets you store a value behind an erased pointer such as{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Box&lt;dyn Any&gt;</code> and later
              ask, at runtime, &ldquo;is the thing in here actually a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">RetryBudget</code>?&rdquo;
              The two work together: you erase a value to put it in a heterogeneous container, you key or check it by{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">TypeId</code>, and you recover it as
              exactly one named type. The recovery is always checked, so a wrong guess returns{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">None</code> rather than reinterpreting
              bytes. One constraint shapes all of this: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Any</code>{" "}
              is for <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">&apos;static</code> types,
              because a runtime identity cannot encode a borrow that only lives for part of the program.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  V[Concrete value: RetryBudget] -->|Box::new| E[Box dyn Any]\n  E -->|store| M[(HashMap keyed by TypeId)]\n  M -->|lookup by TypeId of T| E2[Box dyn Any]\n  E2 -->|downcast_ref T| D{Type matches?}\n  D -->|yes| Some[Some and ref to RetryBudget]\n  D -->|no| None2[None]`}
              caption="A value is erased into Box<dyn Any>, stored under its TypeId, and only ever comes back as the one concrete type you ask for; a mismatch is None, never a reinterpretation."
            />
            <div className="grid gap-4 lg:grid-cols-3">
              {anyTypeIdCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A key correction for reflection-heavy backgrounds: `TypeId` is runtime type identity, not a schema, not a
                field list, and not a stable public protocol key.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Downcasting: recovering one named type by borrow, by mut, or by value</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Downcasting is the act of recovery, and it comes in three forms that mirror Rust&rsquo;s ownership
              choices. The form you pick follows how the erased container holds the value and what the caller needs to
              do with it: read it, mutate it in place, or take ownership back. None of these is a cast in the
              C-language sense; each one checks the type first and only succeeds if it matches.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {downcastCards.map((card) => (
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
                Downcasting is precise and explicit. You only recover a concrete type you already know how to name. That
                is why it is useful as an edge tool and weak as a general application architecture.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Trait-object-based reflection patterns</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {traitReflectionCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">Compile-time introspection through macros</h4>
                <p className="text-sm text-muted-foreground leading-6 mb-4">
                  This is where most of what other languages call reflection actually happens in Rust, just earlier in
                  the timeline. A derive macro reads the syntax of your struct or enum and writes more Rust before type
                  checking, so a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Serialize</code>{" "}
                  implementation that &ldquo;knows&rdquo; every field is generated rather than discovered. The result is the
                  same capability a reflective serializer offers, with the cost paid at build time and the field walk
                  visible to the compiler. The compiler-built labels in the third card are a separate, smaller tool: good
                  for logs and panics, but never a contract.
                </p>
                <div className="grid gap-4 lg:grid-cols-3">
                  {macroCards.map((card) => (
                    <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="font-medium text-foreground mb-2">{card.title}</div>
                      <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                      <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                        <code className="font-mono text-foreground">{card.code}</code>
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="outline" onClick={() => setCurrentPage(chapter20PageIndex)} className="shrink-0">
                Revisit Chapter 20
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">Generating schema instead of inspecting values</h4>
                <p className="text-sm text-muted-foreground leading-6 mb-4">
                  When you need a machine-readable description of a type for documentation, client generation, or
                  validation, generate it from the source rather than inspecting live values. A crate such as schemars
                  uses the same derive machinery to turn a transport DTO into a JSON Schema at build time. That keeps the
                  schema close to the type it describes and frees the domain model to evolve behind the wire DTO, instead
                  of tying a public contract to whatever fields a value happens to expose at runtime.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {schemaCards.map((card) => (
                    <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="font-medium text-foreground mb-2">{card.title}</div>
                      <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)} className="shrink-0">
                Revisit Chapter 19
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Plugin systems that declare rather than infer</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A plugin host is the classic place where engineers from reflective languages reach for runtime inspection:
              load a plugin, scan it for its name and capabilities, dispatch accordingly. The calmer Rust design inverts
              that. Each plugin returns a descriptor through an ordinary trait method, so the host reads metadata the
              same way it reads any other return value, and downcasting is held back as a rare escape hatch for the one
              specialized path that genuinely needs a concrete type. The diagram makes the split concrete: the wide path
              is trait dispatch, and the narrow dotted path is the occasional downcast.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  H[Plugin host] -->|metadata| T[trait method: common path]\n  H -->|run| T\n  T --> A[Plugin A]\n  T --> B[Plugin B]\n  H -.as_any then downcast.-> S[One concrete plugin: rare path]`}
              caption="The common path is a trait method every plugin implements; downcasting via as_any is the narrow dotted exception, not the main API."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              {pluginCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Designing explicit metadata systems</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {explicitMetadataMatrix.map((item) => (
                <div key={item.need} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">{item.tool}</div>
                  <div className="font-medium text-foreground mb-2">{item.need}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">What changes by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Reflection is one of the topics where prior experience cuts both ways: the vocabulary transfers, but the
            reflexes mislead. The shift to keep in mind is that Rust moves structural introspection from a runtime
            capability you call to a compile-time capability you generate, and keeps only a narrow runtime identity
            check for the cases that truly need it. Read the card for your own background before the production patterns.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
              </div>
            ))}
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
                If the code only works after many downcasts, the system is probably missing an explicit contract. Rust
                reflection tools are strongest when they stay narrow and explicit.
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
                <h4 className="font-semibold text-foreground">Example 1: a small `TypeId` + `Any` registry</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The container is erased, but recovery is still type-checked and explicit.
                </p>
              </div>
              {codes.reflection_any_typeid_registry !== DEFAULT_CODES.reflection_any_typeid_registry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("reflection_any_typeid_registry")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: every method on{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">TypeMap</code> uses the generic
              parameter <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">T</code> twice over, once
              to compute <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">TypeId::of::&lt;T&gt;()</code>{" "}
              as the map key and once to drive the{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">downcast_ref::&lt;T&gt;()</code> on
              the way out. The store itself is untyped (<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">HashMap&lt;TypeId, Box&lt;dyn Any&gt;&gt;</code>),
              yet the public API only ever returns the concrete type the caller named. Trace one insert and one get
              through the diagram, then read the same two paths in the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Ins[insert RetryBudget] -->|TypeId of T as key| Put[(values map)]\n  Ins -->|Box::new value| Put\n  Get[get RetryBudget] -->|TypeId of T| Look{key present?}\n  Look -->|no| N[None]\n  Look -->|yes| Dc[downcast_ref T]\n  Dc -->|matches| Ref[Some and ref to RetryBudget]`}
              caption="insert keys the box by TypeId::of::<T>(); get recomputes the same TypeId, then downcast_ref::<T>() turns the erased box back into a typed reference."
            />
            <RustCodeEditor
              code={codes.reflection_any_typeid_registry}
              onChange={(newCode) => updateCode("reflection_any_typeid_registry", newCode)}
              onRun={() => runCode("reflection_any_typeid_registry")}
              output={outputs.reflection_any_typeid_registry ?? null}
              isRunning={isRunning === "reflection_any_typeid_registry"}
              filename="type_id_typemap.rs"
              expectedOutput={"has context = true\nretries = 3\ntrace = req-7"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.reflection_any_typeid_registry}
              onRevert={() => resetCode("reflection_any_typeid_registry")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Registry key</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `TypeId` keys the erased store by concrete type, not by string name.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Recovery</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">
                    downcast_ref::&lt;T&gt;()
                  </code>{" "}
                  recovers one known type and returns <code className="px-1 py-0.5 rounded bg-card font-mono text-[11px]">Option</code>.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Good fit</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Request extensions and typed registries are simpler than trying to reflect arbitrary structs.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: explicit plugin metadata plus optional downcast</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The common path uses trait methods. Downcasting exists only for the rare specialized path.
                </p>
              </div>
              {codes.reflection_plugin_metadata_downcast !== DEFAULT_CODES.reflection_plugin_metadata_downcast && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("reflection_plugin_metadata_downcast")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: two of the three results come straight off the trait. Listing the names and reading{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">metadata().kind</code> never touches{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Any</code> at all, because that data
              lives on the trait every plugin implements. Only the third result, the{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pretty</code> flag, is specific to one
              concrete plugin, so it is the single place that calls{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">as_any()</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">downcast_ref::&lt;JsonFormatter&gt;()</code>.
              The diagram shows that asymmetry: the wide trait path and the one narrow downcast.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  V["Vec of<br/>Box dyn Plugin"] --> M[metadata:<br/>name and kind]\n  M --> Names[plugins =<br/>json,redact]\n  M --> Kind[first kind =<br/>formatter]\n  V --> F[find_map as_any<br/>downcast<br/>JsonFormatter]\n  F -->|matched once| P[json<br/>pretty = true]`}
              caption="Names and kinds come from the trait method on every plugin; only the pretty flag requires a downcast to the one concrete JsonFormatter."
            />
            <RustCodeEditor
              code={codes.reflection_plugin_metadata_downcast}
              onChange={(newCode) => updateCode("reflection_plugin_metadata_downcast", newCode)}
              onRun={() => runCode("reflection_plugin_metadata_downcast")}
              output={outputs.reflection_plugin_metadata_downcast ?? null}
              isRunning={isRunning === "reflection_plugin_metadata_downcast"}
              filename="plugin_metadata_and_downcasting.rs"
              expectedOutput={"plugins = json,redact\njson pretty = true\nfirst kind = formatter"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.reflection_plugin_metadata_downcast}
              onRevert={() => resetCode("reflection_plugin_metadata_downcast")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Metadata first</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Names and kinds are ordinary trait data, not values inferred at runtime.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Downcast escape hatch</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `as_any()` is there for one narrow specialized query, not for every call.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Production translation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Plugin systems are usually easiest to operate when capabilities and config formats are explicit.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch21_reflection_and_type_introspection/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to build a small `TypeId` registry, downcast safely from erased values,
            and design explicit metadata for a plugin boundary instead of leaning on broad runtime reflection.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 21 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Rust has limited runtime reflection on purpose. It offers narrow tools, not broad object inspection.</li>
            <li>`Any` and `TypeId` are useful for erased storage and checked recovery inside one process.</li>
            <li>Downcasting is an edge tool. Common behavior should stay on traits, enums, and explicit descriptors.</li>
            <li>Compile-time macros and schema generation cover many reflection-like needs more cleanly than runtime inspection.</li>
            <li>Plugin systems, admin surfaces, and public protocols are usually best served by explicit metadata systems.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

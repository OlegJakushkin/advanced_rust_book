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
    title: "Rust has type identity, not broad runtime object inspection",
    body: "Rust can answer narrow runtime questions such as 'what concrete type is this?' or 'can I recover it from erased storage?' It does not, by default, enumerate arbitrary fields, methods, or annotations at runtime.",
  },
  {
    title: "`Any` and `TypeId` belong at narrow erased boundaries",
    body: "A request extension bag, a typed registry, or a plugin escape hatch may justify erased storage. Most application code should still use ordinary structs, enums, and trait methods.",
  },
  {
    title: "If metadata matters, model it or generate it explicitly",
    body: "Schema, field labels, plugin capabilities, and admin-facing descriptors are usually better as explicit data or compile-time generated artifacts than as runtime reflection guesses.",
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
    title: "C++ RTTI background",
    body: "Rust is closer to C++ RTTI than to a reflection-heavy managed runtime. `TypeId` and downcasting exist, but Rust does not default to field enumeration or late-bound metadata discovery.",
  },
  {
    title: "C# background",
    body: "C# exposes rich runtime reflection over types, members, and attributes. Rust deliberately keeps that surface small and pushes most structural introspection toward macros and explicit metadata.",
  },
  {
    title: "Go background",
    body: "Go has a runtime `reflect` package, but even there, heavy reflection usually carries cost and complexity. Rust narrows the default surface further and encourages explicit descriptors sooner.",
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
            <h4 className="font-semibold text-foreground mb-3">Why Rust has limited runtime reflection</h4>
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
            <h4 className="font-semibold text-foreground mb-3">`Any` and `TypeId`</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Downcasting</h4>
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
                <h4 className="font-semibold text-foreground mb-3">Compile-time reflection through macros</h4>
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
                <h4 className="font-semibold text-foreground mb-3">Schema generation</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Reflection-like systems for plugins</h4>
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
            <h4 className="font-semibold text-foreground mb-3">Comparing Rust with C#, Go, and C++ RTTI</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
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

"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Bug,
  Cpu,
  Gauge,
  Layers,
  Network,
  Ruler,
  Shield,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A generic is a contract, not a placeholder",
    body: "A C++ template parameter promises nothing about the type that fills it; the body just tries operations and fails to compile if they are missing. A Rust generic parameter carries trait bounds that state, up front, exactly what the type must be able to do. The body may use only what those bounds permit, which means a generic function is checked once against its contract, not re-checked against every concrete type that calls it.",
  },
  {
    title: "Bounds are checked at the definition, not the call",
    body: "This is the single largest shift coming from templates. When you write a bound such as where T: Ord, the compiler verifies the body against that bound the moment it reads the function, before any caller exists. A type that fails to satisfy the bound is rejected at the call site with a precise message about which trait is missing, rather than producing a wall of instantiation errors from deep inside the template body.",
  },
  {
    title: "Monomorphization is the same machine-code story as templates",
    body: "At code generation time Rust still stamps out one specialized copy of a generic per concrete type, exactly like a C++ template instantiation. The runtime cost is the same: no boxing, no vtable, full inlining. The difference is purely in the front end. You pay for binary size and compile time, and you get back the speed of hand-written, type-specialized code.",
  },
]

const comparisons = [
  {
    title: "C++ background",
    body: "Templates are duck-typed and checked at instantiation; Rust generics are contract-typed and checked at definition. The mental shift is to stop thinking 'whatever type works, works' and start naming the trait bounds the body actually relies on. Concepts in C++20 move toward the same idea, but in Rust the bound is mandatory, so the error you used to see as a 400-line instantiation dump becomes a one-line 'T does not implement Ord' at the call.",
  },
  {
    title: "C# background",
    body: "C# generics are checked at definition too, but the runtime shares one JIT-specialized body for all reference types and erases nothing for value types via reification. Rust always monomorphizes, so there is no shared code path and no runtime type metadata; the closest thing to a C# generic constraint is a trait bound, and the closest thing to a base-class or interface parameter you box is a dyn trait object, which you opt into explicitly.",
  },
  {
    title: "Go background",
    body: "Go generics (type parameters with interface constraints) are the nearest analog and were a deliberate, late, conservative addition. The trap is assuming Go's implicit interface satisfaction carries over: in Rust a type implements a trait only where an explicit impl block says so, and the orphan rule limits where that impl can live. Bounds are also richer, including associated types and const parameters that Go does not express.",
  },
  {
    title: "Python background",
    body: "Python is structurally duck-typed at runtime; a function works on anything that happens to have the right methods, and a missing method is a runtime AttributeError. Rust moves that entire class of failure to compile time: the trait bound is the explicit, checked version of 'this object must quack,' and there is no runtime reflection fallback. What you lose in late-binding flexibility you gain in a guarantee that the call cannot fail for a missing method.",
  },
]

const coreConceptCards = [
  {
    title: "Trait bounds say what a type can do",
    body: "A bound such as T: Clone + Send constrains a type parameter to types that implement those traits. Inside the generic body you may call only the methods those traits provide, which is why the function compiles independently of any caller. Bounds compose with +, and the impl block or function signature is where they live.",
  },
  {
    title: "where clauses keep complex signatures readable",
    body: "When bounds grow past one or two traits, or involve associated-type relationships, inline bounds make the signature hard to read. A where clause moves them below the signature, which is purely a readability tool: where T: Iterator, T::Item: Ord means the same thing as the inline form but keeps the parameter list scannable.",
  },
  {
    title: "Associated types name a type the trait owns",
    body: "Some traits have one canonical related type per implementor, such as the element an Iterator yields. Making it an associated type (type Item) instead of an extra generic parameter means a type implements the trait once with a fixed choice, and callers write Iterator without having to spell out the item type everywhere.",
  },
  {
    title: "Const generics parameterize by value, not only by type",
    body: "A parameter like const N: usize lets a type or function be generic over a compile-time number, which is how [T; N] arrays and fixed-size buffers stay typed without heap allocation. The size is part of the type, so a length mismatch is a compile error rather than a runtime bounds check.",
  },
]

const monomorphizationCosts = [
  {
    title: "What you gain",
    body: "Each instantiation is specialized and inlinable, so a generic abstraction compiles to the same machine code you would have written by hand for that concrete type. There is no dispatch indirection and no boxing on the hot path. This is the literal meaning of zero-cost abstraction for generics.",
  },
  {
    title: "What you pay",
    body: "Every distinct concrete type that flows through a generic produces another copy in the binary. Heavy generic code over many types inflates binary size and compile time, and can hurt instruction-cache behavior. The cost is real but bounded: it scales with the number of instantiations, not with how often you call them.",
  },
  {
    title: "When to reach for dyn instead",
    body: "If you need one code path that handles many types chosen at runtime, or you are deliberately trimming binary size, a trait object (Box<dyn Trait>) trades a vtable lookup for a single shared body. It is the right tool for plugin-style boundaries and large match-on-type surfaces; it is the wrong default for tight numeric or collection code.",
  },
]

const productionPatterns = [
  "Bound on the narrowest trait the body actually uses, so callers are not forced to satisfy requirements the function never exercises.",
  "Prefer associated types over extra type parameters when a trait has exactly one natural related type per implementor; it keeps call sites and bounds far simpler.",
  "Start with a concrete type, then generalize only after a second real implementation appears. Premature generics cost compile time and reader effort without paying it back.",
  "Use const generics for genuinely fixed-size data (cryptographic blocks, fixed windows, SIMD-width buffers) rather than reaching for Vec when the length is known at compile time.",
  "Watch instantiation count in hot libraries; if one generic is stamped out across dozens of types, consider an inner non-generic helper that the thin generic shell calls, to cut code bloat.",
  "Reach for dyn Trait at runtime-polymorphism boundaries (plugins, heterogeneous collections) and keep monomorphized generics for the performance-sensitive core.",
]

const pitfalls = [
  "Over-bounding: adding T: Clone + Debug + Default to a function that only ever calls one method, which makes the API harder to satisfy for no benefit.",
  "Reaching for generics where a plain enum would have modeled a small, closed set of variants more clearly and with less monomorphization.",
  "Adding a second generic parameter where an associated type belonged, forcing every caller and every bound to thread the extra type through the whole API.",
  "Assuming generics are free at build time. A widely instantiated generic in a core crate can dominate compile time and binary size even when runtime cost is zero.",
  "Treating a const-generic length as runtime-flexible. The N is fixed per instantiation; if the size is genuinely dynamic, a slice or Vec is the honest type.",
  "Expecting C++ template-style implicit substitution. If a bound is missing, the body will not compile at the definition, even if some caller would have provided a conforming type.",
]

const summaryPoints = [
  "Rust generics are templates with the contract made explicit: trait bounds state what a type must do, and the body is checked against the bound at the definition, not at each instantiation.",
  "where clauses are a readability tool for the same bounds; associated types name the one canonical related type a trait owns; const generics parameterize by a compile-time value such as an array length.",
  "Monomorphization gives the same runtime performance as C++ templates: specialized, inlinable, no dispatch. The cost moves to binary size and compile time, scaling with the number of distinct instantiations.",
  "Bound narrowly, generalize only after a second real case, and prefer associated types over extra parameters when a trait has one natural related type.",
  "Use dyn Trait when you need runtime polymorphism or smaller binaries; keep monomorphized generics for the performance-critical core.",
]

export function PageCh18GenericsInsteadOfTemplates() {
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
  const pageIndex = getPageIndexById("ch18-generics-instead-of-templates")
  const chapter17PageIndex = getPageIndexById("ch17-refactoring-toward-idiomatic-rust")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const exercisesPageIndex = getPageIndexById("ch18-generics-instead-of-templates-exercises")
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
          Chapter 18 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Generics let one Rust API serve many types without giving up concrete contracts. This chapter covers trait
          bounds, where clauses, associated types, const generics, and the monomorphization costs that matter when you
          ship a production library: what the compiler checks, when it checks it, and what it stamps into the binary.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapter 17</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 17 was about refactoring concrete code toward idiomatic Rust. Generics are the next step: once a
                pattern recurs across more than one concrete type, you lift it into a single parameterized API. This
                chapter is deliberately about doing that lifting late and on purpose, not as a reflex.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter17PageIndex)}>
                Chapter 17
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A team is building a job-processing library. They start with one concrete batch of{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Job</code> values, then a second
            caller needs the same batching logic over a different item type, then a third needs a fixed-size encoding
            buffer whose length is known at compile time. The temptation is to copy the code three times or to reach
            immediately for a fully generic abstraction. The business requirement is a single API that compiles to the
            same machine code as the hand-written versions, rejects misuse at the call site with a clear message, and
            does not quietly bloat the binary.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Write the concrete version first and ship it if there is only one caller.</li>
              <li>When a second real type appears, lift to a generic and name the trait bound the body actually uses.</li>
              <li>Pick associated types over extra parameters when the trait has one natural related type.</li>
              <li>Use const generics only when the size is genuinely fixed at compile time.</li>
              <li>Drop to dyn Trait when runtime polymorphism or binary size, not raw speed, is the constraint.</li>
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
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The shape worth memorizing is two checks at two different times. A C++ template defers all type checking
              until a caller instantiates it, so a missing operation surfaces deep inside the body. A Rust generic is
              checked twice: once at the definition against its declared bounds, and once again, trivially, when a caller
              supplies a type and the compiler confirms that type satisfies the bound. The body never gets re-typechecked
              per caller, which is why the diagnostics point at the call site instead of the template internals.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Def[Generic definition] -->|checked vs bounds| OK[Body type-checks once]\n  Call[Caller supplies T] -->|does T satisfy bound| Yes[compile and monomorphize]\n  Call -->|bound missing| Err[error at call site]\n  OK --> Yes`}
              caption="The body is checked once against its bounds at the definition; each caller is only checked for whether its type satisfies the bound."
            />
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Trait bounds, where clauses, associated types, const generics</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {coreConceptCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                These four features form a ladder. A bare type parameter such as{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Vec&lt;T&gt;</code> says nothing
                about <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">T</code>. Adding a bound (
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">T: Keyed</code>) lets the body call
                methods. A <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">where</code> clause keeps
                the bound legible as it grows. An associated type fixes a trait&apos;s one natural related type so callers
                do not repeat it, and a const parameter like{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">const N: usize</code> lets the type
                carry a compile-time size such as {"[T; N]"}.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Generics versus templates: where the difference lives</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              It is worth being precise about what is the same and what is different, because the runtime story is
              identical and only the front end changes. Both languages generate one specialized copy of the code per
              concrete type. The contrast is entirely in when type errors are reported and whether a contract has to be
              declared. The table below is the whole comparison in one view.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-medium text-foreground mb-2">C++ template</div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>No declared contract; the body just tries operations.</li>
                  <li>Type-checked at instantiation, per caller.</li>
                  <li>Errors surface inside the template body.</li>
                  <li>Monomorphized to specialized machine code.</li>
                </ul>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="text-sm font-medium text-foreground mb-2">Rust generic</div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>Trait bounds declare the contract explicitly.</li>
                  <li>Type-checked once at the definition against the bound.</li>
                  <li>Errors surface at the call site as a missing trait.</li>
                  <li>Monomorphized to specialized machine code.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Boxes className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Monomorphization and its costs</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Monomorphization is the compiler stamping out a separate, fully specialized copy of a generic for each
              concrete type that uses it. That is what makes generics fast: the copy for{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">u32</code> knows it is operating on
              four-byte integers and inlines accordingly, with no boxing and no vtable. The price is paid in the binary,
              not at runtime: one generic over many types becomes many functions in the output.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  G["batch generic over T"] --> M[monomorphization]\n  M --> A[batch for Job]\n  M --> B[batch for Order]\n  M --> C[batch for u32]\n  A --> Bin[binary: 3 specialized copies]\n  B --> Bin\n  C --> Bin`}
              caption="One generic becomes one specialized copy per concrete type. Runtime cost stays low; binary size and compile time scale with the number of instantiations."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
              {monomorphizationCosts.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                Generics are free at runtime, not free at build time. A widely instantiated generic in a core crate can
                dominate compile time and binary size even when every call is as fast as hand-written code.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Most engineers meet Rust generics with a model from another language, and the useful question is which part
            of that model transfers. The runtime behavior is rarely the surprise; the surprise is where and when the
            type contract is enforced, and whether you are allowed to leave it implicit.
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {comparisons.map((comparison) => (
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
                A generic is not automatically better than a concrete type. It is a contract you maintain and a set of
                instantiations you pay for. Generalize when a second real case proves the abstraction, not before.
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
                <h4 className="font-semibold text-foreground">Example 1: Generic batch with trait bounds</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Batch&lt;T&gt;</code> holds
                  any item type, but the helper that reads a key requires the items to implement a trait.
                </p>
              </div>
              {codes.generics_batch_bounds !== DEFAULT_CODES.generics_batch_bounds && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("generics_batch_bounds")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: notice which operations are gated by which bound.{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Batch&lt;T&gt;</code> itself has no
              bound, so <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">new</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">len</code> work for every type. Only{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">first_key</code> adds{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">where T: Keyed</code>, which is what
              lets its body call <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">item.key()</code>.
              Trace the bound in the diagram, then read the same split in the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  T[any T] --> Batch["Batch of T: new, len"]\n  T -->|"only if T: Keyed"| FK["first_key: calls item.key()"]\n  Job["Job impl Keyed"] -->|satisfies bound| FK`}
              caption="The container is unbounded; only first_key requires T: Keyed, so only it may call key(). Job satisfies the bound, so the call compiles."
            />
            <RustCodeEditor
              code={codes.generics_batch_bounds}
              onChange={(newCode) => updateCode("generics_batch_bounds", newCode)}
              onRun={() => runCode("generics_batch_bounds")}
              output={outputs.generics_batch_bounds ?? null}
              isRunning={isRunning === "generics_batch_bounds"}
              filename="generic_batch_bounds.rs"
              expectedOutput={"len = 2\nfirst key = 10"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.generics_batch_bounds}
              onRevert={() => resetCode("generics_batch_bounds")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Unbounded container</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Batch&lt;T&gt;</code> stores any
                  type; storage needs no trait.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Bounded helper</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">first_key</code> requires{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Keyed</code> because it calls a
                  trait method.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Checked early</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Pass a type without <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Keyed</code>{" "}
                  and the error names the missing bound at the call.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: Associated types and const generics</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  An <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Encoder</code> fixes its output
                  type as an associated type, and a fixed window carries its length as a const parameter.
                </p>
              </div>
              {codes.generics_associated_types_const !== DEFAULT_CODES.generics_associated_types_const && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("generics_associated_types_const")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: two different parameterization choices in one file. The{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Encoder</code> trait owns its result
              type via <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">type Output</code>, so{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">HexPair</code> pins it to{" "}
              {"[u8; 2]"} once and callers never spell it out. Separately,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">FixedWindow&lt;T, N&gt;</code> is
              generic over a compile-time length <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">N</code>,
              so <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">last()</code> can index{" "}
              {"items[N - 1]"} with the size known at compile time. The diagram separates the by-type axis from the
              by-value axis.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph ByType[Associated type]\n    Enc["Encoder trait: type Output"] --> Hex["HexPair: Output = u8 array of 2"]\n  end`}
              caption="By type: an associated type lets the Encoder trait own its result type, so HexPair pins Output to a fixed array once and callers never spell it out."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The other axis parameterizes by a compile-time value rather than a type:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph ByValue[Const generic]\n    FW["FixedWindow of T and const N"] --> Sum["sum over N items"]\n    FW --> Last["last = items at N minus 1"]\n  end`}
              caption="By value: a const generic makes the length N part of the type, so a FixedWindow sums over N items and indexes the last as items[N - 1] with the size known at compile time."
            />
            <RustCodeEditor
              code={codes.generics_associated_types_const}
              onChange={(newCode) => updateCode("generics_associated_types_const", newCode)}
              onRun={() => runCode("generics_associated_types_const")}
              output={outputs.generics_associated_types_const ?? null}
              isRunning={isRunning === "generics_associated_types_const"}
              filename="associated_types_const_generics.rs"
              expectedOutput={"hex = 1F\nsum = 29\nlast = 13"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.generics_associated_types_const}
              onRevert={() => resetCode("generics_associated_types_const")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Associated type</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">type Output</code> fixes one
                  result type per implementor, so callers do not repeat it.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Const generic</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">const N: usize</code> makes the
                  length part of the type, so {"[T; N]"} stays on the stack.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Checked size</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A length mismatch becomes a compile error, not a runtime bounds check.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <Ruler className="h-5 w-5 text-primary mt-0.5" />
              <p className="text-sm text-muted-foreground leading-6">
                Try changing the inputs to feel the two cost models. Edit the byte passed to{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">encode</code> or the numbers in{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">items</code> and the output follows
                directly; change the number of items and the const length{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">N</code> moves with it because the
                length is part of the type.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to translate template-style helpers into bounded Rust generics, replace
            an extra type parameter with an associated type, and implement a const-generic fixed-size batch with{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">len</code> and{" "}
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">sum</code>.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 18 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Next chapter</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Generics let one type or function serve many types in memory. Chapter 19 takes the same data across
                process and version boundaries: serialization and data contracts, where the question shifts from &quot;what
                can this type do&quot; to &quot;how does this value survive being written, stored, and read back by
                possibly older code.&quot; The bounds-and-contracts discipline from this chapter carries directly into
                designing stable wire formats.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)} className="gap-2 shrink-0">
              Continue to Chapter 19
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
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

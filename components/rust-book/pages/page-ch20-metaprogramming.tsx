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
    title: "Macros rewrite syntax before Rust type-checks the result",
    body: "A macro is not a runtime callback. It is a compile-time syntax transform. Declarative macros pattern-match token trees. Procedural macros receive token streams, inspect them, and emit new Rust tokens.",
  },
  {
    title: "Metaprogramming is justified when syntax is the real duplication",
    body: "If the real problem is repeated expressions, repeated items, or repeated impl blocks, a macro may be right. If the real problem is ordinary value transformation, type abstraction, or behavior variation, a function, generic, trait, or enum is usually calmer.",
  },
  {
    title: "A public macro is a public syntax API",
    body: "Once other crates write code against your macro call shape, you own that call shape. Macro stability is not only about generated behavior. It is also about patterns, diagnostics, and how understandable expansion remains six months later.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Rust `macro_rules!` is not a template system and not a textual preprocessor clone. Generics solve Rust's template-shaped problems. Macros solve syntax-shaped problems. Compared with the C preprocessor, `macro_rules!` is token-based and hygienic.",
  },
  {
    title: "C# background",
    body: "Derive and attribute macros are closer to compile-time source transformation than to runtime reflection. If you know attributes and source generators, that instinct helps. The correction is that Rust keeps the whole mechanism inside the compiler pipeline and type-checks the emitted Rust afterward.",
  },
  {
    title: "Go background",
    body: "Go often pushes metaprogramming toward `go generate`, templates, or external codegen tools. Rust can still do offline generation, but it also has first-class compile-time macros when the call-site syntax itself should remain part of the API.",
  },
]

const declarativeMacroCards = [
  {
    title: "Pattern arms",
    body: "`macro_rules!` matches token-tree patterns arm by arm. The match happens on syntax shape, not on types or inferred trait information.",
    code: `macro_rules! id {
    ($value:expr) => { $value };
}`,
  },
  {
    title: "Repetition",
    body: "Repetition forms like `$( ... ),*` remove boilerplate for lists of expressions, items, or identifiers while keeping one source of truth for the expansion.",
    code: `macro_rules! list {
    ($($value:expr),* $(,)?) => { vec![$($value),*] };
}`,
  },
  {
    title: "Expansion model",
    body: "Expansion happens before type checking. The compiler then type-checks the expanded Rust exactly as if you had written it by hand.",
    code: `// macro expands first
// borrow checker still runs after expansion`,
  },
]

const proceduralMacroCards = [
  {
    title: "Separate proc-macro crate",
    body: "Procedural macros live in a crate compiled with `proc-macro = true`. That crate is part of your build and API surface, which is why proc macros are more powerful and also heavier than `macro_rules!`.",
    code: `[lib]
proc-macro = true`,
  },
  {
    title: "Derive macros",
    body: "Use derive macros when one annotation on a type should generate impls tied to that type: codecs, schema metadata, validation traits, or adapter glue.",
    code: `use proc_macro::TokenStream;

#[proc_macro_derive(EventCodec, attributes(event))]
pub fn derive_event_codec(input: TokenStream) -> TokenStream {
    TokenStream::new()
}`,
  },
  {
    title: "Attribute macros",
    body: "Use attribute macros when an item should be rewritten or decorated as a whole: handler registration, instrumentation, or contract validation around functions or modules.",
    code: `use proc_macro::TokenStream;

#[proc_macro_attribute]
pub fn instrument_service(args: TokenStream, item: TokenStream) -> TokenStream {
    item
}`,
  },
  {
    title: "Function-like proc macros",
    body: "Use function-like procedural macros when you want a custom token-level DSL that still expands into ordinary Rust items or expressions.",
    code: `use proc_macro::TokenStream;

#[proc_macro]
pub fn service_contract(input: TokenStream) -> TokenStream {
    TokenStream::new()
}`,
  },
]

const tokenStreamCards = [
  {
    title: "Syntax, not typed values",
    body: "`TokenStream` is a stream of tokens with spans. A proc macro sees syntax structure before type checking, not inferred trait impls or runtime values.",
  },
  {
    title: "Diagnostics matter",
    body: "Good proc macros produce precise compile-time errors near the bad token, with a message that explains the contract. Bad proc macros produce a riddle somewhere deep in generated code.",
  },
  {
    title: "Emit the smallest expansion that works",
    body: "Generated code should still look like normal Rust in spirit: explicit impls, explicit helpers, and explicit ownership. A macro that emits a maze is harder to debug than the boilerplate it replaced.",
  },
]

const codeGenerationStrategyCards = [
  {
    title: "Ordinary function or generic",
    body: "Use this when the inputs are already values or types and the call-site syntax does not need to change. If a function says the whole story, a macro is overkill.",
  },
  {
    title: "`macro_rules!`",
    body: "Use this when you want local syntax compression, repeated items, or small compile-time DSLs that can be described with token-tree patterns.",
  },
  {
    title: "Procedural macro",
    body: "Use this when one Rust item annotation or token-level DSL should generate more Rust than `macro_rules!` can express cleanly.",
  },
  {
    title: "Build script or offline generator",
    body: "Use this when the source of truth is external: OpenAPI, protobuf, SQL schema, or a domain-specific config file. Large generated surfaces usually age better as generated files or build outputs than as public macro call sites.",
  },
]

const hygieneCards = [
  {
    title: "Introduced locals stay separate",
    body: "Identifiers introduced by `macro_rules!` do not casually capture or clobber caller locals. That is one of the practical reasons Rust macros are safer than textual substitution.",
  },
  {
    title: "Use `$crate` for internal paths",
    body: "If a public `macro_rules!` macro expands to items inside its defining crate, `$crate::path::to::item` is the reliable way to keep path resolution correct for downstream callers.",
  },
  {
    title: "Proc macros need more deliberate identifier handling",
    body: "Procedural macros emit identifiers and spans explicitly. That gives you power, but it also means you must be conservative and intentional about generated names and diagnostics.",
  },
]

const compileTimeDslCards = [
  {
    title: "A good DSL is smaller than the Rust it replaces",
    body: "If the DSL grammar is larger than the ordinary Rust alternative, the macro is probably serving the author rather than the reader.",
  },
  {
    title: "Emit ordinary Rust data or items",
    body: "The best compile-time DSLs expand into structs, enums, impls, or expressions that another engineer can still reason about with normal Rust tools.",
  },
  {
    title: "Keep call sites reviewable",
    body: "A route table, SQL fragment wrapper, or test matrix DSL should make intent clearer at the call site. If reviewers need expansion to understand the behavior, the DSL is already too opaque.",
  },
]

const whenNotToUseCards = [
  {
    title: "A normal function already says it",
    body: "If `build_label(service, route)` or `parse_port(raw)` already captures the abstraction, keep the logic in a function. Functions compose with types, traits, errors, and tools more simply than macros do.",
  },
  {
    title: "The real variability is type or behavior",
    body: "Use generics, traits, or enums when the abstraction is about types or behavior sets, not syntax. Macros are a poor substitute for deliberate type design.",
  },
  {
    title: "The generated surface is large or external",
    body: "If the code comes from an API schema, IDL, or data definition file, prefer offline generation or a build script. Public macro call sites should not become miniature compilers when one generated module would do.",
  },
  {
    title: "Diagnostics and tooling would get worse",
    body: "When the macro makes errors harder to read, jumps-to-definition less useful, or ownership flow harder to see, the abstraction cost is already too high.",
  },
]

const productionPatterns = [
  "Prefer `macro_rules!` over procedural macros when token-tree pattern matching already solves the problem. It is cheaper to build, cheaper to understand, and easier to test.",
  "Use derive macros for type-local generated impls and keep attribute macros narrow. The broader the item rewrite, the more careful you must be with diagnostics and hidden behavior.",
  "Keep public macro syntax small, orthogonal, and boring. Public macros are part of the crate's API surface just as much as public functions are.",
  "Move runtime work into ordinary functions or traits after expansion. A macro should usually generate a clear wrapper around normal Rust logic, not bury the logic itself in emitted syntax.",
  "Use compile-pass and compile-fail tests for macro APIs, especially when diagnostics, ownership requirements, or generated trait impls are part of the contract.",
]

const pitfalls = [
  "Using a macro because ownership, traits, or generics were inconvenient. That usually hides the wrong abstraction instead of repairing it.",
  "Publishing a macro with overly clever pattern arms, then discovering that call-site syntax has become a compatibility burden.",
  "Hiding allocations, locks, or async spawning inside macro expansion so the call site looks cheap while runtime behavior is not.",
  "Reaching for an attribute macro when a plain helper function or builder API would have been clearer and easier to debug.",
  "Forgetting that proc macros add compile-time weight and diagnostic complexity to every downstream build that uses them.",
  "Building a compile-time DSL that is harder to read than a small table literal or function call would have been.",
]

export function PageCh20Metaprogramming() {
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
  const pageIndex = getPageIndexById("ch20-metaprogramming")
  const chapter03PageIndex = getPageIndexById("ch03-project-structure-and-tooling")
  const chapter14PageIndex = getPageIndexById("ch14-interfaces-in-rust-traits")
  const chapter18PageIndex = getPageIndexById("ch18-generics-instead-of-templates")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const exercisesPageIndex = getPageIndexById("ch20-metaprogramming-exercises")
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
          Chapter 20 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Metaprogramming is a build-time tool for removing repetitive syntax while preserving clear APIs. This chapter
          covers macros and generated code as maintainable compile-time infrastructure.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 03, 14, 18, and 19</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 03 matters because proc macros and larger code generation strategies live at crate and build-system
                boundaries. Chapter 14 matters because many derive macros emit trait impls. Chapter 18 matters because
                macros and generics solve different problems. Chapter 19 matters because derive and attribute macros often
                sit directly on serialization and contract surfaces.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter03PageIndex)}>
                Chapter 03
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter14PageIndex)}>
                Chapter 14
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter18PageIndex)}>
                Chapter 18
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A service platform contains repeated route declarations, DTO metadata, validation boilerplate, and generated
            adapter code. The business requirement is to remove structural repetition without hiding runtime behavior:
            use functions for value logic, declarative macros for small syntax patterns, procedural macros for item-level
            generation, and build-time codegen for external schemas.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Start with a normal function, generic, trait, or enum and confirm why it is insufficient.</li>
              <li>If the duplication is syntax-shaped inside Rust, try <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">macro_rules!</code> first.</li>
              <li>If the API must attach to items, inspect attributes, or emit impls from type definitions, consider a procedural macro.</li>
              <li>If the source of truth is external or the generated surface is large, prefer a build script or offline generator.</li>
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
            <h4 className="font-semibold text-foreground mb-3">Declarative macros with <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">macro_rules!</code></h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {declarativeMacroCards.map((card) => (
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
                One correction to keep in mind: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">macro_rules!</code> is not a type system escape hatch. It is a token-pattern expansion tool. Borrow checking, trait solving, and monomorphization still happen after expansion.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Procedural macros</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {proceduralMacroCards.map((card) => (
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
                Procedural macros are powerful because they can inspect and rewrite item-level syntax. They are also heavy because they add a crate boundary, compile-time work, and a bigger diagnostic surface. Reach for them only when that power is actually needed.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Token streams</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {tokenStreamCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                One practical consequence follows from this immediately: if your macro design needs inferred types or trait resolution to decide what to generate, the macro is probably the wrong tool. That information is not available in the way many first designs hope.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Code generation strategies</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {codeGenerationStrategyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Macro hygiene</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {hygieneCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Compile-time DSLs</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {compileTimeDslCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A route table macro, a compact compile-time query wrapper, or a repetitive test-case generator can be excellent. A DSL that hides ownership, control flow, or expensive runtime work behind decorative syntax is usually not.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">When not to use macros</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {whenNotToUseCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Translating prior instincts</h4>
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
                Macros compress source code, but they can expand maintenance cost. If the generated surface, diagnostics,
                and review burden are worse than the original repetition, the metaprogramming gave you nothing.
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
                <h4 className="font-semibold text-foreground">Example 1: <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">macro_rules!</code> repetition plus hygiene</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  One macro introduces a local binding, another expands a repeated list. The caller keeps its own
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">total</code>
                  untouched.
                </p>
              </div>
              {codes.metaprogramming_macro_rules_hygiene !== DEFAULT_CODES.metaprogramming_macro_rules_hygiene && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("metaprogramming_macro_rules_hygiene")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.metaprogramming_macro_rules_hygiene}
              onChange={(newCode) => updateCode("metaprogramming_macro_rules_hygiene", newCode)}
              onRun={() => runCode("metaprogramming_macro_rules_hygiene")}
              output={outputs.metaprogramming_macro_rules_hygiene ?? null}
              isRunning={isRunning === "metaprogramming_macro_rules_hygiene"}
              filename="macro_rules_hygiene_and_repetition.rs"
              expectedOutput={"next = 41\nsum = 6\nouter total = 40"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.metaprogramming_macro_rules_hygiene}
              onRevert={() => resetCode("metaprogramming_macro_rules_hygiene")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Repetition</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">$($value:expr),*</code> removes the repeated accumulator code at the call site.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Hygiene</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The macro's internal bindings do not steal the caller's
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">total</code>
                  name.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This is the right scale for <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">macro_rules!</code>: small syntax compression, ordinary emitted Rust.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: a small compile-time DSL for route tables</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The macro call site reads like a compact route declaration, but it still expands into ordinary Rust
                  data with explicit fields.
                </p>
              </div>
              {codes.metaprogramming_compile_time_dsl !== DEFAULT_CODES.metaprogramming_compile_time_dsl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("metaprogramming_compile_time_dsl")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.metaprogramming_compile_time_dsl}
              onChange={(newCode) => updateCode("metaprogramming_compile_time_dsl", newCode)}
              onRun={() => runCode("metaprogramming_compile_time_dsl")}
              output={outputs.metaprogramming_compile_time_dsl ?? null}
              isRunning={isRunning === "metaprogramming_compile_time_dsl"}
              filename="compile_time_dsl_routes.rs"
              expectedOutput={"routes = 3\nfirst = GET /health\nprivate = 2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.metaprogramming_compile_time_dsl}
              onRevert={() => resetCode("metaprogramming_compile_time_dsl")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">DSL grammar</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The grammar is intentionally tiny: method, path, and one auth marker. Small DSLs survive reviews better.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Generated data</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The expansion is only a vector of <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Route</code> values. No hidden IO, no hidden allocation policy surprise.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Escalation rule</div>
                <p className="text-xs text-muted-foreground leading-5">
                  If this grammar grew much larger, a proc macro or an offline generator might become the better tool.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch20_metaprogramming/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor. The runnable editors
              focus on <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">macro_rules!</code> because real
              procedural macros require a separate <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">proc-macro</code>{" "}
              crate.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to choose between functions and macros on the merits, write a small
            <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">macro_rules!</code>
            helper for repetitive checks, sketch a derive macro API, and map real production needs to declarative macros,
            procedural macros, or build-time code generation.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 20 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li><code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">macro_rules!</code> is the lightest metaprogramming tool when token-pattern expansion is enough.</li>
            <li>Procedural macros operate on token streams in a separate proc-macro crate and are best for derive, attribute, and token-level DSL use cases.</li>
            <li>Macro hygiene helps, but public macros still create a public syntax contract that must be maintained carefully.</li>
            <li>Compile-time DSLs should stay small and expand into understandable Rust data or items.</li>
            <li>When the abstraction is about values, types, or behavior instead of syntax, a function, generic, trait, enum, or build script is usually the better tool.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

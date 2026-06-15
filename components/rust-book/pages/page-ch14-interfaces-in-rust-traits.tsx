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
    title: "A trait is a capability contract, not a base class",
    body: "A trait names a set of methods and associated items that a type promises to provide. It says nothing about how the type stores its data, what else it can do, or where it sits in a hierarchy. You implement a trait for a type from the outside, and a type can implement many unrelated traits without any of them knowing about the others. The contract is the interface; the type is free to be anything that can honor it.",
  },
  {
    title: "Bounds turn the contract into a requirement the compiler checks",
    body: "When a function writes T: Display, it is not documentation; it is a constraint the compiler enforces at the call site. The caller has to supply a type that actually implements the trait, and inside the function you may only use the methods the bounds promise. That is what lets generic code stay both fully general and fully type-checked: the bound is the exact list of operations you are allowed to assume.",
  },
  {
    title: "Static and dynamic dispatch are a deliberate choice, not a default",
    body: "Generic code with trait bounds is monomorphized: the compiler stamps out a specialized copy per concrete type, so calls are direct and inlinable. A trait object such as Box<dyn Trait> erases the concrete type behind a vtable, so one code path handles many types at the cost of an indirect call. Neither is a fallback the language picks for you. You choose which axis to pay for based on whether you want maximum speed or a single heterogeneous collection.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "A trait is closest to a concept plus the pure-virtual half of an abstract base class, but it is implemented out of line and carries no data or layout. Generic bounds behave like checked templates: errors surface at the definition against the bound, not as a wall of instantiation diagnostics. A trait object is the vtable you would hand-roll, except object safety is a compiler rule rather than a convention you hope nobody breaks.",
  },
  {
    title: "C# background",
    body: "Traits read like interfaces, including default methods, but you add them to types you do not own and there is no implicit upcast to a shared root. The biggest shift is dispatch: a generic with a bound is specialized at compile time with no boxing, so you reach for dyn deliberately when you want one list of mixed implementations, instead of getting interface-typed virtual calls everywhere by default.",
  },
  {
    title: "Go background",
    body: "Rust traits are explicit where Go interfaces are structural: a type satisfies a trait only when you write an impl block, never by accidentally having the right method set. In exchange you get default methods, associated types, and bounds that are verified up front. A dyn trait object is the fat pointer you already know from Go interfaces, but you opt into it by name rather than receiving it as the only flavor of polymorphism.",
  },
  {
    title: "Python background",
    body: "Duck typing becomes a contract the compiler signs off on before the program runs. Instead of trusting that an object happens to have a method at call time, you state T: SomeTrait and the requirement is checked everywhere. Abstract base classes are the nearest analogue, but traits are added externally to existing types and a generic bound costs nothing at runtime, where a Python method lookup never does.",
  },
]

const fundamentals = [
  {
    title: "Defining and implementing a trait",
    body: "A trait declares method signatures, and optionally default bodies, associated types, and associated constants. A separate impl block ties the trait to a concrete type and fills in whatever the type did not inherit from a default. Because the impl is external, you can give a foreign type a behavior it was never designed with, as long as either the trait or the type is local to your crate.",
  },
  {
    title: "Default methods",
    body: "A trait method may ship a default body written in terms of the other methods on the trait. Implementers get that behavior for free and override only the parts that differ. This is how a small required core, such as one decide method, can expose a wide convenience surface without forcing every type to reimplement it, and without inheritance.",
  },
  {
    title: "Coherence and the orphan rule",
    body: "Rust allows at most one implementation of a given trait for a given type across the whole program, which is what makes trait resolution unambiguous. The orphan rule enforces it: you may implement a trait for a type only if you own the trait, the type, or both. When neither is yours, the newtype wrapper is the standard way to attach behavior without breaking coherence.",
  },
]

const dispatchCards = [
  {
    title: "Generic bounds: static dispatch",
    body: "Writing fn run<T: Plugin>(p: &T) asks the compiler to generate a dedicated version of run for each concrete T used. The call to a trait method becomes a direct, inlinable call with no indirection. You pay in code size and compile time, and you gain peak runtime speed plus the full power of associated types and where-clauses.",
  },
  {
    title: "Trait objects: dynamic dispatch",
    body: "Writing &dyn Plugin or Box<dyn Plugin> erases the concrete type. The value becomes a fat pointer carrying the data and a vtable of method addresses, and calls go through that table. One function body now serves every implementer, which is exactly what you want for a heterogeneous Vec<Box<dyn Plugin>> or a runtime-chosen strategy.",
  },
  {
    title: "How to choose",
    body: "Reach for generics when the set of types is known at compile time and you want speed and richer signatures. Reach for trait objects when you need to store or pass different concrete types uniformly, keep binary size down, or decide the implementation at runtime. The decision is local: the same trait can be used both ways in different places.",
  },
]

const associatedTypeCards = [
  {
    title: "Associated types name one output per implementer",
    body: "An associated type, declared with type Decision; in the trait, lets each implementer pick a single concrete type for that slot. Iterator's Item is the canonical example. Because there is exactly one choice per implementer, signatures read cleanly as Self::Decision instead of carrying an extra generic parameter everywhere.",
  },
  {
    title: "Generic parameters allow many implementations",
    body: "A trait generic over a type parameter, such as From<T>, can be implemented many times for the same type with different T. Use a type parameter when one type should support several variants of the operation, and an associated type when each implementer has a single natural answer.",
  },
  {
    title: "Bounding the associated type",
    body: "A where-clause can constrain the associated type itself, for example P: RetryPolicy<Decision = bool>. That lets a caller insist not only that a type implements the trait, but that its chosen output type is the one the caller can actually use, all checked before the program runs.",
  },
]

const objectSafetyCards = [
  {
    title: "What object safety means",
    body: "A trait is object-safe when it can be turned into a dyn trait object. The compiler must be able to build a vtable, which means methods take a self receiver, do not return Self by value, and carry no generic type parameters of their own. Marker requirements like Sized on the trait also disqualify it.",
  },
  {
    title: "Why generic methods break it",
    body: "A vtable has one slot per method, but a generic method would need a separate entry per concrete type argument, which cannot be known when the object is built. The same logic rules out returning Self: the caller of a dyn value does not know the concrete size to receive. These are not arbitrary bans; they are what makes a single indirect call possible.",
  },
  {
    title: "Designing for both uses",
    body: "If a trait must work behind dyn, keep its core methods object-safe and move the generic conveniences into a separate extension trait or into default methods bounded by where Self: Sized. That way the same abstraction supports fast generic call sites and a heterogeneous collection without forcing one to give up the other.",
  },
]

const supertraitCards = [
  {
    title: "Supertraits compose requirements",
    body: "Writing trait Audit: Display means any Audit implementer must also implement Display, so methods on Audit may freely call Display methods. It expresses that one capability presupposes another without inheritance of state.",
  },
  {
    title: "Blanket implementations",
    body: "An impl such as impl<T: Display> Loggable for T gives every Display type the Loggable behavior at once. The standard library uses this heavily; it is how ToString comes for free to anything that implements Display.",
  },
  {
    title: "Marker traits",
    body: "Some traits, like Send and Sync, have no methods. They mark a property the compiler reasons about, such as whether a value may cross a thread boundary. They are still ordinary traits and still participate in bounds.",
  },
]

const apiDesignCards = [
  {
    title: "Accept the weakest bound that works",
    body: "A function should require only the capabilities it actually uses. Over-constraining the parameter, for example demanding Clone when you only read the value, shrinks the set of callers for no benefit and leaks implementation choices into the signature.",
  },
  {
    title: "Make the trait the public surface",
    body: "Expose behavior through a small, stable trait and let concrete types stay internal. Callers depend on the contract, not the implementation, so you can add or swap implementers without breaking them, which is the same reason you would publish an interface in any language.",
  },
  {
    title: "Keep traits cohesive",
    body: "A trait should describe one capability. A grab-bag trait forces every implementer to satisfy methods it does not need and makes object safety harder to preserve. Several focused traits, combined with supertraits where one truly depends on another, age better than one wide one.",
  },
]

const productionPatterns = [
  "Define plugin and strategy boundaries as small traits, then choose generics or dyn per call site based on whether the type set is fixed or open.",
  "Use associated types for the single natural output of an implementer, and generic parameters when one type legitimately supports several variants.",
  "Keep traits that may be used behind dyn object-safe, and push generic helpers into default methods bounded by where Self: Sized.",
  "Respect the orphan rule with a newtype wrapper when you must attach behavior to a foreign type and trait.",
  "Bound function parameters with the minimum capability they use, and let blanket impls extend behavior across whole families of types.",
  "Treat the trait, not the struct, as the published contract so implementations can change without breaking callers.",
]

const pitfalls = [
  "Reaching for Box<dyn Trait> everywhere by reflex, paying for indirection on call sites where a generic bound would inline cleanly.",
  "Adding a generic method or a Self return type to a trait you later need behind dyn, then discovering it is no longer object-safe.",
  "Over-constraining a generic with bounds the body never uses, which quietly rejects valid callers.",
  "Choosing a type parameter where an associated type fit, producing turbofish noise and ambiguous inference for every caller.",
  "Trying to implement a foreign trait for a foreign type and fighting the orphan rule instead of introducing a newtype.",
  "Treating default methods as fixed behavior and forgetting that an implementer can override them, so reviewers must read the impl, not only the trait.",
]

const supertraitSnippet = `trait Identify {
    fn id(&self) -> u64;
}

// Audit requires Identify, so Audit methods may call id().
trait Audit: Identify {
    fn audit_line(&self) -> String {
        format!("id={} audited", self.id())
    }
}`

const summaryPoints = [
  "A trait is a capability contract implemented from the outside; a type can satisfy many unrelated traits with no hierarchy.",
  "Trait bounds turn a contract into a compiler-checked requirement, so generic code stays both general and fully type-checked.",
  "Generics monomorphize to direct calls; trait objects erase the type behind a vtable. The choice is per call site, not a language default.",
  "Associated types give each implementer one natural output; generic parameters allow many implementations of the same trait for one type.",
  "Object safety is the rule that decides whether a trait can live behind dyn, and it is worth designing for deliberately.",
  "Coherence and the orphan rule keep trait resolution unambiguous; the newtype wrapper is the escape hatch for foreign trait and type.",
]

export function PageCh14InterfacesInRustTraits() {
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
  const pageIndex = getPageIndexById("ch14-interfaces-in-rust-traits")
  const chapter01PageIndex = getPageIndexById("ch01-why-rust-feels-different")
  const chapter15PageIndex = getPageIndexById("ch15-oop-models-in-rust")
  const exercisesPageIndex = getPageIndexById("ch14-interfaces-in-rust-traits-exercises")
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
          Chapter 14 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Trait interfaces define capability contracts across library and service boundaries. This chapter treats bounds,
          associated types, generic dispatch, trait objects, and object safety as reviewable API choices rather than
          syntax, so you can decide deliberately what a type must prove and what each call site pays for at runtime.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapter 01</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 01 noted that traits describe behavior and that generics usually compile via monomorphization
                rather than dynamic dispatch. This chapter makes that operational: how to write the contract, how bounds
                check it, and when to pay for a vtable instead.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(chapter01PageIndex)} className="shrink-0">
              Revisit Chapter 01
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A service needs a pluggable processing stage: today it normalizes text, tomorrow it will validate, redact, or
            enrich, and operators want to enable stages by configuration. At the same time, a retry layer needs to ask a
            policy whether another attempt is allowed, and that policy must be checkable at compile time so a misuse fails
            the build, not production. Both are interface problems, and both are solved with traits, but they pull in
            opposite directions on dispatch.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Name the capability as a small trait: the exact methods a type must provide.</li>
              <li>Decide what each implementer outputs once: associated type, or a generic parameter if it varies.</li>
              <li>Pick dispatch per call site: generic bound for speed, dyn for a heterogeneous collection.</li>
              <li>If dyn is needed, keep the trait object-safe and move generic helpers out of the core.</li>
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
            <p className="text-sm text-muted-foreground leading-6">
              The shape worth memorizing is a triangle. At one corner sits the trait, a named set of methods. At another
              sit the concrete types, each with its own impl block. At the third sit the call sites, which name the trait
              as a bound or as a dyn object. A type and a trait are linked only by an impl, and a call site reaches a type
              only through the trait. Nothing is connected by inheritance; everything is connected by an explicit
              implementation.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Trait[Trait: required methods] -->|impl for A| A[Type A]\n  Trait -->|impl for B| B[Type B]\n  Call[Call site] -->|bound or dyn| Trait\n  A -.honors contract.-> Trait\n  B -.honors contract.-> Trait`}
              caption="A trait links to types only through impl blocks; call sites reach types only through the trait. There is no shared base."
            />
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Traits, impls, and default methods</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {fundamentals.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{item.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Because an impl is separate from the type definition, the same struct can implement
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Display</code>,
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Iterator</code>, and a domain
                trait of your own, none of which know about the others. That is the practical meaning of composition over
                inheritance here: capability is added in independent layers rather than fixed in a chain of parents.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Static dispatch and dynamic dispatch</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The single most consequential trait decision is how a call reaches the implementation. A generic bound is
              resolved at compile time into a direct call; a trait object is resolved at runtime through a vtable. The
              diagram below contrasts the two paths so the cost of each is visible before you commit a call site to one.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  G[Generic call: T bound] -->|monomorphized| GA[Direct call into A]\n  G -->|monomorphized| GB[Direct call into B]`}
              caption="Static dispatch: a generic call is specialized per concrete type into a direct, inlinable call."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              The dynamic path instead funnels every concrete type through one shared indirection:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  D[dyn Trait call] --> V[vtable lookup]\n  V --> DA[Indirect call into A]\n  V --> DB[Indirect call into B]`}
              caption="Dynamic dispatch: a dyn call funnels every type through one vtable indirection before reaching the implementation."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
              {dispatchCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Associated types versus generic parameters</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Both let a trait talk about types it does not yet know, but they answer different questions. An associated
              type asks the implementer to commit to one output. A generic parameter lets the same type implement the
              trait several ways. Choosing the wrong one shows up later as turbofish noise on every caller or as an
              implementation you cannot write.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {associatedTypeCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <Boxes className="h-4 w-4 text-primary" />
              <h4 className="font-semibold text-foreground">Object safety</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              You can only build a {"Box<dyn Trait>"} when the trait is object-safe, because the compiler has to lay out a
              vtable with one fixed slot per method. The rules are not arbitrary; each one exists so that a single
              indirect call works without knowing the concrete type. The flow below is the check the compiler runs when
              you reach for a trait object.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Start[Use trait as dyn] --> Q1{Every method takes a self receiver}\n  Q1 -->|no| Fail[Not object safe]\n  Q1 -->|yes| Q2{Any method has generic params}\n  Q2 -->|yes| Fail\n  Q2 -->|no| Q3{Any method returns Self by value}\n  Q3 -->|yes| Fail\n  Q3 -->|no| Ok[Object safe: vtable buildable]`}
              caption="Object safety is a checklist: every method takes a self receiver, none is generic, and none returns Self by value. Fail any one and dyn is rejected."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
              {objectSafetyCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="flex-1">
                <h4 className="font-semibold text-foreground mb-3">Supertraits, blanket impls, and markers</h4>
                <p className="text-sm text-muted-foreground leading-6 mb-4">
                  Traits compose. A supertrait says one capability presupposes another, a blanket impl grants a behavior
                  to every type that already meets a bound, and a marker trait carries no methods but still participates
                  in the type system. The snippet shows a supertrait: any
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Audit</code>
                  type must also be
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Identify</code>, so the
                  default method can call across the requirement.
                </p>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{supertraitSnippet}</code>
                </pre>
              </div>
              <div className="grid gap-3 lg:w-72 shrink-0">
                {supertraitCards.map((card) => (
                  <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-3">
                    <div className="font-medium text-foreground mb-1 text-sm">{card.title}</div>
                    <p className="text-xs text-muted-foreground leading-5">{card.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Traits as API design</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              At a boundary, the trait is the contract you publish and the concrete type is an implementation detail you
              keep. The discipline is the same one you would apply to any interface, with one Rust-specific lever: the
              bound on a parameter is the precise list of capabilities the caller must supply, so it is worth writing
              exactly, no wider and no narrower than the body needs.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {apiDesignCards.map((card) => (
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
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How this lands by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Most engineers already have an interface mechanism in muscle memory. The useful question is which part of that
            mechanism transfers to traits and which part quietly misleads. The shift is rarely about syntax; it is about
            where implementation is attached, when dispatch is resolved, and whether the compiler verifies the contract
            before the program runs.
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
                A trait is a contract you will live behind for a long time. Adding a generic method or a by-value Self
                return is easy today and quietly forecloses dynamic dispatch tomorrow. Decide early whether the trait must
                work behind dyn, because retrofitting object safety is a breaking change.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Trait bounds and associated types</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A retry policy trait with an associated output type, a default method, and a generic function bounded so
                  the output is exactly the bool the caller can use.
                </p>
              </div>
              {codes.traits_bounds_associated_types !== DEFAULT_CODES.traits_bounds_associated_types && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("traits_bounds_associated_types")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the trait declares
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">type Decision</code>, so each
              implementer commits to one output type. The function
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">evaluate</code>
              is generic over the policy but bounds the associated type with
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Decision = bool</code>, which is
              static dispatch: the compiler specializes it for
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">FixedLimit</code>. The
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">should_log</code>
              call uses the trait default, untouched by the impl. Trace the call through the diagram, then read it in code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Main[main] -->|and policy, 2| Eval[evaluate generic over P]\n  Eval -->|bound P RetryPolicy Decision bool| Decide[FixedLimit decide]\n  Decide -->|2 less than 3| True[true]\n  Eval --> Label[label override: fixed-limit]\n  Main --> Log[should_log default: true]`}
              caption="evaluate is specialized for FixedLimit; the associated Decision is pinned to bool, label is overridden, and should_log falls through to the default."
            />
            <RustCodeEditor
              code={codes.traits_bounds_associated_types}
              onChange={(newCode) => updateCode("traits_bounds_associated_types", newCode)}
              onRun={() => runCode("traits_bounds_associated_types")}
              output={outputs.traits_bounds_associated_types ?? null}
              isRunning={isRunning === "traits_bounds_associated_types"}
              filename="trait_bounds_associated_types.rs"
              expectedOutput={"fixed-limit => true\nlog = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.traits_bounds_associated_types}
              onRevert={() => resetCode("traits_bounds_associated_types")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Associated type</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Each implementer commits to one
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Decision</code> output.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Bound</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The where-clause pins the output so the caller can trust it is a bool.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Default method</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">should_log</code> is inherited
                  without an override.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-5">
              Quick check: run it to confirm the baseline, then change
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">max</code> or the attempts passed
              to
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">evaluate</code>
              and watch the decision flip while the contract stays the same.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">dyn Trait plugin pipeline</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A heterogeneous list of plugins stored as trait objects, each running the same input through one shared
                  function that dispatches dynamically.
                </p>
              </div>
              {codes.traits_dyn_plugin_pipeline !== DEFAULT_CODES.traits_dyn_plugin_pipeline && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("traits_dyn_plugin_pipeline")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: two unrelated structs,
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Uppercase</code> and
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Prefix</code>, implement the same
              object-safe
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Plugin</code>
              trait. They live together in a {"Vec<Box<dyn Plugin>>"}, which is only possible because the concrete types
              are erased. The function
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">run_all</code>
              iterates that list and calls through the vtable, so one loop drives every plugin. The diagram is that fan-out.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Input[input: rust] --> RunAll[run_all over dyn Plugin]\n  RunAll --> V[vtable dispatch]\n  V --> Up[Uppercase.run]\n  V --> Pre[Prefix.run]\n  Up --> O1[uppercase => RUST]\n  Pre --> O2[prefix => svc-rust]`}
              caption="One run_all loop calls each boxed plugin through its vtable; different concrete types share a single code path because the type is erased."
            />
            <RustCodeEditor
              code={codes.traits_dyn_plugin_pipeline}
              onChange={(newCode) => updateCode("traits_dyn_plugin_pipeline", newCode)}
              onRun={() => runCode("traits_dyn_plugin_pipeline")}
              output={outputs.traits_dyn_plugin_pipeline ?? null}
              isRunning={isRunning === "traits_dyn_plugin_pipeline"}
              filename="dyn_plugin_pipeline.rs"
              expectedOutput={"uppercase => RUST\nprefix => svc-rust"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.traits_dyn_plugin_pipeline}
              onRevert={() => resetCode("traits_dyn_plugin_pipeline")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Object safety</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Both methods take
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">&self</code> and avoid
                  generics, so the trait can be boxed.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Heterogeneous list</div>
                <p className="text-xs text-muted-foreground leading-5">
                  {"Vec<Box<dyn Plugin>>"} holds different types behind one element type.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Dynamic dispatch</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Each
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">run</code> call goes through
                  the vtable at runtime.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3 leading-5">
              Quick check: run it, then add a third plugin or change the prefix value and confirm the pipeline keeps
              working without touching
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">run_all</code>, which is the whole
              point of the trait-object boundary.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to pick the right bound for a function, choose between an associated type
            and a generic parameter, decide whether a trait is object-safe, and build a small plugin API that works both
            as a generic and behind dyn.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 14 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-3">Next chapter</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Traits are the interface mechanism. Chapter 15 uses them to express the patterns engineers reach for out
                of object-oriented habit: polymorphism, encapsulation, and shared behavior modeled with composition,
                enums, and trait objects instead of inheritance. The dispatch and object-safety choices from this chapter
                are exactly the tools that work makes use of.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(chapter15PageIndex)} className="gap-2 shrink-0">
              Continue to Chapter 15
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

"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Compass,
  FileCode,
  Layers,
  Microscope,
  Wand2,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const whyReadCards = [
  {
    icon: Layers,
    title: "Express contracts as traits, not class hierarchies",
    body: "Translate the interfaces and base classes you already think in into traits, associated types, and bounded generics, and learn when behavior should be a compile-time bound versus a dyn Trait object.",
  },
  {
    icon: Boxes,
    title: "Model a domain in the type system",
    body: "Use enums, newtypes, and ownership to make invalid states unrepresentable, so domain rules are checked by the compiler instead of defended by scattered runtime validation.",
  },
  {
    icon: Compass,
    title: "Reach for generics with a clear cost model",
    body: "Understand monomorphization versus dynamic dispatch well enough to choose deliberately, instead of porting C++ template habits or C# generic instincts that no longer fit.",
  },
  {
    icon: FileCode,
    title: "Design data contracts that survive change",
    body: "Treat serialization as a versioned boundary with serde: stable wire shapes, additive evolution, and the discipline that keeps producers and consumers compatible across deploys.",
  },
  {
    icon: Wand2,
    title: "Generate code without losing safety",
    body: "Use derive macros, declarative macros, and a working sense of what reflection Rust does and does not offer, so metaprogramming stays auditable rather than magical.",
  },
]

const chapters = [
  {
    number: "14",
    title: "Interfaces in Rust: Traits",
    description:
      "Traits as Rust's interface mechanism: trait bounds, associated types, default methods, and the choice between static dispatch and dyn Trait.",
  },
  {
    number: "15",
    title: "OOP Models in Rust",
    description:
      "What carries over from object orientation and what does not: composition over inheritance, enums and trait objects, state patterns, and Rust-native encapsulation.",
  },
  {
    number: "16",
    title: "Domain-Driven Design in Rust",
    description:
      "Encoding domain rules in the type system with newtypes, enums, and ownership so that invalid states cannot be constructed in the first place.",
  },
  {
    number: "17",
    title: "Refactoring Toward Idiomatic Rust",
    description:
      "Moving a working but foreign-feeling design toward the grain of the language, replacing ported patterns with traits, enums, and explicit ownership.",
  },
  {
    number: "18",
    title: "Generics Instead of Templates",
    description:
      "How bounded generics and monomorphization differ from C++ templates and C# generics, and how to pick static or dynamic dispatch with a real cost model.",
  },
  {
    number: "19",
    title: "Serialization and Data Contracts",
    description:
      "Designing serde-based wire formats as versioned contracts: stable envelopes, additive evolution, and keeping transport types out of the domain core.",
  },
  {
    number: "20",
    title: "Metaprogramming",
    description:
      "Declarative and procedural macros: generating boilerplate, deriving behavior, and writing code that writes code while staying readable and auditable.",
  },
  {
    number: "21",
    title: "Reflection and Type Introspection",
    description:
      "What Rust offers in place of runtime reflection: trait-driven dispatch, Any and downcasting, and compile-time type information used deliberately.",
  },
]

const flavorSnippet = `// Make an illegal state unrepresentable, then describe behavior with a trait.
enum Subscription {
    Trial { days_left: u8 },
    Active { renews_on: Date },
    Cancelled,
}

trait Billable {
    fn amount_due(&self) -> Cents; // one contract, many concrete types
}

// Generic code stays monomorphized; dyn Billable opts into dynamic dispatch.
fn invoice<B: Billable>(account: &B) -> Cents {
    account.amount_due()
}`

export function PagePart3DesigningTypesAbstractions() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("part-3-designing-types-abstractions")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <BookOpen className="h-4 w-4" />
          Part III
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Translating the design vocabulary you already have into the way Rust expresses abstraction: through its type
          system rather than through inheritance and runtime machinery.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="space-y-4 max-w-3xl mx-auto text-center">
          <p className="text-sm text-muted-foreground leading-6">
            You arrive at this part already fluent in design. You know interfaces, inheritance, domain modeling,
            generics, serialization, macros, and reflection from C++, C#, Go, or Python. The work here is not to relearn
            those ideas. It is to learn how Rust says them. Most of the vocabulary survives the move; what changes is
            where the abstraction lives. In Rust the type system, not a class hierarchy or a reflective runtime, is the
            primary place you encode the shape of a problem.
          </p>
          <p className="text-sm text-muted-foreground leading-6">
            That shift is worth taking seriously because it changes which mistakes are even possible. A trait makes a
            contract explicit and checkable. An enum can make an invalid state impossible to construct. A bounded
            generic can compile down to the same code you would have written by hand. When the type system carries the
            design, whole categories of runtime bug move to compile time, and the compiler becomes a reviewer of your
            domain rules rather than only your syntax.
          </p>
          <p className="text-sm text-muted-foreground leading-6">
            The eight chapters ahead walk that translation one concept at a time, from traits as interfaces through
            serialization, metaprogramming, and the narrow, deliberate role reflection plays. Each one starts from a
            pattern you already use and shows the idiomatic Rust shape of it, along with the tradeoffs that come with the
            move.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Why read this part</h3>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {whyReadCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h4 className="font-semibold text-foreground">{card.title}</h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Microscope className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">The big idea, in one picture</h3>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-6 mb-2">
              In most object-oriented languages, abstraction flows down an inheritance tree and is resolved at runtime.
              In Rust it flows from the type system outward: a trait names a contract, generics resolve it at compile
              time, and trait objects let you opt back into dynamic dispatch only where you actually need it. The same
              design intent, expressed in a different place.
            </p>
            <MermaidDiagram
              chart={`flowchart LR\n  D[Design intent] --> T[Trait: the contract]\n  T --> G[Generic bound]\n  T --> O[dyn Trait object]\n  G --> M[Monomorphized: compile-time, zero abstraction tax]\n  O --> R[Dynamic dispatch: one vtable, runtime choice]\n  T --> E[Enums and newtypes make invalid states unrepresentable]`}
              caption="One trait, two roads: a generic bound monomorphizes to concrete code, while a dyn Trait object defers the choice to runtime. Enums and newtypes carry the rest of the design in the type system itself."
            />
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-6 mb-3">
                A taste of the flavor: the contract is a trait, the states are an enum that cannot be built wrong, and the
                generic function pays no dispatch cost.
              </p>
              <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{flavorSnippet}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Chapters in this part</h3>
          </div>
          <div className="space-y-3">
            {chapters.map((chapter) => (
              <div
                key={chapter.number}
                className="rounded-xl border border-border bg-card p-5 flex items-start gap-4"
              >
                <div className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
                  {chapter.number}
                </div>
                <div>
                  <h4 className="font-semibold text-foreground">
                    {chapter.number} · {chapter.title}
                  </h4>
                  <p className="text-sm text-muted-foreground leading-6 mt-1">{chapter.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Ready to start</h3>
          <p className="text-sm text-muted-foreground leading-6 max-w-2xl mx-auto mb-4">
            Begin with traits, Rust's answer to the interface. Everything else in this part builds on the idea that a
            contract is a type, and a type is something the compiler can check.
          </p>
          <Button
            onClick={() => setCurrentPage(getPageIndexById("ch14-interfaces-in-rust-traits"))}
            className="gap-2"
          >
            Begin Part III
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      </div>
    </div>
  )
}

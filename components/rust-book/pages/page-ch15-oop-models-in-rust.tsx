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
    title: "One class did four jobs; Rust gives each job its own tool",
    body: "A class in C++, C#, or Python quietly bundles four concerns at once: the data it holds, the behavior it exposes, the visibility of its internals, and the lifetime of the objects it points at. Rust refuses to fuse them. Structs and enums carry data, traits carry behavior, modules and visibility carry encapsulation, and ownership plus borrowing carry lifetime. Designing in Rust means deciding each of those four questions on purpose instead of inheriting all four answers from a base class.",
  },
  {
    title: "Open sets and closed sets want different machinery",
    body: "The single most useful question when modeling a type is whether the set of possibilities is closed or open. A closed set, where you know every case at compile time and want the compiler to force you to handle each one, is an enum. An open set, where new implementations can appear later or in other crates and you want to hold several at once behind one interface, is a trait object. Class hierarchies blur this line because a base class serves both. Rust makes you pick, and most design confusion in ported code comes from picking wrong.",
  },
  {
    title: "The best port of a class hierarchy is usually not a class hierarchy",
    body: "When a deep inheritance tree exists because the language made it the path of least resistance rather than because the domain is genuinely hierarchical, translating it node-for-node into traits produces awkward Rust. The better move is to re-read the domain: shared data becomes a composed field, a fixed family of subtypes becomes an enum, a lifecycle becomes an explicit state machine, and only the truly runtime-selected behavior becomes a trait object. Rust rewards re-modeling and tends to punish mechanical porting.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Abstract base classes gave you two things at once: a vtable for virtual dispatch and a place to inherit fields and protected helpers. Rust splits them. Traits give you the dispatch, but they carry no data, so there is no base-class state to inherit and no fragile-base-class problem to manage. The shift is to stop reaching for a base class to share storage and instead compose the shared piece as a field.",
  },
  {
    title: "C# background",
    body: "Traits land closest to your interfaces, and modules with private fields replace most of what access modifiers did at the type level. The trap is the instinct to model a fixed set of subtypes as an interface plus a class per case and a downcast or pattern check at the use site. In Rust that fixed family is almost always an enum, and the compiler then checks that every match handles every case instead of trusting a runtime type test.",
  },
  {
    title: "Go background",
    body: "You already favor composition and small interfaces, so the philosophy will feel native. What changes is precision: Rust forces you to be explicit about ownership of the embedded parts, about whether a trait is object-safe enough to be a runtime interface, and about whether a set of cases is closed (an enum the compiler exhausts) or open (a dyn interface). Go lets you stay vague on those; Rust makes them visible decisions.",
  },
  {
    title: "Python background",
    body: "Duck typing meant any object with the right methods worked, and inheritance was mostly for sharing implementation. Rust replaces the implicit method contract with a named trait the compiler checks, and replaces share-by-subclassing with share-by-field. There is also no run-time isinstance ladder to lean on for variant dispatch: a closed family becomes an enum with an exhaustive match, which catches the case you forgot before the program runs.",
  },
]

const visitorAlternatives = [
  {
    title: "Classic visitor",
    body: "Useful when operations stay open and the node set is not closed in one crate, but it introduces more traits, more double-dispatch shape, and often more indirection than an enum-based design.",
    code: `trait Visitor {
    fn visit_number(&mut self, value: i64);
    fn visit_add(&mut self);
}`,
  },
  {
    title: "Enum plus `match`",
    body: "Often the calm default when the variant set is closed. Adding a new operation is easy, pattern matching stays local, and the compiler checks exhaustiveness for you.",
    code: `match expr {
    Expr::Number(value) => *value,
    Expr::Add(left, right) => eval(left) + eval(right),
}`,
  },
  {
    title: "Separate passes over owned data",
    body: "In production compilers, planners, and domain pipelines, a pass object operating over arena IDs or references is often clearer than a fully generalized visitor framework.",
    code: `struct TypeCheckPass<'a> {
    arena: &'a ExprArena,
}`,
  },
]

const stateCards = [
  {
    title: "Enum state machine",
    body: "Best when one runtime value may be in one of several closed states and transitions are naturally expressed by `match` over a closed set.",
    code: `enum Document {
    Draft,
    Review,
    Published,
}`,
  },
  {
    title: "Typestate",
    body: "Best when illegal transitions should be impossible at compile time and each state deserves its own type. The tradeoff is more types and more conversion methods.",
    code: `struct DraftPost;
struct ReviewPost;
struct PublishedPost;`,
  },
  {
    title: "Dynamic state objects",
    body: "Possible with trait objects, but usually not the first Rust answer. Reach for it when states are genuinely open or supplied by plugins, not because a Gang-of-Four example used it.",
    code: `Box<dyn State>`,
  },
]

const improvesCards = [
  "Ownership and mutation rules are explicit, which removes many aliasing bugs that class-heavy designs leave to discipline.",
  "Enums make closed polymorphism and impossible-state elimination much easier than inheritance plus runtime type checks.",
  "Composition avoids fragile base-class problems because shared behavior and shared state stop pretending to be the same thing.",
  "Modules and visibility provide strong encapsulation without needing protected-field hierarchies.",
  "Pattern matching and exhaustiveness checks make many domain state machines easier to review than chains of virtual overrides.",
]

const harderCards = [
  "There is no field inheritance, so teams moving from class-heavy frameworks must design composition intentionally instead of expecting reuse through subclass state.",
  "Trait objects are constrained by object safety, which means not every generic trait is also a runtime plugin interface.",
  "Broad shared mutable object graphs are more work in Rust because the language makes aliasing cost visible instead of ambient.",
  "The classic visitor pattern is less ergonomic when an enum plus `match` would have been enough, yet open operation sets can still make visitor-like structures desirable.",
  "Adding a new enum variant forces exhaustiveness repairs across matches. That is usually a feature, but it changes the open/closed tradeoff compared with open class hierarchies.",
]

const productionPatterns = [
  "Start from structs, enums, and modules. Add traits only where multiple implementations are semantically real or a boundary truly benefits from polymorphism.",
  "Prefer composition for shared behavior and shared helpers. If two services share logic, compose a reusable component rather than inventing a base service.",
  "Use enums for closed domain variants such as workflow state, command types, AST nodes, and transport kinds. Use trait objects for plugin registries and runtime-selected behavior.",
  "Keep runtime trait-object interfaces small and focused. If a boundary wants `dyn Trait`, design for object safety up front instead of repairing it after the fact.",
  "If a state machine is operationally important, model transitions explicitly with enums or typestate so invalid states stop leaking into logs, queues, and persistence.",
]

const pitfalls = [
  "Rebuilding a class hierarchy with `dyn Trait` everywhere before deciding whether the domain is actually open or closed.",
  "Using trait objects for a fixed set of variants that would be clearer and faster as an enum.",
  "Using enums for a plugin boundary that is meant to stay open across crates or deployments.",
  "Treating modules as a secondary concern. In Rust, encapsulation often lives in `mod`, private fields, and narrow constructors rather than in inheritance structure.",
  "Porting the state pattern mechanically with boxed trait objects when an enum or typestate model would make invalid transitions easier to remove.",
  "Forgetting that object safety, ownership of boxed values, and thread bounds such as `Send + Sync` all matter once runtime polymorphism crosses subsystem boundaries.",
]

const noInheritanceSnippet = `trait Render {
    fn render(&self) -> String;
}

struct Button {
    label: String,
}`

const compositionSnippet = `struct RetryPolicy {
    max_attempts: u32,
}

struct BillingService<N> {
    notifier: N,
    retry: RetryPolicy,
    metrics: Metrics,
}`

const encapsulationSnippet = `mod account {
    pub struct Account {
        balance_cents: i64,
    }

    impl Account {
        pub fn deposit(&mut self, cents: i64) {
            self.balance_cents += cents;
        }
    }
}`

const traitSnippet = `trait Processor {
    fn run(&self, input: &str) -> String;
}

fn execute<P: Processor>(processor: &P, input: &str) -> String {
    processor.run(input)
}`

const traitObjectSnippet = `let plugins: Vec<Box<dyn Processor>> = vec![
    Box::new(JsonProcessor),
    Box::new(XmlProcessor),
];`

const enumSnippet = `enum Event {
    Http(Request),
    Retry(JobId),
    Shutdown,
}`

export function PageCh15OopModelsInRust() {
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
  const pageIndex = getPageIndexById("ch15-oop-models-in-rust")
  const chapter05PageIndex = getPageIndexById("ch05-ownership-inside-structs")
  const chapter13PageIndex = getPageIndexById("ch13-arena-allocation")
  const chapter14PageIndex = getPageIndexById("ch14-interfaces-in-rust-traits")
  const exercisesPageIndex = getPageIndexById("ch15-oop-models-in-rust-exercises")
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
          Chapter 15 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Rust object modeling uses composition, traits, enums, and explicit state transitions to represent domain
          behavior. This chapter maps those choices to maintainable service and library APIs.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 05, 13, and 14</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 05 explained how structs carry ownership and layout. Chapter 13 showed that storage and identity
                are separate design choices. Chapter 14 covered traits, dispatch, and object safety. This chapter puts
                those pieces together into Rust&apos;s practical answer to OOP modeling.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter05PageIndex)}>
                Chapter 05
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter13PageIndex)}>
                Chapter 13
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter14PageIndex)}>
                Chapter 14
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">A worked scenario: the document-workflow platform</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Throughout the chapter we will keep one concrete system in view. A document-workflow platform moves documents
            through a fixed approval lifecycle, lets services share retry and notification logic, hides invoice
            representation behind a clean API, and accepts third-party transport plugins for delivering output. Each of
            those four needs maps to a different Rust tool, and the whole point of the chapter is to see why. In a
            class-first language all four would likely become subclasses of some <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Workflow</code> base
            type; in Rust they deliberately do not.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The deciding question for each need is the same: is the set of cases closed and known at compile time, or open
            and extended later? That single question routes the design to an enum, a struct, a module boundary, or a trait
            object, and reading the diagrams below in that order is most of the chapter in one picture.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Start[Modeling need] --> Q1{Set of cases closed?}\n  Q1 -->|Yes, a fixed lifecycle| Enum[Enum plus match]\n  Q1 -->|No, plugins added later| Dyn[Trait object dyn Trait]`}
            caption="First question: is the set of variants closed (an enum) or open (a trait object)?"
          />
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The same modeling need also routes the other two questions, sharing and hiding, to their own tools:
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Start[Modeling need] --> Q2{Sharing data or behavior?}\n  Q2 -->|Shared data| Comp[Compose a field]\n  Q2 -->|Shared behavior| Trait[Implement a trait]\n  Start --> Q3{Hiding representation?}\n  Q3 -->|Yes| Mod[Module plus private fields]`}
            caption="Sharing routes to a composed field or a trait; hiding routes to a module with private fields. Rust does not fold all four into one inheritance tree."
          />
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Start with concrete structs and enums before you invent a trait hierarchy.</li>
              <li>Decide whether the variant set is open or closed.</li>
              <li>Use traits for shared behavior, not for pretending Rust has base-class fields.</li>
              <li>Use runtime trait objects only when runtime heterogeneity is semantically real.</li>
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Four questions, four separate tools</h3>
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
            <h3 className="text-lg font-semibold text-foreground">The four tools and when to reach for each</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Rust without classical inheritance</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Rust has no class inheritance with shared fields. A type does not extend another type to inherit state.
                  That is a sharp correction for C++ and C# engineers: traits describe behavior, but data reuse comes from
                  ordinary fields, helper types, and composition.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{noInheritanceSnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This sounds like a loss until you notice what disappears with it: fragile base classes, partially
                  initialized parent state, hidden inherited invariants, and broad object graphs whose aliasing story is
                  unclear. Rust makes each of those choices explicit instead.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Composition over inheritance</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The shape to notice is that inheritance grows data downward through a chain of parents, while composition
              grows it sideways as named fields you can name, swap, and test one at a time. The two pictures hold the same
              information, but only the composed one keeps each dependency visible and independently replaceable.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Inheritance\n    direction TB\n    Base[Service base: retry, metrics] --> Mid[Billing base]\n    Mid --> Leaf[ConcreteBilling]\n  end`}
              caption="Inheritance buries shared state in a parent chain: each level inherits the one above."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              Side by side, composition holds the same parts but lays them out as fields the struct owns directly:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Composition\n    direction TB\n    Svc[BillingService] --> R[retry: RetryPolicy]\n    Svc --> N[notifier: N]\n    Svc --> M[metrics: Metrics]\n  end`}
              caption="Composition lists the same parts as named fields, each one visible, swappable, and testable on its own."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  The default Rust reuse pattern is simple: a struct owns the components it needs. Shared logic lives in
                  those components or in traits implemented by them. The design reads directly from the fields instead of
                  from a base-class tree, so there is no hidden parent state to reason about when you read the type.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{compositionSnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is especially useful in services and pipelines. A <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">BillingService</code> can
                  compose a retry policy, a notifier, a cache, and a metrics recorder without pretending those pieces are
                  one inheritance family. Each dependency remains visible, testable, and replaceable, and a test can supply
                  a fake notifier by setting one field rather than subclassing the whole service.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Encapsulation through modules and visibility</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  In Rust, encapsulation usually lives in modules, private fields, narrow constructors, and focused
                  methods. You do not need inheritance to hide representation. You need a good module boundary and the
                  discipline to expose only what callers actually need.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{encapsulationSnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  The translation is this: the public surface is the contract. The internal layout is still
                  allowed to change. Rust&apos;s module system often gives tighter encapsulation than a deep protected-member
                  hierarchy because the exported API is narrower and more deliberate.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Polymorphism with traits</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Traits are Rust&apos;s main behavior abstraction. They let generic code ask for capabilities without naming
                  one concrete type too early. This is Rust&apos;s primary answer to interface-like OOP design.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{traitSnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  The important distinction from inheritance is that the trait does not bring data fields with it. The
                  implementor chooses its own storage and ownership shape. That is why the same trait can fit a stack
                  value, a boxed object, or an arena-backed node equally well.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Trait objects as runtime polymorphism</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  When the system truly needs runtime heterogeneity, Rust uses trait objects such as{" "}
                  <code className="px-1.5 py-0.5 rounded bg-card font-mono text-[11px]">Box&lt;dyn Processor&gt;</code>.
                  This is the closest thing Rust has to virtual-dispatch OOP, but it is opt-in and object-safety rules
                  still apply.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{traitObjectSnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Use this for plugins, strategy registries, sinks, handlers selected from configuration, or any boundary
                  where one collection must hold several concrete implementations at once. Do not use it just because an
                  old base class existed. Chapter 14 covered the dispatch and object-safety details underneath this choice.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Enums as closed polymorphism</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The contrast worth holding in your head is how the three options dispatch. A generic trait bound is resolved
              at compile time into one specialized copy per type; a trait object defers the choice to a vtable at run time;
              an enum keeps every case in one type and lets the compiler force every match to cover all of them. The
              diagrams below line them up so the tradeoff is visible before you read any code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Call[Call site] --> G["Generic fn P: Trait"]\n  G -->|monomorphized| GT[One copy per concrete type]\n  Call --> D["dyn Trait via Box"]\n  D -->|vtable lookup| DT[Any type, chosen at run time]`}
              caption="Static path: a generic bound is monomorphized at compile time; a trait object defers the choice to a vtable at run time."
            />
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The third option keeps every case in one type rather than dispatching across types:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Call[Call site] --> E[Enum value]\n  E -->|exhaustive match| ET[Fixed set, compiler checks all cases]`}
              caption="Closed path: an enum holds a fixed set of cases and the compiler forces every match to cover all of them."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Enums are Rust&apos;s strongest answer when the variant set is closed. Instead of a base class plus derived
                  types, you declare the full set of variants and let pattern matching drive behavior. The data for each
                  case lives inline, so there is no boxing and no pointer chase to reach it.
                </p>
                <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{enumSnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  This is often better than a traditional OOP hierarchy for commands, events, workflow state, AST nodes,
                  transport types, and many domain models. The compiler checks exhaustiveness, which means adding a new
                  variant turns into a compile-time repair across every match rather than a quiet runtime default that
                  ships to production unhandled.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">State pattern in Rust</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              A lifecycle is the clearest case of a closed set: there is a finite list of states and a finite list of legal
              transitions between them. The classical state pattern models each state as its own object behind an
              interface; in Rust the same shape is usually an enum whose <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">match</code> arms
              are the transitions. The three cards below split the choice by where you want an illegal transition to fail:
              at run time, at compile time, or only when the set is genuinely open. The document example later in the
              chapter draws the actual lifecycle graph.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {stateCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The typestate column is worth one extra sentence, because the card only shows three empty structs. Because{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">DraftPost</code>,{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">ReviewPost</code>, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">PublishedPost</code> are distinct
              types, a function that requires a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">PublishedPost</code> cannot
              accept a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">DraftPost</code>; the invalid
              transition is rejected at compile time rather than checked at run time. The exercise page builds this out
              into a working lifecycle.
            </p>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The practical default is usually enum state or typestate, not boxed state objects. A state object model can
                still be correct, but Rust makes the alternatives so strong that many classical implementations become
                needlessly dynamic.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Visitor pattern and alternatives</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {visitorAlternatives.map((item) => (
                <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{item.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{item.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{item.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                Rust often improves on classical visitor-heavy designs because enums and exhaustiveness make closed trees
                easier to traverse. But when operations or node families stay open across crates, visitor-like trait seams
                can still be the right model.
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
                  Example 1: composition, visibility, and trait-based behavior
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The service composes a notifier instead of inheriting a base class, and the invoice keeps its fields
                  private behind methods.
                </p>
              </div>
              {codes.oop_models_composition_traits !== DEFAULT_CODES.oop_models_composition_traits && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("oop_models_composition_traits")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6">
              What to look at: trace where the behavior comes from. The service holds the notifier as a field (<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">notifier: N</code>),
              reaches the invoice only through public methods because its fields are private to the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">billing</code> module,
              and delegates notification to whatever <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Notifier</code> it was built with. Nothing is inherited; every
              capability is a field or a trait bound.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Main[main] -->|owns| Svc[BillingService N]\n  Svc -->|field| Not[notifier: EmailNotifier]\n  Main -->|borrow Invoice| Svc\n  Svc -->|notifier.send| Not\n  Not -->|reads via id| Inv[Invoice private fields]\n  Svc -->|process via methods| Inv`}
              caption="Reuse flows through a field and a trait bound, not a parent class. The invoice is reached only through its public methods."
            />
            <RustCodeEditor
              code={codes.oop_models_composition_traits}
              onChange={(newCode) => updateCode("oop_models_composition_traits", newCode)}
              onRun={() => runCode("oop_models_composition_traits")}
              output={outputs.oop_models_composition_traits ?? null}
              isRunning={isRunning === "oop_models_composition_traits"}
              filename="composition_and_traits.rs"
              expectedOutput={"invoice = 41 cents = 1250\nnotification = queued email for 41\nsent = 1"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.oop_models_composition_traits}
              onRevert={() => resetCode("oop_models_composition_traits")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: change the invoice ID, cents, or notifier prefix and rerun. The point is not the string
              formatting. It is that reuse comes from fields plus trait bounds, not from a parent service class.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Composition</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">BillingService</code> owns a
                  notifier component directly.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Encapsulation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The invoice fields stay private, so callers cannot violate representation casually.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Polymorphism</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Trait-based behavior stays open without dragging storage inheritance along with it.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: enum-based state pattern</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The state set is closed, so an enum plus explicit transitions is calmer than a family of dynamic state
                  classes.
                </p>
              </div>
              {codes.oop_models_enum_state_machine !== DEFAULT_CODES.oop_models_enum_state_machine && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("oop_models_enum_state_machine")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6">
              What to look at: each transition takes <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">self</code> by
              value and returns a new <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Document</code>, so the old
              state is consumed and cannot be used again. The chain in <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">main</code> walks
              the lifecycle one move at a time, and any transition that does not apply to the current state falls through to
              the catch-all arm that returns the state unchanged.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  D["Draft { title }"] -->|request_review| R["Review { title, reviewer }"]\n  R -->|publish| P["Published { title, slug }"]\n  D -.->|publish: no-op| D\n  R -.->|request_review: no-op| R`}
              caption="The builder chain consumes self at each step: Draft becomes Review becomes Published. Dashed edges are transitions that do not apply and return the value untouched."
            />
            <RustCodeEditor
              code={codes.oop_models_enum_state_machine}
              onChange={(newCode) => updateCode("oop_models_enum_state_machine", newCode)}
              onRun={() => runCode("oop_models_enum_state_machine")}
              output={outputs.oop_models_enum_state_machine ?? null}
              isRunning={isRunning === "oop_models_enum_state_machine"}
              filename="enum_state_machine.rs"
              expectedOutput={"state = published\nslug = rust-oop"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.oop_models_enum_state_machine}
              onRevert={() => resetCode("oop_models_enum_state_machine")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: change the title and rerun. The variant set stays closed and the transition logic stays in one
              visible place, which is usually easier to review than a dynamic state-object lattice.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Closed polymorphism</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The compiler knows every valid document state ahead of time.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">State repair</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Illegal transitions can be made explicit instead of disappearing behind shared mutable flags.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Alternative</div>
                <p className="text-xs text-muted-foreground leading-5">
                  If you want compile-time-only transitions, the typestate exercise page pushes this idea one step further.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch15_oop_models_in_rust/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Translating instincts from other languages</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            The hardest part of OOP in Rust is rarely a missing feature; it is an instinct that no longer pays off. Each
            card below names the one mental-model shift that trips up engineers from that language, not a table of which
            crate replaces which library.
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
                The most common translation mistake is trying to preserve the old class shape instead of preserving the
                actual domain rules. Rust rewards re-modeling. It often punishes mechanical porting.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">When Rust improves on traditional OOP</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {improvesCards.map((item) => (
              <div key={item} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">When Rust makes OOP harder</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {harderCards.map((item) => (
              <div key={item} className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to replace inheritance with composition, choose between traits and enums
            for a given variant set, and refactor a state machine into a more Rust-native model.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 15 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Rust does not offer classical inheritance with shared fields. It splits OOP concerns into smaller, clearer tools.</li>
            <li>Composition is the default reuse mechanism. Traits express behavior. Modules and visibility express encapsulation.</li>
            <li>Traits and trait objects solve open polymorphism. Enums solve closed polymorphism. Confusing the two is a common design mistake.</li>
            <li>State machines are usually better modeled with enums or typestate than with boxed state objects ported mechanically from older patterns.</li>
            <li>Rust often improves traditional OOP by making ownership, state validity, and variant closure explicit, but it also makes some inheritance-shaped designs harder on purpose.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

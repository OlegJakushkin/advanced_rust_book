"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
  Layers,
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
    title: "DDD in Rust is mostly about boundaries and invariants",
    body: "Rust does not give you inheritance hierarchies or runtime magic to fake a domain model. That is helpful. It pushes you toward explicit boundaries: which types are domain concepts, which rules belong in constructors and methods, and which layer may talk to infrastructure.",
  },
  {
    title: "An aggregate is an ownership and consistency boundary",
    body: "In Rust terms, an aggregate root is the place where invariants are enforced before state escapes. That fits the language well. One root owns the state that must change together, and methods become the place where the business rule is checked.",
  },
  {
    title: "Repositories are seams, not dumping grounds",
    body: "A repository trait is a boundary contract between domain/application code and persistence. It should not become an ORM-shaped bag of every query the storage layer happened to make convenient.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You have modeled rich types before, but your reflex for shared behavior is probably a base class with protected state and virtual methods. Rust removes that vehicle entirely, which forces the question you should have been asking anyway: is this shared behavior (a trait), shared data (a field or component), or a closed set of cases (an enum)? The aggregate also stops being a graph of pointers you must keep alive by hand and becomes one owner of the state that changes together.",
  },
  {
    title: "C# background",
    body: "Interface-heavy domain models and a framework that quietly tracks entity identity have trained you to lean on reference semantics and runtime services. The shift is that Rust keeps ownership and value semantics visible: a newtype is a real distinct type, not an annotation, and an aggregate's invariants live in its methods rather than in an ORM's change tracker. Traits give you the seams, but the modeling work happens in plain structs, enums, and constructors.",
  },
  {
    title: "Go background",
    body: "Go nudges you toward structs of public fields plus free functions plus stringly typed IDs, with validation re-checked at every call site. Rust nudges the other way: make the illegal value unconstructable once, in a newtype constructor or an aggregate method, and the rest of the code can trust it. The trap to unlearn is treating an `OrderId` and a `CustomerId` as interchangeable strings; here they are different types and the compiler refuses the mix-up.",
  },
  {
    title: "Python background",
    body: "Dynamic attributes and duck typing let a domain object mean whatever the last writer set on it, with rules scattered across services and re-validated defensively. Rust asks you to spend the modeling cost up front: encode the closed set of states as an enum, reject bad values at construction, and let the type carry the guarantee. You write more declarations, but the runtime AttributeError and the silently wrong field become compile-time impossibilities instead.",
  },
]

const buildingBlockCards = [
  {
    title: "Entities",
    body: "Entities carry identity over time. Two orders with the same `OrderId` may be considered the same conceptual thing even as their fields change.",
    code: `struct Order {\n    id: OrderId,\n    lines: Vec<OrderLine>,\n}`,
  },
  {
    title: "Value objects",
    body: "Value objects are defined by value, not by identity. They are the natural home for invariants, normalization, and domain-safe newtypes.",
    code: `struct Quantity(u32);\nstruct MoneyCents(u64);`,
  },
  {
    title: "Aggregates",
    body: "Aggregates are consistency boundaries. The root owns state that must change together and exposes methods that uphold the rules before the outside world sees the new state.",
    code: `impl Order {\n    fn submit(&mut self) -> Result<(), DomainError> { ... }\n}`,
  },
  {
    title: "Repositories",
    body: "Repositories are interfaces for loading and saving aggregates or aggregate-shaped projections. They are boundaries, not domain behavior containers.",
    code: `trait OrderRepository {\n    fn load(&self, id: OrderId) -> Result<Option<Order>, RepositoryError>;\n}`,
  },
]

const invariantCards = [
  {
    title: "Encode invalid states out of existence",
    body: "If zero quantity is invalid, make `Quantity::new(0)` fail. If an empty SKU is invalid, reject it where the value is constructed. That keeps invalid states from drifting deeper into the model.",
    code: `impl Quantity {\n    fn new(value: u32) -> Result<Self, DomainError> { ... }\n}`,
  },
  {
    title: "Use newtypes for domain language",
    body: "A senior Rust codebase rarely benefits from passing raw `u64`, `String`, and `i32` everywhere. `OrderId`, `CustomerId`, `Sku`, and `MoneyCents` make APIs harder to mix up and easier to review.",
    code: `#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]\nstruct OrderId(u64);`,
  },
  {
    title: "Keep behavior near the invariant",
    body: "A rich model is not 'methods for style.' It is how the rule stays close to the state that the rule protects. Rust `impl` blocks are a strong fit for this.",
    code: `order.add_line(sku, qty, unit_price)?;\norder.submit()?;`,
  },
]

const errorCards = [
  {
    title: "Domain errors",
    body: "Domain errors describe rule violations in domain language: empty order, invalid quantity, insufficient funds. They should stay free of SQL, HTTP, or transport concerns.",
    code: `enum DomainError {\n    EmptyOrder,\n    InvalidQuantity,\n}`,
  },
  {
    title: "Application errors",
    body: "Application services often wrap domain and repository failures into use-case level errors. That layer may coordinate retry, idempotency, or boundary translation.",
    code: `enum PlaceOrderError {\n    Domain(DomainError),\n    Repo(RepositoryError),\n}`,
  },
  {
    title: "Boundary rule",
    body: "Do not leak database driver errors, HTTP status codes, or framework request objects into the domain layer. Translate them at the edge, not after they have spread.",
    code: `// domain code should not return StatusCode or sqlx::Error`,
  },
]

const richModelCards = [
  {
    title: "Rich domain models without inheritance",
    body: "Rust has no base-class state, and that is usually a gift. Shared helpers become components. Shared behavior becomes traits. Closed variant sets become enums. The domain model stops pretending one abstraction mechanism should carry everything.",
  },
  {
    title: "Anaemic models are easy to spot",
    body: "If your `Order` is just public fields plus a pile of free functions elsewhere, the invariants are probably already diffused across handlers, services, and tests. Rust does not force that design. It merely makes the repair obvious.",
  },
]

const serviceCards = [
  {
    title: "Application services",
    body: "Application services orchestrate use cases: load aggregate, call domain methods, save, publish integration events, return a result. They are usually thin in pure domain logic and rich in sequencing and boundary work.",
    code: `fn place_order(&mut self, cmd: PlaceOrder) -> Result<Receipt, PlaceOrderError>`,
  },
  {
    title: "Domain services",
    body: "Use a domain service only when a rule belongs to the domain but not naturally to one aggregate or value object. Do not create them as a default replacement for methods.",
    code: `trait PricingPolicy {\n    fn quote(&self, customer: CustomerId, sku: &Sku) -> MoneyCents;\n}`,
  },
]

const syncRepositorySnippet = `trait OrderRepository {
    fn load(&self, id: OrderId) -> Result<Option<Order>, RepositoryError>;
    fn save(&mut self, order: Order) -> Result<(), RepositoryError>;
}`

const asyncRepositorySnippet = `// async fn in traits is stable since Rust 1.75.
trait AsyncOrderRepository {
    async fn load(&self, id: OrderId) -> Result<Option<Order>, RepositoryError>;
}

// Before 1.75 (or to pin a Send bound on the returned future for a
// public API), the same method is written by hand as a boxed future:
//
// fn load<'a>(
//     &'a self,
//     id: OrderId,
// ) -> Pin<Box<dyn Future<Output = Result<Option<Order>, RepositoryError>> + Send + 'a>>;`

const repositoryRules = [
  "Repository traits should usually speak in aggregate roots, aggregate IDs, or purpose-built projections, not persistence rows.",
  "Keep transactions and orchestration in the application layer unless a narrower abstraction is genuinely clearer.",
  "Return owned aggregates or owned projections at repository boundaries. Borrowed references to persistence-managed data are rarely the right domain seam.",
  "Test repository contracts with in-memory implementations, but do not let the in-memory shape become an excuse for leaky infrastructure concepts.",
]

const asyncRepositoryCards = [
  {
    title: "Async repositories and lifetime issues",
    body: "Once a repository method becomes async, borrowed return values get awkward quickly. The borrow may have to survive across suspension points, which tends to couple the future to the repository's internal storage lifetime. In practice, async repository boundaries usually return owned aggregates or owned projections.",
  },
  {
    title: "Why owned returns are correct",
    body: "The underlying issue is not that async and lifetimes are 'bad together.' The issue is that borrowing across await points and returning references from IO-driven boundaries usually expresses the wrong ownership model for the problem.",
  },
]

const eventSourcingCards = [
  {
    title: "Event sourcing in Rust",
    body: "Event sourcing fits Rust well when the domain already thinks in facts over time. Events are ordinary enums or structs, rehydration is a fold, and aggregate methods can emit new events instead of mutating hidden state directly.",
    code: `enum OrderEvent {\n    LineAdded { sku: Sku, qty: Quantity },\n    Submitted,\n}`,
  },
  {
    title: "Rehydrate by applying facts",
    body: "The aggregate can be rebuilt from a stream of past facts. That keeps write logic explicit and auditable, but it also means schema evolution, snapshots, and versioning are now part of the production design.",
    code: `for event in history {\n    aggregate.apply(event)?;\n}`,
  },
  {
    title: "Tradeoffs",
    body: "Event sourcing buys temporal auditability and expressive workflows, but it also adds storage, migration, tooling, and projection complexity. Use it when the domain benefits, not because it sounds sophisticated.",
  },
]

const boundaryCards = [
  {
    title: "DDD boundaries in a modular monolith",
    body: "Rust crates and modules are a natural fit for bounded contexts. Keep each context's language explicit, keep IDs and value objects local where possible, and translate at context boundaries instead of sharing one giant global model.",
  },
  {
    title: "DDD boundaries in distributed systems",
    body: "Across services, ship integration DTOs and integration events, not internal aggregates. A repository trait inside one service is not a public protocol. Promote contracts deliberately.",
  },
  {
    title: "Anti-corruption layers",
    body: "When one context or external system speaks a different language, add an adapter layer that translates into your local domain model. Rust newtypes and enums make that translation explicit and testable.",
  },
]

const productionPatterns = [
  "Put invariants in constructors and aggregate methods first. Add validation layers outside the domain only for boundary hygiene, not as the sole enforcement mechanism.",
  "Use newtypes aggressively for domain identifiers, quantities, and units. The review benefit usually exceeds the small ceremony cost.",
  "Keep application services thin but explicit: load, invoke domain behavior, persist, emit side effects, and translate errors at the boundary.",
  "Return owned aggregates or owned projections from async repositories. That boundary is usually calmer than trying to return borrowed data across suspension points.",
  "If you adopt event sourcing, measure the operational cost honestly: projection lag, snapshot cadence, migration strategy, and observability around version mismatches matter more than the pattern name.",
  "Test aggregates as pure state machines. Table-driven tests over constructors, transitions, and event application often give high coverage with low framework noise.",
]

const pitfalls = [
  "Leaving domain IDs as raw `u64` or `String` everywhere, then mixing order IDs, customer IDs, and transport IDs by accident.",
  "Building anaemic record bags and pushing all real rules into handlers, repositories, or controllers because that felt more familiar from framework-heavy designs.",
  "Letting repository traits mirror storage tables instead of aggregate boundaries. That usually means persistence leaked upward and the domain leaked downward.",
  "Returning borrowed references from async repository or service boundaries. The lifetime friction is often design feedback, not a borrow-checker rule to work around.",
  "Adopting event sourcing for every aggregate. Some domains need a durable event log; others only need plain current state plus a few audit records.",
  "Confusing domain events with public integration events. Not every internal fact should become an external contract.",
]

export function PageCh16DomainDrivenDesignInRust() {
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
  const pageIndex = getPageIndexById("ch16-domain-driven-design-in-rust")
  const chapter05PageIndex = getPageIndexById("ch05-ownership-inside-structs")
  const chapter14PageIndex = getPageIndexById("ch14-interfaces-in-rust-traits")
  const chapter15PageIndex = getPageIndexById("ch15-oop-models-in-rust")
  const exercisesPageIndex = getPageIndexById("ch16-domain-driven-design-in-rust-exercises")
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
          Chapter 16 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Domain-driven Rust encodes business rules in types, constructors, aggregate boundaries, and repository
          interfaces. This chapter keeps invalid states and persistence concerns out of core domain code.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 05, 14, and 15</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 05 established ownership inside structs. Chapter 14 covered traits as interface boundaries.
                Chapter 15 explained why Rust prefers composition, enums, and explicit state models over classical
                inheritance. DDD in Rust sits on top of all three.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter05PageIndex)}>
                Chapter 05
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter14PageIndex)}>
                Chapter 14
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter15PageIndex)}>
                Chapter 15
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            An order platform coordinates pricing, inventory reservation, payment authorization, and fulfillment. The
            business requirement is to encode business language and invariants directly in Rust types: domain identifiers,
            value objects, aggregate methods, repository seams, and transport-independent error contracts.
          </p>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Identify the domain concepts that deserve names in types.</li>
              <li>Decide which invariants belong in value-object constructors and which belong at aggregate methods.</li>
              <li>Keep application services responsible for orchestration, not for becoming the only place rules exist.</li>
              <li>Make repository and integration boundaries speak in domain language or explicit translations.</li>
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

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">What changes by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Domain-driven design is older than Rust, so most senior engineers arrive with habits from a language whose
            type system made different promises. The vocabulary carries over; the mechanism does not. The shift below is
            the one worth internalizing before reading any code in this chapter.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The common thread across all four: in Rust the domain model is not enforced by a framework at runtime, by a
              base class, or by convention. It is enforced by types that refuse to hold an invalid value. The diagram
              below shows where those types sit relative to the infrastructure they protect.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  HTTP[HTTP / CLI edge] --> App[Application service]\n  App --> Domain[Domain model]\n  App --> RepoT[Repository trait]\n  RepoT -. implemented by .-> RepoImpl[SQL repository]\n  RepoImpl --> DB[(Database)]\n  Domain -. no dependency .-> RepoImpl`}
              caption="Dependencies point inward toward the domain. The application service depends on a repository trait; the SQL implementation depends on the trait, not the other way round, so the domain never imports infrastructure."
            />
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Entities, value objects, aggregates, repositories</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {buildingBlockCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              These four pieces nest into one shape worth memorizing. Value objects are owned by the aggregate root, which
              is the entity that guards the invariants; the repository is the only door through which the whole aggregate
              is loaded and saved. The root owns everything inside the boundary, so there is no way to mutate a line item
              without going through a method that can re-check the rule.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Repo[OrderRepository trait] -->|load / save| Root[Order aggregate root]\n  Root -->|enforces| Inv[Invariants: non-empty, valid status]\n  Root -.->|owns, see below| Cont[Aggregate boundary continues below]`}
              caption="Outside view: the repository moves the whole aggregate in and out of storage, and invariants are checked on the root rather than scattered across callers."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Looking inside that boundary, the root owns the order lines and the value objects they carry:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cont[Aggregate boundary] --> Root[Order aggregate root]\n  Root -->|owns| Lines[Vec of OrderLine]\n  Lines --> VO1[Sku value object]\n  Lines --> VO2[Quantity value object]\n  Lines --> VO3[MoneyCents value object]`}
              caption="Inside view: the root owns its value objects through the order lines, so there is no way to mutate a line without going through a method that can re-check the rule."
            />
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Encoding invariants in types</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {invariantCards.map((card) => (
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
                The important rule is simple: if the invalid state is local and stable, encode it in the type. If the
                rule depends on aggregate-wide state, encode it in the aggregate method. Rust gives you both tools.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Newtypes for domain safety</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Newtypes are one of the most practical DDD tools in Rust. They are cheap, explicit, and easy to compose
              with traits. They prevent primitive obsession without pretending a runtime framework will keep your
              identifiers straight for you.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{`#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
struct OrderId(u64);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
struct CustomerId(u64);`}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  That small amount of ceremony buys strong review benefits: fewer swapped parameters, clearer logs,
                  narrower traits, and sharper boundaries between internal and external identifiers.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Rich domain models without inheritance</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {richModelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A strong correction for C++ and C# readers is this: a rich model in Rust means behavior near state and
                invariants, not a base class with protected fields. Rust wants `impl` blocks, value objects, traits, and
                modules to each do their own job.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Error modeling in domain layers</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {errorCards.map((card) => (
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
            <h4 className="font-semibold text-foreground mb-3">Application services and domain services</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {serviceCards.map((card) => (
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
            <h4 className="font-semibold text-foreground mb-3">Repository interfaces with traits</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Synchronous shape</div>
                <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{syncRepositorySnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Async shape</div>
                <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{asyncRepositorySnippet}</code>
                </pre>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {repositoryRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Async repositories and lifetime issues</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {asyncRepositoryCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A reliable production rule is this: if the repository method performs IO and may suspend, return owned
                data or an owned projection. Do not fight the lifetime model just to preserve a borrowed shape that no
                longer matches the boundary.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Event sourcing in Rust</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {eventSourcingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  {"code" in card && card.code ? (
                    <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                      <code className="font-mono text-foreground">{card.code}</code>
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">DDD boundaries in monoliths and distributed systems</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {boundaryCards.map((card) => (
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
                DDD is not an excuse for heavy ceremony. In Rust, the best version is often the lightest one that gives
                the domain real names, protects invariants locally, and keeps infrastructure outside the core language of
                the model.
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
                <h4 className="font-semibold text-foreground">Example 1: aggregate invariants with newtypes and rich methods</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The aggregate root owns the mutable consistency boundary. Value objects reject invalid local state,
                  and the aggregate decides when the order may be submitted.
                </p>
              </div>
              {codes.ddd_order_aggregate !== DEFAULT_CODES.ddd_order_aggregate && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("ddd_order_aggregate")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the order is a tiny state machine with two states. While it is{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Draft</code> you may add lines;
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">submit</code> refuses an empty
              order and otherwise moves it to <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">Submitted</code>,
              after which <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">add_line</code> is
              rejected. The value-object constructors reject the local errors first, so by the time a line reaches the
              aggregate every quantity is non-zero and every SKU is non-empty. Trace the transitions in the diagram, then
              read the same guards in the code.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Draft: construct\n  Draft --> Draft: add_line ok\n  Draft --> Submitted: submit when non-empty\n  Draft --> Draft: submit fails EmptyOrder\n  Submitted --> Submitted: add_line fails CannotModify\n  Submitted --> [*]`}
              caption="Two states, with the guards drawn as edges: add_line only works in Draft, and submit only advances when at least one line exists."
            />
            <RustCodeEditor
              code={codes.ddd_order_aggregate}
              onChange={(newCode) => updateCode("ddd_order_aggregate", newCode)}
              onRun={() => runCode("ddd_order_aggregate")}
              output={outputs.ddd_order_aggregate ?? null}
              isRunning={isRunning === "ddd_order_aggregate"}
              filename="order_aggregate.rs"
              expectedOutput={"lines = 2\ntotal cents = 4200\nstate = submitted"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.ddd_order_aggregate}
              onRevert={() => resetCode("ddd_order_aggregate")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Entity</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `Order` has identity and behavior. It is not only a record bag.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Value objects</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `Quantity`, `MoneyCents`, and `Sku` protect local rules at construction time.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Aggregate rule</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `submit` refuses an empty order. The rule stays on the model, not in a handler comment.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: event-sourced aggregate rehydration</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The aggregate is rebuilt from domain events. Rehydration is a fold, and versioning follows the applied
                  stream length.
                </p>
              </div>
              {codes.ddd_event_sourced_account !== DEFAULT_CODES.ddd_event_sourced_account && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("ddd_event_sourced_account")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: there is no stored balance to read. Current state is computed by folding the event stream
              into a fresh accumulator, one event at a time. Each call to{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] mx-1">apply</code> validates against the
              state built so far &mdash; a deposit before the account is open is rejected, a withdrawal larger than the
              running balance is rejected &mdash; and the version counter is simply how many events were applied. The
              diagram is that fold; the three output numbers are the accumulator after the last event.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Start[balance 0, version 0, closed] --> E1[Opened 1000]\n  E1 --> S1[balance 1000, version 1, open]\n  S1 --> E2[Deposited 400]\n  E2 --> S2[balance 1400, version 2]\n  S2 --> E3[Withdrawn 150]\n  E3 --> S3[balance 1250, version 3]`}
              caption="Rehydration is a left fold: each event is applied to the running state, version increments per applied event, and the final accumulator is the current account."
            />
            <RustCodeEditor
              code={codes.ddd_event_sourced_account}
              onChange={(newCode) => updateCode("ddd_event_sourced_account", newCode)}
              onRun={() => runCode("ddd_event_sourced_account")}
              output={outputs.ddd_event_sourced_account ?? null}
              isRunning={isRunning === "ddd_event_sourced_account"}
              filename="event_sourced_account.rs"
              expectedOutput={"events = 3\nbalance cents = 1250\nversion = 3"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.ddd_event_sourced_account}
              onRevert={() => resetCode("ddd_event_sourced_account")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Events</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The stream records domain facts, not persistence internals.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Rehydration</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `rehydrate` applies each event in order and rebuilds current state explicitly.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Tradeoff</div>
                <p className="text-xs text-muted-foreground leading-5">
                  You gain temporal history, but you also accept projection and migration work.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch16_domain_driven_design_in_rust/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary Rust files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to implement newtypes for domain identifiers, encode aggregate
            invariants in constructors, compare anaemic and rich models, and design repository traits with sync and async
            variants.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 16 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Entities, value objects, aggregates, and repositories map cleanly onto Rust structs, enums, traits, and ownership boundaries.</li>
            <li>Newtypes and constructors are practical tools for encoding invariants and defending domain language from primitive obsession.</li>
            <li>Rich domain models in Rust do not rely on inheritance. They rely on `impl` blocks, composition, enums, and clear visibility.</li>
            <li>Application services orchestrate use cases. Domain services are narrower and should exist only when a rule does not belong to one aggregate or value object.</li>
            <li>Async repository seams usually want owned returns, and event sourcing is a domain choice with real operational tradeoffs, not a free architectural upgrade.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

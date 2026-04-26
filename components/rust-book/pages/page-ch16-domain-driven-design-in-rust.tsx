"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
  Shield,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
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
    body: "DDD will feel familiar if you have modeled rich types before, but Rust removes inheritance as the default vehicle. That usually improves the design. Entities, value objects, and services become explicit types and traits instead of base-class trees.",
  },
  {
    title: "C# background",
    body: "If you come from interface-heavy domain models, the big shift is that Rust wants value semantics and ownership clarity to stay visible. Traits help with seams, but newtypes, enums, and constructors do much of the real domain work.",
  },
  {
    title: "Go background",
    body: "If you are used to service code drifting toward structs plus functions plus stringly typed IDs, Rust is a strong nudge back toward explicit domain language. Newtypes, enums, and aggregate methods make the model harder to misuse accidentally.",
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
    code: `order.add_line(sku, qty, price)?;\norder.submit()?;`,
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

const asyncRepositorySnippet = `use std::future::Future;
use std::pin::Pin;

trait AsyncOrderRepository {
    fn load<'a>(
        &'a self,
        id: OrderId,
    ) -> Pin<Box<dyn Future<Output = Result<Option<Order>, RepositoryError>> + Send + 'a>>;
}`

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
    title: "Technical correction",
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
  "Returning borrowed references from async repository or service boundaries. The lifetime friction is often design feedback, not compiler mood.",
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
          Domain-driven design fits Rust unusually well once you stop searching for inheritance and start modeling
          invariants, aggregate boundaries, and domain language directly in the type system.
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
            You are refactoring an order platform with pricing, inventory reservation, payment authorization, and
            fulfillment workflows. The previous design used raw IDs, DTO-shaped structs, and service methods that
            performed validation in several layers at once. Bugs keep appearing at the seams: mixed-up identifiers,
            empty orders reaching persistence, and transport models leaking into core business logic. Rust does not fix
            this with framework ceremony. It gives you a calmer option: encode the business language directly into
            types, keep invariants close to the aggregate root, and make boundary traits honest about what they load,
            save, and publish.
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

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout: what changes by background</h4>
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
            <h3 className="text-lg font-semibold text-foreground">Worked examples</h3>
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
````

### File: `components/rust-book/pages/page-ch16-domain-driven-design-in-rust-exercises.tsx`
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
    title: "Separate entity, value object, aggregate, and repository",
    objective: "Practice naming the DDD role before you choose the Rust shape.",
    starterPrompt:
      "Classify these concepts in an order platform: `OrderId`, `MoneyCents`, `Order`, `OrderLine`, and `OrderRepository`.",
    prompts: [
      "Which types are identity-carrying entities or roots?",
      "Which types are value objects and why?",
      "Which type is the aggregate root that should enforce consistency rules?",
      "Which item is a boundary trait rather than a domain object?",
    ],
    acceptanceCriteria: [
      "You distinguish entity identity from value semantics clearly.",
      "You identify one aggregate root and explain why that root owns the consistency boundary.",
      "You identify the repository as a seam, not as the place where domain rules should live by default.",
    ],
    hints: [
      "Ask which concept is compared by identity over time and which is compared only by value.",
      "Repositories are usually boundary contracts, not business-rule containers.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Replace primitive obsession with newtypes",
    objective: "Read a raw-ID design and explain what becomes safer once the domain gets explicit types.",
    starterPrompt:
      "You inherit `fn assign(order_id: u64, customer_id: u64, amount_cents: u64)` plus several transport DTOs that all use raw integers and strings.",
    prompts: [
      "Which parameters are easiest to swap by accident?",
      "Which newtypes would you introduce first?",
      "What review mistakes become easier to spot once the function signature becomes domain-specific?",
    ],
    acceptanceCriteria: [
      "You identify at least two raw primitives that should become domain-specific types.",
      "You explain one concrete bug class that newtypes help prevent.",
      "You describe the gain in terms of API review and domain language, not only type aesthetics.",
    ],
    hints: [
      "The question is not whether `u64` works mechanically. The question is whether it says enough.",
      "Identifiers, money, quantities, and status-like strings are common first candidates.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Encode aggregate invariants in constructors and methods",
    objective: "Build a small domain model that rejects invalid quantity and keeps the aggregate total correct.",
    starterPrompt:
      "Implement `OrderId`, `Quantity`, and `Order` so zero quantity is invalid and `add_line` updates both line count and total cents.",
    prompts: [
      "Use a newtype for `OrderId`.",
      "Make `Quantity::new(0)` return an explicit error.",
      "Keep the aggregate method responsible for updating line count and total.",
      "Do not push the rule into a free function outside the aggregate.",
    ],
    acceptanceCriteria: [
      "The model uses at least one newtype and one constructor that enforces an invariant.",
      "The aggregate method updates its own state consistently.",
      "The runnable lab prints the expected zero-quantity error, line count, and total.",
    ],
    hints: [
      "A value-object constructor is the right place for the local rule.",
      "An aggregate method is the right place for multi-field consistency.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair an anaemic domain model without inheritance",
    objective: "Move rule enforcement closer to the model instead of reproducing a service-layer god object.",
    starterPrompt:
      "You inherit `struct OrderRecord { pub lines: Vec<...>, pub status: String, pub total_cents: u64 }` plus service functions `validate_order`, `recompute_total`, and `submit_order`.",
    prompts: [
      "Which fields should stop being `pub` immediately?",
      "Which free functions should become methods on the aggregate?",
      "Where do you keep status as an enum instead of an open string?",
      "How would you explain the refactor to a teammate coming from inheritance-heavy design?",
    ],
    acceptanceCriteria: [
      "You narrow the public surface of the aggregate state.",
      "You move at least one real invariant into a method or constructor on the model.",
      "You replace at least one stringly typed state with a stronger domain type.",
    ],
    hints: [
      "Rust modules and private fields are part of the repair.",
      "A rich model is about rule locality, not about having more methods for style.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Design repository traits with sync and async variants",
    objective: "Choose repository seams that remain honest under both blocking and suspending IO.",
    starterPrompt:
      "Design `OrderRepository` and `AsyncOrderRepository` for one aggregate. Then explain why an async version returning `&Order` is usually the wrong seam.",
    prompts: [
      "What should the sync trait return on load and save?",
      "What should the async trait return, and what future shape would you use on stable Rust if you avoid macros?",
      "Why does an owned return usually fit async repository boundaries better than a borrowed return?",
    ],
    acceptanceCriteria: [
      "You produce a plausible sync repository trait over domain types or domain-shaped projections.",
      "You produce a plausible async repository trait or clearly describe one with owned outputs.",
      "You explain the ownership and lifetime issue behind borrowed async returns accurately.",
    ],
    hints: [
      "Repository boundaries usually want owned aggregates or owned projections.",
      "The async problem is not style. It is borrow lifetime across suspension.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose event sourcing and service boundaries deliberately",
    objective: "Make DDD boundary choices across a modular monolith or distributed system without over-modeling everything.",
    starterPrompt:
      "You are designing `cart -> order -> payment -> fulfillment`, with one team considering event sourcing for order history and another team splitting payment into a separate service.",
    prompts: [
      "Which parts of the model belong inside one bounded context and which deserve translation at a boundary?",
      "Which events are internal domain facts and which might become public integration events?",
      "Would event sourcing help the order context enough to justify projection and migration work?",
      "What testing or observability hooks would you add before declaring the design production-ready?",
    ],
    acceptanceCriteria: [
      "You distinguish bounded-context boundaries from in-process code organization clearly.",
      "You separate internal domain events from public integration events deliberately.",
      "You justify event sourcing as a domain choice with operational cost, not as automatic modernization.",
      "You name at least one test and one observability hook, such as aggregate transition tests, outbox lag, or projection version metrics.",
    ],
    hints: [
      "Not every internal event deserves public contract status.",
      "The strongest answer names both the modeling benefit and the operational price.",
    ],
  },
]

const reviewQuestions = [
  "Why is a newtype often a better DDD move than another validation helper around a primitive?",
  "What makes an aggregate a consistency boundary rather than just a large struct?",
  "Why is an anaemic model especially brittle in Rust service code?",
  "What is the difference between an application service and a domain service?",
  "Why do async repositories usually prefer owned outputs?",
  "What production tradeoff should you state explicitly before choosing event sourcing?",
]

const workingLoop = [
  "Name the domain concept before you name the Rust feature.",
  "Place local invariants in value-object constructors and multi-field consistency in aggregate methods.",
  "Keep repositories as boundary traits, not domain dumping grounds.",
  "If the boundary is async or distributed, prefer owned data and explicit translation over borrowed convenience.",
]

const repositoryChecklist = [
  "Do repository traits speak in domain IDs, aggregates, or purpose-built projections?",
  "Does the async boundary return owned data rather than borrowed references tied to storage internals?",
  "Are transport and persistence errors translated before they leak into the domain?",
  "Would an in-memory implementation exercise the same semantic contract as the real repository?",
]

export function PageCh16DomainDrivenDesignInRustExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = 31
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 16 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice DDD the Rust way: precise domain language, type-level safety where it pays, explicit aggregate
          boundaries, and repository seams that stay honest under production pressure.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a modeling review. The best answer does not say only “use DDD” or “make a
                trait.” It says which concept deserves a type, where the invariant belongs, which layer owns the rule,
                and where the boundary must translate into owned data or external contracts.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(30)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 16
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

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Repository boundary checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {repositoryChecklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
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
                  Domain modeling drill
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
          title="Runnable lab · Newtypes plus aggregate invariants"
          description={
            <>
              Repair the starter so zero quantity is rejected and the aggregate keeps its own counters correct. The
              checker expects a real constructor guard for{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Quantity</code> and a correct update in{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">add_line</code>.
            </>
          }
          filename="order_invariants_lab.rs"
          runKey="ch16_ex_order_invariants"
          expectedOutput={'zero = Err("quantity must be greater than 0")\norder = OrderId(7)\nlines = 1\ntotal cents = 1800'}
          helperText={
            <>
              Tip: keep the local rule in <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Quantity::new</code>,
              then keep the multi-field consistency update inside the aggregate method.
            </>
          }
          initialCode={`#[derive(Debug, Clone, Copy, PartialEq, Eq)]\nstruct OrderId(u64);\n\n#[derive(Debug, Clone, Copy, PartialEq, Eq)]\nstruct Quantity(u32);\n\nimpl Quantity {\n    fn new(value: u32) -> Result<Self, &'static str> {\n        Ok(Self(value))\n    }\n\n    fn get(self) -> u32 {\n        self.0\n    }\n}\n\n#[derive(Debug)]\nstruct Order {\n    id: OrderId,\n    line_count: usize,\n    total_cents: u64,\n}\n\nimpl Order {\n    fn new(id: OrderId) -> Self {\n        Self {\n            id,\n            line_count: 0,\n            total_cents: 0,\n        }\n    }\n\n    fn add_line(&mut self, qty: Quantity, unit_price_cents: u64) {\n        self.line_count += 0;\n        self.total_cents += 0;\n    }\n}\n\nfn main() {\n    println!(\"zero = {:?}\", Quantity::new(0));\n    let mut order = Order::new(OrderId(7));\n    let qty = Quantity::new(3).unwrap();\n    order.add_line(qty, 600);\n    println!(\"order = {:?}\", order.id);\n    println!(\"lines = {}\", order.line_count);\n    println!(\"total cents = {}\", order.total_cents);\n}`}
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
            By the end of this page, you should be able to defend when a concept deserves a newtype, when a rule belongs
            in a constructor versus an aggregate method, how repository traits differ from domain behavior, and why DDD
            boundaries in Rust are mostly about explicit language, ownership, and translation rather than architectural
            slogans.
          </p>
        </section>
      </div>
    </div>
  )
}
````

### File: `examples/ch16_domain_driven_design_in_rust/order_aggregate.rs`
````
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct OrderId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct CustomerId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct Quantity(u32);

impl Quantity {
    fn new(value: u32) -> Result<Self, DomainError> {
        if value == 0 {
            return Err(DomainError::InvalidQuantity);
        }
        Ok(Self(value))
    }

    fn get(self) -> u32 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct MoneyCents(u64);

impl MoneyCents {
    fn new(value: u64) -> Self {
        Self(value)
    }

    fn get(self) -> u64 {
        self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct Sku(String);

impl Sku {
    fn new(value: &str) -> Result<Self, DomainError> {
        if value.trim().is_empty() {
            return Err(DomainError::EmptySku);
        }
        Ok(Self(value.to_string()))
    }
}

#[derive(Debug)]
struct OrderLine {
    sku: Sku,
    qty: Quantity,
    unit_price: MoneyCents,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum OrderStatus {
    Draft,
    Submitted,
}

#[derive(Debug)]
enum DomainError {
    InvalidQuantity,
    EmptySku,
    EmptyOrder,
    CannotModifySubmittedOrder,
}

#[derive(Debug)]
struct Order {
    id: OrderId,
    customer_id: CustomerId,
    status: OrderStatus,
    lines: Vec<OrderLine>,
}

impl Order {
    fn new(id: OrderId, customer_id: CustomerId) -> Self {
        Self {
            id,
            customer_id,
            status: OrderStatus::Draft,
            lines: Vec::new(),
        }
    }

    fn add_line(
        &mut self,
        sku: Sku,
        qty: Quantity,
        unit_price: MoneyCents,
    ) -> Result<(), DomainError> {
        if self.status == OrderStatus::Submitted {
            return Err(DomainError::CannotModifySubmittedOrder);
        }

        self.lines.push(OrderLine {
            sku,
            qty,
            unit_price,
        });

        Ok(())
    }

    fn submit(&mut self) -> Result<(), DomainError> {
        if self.lines.is_empty() {
            return Err(DomainError::EmptyOrder);
        }

        self.status = OrderStatus::Submitted;
        Ok(())
    }

    fn total_cents(&self) -> u64 {
        self.lines
            .iter()
            .map(|line| line.qty.get() as u64 * line.unit_price.get())
            .sum()
    }

    fn status(&self) -> &'static str {
        match self.status {
            OrderStatus::Draft => "draft",
            OrderStatus::Submitted => "submitted",
        }
    }
}

fn main() {
    let mut order = Order::new(OrderId(1001), CustomerId(7));

    order
        .add_line(
            Sku::new("BOOK-1").unwrap(),
            Quantity::new(2).unwrap(),
            MoneyCents::new(1500),
        )
        .unwrap();

    order
        .add_line(
            Sku::new("PEN-9").unwrap(),
            Quantity::new(3).unwrap(),
            MoneyCents::new(400),
        )
        .unwrap();

    order.submit().unwrap();

    println!("lines = {}", order.lines.len());
    println!("total cents = {}", order.total_cents());
    println!("state = {}", order.status());
}
````

### File: `examples/ch16_domain_driven_design_in_rust/event_sourced_account.rs`
````
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct AccountId(u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AccountEvent {
    Opened { opening_balance_cents: i64 },
    Deposited { cents: i64 },
    Withdrawn { cents: i64 },
}

#[derive(Debug)]
enum DomainError {
    AlreadyOpened,
    NotOpen,
    InsufficientFunds,
}

#[derive(Debug)]
struct Account {
    id: AccountId,
    balance_cents: i64,
    version: usize,
    is_open: bool,
}

impl Account {
    fn rehydrate(id: AccountId, history: &[AccountEvent]) -> Result<Self, DomainError> {
        let mut account = Self {
            id,
            balance_cents: 0,
            version: 0,
            is_open: false,
        };

        for event in history {
            account.apply(*event)?;
            account.version += 1;
        }

        Ok(account)
    }

    fn apply(&mut self, event: AccountEvent) -> Result<(), DomainError> {
        match event {
            AccountEvent::Opened {
                opening_balance_cents,
            } => {
                if self.is_open {
                    return Err(DomainError::AlreadyOpened);
                }

                self.balance_cents = opening_balance_cents;
                self.is_open = true;
                Ok(())
            }
            AccountEvent::Deposited { cents } => {
                if !self.is_open {
                    return Err(DomainError::NotOpen);
                }

                self.balance_cents += cents;
                Ok(())
            }
            AccountEvent::Withdrawn { cents } => {
                if !self.is_open {
                    return Err(DomainError::NotOpen);
                }

                if self.balance_cents < cents {
                    return Err(DomainError::InsufficientFunds);
                }

                self.balance_cents -= cents;
                Ok(())
            }
        }
    }
}

fn main() {
    let history = vec![
        AccountEvent::Opened {
            opening_balance_cents: 1000,
        },
        AccountEvent::Deposited { cents: 400 },
        AccountEvent::Withdrawn { cents: 150 },
    ];

    let account = Account::rehydrate(AccountId(7), &history).unwrap();

    println!("events = {}", history.len());
    println!("balance cents = {}", account.balance_cents);
    println!("version = {}", account.version);
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -28,3 +28,5 @@ export { PageCh14InterfacesInRustTraitsExercises } from "./page-ch14-interfaces-
 export { PageCh15OopModelsInRust } from "./page-ch15-oop-models-in-rust"
 export { PageCh15OopModelsInRustExercises } from "./page-ch15-oop-models-in-rust-exercises"
+export { PageCh16DomainDrivenDesignInRust } from "./page-ch16-domain-driven-design-in-rust"
+export { PageCh16DomainDrivenDesignInRustExercises } from "./page-ch16-domain-driven-design-in-rust-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -39,6 +39,8 @@ import {
   PageCh14InterfacesInRustTraitsExercises,
   PageCh15OopModelsInRust,
   PageCh15OopModelsInRustExercises,
+  PageCh16DomainDrivenDesignInRust,
+  PageCh16DomainDrivenDesignInRustExercises,
 } from "./pages"
 
 const PAGE_COMPONENTS = [
@@ -72,6 +74,8 @@ const PAGE_COMPONENTS = [
   PageCh14InterfacesInRustTraitsExercises,
   PageCh15OopModelsInRust,
   PageCh15OopModelsInRustExercises,
+  PageCh16DomainDrivenDesignInRust,
+  PageCh16DomainDrivenDesignInRustExercises,
 ]
 
 function BookContent() {
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh16Output } from "./rust-simulator-ch16"
 import { simulateCh15Output } from "./rust-simulator-ch15"
 import { simulateCh14Output } from "./rust-simulator-ch14"
 import { simulateCh13Output } from "./rust-simulator-ch13"
@@ -994,6 +995,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch16Output = simulateCh16Output(code, key)
+  if (ch16Output !== null) return ch16Output
 
   const ch15Output = simulateCh15Output(code, key)
   if (ch15Output !== null) return ch15Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -5,6 +5,7 @@ import { DEFAULT_CODES_CH13 } from "./default-codes-ch13"
 import { DEFAULT_CODES_CH14 } from "./default-codes-ch14"
 import { DEFAULT_CODES_CH15 } from "./default-codes-ch15"
+import { DEFAULT_CODES_CH16 } from "./default-codes-ch16"
 
 export interface PageConfig {
   id: string
@@ -373,6 +374,29 @@ export const CHAPTERS: ChapterConfig[] = [
         icon: "trophy",
       },
     ],
+  },
+  {
+    id: "ch16-domain-driven-design-in-rust",
+    title: "Chapter 16 · Domain-Driven Design in Rust",
+    icon: "book",
+    pages: [
+      {
+        id: "ch16-domain-driven-design-in-rust",
+        title: "Domain-Driven Design in Rust",
+        shortTitle: "DDD in Rust",
+        description:
+          "Entities, value objects, aggregates, repositories, invariants, event sourcing, and DDD boundaries",
+        icon: "book",
+        codeKeys: ["ddd_order_aggregate", "ddd_event_sourced_account"],
+      },
+      {
+        id: "ch16-domain-driven-design-in-rust-exercises",
+        title: "Chapter 16 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Implement newtypes, encode aggregate invariants, and design repository seams for sync and async workloads",
+        icon: "trophy",
+      },
+    ],
   },
 ]
 
@@ -806,6 +830,7 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH13,
   ...DEFAULT_CODES_CH14,
   ...DEFAULT_CODES_CH15,
+  ...DEFAULT_CODES_CH16,
 }
 
 export interface BookState {
````
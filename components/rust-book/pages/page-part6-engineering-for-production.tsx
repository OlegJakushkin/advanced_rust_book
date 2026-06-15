"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  Boxes,
  Eye,
  Layers,
  Network,
  Package,
  ShieldCheck,
  TestTube,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const whyReadCards = [
  {
    icon: ShieldCheck,
    title: "An error strategy that scales past one crate",
    body: "Decide where typed domain errors end and opaque operational errors begin, how context travels across async and FFI boundaries, and what a caller is allowed to match on. The goal is an error contract a team can review, not a pile of ad hoc conversions.",
  },
  {
    icon: TestTube,
    title: "Tests that pin behavior, not implementation",
    body: "Move beyond unit tests into property tests, integration harnesses, async test setup, and fixtures that survive refactoring. You learn what to assert so the suite catches regressions instead of breaking on every internal change.",
  },
  {
    icon: Eye,
    title: "Observability you can operate on call",
    body: "Structured logs, spans, and metrics that let you answer 'what is this process doing right now' under load. The emphasis is on signals that shorten an incident, not dashboards that only look busy.",
  },
  {
    icon: Package,
    title: "Packaging and deployment without surprises",
    body: "Reproducible builds, feature flags, slim release artifacts, and the deployment shape that gets a Rust binary safely from cargo to a running service. Less guesswork between a green CI run and a healthy production rollout.",
  },
  {
    icon: Boxes,
    title: "A capstone that forces the pieces to fit",
    body: "A distributed system that exercises errors, tests, observability, and deployment together, where each prior chapter stops being a standalone topic and becomes one constraint among several that have to hold at once.",
  },
]

const chapters = [
  {
    number: "41",
    title: "Error Handling in Large Systems",
    id: "ch41-error-handling-in-large-systems",
    blurb:
      "Design an error contract: typed domain enums, opaque operational errors, and context that survives async and FFI boundaries.",
  },
  {
    number: "42",
    title: "Testing Advanced Rust Systems",
    id: "ch42-testing-advanced-rust-systems",
    blurb:
      "Unit, property, and integration testing for real systems, including async harnesses and fixtures that outlast a refactor.",
  },
  {
    number: "43",
    title: "Observability",
    id: "ch43-observability",
    blurb:
      "Structured logging, tracing spans, and metrics that tell you what a service is actually doing while an incident is live.",
  },
  {
    number: "44",
    title: "Packaging and Deployment",
    id: "ch44-packaging-and-deployment",
    blurb:
      "Reproducible builds, feature flags, slim artifacts, and the steps that carry a Rust binary from cargo to a running service.",
  },
  {
    number: "45",
    title: "Capstone: A Distributed Rust System",
    id: "ch45-capstone-distributed-rust-system",
    blurb:
      "Assemble the part into one distributed system where errors, tests, observability, and deployment all have to hold together.",
  },
]

const errorContractSnippet = `#[derive(Debug, thiserror::Error)]
pub enum OrderError {
    #[error("order {0} not found")]
    NotFound(OrderId),
    #[error("payment declined: {reason}")]
    PaymentDeclined { reason: String },
    // Infrastructure failures stay opaque to callers.
    #[error(transparent)]
    Infra(#[from] anyhow::Error),
}

pub fn place_order(req: &OrderRequest) -> Result<Receipt, OrderError> {
    let total = price(req).map_err(OrderError::from)?;
    charge(req.account, total)?; // declines surface as a typed variant
    Ok(Receipt::new(req.id, total))
}`

export function PagePart6EngineeringForProduction() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("part-6-engineering-for-production")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Layers className="h-4 w-4" />
          Part VI
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Engineering Systems for Production</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          {page?.description ??
            "What turns working Rust into maintainable production software: error strategy at scale, testing, observability, packaging, and a capstone that ties them together."}
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">What this part is about</h3>
          <div className="space-y-4 text-sm text-muted-foreground leading-6 max-w-3xl">
            <p>
              By this point in the book the code compiles, the ownership story holds, and the concurrency model
              behaves. That is the point where most of the interesting engineering actually starts. The gap between a
              program that works on your machine and a service that a team can run for years is not raw correctness;
              it is the surrounding disciplines that let other people change the code, watch it in production, and ship
              it again without holding their breath.
            </p>
            <p>
              This part treats those disciplines as first-class design work rather than chores bolted on at the end.
              Error handling becomes a contract that callers and reviewers can read. Tests become a description of the
              behavior you intend to keep. Observability becomes the instrument panel you reach for during an incident
              instead of guessing. Packaging and deployment become a repeatable path from <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">cargo build</code>{" "}
              to a healthy rollout.
            </p>
            <p>
              If you are coming from C++, C#, Go, or Python, you already know these problems exist; what changes in
              Rust is where the work lands. The type system absorbs some of it, the borrow checker absorbs more, and
              the rest becomes explicit decisions you make on purpose. The chapters here show how to make those
              decisions once, write them down in code, and stop relitigating them in every review.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Why read this part</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {whyReadCards.map((card) => {
              const Icon = card.icon
              return (
                <div key={card.title} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <div className="font-medium text-foreground">{card.title}</div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Network className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">The shape of the part</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl mb-2">
            The four supporting chapters are not independent topics; they are layers that each later chapter assumes.
            A clear error strategy gives tests something stable to assert. Tested behavior is what observability
            confirms in production. Reliable signals are what make a deployment safe to repeat. The capstone is where
            all four have to be true at the same time, in one distributed system, under real failure.
          </p>
          <MermaidDiagram
            chart={`flowchart LR\n  E[Error strategy] --> T[Testing]\n  T --> O[Observability]\n  O --> D[Packaging and deployment]\n  E --> C[Capstone: distributed system]\n  T --> C\n  O --> C\n  D --> C`}
            caption="Each discipline feeds the next, and the capstone is where all four have to hold together at once."
          />
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">A taste of the flavor</div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The error chapter, for example, draws a hard line between what a caller may match on and what stays
              opaque. Typed variants describe domain outcomes; infrastructure failures collapse into one transparent
              variant so the contract does not leak every dependency.
            </p>
            <pre className="rounded-md bg-background/60 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{errorContractSnippet}</code>
            </pre>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Chapters in this part</h3>
          </div>
          <div className="space-y-3">
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                type="button"
                onClick={() => setCurrentPage(getPageIndexById(chapter.id))}
                className="group w-full text-left rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-mono text-sm font-semibold">
                    {chapter.number}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-foreground">{chapter.title}</div>
                    <p className="text-sm text-muted-foreground leading-6 mt-1">{chapter.blurb}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground mt-1 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Ready to start</h3>
              <p className="text-sm text-muted-foreground leading-6 max-w-2xl">
                Begin with error handling, since the contract you settle there is what every later chapter in this part
                leans on. Then work forward through testing, observability, and deployment, and finish by assembling
                them in the capstone.
              </p>
            </div>
            <Button
              onClick={() => setCurrentPage(getPageIndexById("ch41-error-handling-in-large-systems"))}
              className="gap-2 shrink-0"
            >
              Begin Part VI
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

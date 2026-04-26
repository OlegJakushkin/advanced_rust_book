"use client"

import { useEffect } from "react"
import { ArrowLeft, Lightbulb, Target, Trophy, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
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
    title: "Map a FastAPI-style endpoint into Rust transport and service seams",
    objective:
      "Practice translating a familiar typed endpoint into Rust extractors, typed state, and one application service call without leaking HTTP inward.",
    starterPrompt:
      "Design one `POST /v1/invoices` endpoint with path or body extractors, typed application state, and an authenticated caller context.",
    prompts: [
      "Which values belong in transport DTOs and which values belong in one application command?",
      "Which shared resources belong in typed app state: pools, config, telemetry, idempotency store?",
      "Which checks belong in middleware or auth extraction versus in the handler itself?",
      "What should the domain service never learn about this HTTP request?",
    ],
    acceptanceCriteria: [
      "You separate transport DTOs from the application command clearly.",
      "You put at least one real shared dependency into typed app state with a reason.",
      "You identify at least one concern that belongs in middleware or auth extraction instead of in the domain service.",
      "You explain why the domain model should not depend on framework request types.",
    ],
    hints: [
      "Start from the handler signature you want another engineer to understand in ten seconds.",
      "Then ask which part of that signature is transport-only versus business-relevant.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Spot transport leakage into the domain layer",
    objective:
      "Read a handler and service pair and identify where HTTP types, status semantics, or documentation concerns have crossed the wrong boundary.",
    starterPrompt:
      "A `BillingService::create_invoice` method currently accepts `CreateInvoiceRequest`, returns `Result<InvoiceDto, StatusCode>`, and mentions OpenAPI field examples in comments right above the business rule logic.",
    prompts: [
      "Which parameters or return types are transport-layer concepts rather than domain or application concepts?",
      "Which type should the service take instead of the HTTP request DTO?",
      "Which type should the service return so the handler can translate it to HTTP later?",
      "Where should the documentation examples and status mapping live instead?",
    ],
    acceptanceCriteria: [
      "You identify at least one transport-shaped input and one transport-shaped output that should move out of the service layer.",
      "You propose a command or query type that is calmer for the service boundary.",
      "You place HTTP status mapping and documentation concerns back at the transport boundary.",
      "You explain one concrete testing or refactoring benefit of the repaired seam.",
    ],
    hints: [
      "If the service could not run under a message queue or CLI boundary anymore, HTTP has probably leaked too far inward.",
      "The calm repair usually makes the service boundary easier to unit test as plain Rust.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Refactor a handler into a testable service boundary",
    objective:
      "Implement a small typed handler that converts a request DTO into a command, calls a service, and returns one response shape without leaking transport types inward.",
    starterPrompt:
      "Take a small create-style endpoint, add an authenticated actor, map the request DTO into a command, call the service, and return a created response.",
    prompts: [
      "Keep the service API free of framework request wrappers.",
      "Use one typed caller context such as tenant plus permission bit.",
      "Translate one domain rejection into one API-facing error at the edge.",
      "Return a status and response payload that another test can assert deterministically.",
    ],
    acceptanceCriteria: [
      "The handler translates request DTO into a separate command type.",
      "The service boundary does not accept HTTP request DTOs directly.",
      "The handler performs at least one authorization or edge validation check before the service call.",
      "The runnable lab prints the expected created status, invoice ID, and tenant.",
    ],
    hints: [
      "A create handler should be boring: authorize, map, call, translate.",
      "If the domain service still takes the request DTO, the transport seam is not finished yet.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Choose code-first, spec-first, or mixed OpenAPI workflow honestly",
    objective:
      "Pick the workflow that matches team boundaries and generated-code obligations instead of choosing by fashion.",
    starterPrompt:
      "You have one Rust server, one TypeScript client, and one partner team that wants the contract reviewed before implementation lands.",
    prompts: [
      "What makes code-first attractive here?",
      "What makes spec-first attractive here?",
      "What would a mixed workflow look like if the checked-in spec must still be CI-enforced?",
      "Which workflow makes generated clients least surprising for the teams involved?",
    ],
    acceptanceCriteria: [
      "You choose one primary workflow and justify it from team and review boundaries.",
      "You explain at least one tradeoff of the two alternatives.",
      "You include one CI or artifact rule that keeps the chosen workflow honest.",
      "You avoid claiming that one style is universally superior in every organization.",
    ],
    hints: [
      "The right answer is usually the one that minimizes silent drift between server and clients.",
      "Think about who reviews the contract and when, not only about who writes the code.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Prevent documentation drift and generated-code drift",
    objective:
      "Design a review loop that keeps handlers, OpenAPI artifacts, Swagger UI, and generated clients describing the same API over time.",
    starterPrompt:
      "A recent rollout changed one handler input field, but the checked-in spec and generated client were not regenerated. The change passed unit tests and broke one downstream team.",
    prompts: [
      "Which CI check should fail first: spec diff, generated client compile, or contract fixture test?",
      "Which artifacts should be checked into the repository and which can be generated only in CI?",
      "How would you review Swagger UI or schema output without treating it as the only proof?",
      "Which fields or operation IDs should be stabilized so downstream diffs stay reviewable?",
    ],
    acceptanceCriteria: [
      "You define at least two drift-prevention checks with different jobs.",
      "You include at least one checked artifact or snapshot strategy and one generated-client validation strategy.",
      "You mention stable operation IDs or stable error envelopes explicitly.",
      "You explain why documentation review still needs semantic contract assertions nearby.",
    ],
    hints: [
      "The most useful drift check is the one that fails before a client release is cut from stale types.",
      "Swagger UI helps humans, but CI still needs machine-checkable contract evidence.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Design one production API surface with versioning, pagination, idempotency, tracing, metrics, and graceful shutdown",
    objective:
      "Make the non-happy-path parts of a web API explicit before the service ships.",
    starterPrompt:
      "You are designing a billing API with create, list, and lookup endpoints, one async side-effect path, and an operator requirement that canary rollout and rollback stay safe under load.",
    prompts: [
      "Which routes or envelopes carry version boundaries, and how do they evolve?",
      "Which list route wants cursor pagination and what limits should be validated at the edge?",
      "Which create route needs an idempotency key and where does finish-once state live?",
      "Which trace and metric fields must exist before rollout?",
      "How does the server stop admitting and drain gracefully during deployment shutdown?",
    ],
    acceptanceCriteria: [
      "You define at least one versioning rule, one pagination rule, and one idempotency rule.",
      "You include at least two observability hooks such as request ID, trace ID, route, queue age, or publish latency.",
      "You describe one graceful shutdown sequence that stops admission before exit.",
      "You keep the explanation tied to transport and application boundaries rather than only to framework settings.",
    ],
    hints: [
      "A production API design is still an ownership and pacing design once traffic is real.",
      "If the service causes duplicate side effects during deploy shutdown, graceful shutdown was not actually graceful.",
    ],
  },
]

const reviewQuestions = [
  "What does it mean for a domain service to stay HTTP-free in a Rust web application?",
  "Why are typed extractors and typed state a better long-term seam than passing one raw request object around?",
  "When is code-first OpenAPI the calm default, and when does spec-first become more honest?",
  "Why should generated clients stay in the transport layer rather than in the domain layer?",
  "What CI checks keep Swagger UI and generated SDKs from silently drifting away from handler behavior?",
]

const workingLoop = [
  "State the public API contract first: route, version, request DTO, response DTO, and caller-visible errors.",
  "Translate transport DTOs into application commands or queries before the service boundary.",
  "Choose one OpenAPI workflow and one CI drift check before adding more framework convenience.",
  "Add auth, idempotency, tracing, metrics, and graceful shutdown at the boundaries where they change real behavior.",
]

const apiContractChecklist = [
  "HTTP request and response DTOs stay separate from domain entities and service commands.",
  "OpenAPI generation has one declared source of truth and one CI drift gate.",
  "Generated clients and server stubs are validated as transport artifacts, not ignored after generation.",
  "Request validation, typed errors, auth hooks, and observability fields are part of the public contract.",
  "Graceful shutdown and idempotency are exercised before rollout, not only documented afterward.",
]

export function PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegenExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises")
  const mainPageIndex = getPageIndexById("ch46-fastapi-style-web-apps-swagger-openapi-codegen")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 46 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice Rust web API design the way it survives review: typed boundaries, domain isolation, OpenAPI workflows,
          generated-code discipline, and operational contracts that stay honest after rollout.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a transport-and-contract review. The strongest answer does not stop at “use a web
                framework” or “generate OpenAPI.” It says which types belong at the edge, which types belong in the
                application service, and which tests keep docs, codegen, and behavior aligned later.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 46
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
          <h3 className="text-lg font-semibold text-foreground mb-3">API contract checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {apiContractChecklist.map((item) => (
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
                  API contract drill
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
          title="Runnable lab · Refactor the handler away from transport leakage"
          description={
            <>
              Repair the starter so the handler maps a request DTO into a separate command type, calls the service, and
              returns a created response without leaking HTTP-shaped types into the service boundary. The checker expects
              the exact output below.
            </>
          }
          filename="handler_boundary_lab.rs"
          runKey="ch46_ex_handler_boundary"
          expectedOutput={"status = 201\ninvoice = inv-7\ntenant = acme"}
          helperText={
            <>
              Tip: create one <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">CreateInvoiceCommand</code>{" "}
              from the actor and request, call <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">service.create(cmd)</code>,
              then translate the returned domain invoice into the handler's response tuple.
            </>
          }
          initialCode={`#[derive(Debug, Clone)]\nstruct CreateInvoiceRequest {\n    customer_id: String,\n    total_cents: u64,\n}\n\n#[derive(Debug, Clone)]\nstruct CreateInvoiceCommand {\n    tenant: String,\n    customer_id: String,\n    total_cents: u64,\n}\n\n#[derive(Debug, Clone)]\nstruct Invoice {\n    id: String,\n    tenant: String,\n}\n\n#[derive(Debug, Clone)]\nstruct Actor {\n    tenant: String,\n    can_create: bool,\n}\n\n#[derive(Debug)]\nenum ApiError {\n    Forbidden,\n    BadRequest(&'static str),\n}\n\nstruct InvoiceService;\n\nimpl InvoiceService {\n    fn create(&self, cmd: CreateInvoiceCommand) -> Result<Invoice, &'static str> {\n        if cmd.total_cents == 0 {\n            Err(\"total must be positive\")\n        } else {\n            Ok(Invoice {\n                id: format!(\"inv-{}\", cmd.customer_id),\n                tenant: cmd.tenant,\n            })\n        }\n    }\n}\n\nfn create_invoice_handler(\n    service: &InvoiceService,\n    actor: Actor,\n    request: CreateInvoiceRequest,\n) -> Result<(u16, String, String), ApiError> {\n    if !actor.can_create {\n        return Err(ApiError::Forbidden);\n    }\n\n    Err(ApiError::BadRequest(\"unfinished\"))\n}\n\nfn main() {\n    let service = InvoiceService;\n    let actor = Actor {\n        tenant: String::from(\"acme\"),\n        can_create: true,\n    };\n    let request = CreateInvoiceRequest {\n        customer_id: String::from(\"7\"),\n        total_cents: 4_200,\n    };\n\n    match create_invoice_handler(&service, actor, request) {\n        Ok((status, invoice_id, tenant)) => {\n            println!(\"status = {}\", status);\n            println!(\"invoice = {}\", invoice_id);\n            println!(\"tenant = {}\", tenant);\n        }\n        Err(_) => {\n            println!(\"status = {}\", 0);\n            println!(\"invoice = broken\");\n            println!(\"tenant = broken\");\n        }\n    }\n}`}
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
            By the end of this page, you should be able to design one typed Rust endpoint with extractors and app state,
            choose an OpenAPI workflow that matches your team boundaries, keep generated code in the transport layer, and
            explain how documentation drift, idempotency, and graceful shutdown affect a production API contract.
          </p>
        </section>
      </div>
    </div>
  )
}

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
    title: "HTTP is a translation boundary, not your domain model",
    body: "A Rust web handler should decode transport input, authenticate and authorize, build one application command, call one service boundary, and translate the result back into HTTP. The domain should not learn about query strings, path extractors, or Swagger annotations by accident.",
  },
  {
    title: "FastAPI-like ergonomics in Rust come from types plus seams",
    body: "FastAPI feels productive because routing, request models, validation, and docs line up. In Rust, the same feel usually comes from typed extractors, typed state, structured middleware, and schema generation. The difference is that ownership, cancellation, and Send or Sync boundaries stay explicit instead of being hidden behind runtime reflection.",
  },
  {
    title: "OpenAPI is a contract artifact, not a screenshot of your handlers",
    body: "If clients, server stubs, docs, and tests all depend on one API shape, the spec should be generated or curated as a first-class artifact. The operational question is not code-first versus spec-first in the abstract. It is which workflow keeps drift visible and reviewable in your repository.",
  },
]

const fastApiExperienceCards = [
  {
    title: "Routers",
    body: "Keep routing focused on transport shape: HTTP method, path, and version boundary. The route should pick the handler, not define the business rule.",
    code: `POST /v1/invoices -> create_invoice\nGET /v1/invoices/{id} -> get_invoice`,
  },
  {
    title: "Extractors",
    body: "Typed extractors are Rust's replacement for ad hoc request digging. Path, query, JSON body, auth claims, and typed headers become ordinary typed inputs at the edge.",
    code: `Path<InvoiceId>\nQuery<PageRequest>\nJson<CreateInvoiceRequest>`,
  },
  {
    title: "Typed state",
    body: "Application state should hold owned service objects, connection pools, config snapshots, and telemetry handles. Clone only cheap shared handles such as Arc-backed clients when the framework boundary requires it.",
    code: `struct AppState {\n    billing: BillingService,\n    idempotency: IdempotencyStore,\n}`,
  },
  {
    title: "Middleware",
    body: "Middleware should stay cross-cutting: auth, request IDs, tracing, rate limits, timeout policy, and maybe body size limits. Do not bury business rules in middleware just because it runs early.",
    code: `request_id -> auth -> trace -> timeout -> handler`,
  },
  {
    title: "Dependency boundaries",
    body: "Rust frameworks differ in how they spell handlers, but the transferable seam is the same: transport DTOs in, application service call, transport DTOs out.",
    code: `HTTP DTO -> command -> service -> result -> HTTP DTO`,
  },
]

const frameworkChoiceCards = [
  {
    title: "Pick a framework for the outer shell, not for the whole architecture",
    body: "Examples of ecosystem options include axum-style extractor and tower composition, actix-web-style service layering, and frameworks with more integrated OpenAPI helpers. The important thing is that your domain and application services survive a framework swap with small adapter changes.",
  },
  {
    title: "A framework should not own your business types",
    body: "If a service method takes framework request extractors directly, your transport layer already leaked inward. Prefer framework-facing DTOs or small wrapper types that are converted into commands or queries before the service call.",
  },
  {
    title: "Cancellation and backpressure still matter at the HTTP edge",
    body: "A nice developer experience is not enough if every request spawns unbounded work, buffers bodies indefinitely, or holds one database connection per handler branch. Choose frameworks and middleware patterns with clear limits around request size, in-flight concurrency, and graceful shutdown.",
  },
  {
    title: "Generated docs are useful only when operations remain stable",
    body: "Stable operation IDs, response envelopes, auth requirements, and versioning rules matter more than which framework mounted Swagger UI first. Treat documentation ergonomics as contract ergonomics, not as decoration.",
  },
]

const openApiWorkflowCards = [
  {
    title: "Code-first",
    body: "Define typed request and response DTOs in Rust, annotate or derive schema information, then emit OpenAPI from that source. This is strong when the server code is the main source of truth and the spec should stay mechanically aligned with it.",
  },
  {
    title: "Spec-first",
    body: "Start from an OpenAPI document, generate server stubs or client types, and implement behind those contracts. This is strong when several teams or languages share the API and the spec must be reviewed before the server code exists.",
  },
  {
    title: "Mixed workflow",
    body: "Keep a checked-in spec artifact, but still derive or generate parts of it from Rust DTOs and validate the result in CI. This is often the calmest large-team compromise when docs, generated clients, and server code all need one reviewable contract.",
  },
]

const swaggerCards = [
  {
    title: "Swagger UI is a debugging and onboarding surface",
    body: "A docs page should show versioned paths, example payloads, auth requirements, typed errors, and deprecation notes clearly enough that another team can use the API without reverse-engineering handlers.",
  },
  {
    title: "Examples and operation IDs matter",
    body: "Generated docs are much more useful when operation IDs stay stable, examples look realistic, and error responses are documented with the same discipline as happy-path payloads.",
  },
  {
    title: "Separate internal and external docs when contracts differ",
    body: "If internal queues or admin-only routes should not leak into public client generation, keep the docs surface intentional. One monolithic Swagger page for every transport boundary often creates more confusion than clarity.",
  },
]

const codegenCards = [
  {
    title: "Generated clients belong in the transport layer",
    body: "A generated client should expose DTOs or transport types, then be wrapped behind a small trait or adapter if the rest of the system should not depend on the generator's exact naming or optionality rules.",
  },
  {
    title: "Generated server stubs should stay thin",
    body: "Generated handler signatures or router scaffolds are useful when they terminate at one application service boundary quickly. If the stub becomes the place where business logic accumulates, the transport layer has become too heavy.",
  },
  {
    title: "Prevent codegen drift in CI",
    body: "A changed spec should regenerate code, compile cleanly, and ideally run at least one smoke or contract test. A generated client that has not been rebuilt since the last schema change is already stale operationally.",
  },
]

const validationCards = [
  {
    title: "Request validation",
    body: "Validate shape and contract at the edge: required fields, page size bounds, enum decoding, path parameter parsing, and auth headers. Keep domain invariants in domain constructors or service rules after transport validation completes.",
  },
  {
    title: "Typed errors",
    body: "Return typed error envelopes or predictable status mappings. HTTP 400, 401, 403, 404, 409, and 422 should each mean something reviewable rather than being chosen ad hoc per handler.",
  },
  {
    title: "Authentication hooks",
    body: "Auth extraction should produce one typed caller context: tenant, actor ID, scopes, or role claims. The handler can then authorize explicitly before calling the domain or application service.",
  },
  {
    title: "Response schemas",
    body: "Keep response DTOs stable, documented, and version-aware. Avoid leaking raw internal structs whose fields change whenever the domain model is refactored.",
  },
]

const productionConcernCards = [
  {
    title: "Versioning",
    body: "Version in paths, headers, or envelopes deliberately. Prefer additive change plus deprecation over redefining field meaning in place. Stable operation IDs and stable error envelopes help clients survive the transition.",
  },
  {
    title: "Pagination",
    body: "Cursor-based pagination is often calmer than offset pagination once data grows or inserts become common. Whatever you choose, make bounds and continuation tokens typed and explicit in the contract.",
  },
  {
    title: "Idempotency",
    body: "For create, charge, or other side-effect-heavy routes, an idempotency key is often part of correctness, not only convenience. The HTTP layer should extract it clearly and the durable boundary should own the finish-once rule.",
  },
  {
    title: "Tracing and metrics",
    body: "Instrument request ID, trace ID, route, tenant, queue handoff, and downstream publish or store time. API latency without queue or retry context is often too shallow for real incidents.",
  },
  {
    title: "Graceful shutdown",
    body: "Stop admitting new requests, let in-flight handlers finish or time out, drain local work queues, and surface remaining backlog before process exit. The HTTP server, spawned tasks, and generated client calls should all respect the same shutdown story.",
  },
]

const driftPreventionCards = [
  {
    title: "Spec diff in CI",
    body: "Generate the OpenAPI artifact in CI and fail when the checked-in spec drifted unexpectedly. This catches silent handler changes before client teams discover them at runtime.",
  },
  {
    title: "Generated client compile lane",
    body: "If you publish generated clients or stubs, rebuild them in CI and compile them against the changed contract. A broken generator run is a contract failure, not an optional maintenance task.",
  },
  {
    title: "Contract tests",
    body: "Run request and response fixtures against the server boundary, not only against service internals. This keeps serialization, validation, auth hooks, and status mapping honest.",
  },
  {
    title: "Documentation review discipline",
    body: "Swagger UI and snapshots help humans review docs drift, but pair them with semantic assertions such as required fields, version headers, pagination bounds, and error classification.",
  },
]

const transportPipelineSnippet = `HTTP extractor DTO
    -> application command or query
    -> service trait or concrete app service
    -> domain result
    -> response DTO`

const ecosystemNote = `In a real Cargo project, common ecosystem options include framework layers such as axum, actix-web, poem, or salvo, plus OpenAPI tooling such as code-first schema generators, spec-first code generators, or mixed workflows. The browser examples stay self-contained so the transferable boundary design is visible without framework-version noise.`

const productionPatterns = [
  "Keep transport DTOs, application commands, and domain types separate. Convert once at the handler boundary and keep the service API HTTP-free.",
  "Treat OpenAPI as a build artifact with one explicit source-of-truth workflow: code-first, spec-first, or mixed. Then enforce that workflow in CI.",
  "Use stable operation IDs, versioned error envelopes, realistic examples, and auth documentation so Swagger UI stays operationally useful.",
  "Generate clients and server stubs as transport adapters, not as the whole architecture. Domain logic should still live behind service boundaries.",
  "Budget request size, in-flight concurrency, downstream call limits, and graceful shutdown explicitly. FastAPI-like ergonomics do not remove backpressure and cancellation concerns.",
  "Add contract tests and spec-diff gates so documentation drift is caught as a build failure instead of as a client incident.",
]

const pitfalls = [
  "Letting the domain or application service take framework request types directly because it felt convenient in one handler.",
  "Treating OpenAPI generation as a side effect of the build without testing the generated spec, generated client, or published docs surface.",
  "Publishing one Swagger page that mixes public routes, admin-only routes, and internal-only contracts until nobody knows which surface is stable.",
  "Generating clients and then leaking those generated transport types deep into the domain model, which makes generator churn look like a business refactor.",
  "Ignoring idempotency, timeout, or graceful shutdown because the local dev server felt simple enough without them.",
  "Assuming handler latency is the full API story while queue handoff, retry, or downstream publish time actually dominate user-visible latency.",
]

const summaryPoints = [
  "FastAPI-like ergonomics in Rust come from typed routers, extractors, state, middleware, and schema generation, not from hiding ownership or cancellation.",
  "Choose frameworks for the transport shell and keep the domain model independent of HTTP and documentation tooling.",
  "OpenAPI can be code-first, spec-first, or mixed; the important part is making one workflow authoritative and CI-enforced.",
  "Swagger UI is useful when operation IDs, examples, auth, versioning, and typed errors are documented with the same discipline as the handlers themselves.",
  "Generated clients and server stubs should stay thin transport adapters, while request validation, typed errors, auth hooks, and idempotency remain explicit application concerns.",
  "Production APIs still need versioning, pagination, tracing, metrics, graceful shutdown, and contract-drift tests long after the first route compiles.",
]

export function PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegen() {
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

  const pageIndex = getPageIndexById("ch46-fastapi-style-web-apps-swagger-openapi-codegen")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter41PageIndex = getPageIndexById("ch41-error-handling-in-large-systems")
  const chapter42PageIndex = getPageIndexById("ch42-testing-advanced-rust-systems")
  const chapter43PageIndex = getPageIndexById("ch43-observability")
  const chapter45PageIndex = getPageIndexById("ch45-capstone-distributed-rust-system")
  const exercisesPageIndex = getPageIndexById("ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises")
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
          Chapter 46 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Web API delivery needs typed handlers, documented contracts, generated transport code, and domain services
          isolated from HTTP concerns. This chapter builds that production boundary in Rust.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Builds on Chapters 19, 25, 41, 42, 43, and 45
              </h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 19 covered stable wire DTOs and serialization contracts. Chapter 25 covered Tokio and service
                runtime boundaries. Chapter 41 covered typed errors and translation layers. Chapter 42 covered contract and
                integration tests. Chapter 43 covered tracing, metrics, and SLOs. Chapter 45 tied those ideas together in
                one distributed system. This chapter narrows that same discipline to HTTP APIs and OpenAPI contracts.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter41PageIndex)}>
                Chapter 41
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter42PageIndex)}>
                Chapter 42
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Chapter 43
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter45PageIndex)}>
                Chapter 45
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            An API prototype is being moved to Rust for tighter latency, concurrency, and failure-control requirements
            while preserving typed handlers and usable documentation. The business requirement is to keep HTTP DTOs,
            generated OpenAPI artifacts, and framework extractors at the transport edge while domain services remain
            independent and testable.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">Transport-to-domain pipeline</div>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{transportPipelineSnippet}</code>
            </pre>
          </div>
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">{ecosystemNote}</p>
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

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              FastAPI-like developer experience in Rust: routers, extractors, typed state, middleware, and dependency boundaries
            </h4>
            <div className="grid gap-4 lg:grid-cols-5">
              {fastApiExperienceCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                  <pre className="mt-3 rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                    <code className="font-mono text-foreground">{card.code}</code>
                  </pre>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The main difference from Python FastAPI is operational, not stylistic. Rust will not let you pretend a
                spawned task still borrows request-local state or that an auth claim magically exists everywhere. The
                signature is part of the ownership model.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Choosing between Rust web frameworks without coupling the domain model to HTTP
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {frameworkChoiceCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">OpenAPI as a contract: code-first, spec-first, and mixed workflows</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {openApiWorkflowCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The best workflow is the one that keeps drift reviewable. If client teams live off generated SDKs, the spec
                probably deserves its own checked artifact and diff gate even when Rust DTOs still generate most of it.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Swagger UI integration and documentation ergonomics</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {swaggerCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Client and server code generation from OpenAPI</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {codegenCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Request validation, typed errors, authentication hooks, and response schemas
            </h4>
            <div className="grid gap-4 lg:grid-cols-4">
              {validationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                A common migration mistake is validating only at the HTTP layer and then pretending the domain can never
                see bad state again. Transport validation and domain invariants are complementary, not interchangeable.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Production API concerns: versioning, pagination, idempotency, tracing, metrics, and graceful shutdown
            </h4>
            <div className="grid gap-4 lg:grid-cols-5">
              {productionConcernCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing API contracts and preventing documentation drift</h4>
            <div className="grid gap-4 lg:grid-cols-4">
              {driftPreventionCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter42PageIndex)}>
                Revisit Chapter 42
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Revisit Chapter 43
              </Button>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Comparison callout</h4>
            <div className="grid gap-3 lg:grid-cols-3">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{comparison.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{comparison.body}</p>
                </div>
              ))}
            </div>
          </article>
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
                The biggest documentation bug is often not a missing description string. It is a handler and an OpenAPI
                contract that silently stopped describing the same system.
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
                <h4 className="font-semibold text-foreground">Example 1: keep the HTTP handler separate from the application service</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The handler owns transport translation and auth. The service owns domain behavior. That seam survives
                  framework swaps much better than a direct framework-shaped domain API.
                </p>
              </div>
              {codes.fastapi_style_handler_service_boundary !== DEFAULT_CODES.fastapi_style_handler_service_boundary && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("fastapi_style_handler_service_boundary")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.fastapi_style_handler_service_boundary}
              onChange={(newCode) => updateCode("fastapi_style_handler_service_boundary", newCode)}
              onRun={() => runCode("fastapi_style_handler_service_boundary")}
              output={outputs.fastapi_style_handler_service_boundary ?? null}
              isRunning={isRunning === "fastapi_style_handler_service_boundary"}
              filename="handler_service_boundary.rs"
              expectedOutput={"status = 201\ninvoice = inv-42\ntotal cents = 4200\nrequest id = req-7"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.fastapi_style_handler_service_boundary}
              onRevert={() => resetCode("fastapi_style_handler_service_boundary")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Transport DTO</div>
                <p className="text-xs text-muted-foreground leading-5">
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">CreateInvoiceRequest</code> is
                  HTTP-facing shape, not the domain-facing service contract.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Application command</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The handler builds one command and the service works only from that command.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Typed auth</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Auth becomes one caller context object, not a global ambient assumption.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Error mapping</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Domain rejection is translated to an API-facing error only at the edge.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: treat OpenAPI and Swagger as contract artifacts, not side effects</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The example stays self-contained, but the structure matches real code-first or mixed workflows: define
                  operations once, emit docs once, and generate thin transport code from the same artifact.
                </p>
              </div>
              {codes.fastapi_style_openapi_codegen_scaffold !== DEFAULT_CODES.fastapi_style_openapi_codegen_scaffold && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("fastapi_style_openapi_codegen_scaffold")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.fastapi_style_openapi_codegen_scaffold}
              onChange={(newCode) => updateCode("fastapi_style_openapi_codegen_scaffold", newCode)}
              onRun={() => runCode("fastapi_style_openapi_codegen_scaffold")}
              output={outputs.fastapi_style_openapi_codegen_scaffold ?? null}
              isRunning={isRunning === "fastapi_style_openapi_codegen_scaffold"}
              filename="openapi_contract_codegen_scaffold.rs"
              expectedOutput={"operations = 2\nswagger = /docs\nclient methods = create_invoice,get_invoice\nserver stubs = 2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.fastapi_style_openapi_codegen_scaffold}
              onRevert={() => resetCode("fastapi_style_openapi_codegen_scaffold")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Operation IDs</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Stable operation IDs are the anchor for generated clients and docs review.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Swagger surface</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Mount docs intentionally and keep the path and audience explicit.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Generated client</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Generated methods belong to the transport layer, not directly to the domain model.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Server stubs</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Generated stubs are helpful only if they terminate quickly at one application service boundary.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch46_fastapi_style_web_apps_swagger_openapi_codegen/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor, including one extra
              typed-error and idempotency scaffold.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to design typed extractors and state, keep the domain model free of HTTP
            types, choose code-first versus spec-first OpenAPI workflows, and prevent documentation drift with contract
            tests and generated-code checks.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 46 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
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
````

### File: `components/rust-book/pages/page-ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises.tsx`
```tsx
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
    objective: "Practice translating a familiar typed web endpoint into Rust extractors, typed state, and one application service call without leaking HTTP inward.",
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
    objective: "Read a handler and service pair and identify where HTTP types, status semantics, or documentation concerns have crossed the wrong boundary.",
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
    objective: "Implement a small typed handler that converts a request DTO into a command, calls a service, and returns one response shape without leaking transport types inward.",
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
    objective: "Pick the workflow that matches team boundaries and generated-code obligations instead of choosing by fashion.",
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
    objective: "Design a review loop that keeps handlers, OpenAPI artifacts, Swagger UI, and generated clients describing the same API over time.",
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
    objective: "Make the non-happy-path parts of a web API explicit before the service ships.",
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
          initialCode={`#[derive(Debug, Clone)]
struct CreateInvoiceRequest {
    customer_id: String,
    total_cents: u64,
}

#[derive(Debug, Clone)]
struct CreateInvoiceCommand {
    tenant: String,
    customer_id: String,
    total_cents: u64,
}

#[derive(Debug, Clone)]
struct Invoice {
    id: String,
    tenant: String,
}

#[derive(Debug, Clone)]
struct Actor {
    tenant: String,
    can_create: bool,
}

#[derive(Debug)]
enum ApiError {
    Forbidden,
    BadRequest(&'static str),
}

struct InvoiceService;

impl InvoiceService {
    fn create(&self, cmd: CreateInvoiceCommand) -> Result<Invoice, &'static str> {
        if cmd.total_cents == 0 {
            Err("total must be positive")
        } else {
            Ok(Invoice {
                id: format!("inv-{}", cmd.customer_id),
                tenant: cmd.tenant,
            })
        }
    }
}

fn create_invoice_handler(
    service: &InvoiceService,
    actor: Actor,
    request: CreateInvoiceRequest,
) -> Result<(u16, String, String), ApiError> {
    if !actor.can_create {
        return Err(ApiError::Forbidden);
    }

    Err(ApiError::BadRequest("unfinished"))
}

fn main() {
    let service = InvoiceService;
    let actor = Actor {
        tenant: String::from("acme"),
        can_create: true,
    };
    let request = CreateInvoiceRequest {
        customer_id: String::from("7"),
        total_cents: 4_200,
    };

    match create_invoice_handler(&service, actor, request) {
        Ok((status, invoice_id, tenant)) => {
            println!("status = {}", status);
            println!("invoice = {}", invoice_id);
            println!("tenant = {}", tenant);
        }
        Err(_) => {
            println!("status = {}", 0);
            println!("invoice = broken");
            println!("tenant = broken");
        }
    }
}`}
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
````

### File: `examples/ch46_fastapi_style_web_apps_swagger_openapi_codegen/handler_service_boundary.rs`
```rust
#[derive(Debug, Clone)]
struct CreateInvoiceRequest {
    customer_id: String,
    line_totals: Vec<u64>,
}

#[derive(Debug, Clone)]
struct CreateInvoiceCommand {
    tenant: String,
    customer_id: String,
    line_totals: Vec<u64>,
}

#[derive(Debug, Clone)]
struct Invoice {
    id: String,
    tenant: String,
    total_cents: u64,
}

#[derive(Debug)]
enum DomainError {
    EmptyInvoice,
    Unauthorized,
}

#[derive(Debug)]
enum ApiError {
    BadRequest(&'static str),
    Forbidden,
}

struct InvoiceService;

impl InvoiceService {
    fn create_invoice(&self, cmd: CreateInvoiceCommand) -> Result<Invoice, DomainError> {
        if cmd.line_totals.is_empty() {
            return Err(DomainError::EmptyInvoice);
        }

        let total_cents: u64 = cmd.line_totals.iter().copied().sum();

        Ok(Invoice {
            id: format!("inv-{}", cmd.customer_id),
            tenant: cmd.tenant,
            total_cents,
        })
    }
}

struct ApiState {
    invoices: InvoiceService,
    service_name: String,
}

#[derive(Debug)]
struct AuthenticatedUser {
    tenant: String,
    can_create: bool,
}

#[derive(Debug)]
struct CreatedInvoiceResponse {
    status: u16,
    request_id: String,
    invoice_id: String,
    tenant: String,
    total_cents: u64,
}

fn create_invoice_handler(
    state: &ApiState,
    actor: AuthenticatedUser,
    request_id: &str,
    body: CreateInvoiceRequest,
) -> Result<CreatedInvoiceResponse, ApiError> {
    if !actor.can_create {
        return Err(ApiError::Forbidden);
    }

    let cmd = CreateInvoiceCommand {
        tenant: actor.tenant,
        customer_id: body.customer_id,
        line_totals: body.line_totals,
    };

    let created = state
        .invoices
        .create_invoice(cmd)
        .map_err(|err| match err {
            DomainError::EmptyInvoice => {
                ApiError::BadRequest("invoice must contain at least one line")
            }
            DomainError::Unauthorized => ApiError::Forbidden,
        })?;

    Ok(CreatedInvoiceResponse {
        status: 201,
        request_id: request_id.to_string(),
        invoice_id: created.id,
        tenant: created.tenant,
        total_cents: created.total_cents,
    })
}

fn main() {
    let state = ApiState {
        invoices: InvoiceService,
        service_name: String::from("billing-api"),
    };
    let actor = AuthenticatedUser {
        tenant: String::from("acme"),
        can_create: true,
    };
    let request = CreateInvoiceRequest {
        customer_id: String::from("42"),
        line_totals: vec![1_200_u64, 3_000],
    };

    let created = create_invoice_handler(&state, actor, "req-7", request).unwrap();

    println!("status = {}", created.status);
    println!("invoice = {}", created.invoice_id);
    println!("total cents = {}", created.total_cents);
    println!("request id = {}", created.request_id);
}
````

### File: `examples/ch46_fastapi_style_web_apps_swagger_openapi_codegen/openapi_contract_codegen_scaffold.rs`
```rust
#[derive(Debug, Clone)]
struct ApiSchema {
    name: &'static str,
    required_fields: &'static [&'static str],
}

#[derive(Debug, Clone)]
struct ApiOperation {
    method: &'static str,
    path: &'static str,
    operation_id: &'static str,
    request: Option<ApiSchema>,
    response: ApiSchema,
    auth: bool,
}

#[derive(Debug)]
struct OpenApiDoc {
    title: &'static str,
    version: &'static str,
    swagger_ui_path: &'static str,
    operations: Vec<ApiOperation>,
}

#[derive(Debug)]
struct CodegenPlan {
    client_methods: Vec<&'static str>,
    server_stubs: usize,
}

fn build_doc() -> OpenApiDoc {
    OpenApiDoc {
        title: "Billing API",
        version: "2026-04",
        swagger_ui_path: "/docs",
        operations: vec![
            ApiOperation {
                method: "POST",
                path: "/v1/invoices",
                operation_id: "create_invoice",
                request: Some(ApiSchema {
                    name: "CreateInvoiceRequest",
                    required_fields: &["customer_id", "line_totals"],
                }),
                response: ApiSchema {
                    name: "CreatedInvoiceResponse",
                    required_fields: &["invoice_id", "total_cents"],
                },
                auth: true,
            },
            ApiOperation {
                method: "GET",
                path: "/v1/invoices/{id}",
                operation_id: "get_invoice",
                request: None,
                response: ApiSchema {
                    name: "InvoiceResponse",
                    required_fields: &["invoice_id", "total_cents"],
                },
                auth: true,
            },
        ],
    }
}

fn generate_code(doc: &OpenApiDoc) -> CodegenPlan {
    let client_methods = doc
        .operations
        .iter()
        .map(|op| op.operation_id)
        .collect::<Vec<_>>();

    CodegenPlan {
        server_stubs: doc.operations.len(),
        client_methods,
    }
}

fn main() {
    let doc = build_doc();
    let plan = generate_code(&doc);

    println!("operations = {}", doc.operations.len());
    println!("swagger = {}", doc.swagger_ui_path);
    println!("client methods = {}", plan.client_methods.join(","));
    println!("server stubs = {}", plan.server_stubs);
}
````

### File: `examples/ch46_fastapi_style_web_apps_swagger_openapi_codegen/typed_errors_auth_idempotency.rs`
```rust
#[derive(Debug, Clone)]
struct PageRequest {
    cursor: Option<String>,
    limit: usize,
}

#[derive(Debug, Clone)]
struct ListInvoicesQuery {
    tenant: String,
    cursor: Option<String>,
    limit: usize,
}

#[derive(Debug, Clone)]
struct Actor {
    tenant: String,
    can_read: bool,
}

#[derive(Debug)]
enum ApiError {
    Forbidden,
    Validation(&'static str),
}

#[derive(Debug, Clone)]
struct IdempotencyKey(String);

fn normalize_limit(limit: usize) -> Result<usize, ApiError> {
    if (1..=100).contains(&limit) {
        Ok(limit)
    } else {
        Err(ApiError::Validation("limit must be 1..=100"))
    }
}

fn build_query(actor: &Actor, request: &PageRequest) -> Result<ListInvoicesQuery, ApiError> {
    if !actor.can_read {
        return Err(ApiError::Forbidden);
    }

    Ok(ListInvoicesQuery {
        tenant: actor.tenant.clone(),
        cursor: request.cursor.clone(),
        limit: normalize_limit(request.limit)?,
    })
}

fn main() {
    let actor = Actor {
        tenant: String::from("acme"),
        can_read: true,
    };
    let request = PageRequest {
        cursor: Some(String::from("cur-7")),
        limit: 25,
    };
    let key = IdempotencyKey(String::from("idem-100"));

    let query = build_query(&actor, &request).unwrap();

    println!("tenant = {}", query.tenant);
    println!("limit = {}", query.limit);
    println!(
        "cursor = {}",
        query.cursor.as_deref().unwrap_or("none")
    );
    println!("idempotency = {}", key.0);
}
````

### File: `components/rust-book/pages/index.ts`
````diff
--- components/rust-book/pages/index.ts
+++ components/rust-book/pages/index.ts
@@ -88,3 +88,5 @@ export { PageCh44PackagingAndDeployment } from "./page-ch44-packaging-and-deploy
 export { PageCh44PackagingAndDeploymentExercises } from "./page-ch44-packaging-and-deployment-exercises"
 export { PageCh45CapstoneDistributedRustSystem } from "./page-ch45-capstone-distributed-rust-system"
 export { PageCh45CapstoneDistributedRustSystemExercises } from "./page-ch45-capstone-distributed-rust-system-exercises"
+export { PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegen } from "./page-ch46-fastapi-style-web-apps-swagger-openapi-codegen"
+export { PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegenExercises } from "./page-ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises"
````

### File: `components/rust-book/index.tsx`
````diff
--- components/rust-book/index.tsx
+++ components/rust-book/index.tsx
@@ -97,6 +97,8 @@ import {
   PageCh43ObservabilityExercises,
   PageCh44PackagingAndDeployment,
   PageCh44PackagingAndDeploymentExercises,
   PageCh45CapstoneDistributedRustSystem,
   PageCh45CapstoneDistributedRustSystemExercises,
+  PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegen,
+  PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegenExercises,
 } from "./pages"
@@ -194,6 +196,8 @@ const PAGE_COMPONENTS = [
   PageCh43ObservabilityExercises,
   PageCh44PackagingAndDeployment,
   PageCh44PackagingAndDeploymentExercises,
   PageCh45CapstoneDistributedRustSystem,
   PageCh45CapstoneDistributedRustSystemExercises,
+  PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegen,
+  PageCh46FastApiStyleWebAppsSwaggerOpenapiCodegenExercises,
 ]
````

### File: `components/rust-book/rust-simulator.ts`
````diff
--- components/rust-book/rust-simulator.ts
+++ components/rust-book/rust-simulator.ts
@@ -1,3 +1,4 @@
+import { simulateCh46Output } from "./rust-simulator-ch46"
 import { simulateCh45Output } from "./rust-simulator-ch45"
 import { simulateCh44Output } from "./rust-simulator-ch44"
 import { simulateCh43Output } from "./rust-simulator-ch43"
@@ -1022,6 +1023,9 @@ function findCompilationError(code: string, filename: string): string | null {
 export function simulateRustExecution(code: string, key?: string, filename = "main.rs"): string {
   const compilationError = findCompilationError(code, filename)
   if (compilationError) return compilationError
+
+  const ch46Output = simulateCh46Output(code, key)
+  if (ch46Output !== null) return ch46Output
 
   const ch45Output = simulateCh45Output(code, key)
   if (ch45Output !== null) return ch45Output
````

### File: `components/rust-book/types.ts`
````diff
--- components/rust-book/types.ts
+++ components/rust-book/types.ts
@@ -35,6 +35,7 @@ import { DEFAULT_CODES_CH42 } from "./default-codes-ch42"
 import { DEFAULT_CODES_CH43 } from "./default-codes-ch43"
 import { DEFAULT_CODES_CH44 } from "./default-codes-ch44"
 import { DEFAULT_CODES_CH45 } from "./default-codes-ch45"
+import { DEFAULT_CODES_CH46 } from "./default-codes-ch46"
 
 export interface PageConfig {
   id: string
@@ -1135,6 +1136,28 @@ export const CHAPTERS: ChapterConfig[] = [
         description: "Assemble the capstone architecture, define milestones, and refactor it from profiling and queue evidence",
         icon: "trophy",
       },
+    ],
+  },
+  {
+    id: "ch46-fastapi-style-web-apps-swagger-openapi-codegen",
+    title: "Chapter 46 · FastAPI-Style Web Apps, Swagger, and OpenAPI Codegen",
+    icon: "book",
+    pages: [
+      {
+        id: "ch46-fastapi-style-web-apps-swagger-openapi-codegen",
+        title: "FastAPI-Style Web Apps, Swagger, and OpenAPI Codegen",
+        shortTitle: "Web APIs and OpenAPI",
+        description:
+          "Routers, extractors, typed state, OpenAPI workflows, Swagger UI, code generation, validation, typed errors, auth, and production API concerns",
+        icon: "book",
+        codeKeys: ["fastapi_style_handler_service_boundary", "fastapi_style_openapi_codegen_scaffold"],
+      },
+      {
+        id: "ch46-fastapi-style-web-apps-swagger-openapi-codegen-exercises",
+        title: "Chapter 46 Exercises",
+        shortTitle: "Exercises",
+        description:
+          "Design typed REST endpoints, keep domains HTTP-free, choose OpenAPI workflows, and prevent documentation drift",
+        icon: "trophy",
+      },
     ],
   },
 ]
@@ -1600,5 +1623,6 @@ export const DEFAULT_CODES: Record<string, string> = {
   ...DEFAULT_CODES_CH43,
   ...DEFAULT_CODES_CH44,
   ...DEFAULT_CODES_CH45,
+  ...DEFAULT_CODES_CH46,
 }
 export interface BookState {
````
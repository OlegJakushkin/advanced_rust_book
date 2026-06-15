"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Layers, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
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

const comparisonCallouts = [
  {
    title: "Python background",
    body: "FastAPI is the closest analogue, so the handler shape feels familiar at first glance: typed extractors, request and response models, generated OpenAPI from those models. The mental shift is that none of it is reflection at runtime. The compiler resolves your extractors and schemas before the server starts, so a claim that exists in the type only exists because you proved it, and a value moved into a spawned task is genuinely gone from the handler. The trap is reaching for an ambient request object or a global app state the way Python lets you; Rust wants those passed as typed inputs.",
  },
  {
    title: "C# background",
    body: "ASP.NET Core routing, model binding, and middleware concepts transfer almost one for one, and attribute-driven Swagger feels like the derive macros you will use here. The shift is that there is no DI container resolving services by interface at request time. State is one owned value you thread through explicitly, and the application service boundary should never take a framework request type. Keep that seam clean and a transport rewrite becomes an adapter change, not a domain rewrite.",
  },
  {
    title: "Go background",
    body: "Explicit handlers, small structs, and short middleware chains all translate naturally, and you will feel at home keeping the transport edge thin. The shift is that per-handler request digging is replaced by typed extractors that fail at the boundary, and OpenAPI usually comes from derive macros on your DTOs rather than from struct tags you read by hand. The trap is treating an extractor like a free conversion; it is the place where bad input is rejected, so design it as a real validation gate.",
  },
  {
    title: "C++ background",
    body: "If your previous HTTP stack stitched together a parser, a JSON library, and a hand-maintained OpenAPI file, the big change is consolidation: typed extractors, derive-based schemas, and one declared codegen workflow replace several integrations that drifted independently. RAII intuition helps because connection pools, request bodies, and spawned tasks all have clear owners. The shift is to let one generated contract be the source of truth instead of keeping the spec and the server in sync by review.",
  },
]

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
          A FastAPI-style developer experience in Rust comes from typed handlers, a documented OpenAPI contract,
          generated transport code, and domain services kept clear of HTTP concerns. This chapter shows where each of
          those boundaries belongs and how to keep the contract from drifting away from the code.
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
            A team has a working API prototype, written in something that made it easy to ship, and now needs to move it
            to Rust. The motivation is the usual set of production pressures: tighter and more predictable latency, real
            control over concurrency, and explicit handling of the failure cases that kept paging the on-call engineer.
            What the team does not want to lose is the part of the prototype that made it pleasant to build, namely typed
            handlers and documentation that other teams can actually read.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The requirement, stated plainly, is a single boundary rule. HTTP DTOs, the generated OpenAPI artifact, and
            the framework extractors all live at the transport edge. The domain services behind that edge stay
            independent of HTTP, so they remain easy to test, easy to reuse from a non-HTTP caller, and able to survive a
            framework change. Most of this chapter is about where to draw that line and how to keep it from eroding.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">Transport-to-domain pipeline</div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The shape to hold in your head is a one-way flow that crosses one boundary exactly once. A request enters
              as transport bytes, is decoded into an HTTP-facing DTO, is converted into a single application command or
              query, and only then reaches the service. The result travels back out the same way. The conversion happens
              at the handler and nowhere deeper, which is what keeps the service free of transport types.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  In[HTTP request] --> Ext[Typed extractor DTO]\n  Ext --> Cmd[Application command or query]\n  Cmd --> Svc[Domain or app service]\n  Svc --> Res[Domain result]\n  Res --> Out[Response DTO]\n  Out --> HTTP[HTTP response]\n  subgraph edge[Transport edge]\n    Ext\n    Out\n  end\n  subgraph core[HTTP-free core]\n    Cmd\n    Svc\n    Res\n  end`}
              caption="Transport types live only at the edge; the command, the service, and the result never see HTTP."
            />
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
          <p className="text-sm text-muted-foreground leading-6">
            Three ideas carry most of the weight in this chapter, and they are easier to hold onto if you state them
            before reaching for any framework. HTTP is a translation boundary rather than your domain model. The
            FastAPI-style feel you want comes from types and seams, not from runtime magic. And OpenAPI is an artifact
            you own and review, not a screenshot the build happens to produce. The three cards below say each of these
            more precisely; the rest of the chapter is mostly consequences of them.
          </p>
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
              What gives Rust a FastAPI-like feel: routers, extractors, typed state, middleware, and dependency boundaries
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The productivity of a FastAPI-style stack is not one feature; it is five small pieces that line up. The
              router maps an HTTP method and path to one handler and nothing more. Extractors turn the messy parts of a
              request, such as the path, the query string, the JSON body, and the auth header, into ordinary typed
              function arguments. Typed state hands the handler its dependencies. Middleware runs the cross-cutting work
              that every route needs. And the dependency boundary is the single conversion from transport DTOs into an
              application call. The five cards below take each piece in turn.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              Those pieces compose into a request lifecycle with a fixed order. Middleware runs first and outermost,
              wrapping the handler so that a request ID and a tracing span exist before authentication runs, the timeout
              policy is in force before the handler starts real work, and an early rejection, such as a failed auth
              check, short-circuits before the body is ever decoded. Only when the cross-cutting layers pass does the
              router reach the handler, where extractors decode the typed inputs and the one conversion into an
              application call happens.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Req[Incoming request] --> RID[Request ID]\n  RID --> Trace[Tracing span]\n  Trace --> Auth[Authenticate]\n  Auth -->|reject| Err[401 or 403]\n  Auth -->|pass| TO[Timeout policy]\n  TO --> H[Handler: extract and convert]\n  H --> Svc[Application service]\n  Svc --> Resp[Response DTO]`}
              caption="Middleware wraps the handler in a fixed order, so an early rejection never reaches the body or the service."
            />
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The main difference from Python FastAPI is operational, not stylistic. Rust will not let you pretend a
                spawned task still borrows request-local state or that an auth claim magically exists everywhere. The
                signature is part of the ownership model: if a handler needs the caller&apos;s identity, it takes a typed
                caller context as an argument, and if a background task needs request data, that data is moved into it.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Choosing between Rust web frameworks without coupling the domain model to HTTP
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Framework choice in Rust attracts more debate than it deserves, because the decision matters far less when
              the domain is properly insulated. The useful test is not which framework has the nicest extractor syntax;
              it is how much code would change if you swapped frameworks next year. If the answer is &ldquo;a handful of
              handler signatures and the router&rdquo;, the framework is doing its job as an outer shell. If the answer is
              &ldquo;the service layer too&rdquo;, the transport edge has leaked inward and the framework now owns your
              architecture. The cards below describe what to insist on regardless of which one you pick.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The deciding question is which artifact is the source of truth, because every other thing, the docs, the
              generated clients, and the server, is downstream of it. Code-first makes the Rust DTOs authoritative and
              derives the spec from them, which keeps spec and server mechanically aligned but means the spec only exists
              after you write code. Spec-first makes the OpenAPI document authoritative and generates server stubs and
              client types from it, which lets several teams agree on the contract before any server exists. The diagram
              shows the two directions of flow through the same OpenAPI document.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph cf[Code-first]\n    direction LR\n    DTO[Rust DTOs] --> Spec1[OpenAPI doc]\n  end\n  subgraph sf[Spec-first]\n    direction LR\n    Spec2[OpenAPI doc] --> Stub[Server stubs and client types]\n  end\n  Spec1 --> Out[Docs, generated clients, CI diff gate]\n  Spec2 --> Out`}
              caption="Code-first derives the spec from DTOs; spec-first generates code from the spec. Either way, one document feeds docs, clients, and the CI gate."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
              {openApiWorkflowCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The best workflow is the one that keeps drift reviewable, not the one that is purest in theory. If client
                teams live off generated SDKs, the spec probably deserves its own checked-in artifact and a diff gate even
                when Rust DTOs still generate most of it. The failure mode to design against is the same in every
                workflow: a contract that quietly stops describing the server it claims to document.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Swagger UI integration and documentation ergonomics</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Swagger UI is worth treating as a real user interface, because for the teams consuming your API it is the
              product. It is where another engineer figures out how to call you without reading your handlers, and it is
              the first thing a new teammate opens. That framing changes what &ldquo;good docs&rdquo; means: realistic
              example payloads, documented error responses, clearly marked auth requirements, and stable operation IDs
              matter far more than prose descriptions. The cards below cover the parts that make the page trustworthy
              rather than merely present.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Generated code is convenient precisely because it is mechanical, and that is also its risk. A generator
              encodes its own opinions about naming, optionality, and error shape, and those opinions will not match your
              domain&apos;s. The rule that keeps this healthy is to let generated types live in the transport layer and
              never deeper. A generated client gets wrapped behind a small trait so the rest of the system depends on your
              names, not the generator&apos;s; a generated server stub stays thin and hands off to one application service
              quickly. Treated that way, regenerating after a spec change is a routine rebuild rather than a refactor that
              ripples through the domain.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              It helps to separate two questions that often get blurred. The first is whether the request is
              well-formed: are the required fields present, is the page size within bounds, does the enum decode, did the
              path parameter parse? That is transport validation, and it belongs at the edge in the extractor. The second
              is whether the requested operation is allowed and consistent with domain rules, which can only be answered
              by the domain itself. Authentication sits between the two: it produces one typed caller context that the
              handler uses to authorize explicitly. The diagram traces a request through both checks and shows where each
              failure becomes which status code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Req[Request bytes] --> V1{Well-formed?}\n  V1 -->|no| E422[400 or 422]\n  V1 -->|yes| Auth{Authenticated and authorized?}\n  Auth -->|no| E401[401 or 403]\n  Auth -->|yes| Dom{Domain invariants hold?}\n  Dom -->|no| E409[409 or domain error]\n  Dom -->|yes| OK[2xx response DTO]`}
              caption="Transport validation, then auth, then domain invariants. Each gate maps to a distinct, reviewable status class."
            />
            <div className="grid gap-4 lg:grid-cols-4 mt-4">
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
                The edge keeps malformed input out; the domain keeps invalid operations out. A service that trusts the
                edge to enforce business rules is one non-HTTP caller away from a bug.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Production API concerns: versioning, pagination, idempotency, tracing, metrics, and graceful shutdown
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              These are the concerns that do not show up in the first demo and dominate the second year. Each is a
              promise the contract makes to clients over time. Versioning is the promise that a field&apos;s meaning will
              not change under them. Pagination is the promise that a large result set will not arrive as one unbounded
              response. Idempotency is the promise that a retried create will not charge a customer twice. Tracing and
              metrics are the promise that when something goes wrong you can see where, and graceful shutdown is the
              promise that a deploy will not drop in-flight work. None of these are framework features you switch on; they
              are design decisions that belong in the contract from the start.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Documentation drift is rarely a missing description. It is a handler and an OpenAPI document that slowly
              stopped describing the same system, with no failing test to announce it. The fix is to make the contract
              part of the build rather than part of code review. Generate the spec in CI and fail when the checked-in copy
              drifts; rebuild and compile any published clients against the new contract; and run request and response
              fixtures against the actual server boundary so serialization, auth hooks, and status mapping stay honest.
              The four cards below are the layers of that safety net, from cheapest to most thorough.
            </p>
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

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">What changes by background</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Most engineers arriving at Rust web work already know how to build an API somewhere else, so the useful
            framing is not &ldquo;here is routing&rdquo; but &ldquo;here is what to unlearn.&rdquo; The patterns below
            describe the one mental shift each background tends to need and the trap that comes from carrying old habits
            across unchanged. The recurring theme is that Rust makes explicit what your previous stack handled for you:
            ownership of state, where conversions happen, and where bad input is rejected.
          </p>
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Read <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">create_invoice_handler</code> top to
              bottom and watch the boundary work: it authorizes using the typed{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">AuthenticatedUser</code>, builds exactly
              one <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">CreateInvoiceCommand</code> from the
              request DTO, calls the service once, and maps the domain&apos;s{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">DomainError</code> to an{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">ApiError</code> only on the way out. The
              service itself never sees a request type, an auth header, or a status code. The diagram is that handler as a
              flow, including the two ways it can reject before any work happens.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  H[create_invoice_handler] --> A{actor.can_create?}\n  A -->|no| F[ApiError::Forbidden]\n  A -->|yes| C[Build CreateInvoiceCommand]\n  C --> S[InvoiceService::create_invoice]\n  S -->|Err EmptyInvoice| B[ApiError::BadRequest]\n  S -->|Ok Invoice| R[CreatedInvoiceResponse 201]`}
              caption="Authorize, build one command, call the service once, map errors at the edge. The service stays HTTP-free."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The shape to notice is that one value, the{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">OpenApiDoc</code> returned by{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">build_doc</code>, is the single source
              of truth. <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">generate_code</code> only
              reads it, deriving one client method per <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">operation_id</code>{" "}
              and counting one server stub per operation. Add an operation to the doc and both the generated client and
              the stub count follow automatically; nothing is maintained by hand on the side. That is the whole point of
              treating OpenAPI as an artifact rather than a side effect. The diagram traces that fan-out.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  BD[build_doc] --> Doc[OpenApiDoc operations]\n  Doc --> GC[generate_code]\n  Doc --> SW[Swagger UI at /docs]\n  GC --> CM[Client methods per operation_id]\n  GC --> SS[Server stubs, one per operation]`}
              caption="One OpenApiDoc feeds the Swagger surface and the codegen; clients and stubs are derived, never hand-kept."
            />
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

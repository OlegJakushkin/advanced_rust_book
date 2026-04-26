"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const protoSnippet = `syntax = "proto3";
package billing.v1;

message CreateInvoiceRequest {
  string customer_id = 1;
  repeated uint64 line_totals = 2;
}

message CreateInvoiceResponse {
  string invoice_id = 1;
  uint64 total_cents = 2;
}

message StreamInvoicesRequest {
  string tenant = 1;
}

message InvoiceEvent {
  string invoice_id = 1;
  string kind = 2;
}

service BillingService {
  rpc CreateInvoice(CreateInvoiceRequest) returns (CreateInvoiceResponse);
  rpc StreamInvoices(StreamInvoicesRequest) returns (stream InvoiceEvent);
  rpc UploadInvoices(stream CreateInvoiceRequest) returns (UploadSummary);
  rpc ChatInvoices(stream InvoiceEvent) returns (stream InvoiceEvent);
}`

const buildScriptSnippet = `fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::configure()
        .build_server(true)
        .build_client(true)
        .compile_protos(&["proto/billing.proto"], &["proto"])?;

    println!("cargo:rerun-if-changed=proto/billing.proto");
    Ok(())
}`

const generatedModuleSnippet = `pub mod billing {
    tonic::include_proto!("billing.v1");
}

// generated types live here:
// billing::CreateInvoiceRequest
// billing::CreateInvoiceResponse
// billing::billing_service_server::BillingServiceServer
// billing::billing_service_client::BillingServiceClient`

const serviceShapeSnippet = `#[tonic::async_trait]
impl billing_service_server::BillingService for BillingApi {
    async fn create_invoice(
        &self,
        request: Request<CreateInvoiceRequest>,
    ) -> Result<Response<CreateInvoiceResponse>, Status>;

    type StreamInvoicesStream =
        Pin<Box<dyn Stream<Item = Result<InvoiceEvent, Status>> + Send + 'static>>;

    async fn stream_invoices(
        &self,
        request: Request<StreamInvoicesRequest>,
    ) -> Result<Response<Self::StreamInvoicesStream>, Status>;

    async fn upload_invoices(
        &self,
        request: Request<Streaming<CreateInvoiceRequest>>,
    ) -> Result<Response<UploadSummary>, Status>;

    async fn chat_invoices(
        &self,
        request: Request<Streaming<InvoiceEvent>>,
    ) -> Result<Response<Self::ChatInvoicesStream>, Status>;
}`

const interceptorSnippet = `fn auth_interceptor(mut req: Request<()>) -> Result<Request<()>, Status> {
    let token = req
        .metadata()
        .get("authorization")
        .ok_or_else(|| Status::unauthenticated("missing authorization"))?;

    req.extensions_mut().insert(CallerContext::from_token(token)?);
    Ok(req)
}`

const mentalModelPoints = [
  {
    title: "gRPC is a transport contract first",
    body: "The .proto file is the durable shared contract. Rust service code should treat generated messages and service traits as transport-layer types, not as the domain model itself.",
  },
  {
    title: "Generated code is an adapter surface, not the whole architecture",
    body: "Codegen removes boilerplate around messages, clients, and server traits. It does not answer where domain commands live, how retries are classified, or which metadata should cross the auth and tracing boundary.",
  },
  {
    title: "Streaming RPCs are queue and backpressure contracts",
    body: "Unary calls feel like request-response. Streaming calls feel like bounded or unbounded pipelines. Production design questions quickly become ownership, buffering, cancellation, and who controls pace.",
  },
]

const comparisonCallouts = [
  {
    title: "Go background",
    body: "The contract shape will feel familiar: generated client and server surfaces from one .proto source. The Rust difference is sharper ownership and async boundary control around those generated types.",
  },
  {
    title: "C# background",
    body: "The ergonomic comparison is a generated client plus async service base, but Rust keeps transport DTOs, domain commands, and cancellation semantics much more explicit instead of letting framework types drift inward.",
  },
  {
    title: "C++ background",
    body: "The polyglot benefit is the same as in C++ fleets: one schema, several generated surfaces. Rust's extra discipline is that transport buffers, async tasks, and retry classification remain visible and typed instead of mostly conventional.",
  },
]

const streamingShapeCards = [
  {
    title: "Unary",
    body: "One request, one response. Best when the whole command fits in one message and the server can answer quickly enough that streaming would only add complexity.",
  },
  {
    title: "Server streaming",
    body: "One request, many responses. Useful for change feeds, large result sets, and watch-style APIs where the client controls one subscription and the server emits items over time.",
  },
  {
    title: "Client streaming",
    body: "Many requests, one response. Useful for uploads, batched ingest, and push-many then summarize workflows where the server should own accumulation and final commit.",
  },
  {
    title: "Bidirectional streaming",
    body: "Many requests, many responses. Use it when both sides need to speak over one long-lived channel. It is powerful and also the fastest way to inherit backpressure and cancellation bugs if the pace contract stays vague.",
  },
]

const codegenPipelineCards = [
  {
    title: ".proto is the source of truth",
    body: "Messages, field tags, services, and streaming shapes should be reviewed at the schema level before generated Rust code is considered stable.",
  },
  {
    title: "Build script owns code generation",
    body: "In a Cargo service, a build script typically compiles protobufs into Rust during the build. That keeps the schema and generated module mechanically aligned.",
  },
  {
    title: "Generated modules stay transport-facing",
    body: "Keep generated items inside a transport crate or module so application and domain crates depend on smaller hand-written abstractions rather than on every generated detail.",
  },
  {
    title: "Regeneration should be CI-visible",
    body: "A changed .proto should regenerate code, compile the resulting client or server, and fail loudly if checked-in contract artifacts drift.",
  },
]

const mappingCards = [
  {
    title: "Generated messages are DTOs",
    body: "prost-style generated messages usually own their data as String, Vec<T>, and nested structs. That is convenient at the edge and a good reason not to let them become the domain entities themselves.",
  },
  {
    title: "Map request types into domain commands",
    body: "The handler or service adapter should convert `CreateInvoiceRequest` into one domain or application command with domain-specific validation and naming.",
  },
  {
    title: "Translate back on the way out",
    body: "The domain result becomes a transport response DTO or a gRPC Status only at the boundary that speaks gRPC. This keeps business code free of `Request`, `Response`, and metadata APIs.",
  },
]

const errorModelCards = [
  {
    title: "Status codes are transport-facing",
    body: "InvalidArgument, NotFound, FailedPrecondition, AlreadyExists, Unauthenticated, PermissionDenied, DeadlineExceeded, and Unavailable are transport-level signals. They should be chosen from caller action, not from habit.",
  },
  {
    title: "Deadlines and cancellation are real control flow",
    body: "A server should stop expensive work when the caller deadline is gone or the stream is cancelled. Otherwise the service can keep burning CPU or queue slots for results nobody will read.",
  },
  {
    title: "Retry only transient failures",
    body: "Unavailable or DeadlineExceeded may be retryable for idempotent operations. InvalidArgument and FailedPrecondition usually are not. Make that distinction explicit in client policy and in service documentation.",
  },
  {
    title: "Rich error details still need discipline",
    body: "If you attach structured detail metadata or use a richer error model, keep it versioned and transport-facing. Do not leak internal error trees directly into a public gRPC contract.",
  },
]

const interceptorCards = [
  {
    title: "Authentication metadata",
    body: "Interceptors or request middleware are a good place to read auth headers, validate bearer or mTLS-derived identity, and attach one typed caller context to request extensions.",
  },
  {
    title: "Tracing and request identity",
    body: "Carry trace IDs, tenant IDs, and stable operation names through unary and streaming handlers. A stream without item-level or session-level identity becomes hard to debug fast.",
  },
  {
    title: "Observability at the transport seam",
    body: "Record method name, status code class, request size, response size, deadline expiry, and stream lifetime. gRPC observability should explain queue wait and cancellation just as well as HTTP observability does.",
  },
]

const compatibilityCards = [
  {
    title: "Field numbers are durable identity",
    body: "Never renumber or reuse a field tag casually. Add new fields, reserve removed tags and names, and keep optional or additive evolution boring enough that mixed deployments survive.",
  },
  {
    title: "Generated APIs differ, schema stays shared",
    body: "Go commonly generates interfaces and context-aware stubs, C# commonly generates async client and service base shapes, C++ commonly generates stub and service classes, and Rust commonly generates transport structs and async service traits. The shared truth is still the .proto contract.",
  },
  {
    title: "Crate and namespace boundaries matter",
    body: "Use package names and module boundaries deliberately so polyglot services agree on namespace, version, and deprecation intent rather than only on field tags.",
  },
]

const testingCards = [
  "Unit test transport-to-domain mapping so generated request types do not contaminate the domain model silently.",
  "Run contract tests against generated client and server surfaces, especially for streaming paths and metadata requirements.",
  "Keep checked-in .proto files, generated artifacts, or descriptor sets under CI review so breaking schema drift fails before rollout.",
  "Use ecosystem breaking-change checks or descriptor diff checks when several teams and languages share the same protobuf contract.",
  "Exercise deadlines, cancellation, retries, and backpressure with deterministic harnesses. gRPC bugs often live in those control paths, not in the happy path.",
]

const productionPatterns = [
  "Keep .proto contracts versioned, explicit, and reviewed as first-class source artifacts.",
  "Generate transport code in one narrow module or crate, then map generated types into application commands immediately.",
  "Choose unary versus streaming from the pacing contract, not from novelty. Streaming APIs deserve explicit backpressure and cancellation rules.",
  "Classify gRPC status codes from caller action: retry, reject, re-authenticate, or surface to operator. Do not flatten all failures into Unavailable.",
  "Instrument metadata, deadlines, stream lifetime, and payload size at the transport boundary so incidents are attributable without reading generated code.",
  "Protect polyglot compatibility with additive protobuf evolution, reserved tags, contract tests, and explicit CI drift checks.",
]

const pitfalls = [
  "Letting generated protobuf structs become the domain model because they were already available and owned their data conveniently.",
  "Designing bidirectional streams before the team has a clear pacing, buffering, and cancellation model. Bidi is often the most operationally expensive shape.",
  "Retrying InvalidArgument or FailedPrecondition as if every failure were transient. That turns client bugs into load.",
  "Ignoring deadline expiry and continuing expensive server work after the caller has already given up.",
  "Sharing one global gRPC queue or pool across fast unary calls and slow streams without isolation, then calling the tail-latency incident 'transport overhead'.",
  "Changing field tags or semantics in place and trusting polyglot consumers to discover the drift kindly.",
]

const summaryPoints = [
  "gRPC in Rust is best treated as a transport contract plus generated adapter surface, not as the domain model itself.",
  "The .proto schema, build script, generated module, and crate boundary form one codegen pipeline that should stay explicit and reviewable.",
  "Unary, server-streaming, client-streaming, and bidirectional-streaming calls each encode different pacing and ownership assumptions.",
  "Generated transport types should be mapped into domain commands, while gRPC status codes, metadata, and deadlines stay at the boundary.",
  "Polyglot compatibility depends on conservative protobuf evolution and generated-API drift checks, not only on one local compile passing.",
]

export function PageCh47GrpcServicesWithProtobufAndServiceApiCodegen() {
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

  const pageIndex = getPageIndexById("ch47-grpc-services-with-protobuf-and-service-api-codegen")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter41PageIndex = getPageIndexById("ch41-error-handling-in-large-systems")
  const chapter43PageIndex = getPageIndexById("ch43-observability")
  const chapter46PageIndex = getPageIndexById("ch46-fastapi-style-web-apps-swagger-openapi-codegen")
  const exercisesPageIndex = getPageIndexById("ch47-grpc-services-with-protobuf-and-service-api-codegen-exercises")
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
          Chapter 47 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Build Rust gRPC services the way they survive a polyglot fleet: protobuf as contract, generated transport code as
          adapter surface, domain mapping by hand, and deadlines, retries, metadata, and tracing kept explicit.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 19, 25, 41, 43, and 46</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 19 established transport DTO discipline. Chapter 25 covered async runtime boundaries. Chapter 41
                separated domain, infrastructure, and transport errors. Chapter 43 covered tracing and metrics. Chapter 46
                established OpenAPI and generated-API workflows on the HTTP side. This chapter applies the same thinking to
                protobuf and gRPC.
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
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Chapter 43
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter46PageIndex)}>
                Chapter 46
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            Your platform already has Go and C# services speaking gRPC, and a C++ client still owns one latency-sensitive
            integration. The Rust service joining that fleet must not only compile; it must preserve contract compatibility,
            expose useful codegen surfaces, keep domain rules out of generated transport types, and remain operable when
            deadlines, retries, or streaming backpressure go wrong. The easiest design mistake is to let generated code
            define the architecture. The calm design is smaller: generated types at the edge, domain types inside, and
            transport policy visible in one place.
          </p>
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
              gRPC as a service contract: protobuf messages, services, methods, and streaming shapes
            </h4>
            <p className="text-sm text-muted-foreground leading-6">
              gRPC contract design begins in protobuf, not in handler code. Messages define field numbering and evolution
              policy. Services define method names and streaming shapes. This contract is the shared source for Rust, Go,
              C#, and C++ code generation.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{protoSnippet}</code>
            </pre>
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              {streamingShapeCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Rust code generation pipeline: .proto files, build scripts, generated modules, and crate boundaries
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Example build script</div>
                <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{buildScriptSnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-2">Generated module boundary</div>
                <pre className="rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{generatedModuleSnippet}</code>
                </pre>
              </div>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-4">
              {codegenPipelineCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                In practice, many Rust teams keep generated protobuf and tonic surfaces in a transport crate or module,
                then make the application crate depend on a smaller hand-written interface. That keeps protobuf churn from
                looking like domain churn.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Unary, server-streaming, client-streaming, and bidirectional-streaming APIs
            </h4>
            <p className="text-sm text-muted-foreground leading-6">
              The generated service shape should teach you the operational contract immediately: one request-response,
              subscription-style output stream, upload-style input stream, or full duplex channel.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{serviceShapeSnippet}</code>
            </pre>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                Streaming APIs are rarely “just like unary but more advanced.” They are pacing systems. If message rate,
                buffer size, and cancellation rules are vague, the streaming design is still unfinished.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Mapping generated transport types into domain models</h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {mappingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Error models: status codes, rich errors, retries, deadlines, and cancellation
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {errorModelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Interceptors, authentication metadata, tracing, and observability
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Interceptor sketch</div>
                <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{interceptorSnippet}</code>
                </pre>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="grid gap-4">
                  {interceptorCards.map((card) => (
                    <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                      <div className="font-medium text-foreground mb-2">{card.title}</div>
                      <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Compatibility with Go, C#, C++, and polyglot service fleets
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {compatibilityCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Polyglot workflow reminder</div>
              <p className="text-sm text-muted-foreground leading-6">
                Go, C#, C++, and Rust will each generate a different local API shape from the same protobuf. Review the
                schema as the contract and treat generated language surfaces as adapters around that contract.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Testing generated APIs and preventing breaking protobuf changes
            </h4>
            <div className="grid gap-3 lg:grid-cols-2">
              {testingCards.map((item) => (
                <div key={item} className="rounded-lg border border-border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground leading-6">{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The most useful breaking-change gate is the one that runs before a partner team regenerates from a stale
                contract. Treat schema drift as a build failure, not as a post-rollout surprise.
              </p>
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
                The most expensive gRPC mistake is often not a tonic call-site bug. It is one contract that kept compiling
                locally while schema evolution, retries, or streaming pace drifted apart across services.
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
                <h4 className="font-semibold text-foreground">
                  Example 1: map a generated request into a domain command
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The transport request owns strings and vectors already. The adapter converts it into one application
                  command, and the service never learns about gRPC metadata or generated transport wrappers.
                </p>
              </div>
              {codes.grpc_transport_to_domain_mapping !== DEFAULT_CODES.grpc_transport_to_domain_mapping && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("grpc_transport_to_domain_mapping")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.grpc_transport_to_domain_mapping}
              onChange={(newCode) => updateCode("grpc_transport_to_domain_mapping", newCode)}
              onRun={() => runCode("grpc_transport_to_domain_mapping")}
              output={outputs.grpc_transport_to_domain_mapping ?? null}
              isRunning={isRunning === "grpc_transport_to_domain_mapping"}
              filename="transport_mapping.rs"
              expectedOutput={"tenant = acme\ncustomer = cust-7\ntotal cents = 4200\ninvoice = inv-cust-7"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.grpc_transport_to_domain_mapping}
              onRevert={() => resetCode("grpc_transport_to_domain_mapping")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Generated DTO</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The request type is transport-owned input, not the application service contract itself.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Mapping seam</div>
                <p className="text-xs text-muted-foreground leading-5">
                  `into_command` is where request validation and naming translation stay explicit.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Owned boundary</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Strings and vectors are owned once at the transport edge, then moved into the application command.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Testing fit</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This seam is cheap to unit test without a live server or generated client.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: classify retry and cancellation decisions explicitly
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The transport boundary decides whether a status is transient and whether the work should abort after
                  cancellation or deadline expiry. That policy should not be hidden in ad hoc client code.
                </p>
              </div>
              {codes.grpc_status_deadline_retry !== DEFAULT_CODES.grpc_status_deadline_retry && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("grpc_status_deadline_retry")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.grpc_status_deadline_retry}
              onChange={(newCode) => updateCode("grpc_status_deadline_retry", newCode)}
              onRun={() => runCode("grpc_status_deadline_retry")}
              output={outputs.grpc_status_deadline_retry ?? null}
              isRunning={isRunning === "grpc_status_deadline_retry"}
              filename="status_deadline_retry.rs"
              expectedOutput={"retry unavailable = true\nretry invalid = false\ncancelled = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.grpc_status_deadline_retry}
              onRevert={() => resetCode("grpc_status_deadline_retry")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Retry policy</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Unavailable and deadline failure are only retryable when the operation and caller semantics allow it.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Cancellation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Abort logic belongs in the service boundary before useless work keeps running after the caller is gone.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Operational value</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One explicit policy function is easier to test and document than many scattered retry branches.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone example assets under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch47_grpc_services_protobuf_service_api_codegen/
              </code>{" "}
              including a small protobuf contract, a build-script sketch, and the two transport-focused Rust examples used
              by this chapter.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to reason about protobuf service shapes, map generated request types into
            domain commands, diagnose deadline or streaming backpressure bugs, and design breaking-change prevention for a
            polyglot gRPC fleet.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 47 Exercises
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

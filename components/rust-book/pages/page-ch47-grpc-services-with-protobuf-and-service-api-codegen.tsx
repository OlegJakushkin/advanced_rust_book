"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
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
pub trait BillingService: Send + Sync + 'static {
    async fn create_invoice(
        &self,
        request: Request<CreateInvoiceRequest>,
    ) -> Result<Response<CreateInvoiceResponse>, Status>;

    type StreamInvoicesStream:
        Stream<Item = Result<InvoiceEvent, Status>> + Send + 'static;

    async fn stream_invoices(
        &self,
        request: Request<StreamInvoicesRequest>,
    ) -> Result<Response<Self::StreamInvoicesStream>, Status>;

    async fn upload_invoices(
        &self,
        request: Request<Streaming<CreateInvoiceRequest>>,
    ) -> Result<Response<UploadSummary>, Status>;

    type ChatInvoicesStream:
        Stream<Item = Result<InvoiceEvent, Status>> + Send + 'static;

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
    title: "The schema is the contract; Rust types are downstream of it",
    body: "The .proto file is the durable, language-neutral agreement that every service in the fleet shares. The Rust structs and traits that come out of codegen are just one team's view of that agreement. Treat them as transport-layer types you adapt at the edge, never as the place your business rules quietly accumulate.",
  },
  {
    title: "Generated code removes typing, not design decisions",
    body: "Codegen writes the message structs, the client, and the server trait so you do not. What it deliberately leaves open is everything that matters in production: where domain commands live, how a failure is classified as retryable or fatal, and which metadata is allowed to cross the auth and tracing boundary. Those are still yours to design.",
  },
  {
    title: "A streaming RPC is a pacing agreement, not a fancier call",
    body: "Unary calls behave like request-response and rarely surprise anyone. Streaming calls behave like pipelines, and a pipeline only works if both ends agree on buffering, who applies backpressure, and what cancellation means. If those answers are vague, the streaming design is unfinished no matter how clean the generated trait looks.",
  },
]

const comparisonCallouts = [
  {
    title: "Go background",
    body: "gRPC-Go hands you generated interfaces and lets context.Context quietly carry deadlines and cancellation through every call. Rust makes that wiring visible: cancellation is a future being dropped, and a stream's pace, buffering, and ownership are decisions you write down rather than conventions the runtime smooths over.",
  },
  {
    title: "C# background",
    body: "In Grpc.AspNetCore you inherit a service base and let the DI container and async/await machinery hide most of the plumbing. In Rust the generated server trait is yours to implement, the runtime boundary is an explicit tonic/Tokio choice, and there is no ambient framework into which transport types can quietly leak.",
  },
  {
    title: "C++ background",
    body: "You already know the value of one schema feeding several generated stubs, and you already manage buffers and lifetimes by hand. Rust keeps that control but moves it from convention into the type system: a streaming buffer is a typed channel, a deadline is a value you check, and the borrow checker objects when a request's data outlives its scope.",
  },
  {
    title: "Python background",
    body: "grpcio and Pydantic let you treat generated messages as loose data and validate later, often at the handler. Rust pushes you to map a generated request into a typed domain command at the edge, so a missing field or empty list is a Result branch you handle on entry, not an exception that surfaces deep in business logic.",
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
    body: "The handler or service adapter should convert the generated request type into one domain or application command, applying domain-specific validation and naming as it does.",
  },
  {
    title: "Translate back on the way out",
    body: "The domain result becomes a transport response or a gRPC status only at the boundary that speaks gRPC. This keeps business code free of the request, response, and metadata wrappers entirely.",
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
          A gRPC service is really two things at once: a protobuf schema that several languages share, and a pile of
          generated Rust code that turns that schema into types, clients, and a server trait. This chapter is about
          keeping those two things in their place — letting codegen remove boilerplate while you stay in charge of where
          domain rules, deadlines, retries, metadata, and streaming backpressure actually live.
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
            A new Rust service is joining a gRPC fleet that already has Go, C#, and C++ services talking to each other
            through shared protobuf contracts. Nobody is asking you to invent the contract — it exists, other teams
            generate from it, and breaking it breaks them. The job is narrower and harder than greenfield work: preserve
            wire compatibility, expose a generated client and server adapter that feels native in Rust, keep domain rules
            from seeping into generated transport types, and make deadlines, retries, metadata, and streaming
            backpressure explicit enough to survive review.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            The diagram below is the shape worth holding onto for the rest of the chapter. One <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.proto</code>{" "}
            file is the single source of truth; each language runs its own code generator and gets its own local API.
            Rust is just one of those consumers, and the part you control is the thin adapter between the generated
            surface and your domain.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Proto[billing.proto schema] --> GoGen[Go codegen]\n  Proto --> CsGen[C# codegen]\n  Proto --> CppGen[C++ codegen]\n  GoGen --> GoSvc[Go service]\n  CsGen --> CsSvc[C# service]\n  CppGen --> CppSvc[C++ service]\n  Proto --> Cont[Rust path continues below]`}
            caption="The same schema feeds every language's code generator. Go, C#, and C++ each get their own local surface."
          />
          <p className="text-sm text-muted-foreground leading-6">
            The Rust branch off that same schema is the part you actually own — it runs one more step than the others:
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Proto[billing.proto schema] --> RustGen[Rust / tonic codegen]\n  RustGen --> Adapter[hand-written adapter]\n  Adapter --> Domain[Rust domain logic]`}
            caption="The part you own in Rust is the adapter between generated transport types and your domain logic."
          />
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
              The protobuf contract: messages, fields, services, and streaming shapes
            </h4>
            <p className="text-sm text-muted-foreground leading-6">
              gRPC design starts in the schema, not in handler code, and the schema carries two distinct kinds of
              decision. The <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">message</code> blocks
              describe data: each field has a name, a type, and — most importantly — a number. Those numbers, not the
              names, are what actually go on the wire, which is why they become the unit of long-term compatibility.
              The <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">service</code> block describes
              behavior: which methods exist and, for each one, whether either side streams. The four RPC shapes you can
              spell here are the same four every gRPC language generates from.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              When you read the schema below, look at two things before anything else. First, the field numbers
              (<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">= 1</code>,
              {" "}<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">= 2</code>) — those are the durable
              identity you must not reuse. Second, the four <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">rpc</code>{" "}
              lines and where <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">stream</code> appears,
              because that one keyword decides whether a method is a request-response call or a long-lived pipe.
            </p>
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{protoSnippet}</code>
            </pre>
            <p className="text-sm text-muted-foreground leading-6 mt-4">
              Each <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">rpc</code> line in that service
              maps to exactly one of four communication shapes, and the position of the
              {" "}<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">stream</code> keyword is the whole
              difference. The cards below name them; the rest of the chapter keeps coming back to the operational cost
              each one carries.
            </p>
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
              How a .proto file becomes Rust types: the build-time codegen pipeline
            </h4>
            <p className="text-sm text-muted-foreground leading-6">
              In Rust the standard tool for this is tonic together with its companion build crate. The mechanism is a
              Cargo <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">build.rs</code> script that runs
              before your crate compiles: it reads the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.proto</code>{" "}
              files, generates Rust source into Cargo's output directory, and a small
              {" "}<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">include_proto!</code> macro pulls
              that generated source into a module of your choosing. The result is that the generated code is never
              checked into the repository as Rust — it is reproduced from the schema on every build, which is exactly
              what keeps the two from drifting apart.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The flow below is worth tracing once end to end. The thing to notice is the
              {" "}<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">rerun-if-changed</code> line in the
              build script: it tells Cargo to re-run codegen whenever the schema changes, so editing the
              {" "}<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">.proto</code> is enough to
              regenerate everything downstream. You never hand-edit generated output, and you never let it go stale.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Proto[billing.proto] --> Build[build.rs runs tonic_build]\n  Build --> OutDir[generated .rs in OUT_DIR]\n  OutDir --> Include[include_proto! macro]\n  Include --> Module[billing module: structs, client, server trait]\n  Module --> App[your code uses generated types]`}
              caption="Editing the schema re-triggers build.rs, which regenerates the module your code depends on."
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="font-medium text-foreground mb-2">Example build script (build.rs)</div>
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
              Reading the four streaming shapes off the generated server trait
            </h4>
            <p className="text-sm text-muted-foreground leading-6">
              The four <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">rpc</code> shapes from the
              schema turn directly into a Rust trait, and you can read the operational contract straight off each method
              signature. The diagram below shows what each shape looks like as message flow between client and server —
              one message each way, a fan-out of responses, a fan-in of requests, or a full duplex conversation.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Unary\n    C1[client] -->|1 req| S1[server]\n    S1 -->|1 resp| C1\n  end\n  subgraph ServerStream\n    C2[client] -->|1 req| S2[server]\n    S2 -->|many resp| C2\n  end`}
              caption="The two simplest shapes: one message each way, or one request that fans out into many responses."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The two streaming shapes that flip the fan-in direction round out the set:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph ClientStream\n    C3[client] -->|many req| S3[server]\n    S3 -->|1 resp| C3\n  end\n  subgraph BiDi\n    C4[client] -->|many req| S4[server]\n    S4 -->|many resp| C4\n  end`}
              caption="Many requests collapsing into one response, or both sides streaming over one long-lived channel."
            />
            <p className="text-sm text-muted-foreground leading-6">
              Now read the trait against that picture. Codegen produces the trait below; your server type writes the
              {" "}<code className="font-mono">impl</code> block that fills in real bodies. The detail that catches people
              new to tonic is the two associated <code className="font-mono">type</code> declarations: a server-streaming
              method does not return a concrete stream, it returns
              {" "}<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Self::StreamInvoicesStream</code>,
              and you must name a concrete type that satisfies that bound. That associated type is where the buffering and
              ownership decisions for the stream actually get pinned down.
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
            <p className="text-sm text-muted-foreground leading-6">
              This is the single most consequential habit in the chapter, and it is easy to skip because the generated
              types are right there and already own their data. The temptation is to pass a
              {" "}<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">CreateInvoiceRequest</code> straight
              into business logic. Resist it. A generated message is a data transfer object shaped by wire concerns:
              every field is optional-ish, names follow protobuf conventions, and the type knows nothing about your
              invariants. The moment domain code starts pattern-matching on transport structs, a schema change becomes a
              domain change, and a Go team's additive field edit can ripple into your business layer. The fix is a single
              translation seam at the edge — convert the request into a typed domain command on entry, translate the
              domain result back into a response or a gRPC status on exit, and let everything in between speak only your
              own vocabulary.
            </p>
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
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
            <p className="text-sm text-muted-foreground leading-6">
              gRPC's error vocabulary is a small set of status codes, and the discipline is choosing them by what the
              caller should do next rather than by what went wrong internally. A code like
              {" "}<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">InvalidArgument</code> tells the
              caller "fix your request and stop retrying"; <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Unavailable</code>{" "}
              tells it "I am temporarily down, try again." Flattening every failure into one generic code throws that
              signal away. The two control-flow concepts that ride alongside status codes — deadlines and cancellation —
              are just as load-bearing: a caller can attach a deadline, and the server is expected to stop working once
              it passes, because results nobody is waiting for are pure waste. The cards below separate the four pieces
              that usually get tangled together.
            </p>
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
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
            <p className="text-sm text-muted-foreground leading-6">
              gRPC carries side-band data — auth tokens, trace IDs, tenant identifiers — in per-call metadata, the
              protobuf equivalent of HTTP headers. An interceptor is the seam that runs before your handler, reads that
              metadata, and either rejects the call or enriches it. The pattern that keeps handlers clean is to do the
              untyped work once in the interceptor and hand the handler a typed value instead: validate the token, then
              attach a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">CallerContext</code> to the
              request extensions so the handler reads identity as a struct, not as raw header strings.
            </p>
            <p className="text-sm text-muted-foreground leading-6 mt-3">
              The sketch below is exactly that flow: pull the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">authorization</code>{" "}
              metadata, turn a missing token into an <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Unauthenticated</code>{" "}
              status before any handler runs, and otherwise insert a typed caller context. Read it against this sequence:
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant Client\n  participant Interceptor\n  participant Handler\n  Client->>Interceptor: request + authorization metadata\n  alt token missing\n    Interceptor-->>Client: Status::unauthenticated\n  else token present\n    Interceptor->>Handler: request + typed CallerContext\n    Handler-->>Client: response\n  end`}
              caption="The interceptor turns raw metadata into a typed context or a rejection before the handler ever runs."
            />
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
              Staying compatible across Go, C#, C++, Python, and the rest of the fleet
            </h4>
            <p className="text-sm text-muted-foreground leading-6">
              In a polyglot fleet the schema is a shared interface, and the rule of thumb is that protobuf evolution must
              be additive and boring. Field numbers are the wire identity, so the safe moves are narrow: add new fields
              with new numbers, mark removed fields as <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">reserved</code>{" "}
              so nobody recycles them, and never change a tag's meaning in place. Everything else — Rust generating async
              traits, Go generating interfaces, C# generating async bases — is a local cosmetic difference that the shared
              schema papers over, as long as the schema itself stays stable.
            </p>
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
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
            <p className="text-sm text-muted-foreground leading-6">
              Testing splits cleanly into two questions: does your adapter behave, and is the schema still safe for
              everyone else. The first is ordinary unit testing of the mapping seam — cheap, fast, and the place most
              real bugs hide. The second needs tooling the compiler cannot provide, because a local
              {" "}<code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">cargo build</code> passing tells
              you nothing about whether a partner team's stale client still parses your messages. That is what
              descriptor-diff and breaking-change checks in CI are for. The items below cover both halves.
            </p>
            <div className="grid gap-3 lg:grid-cols-2 mt-4">
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

          <article className="rounded-xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Network className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">What changes by background</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Every language in this list generates from the same protobuf, so the wire is not where you will be
              surprised. The surprise is what each ecosystem used to do for you automatically that Rust now asks you to
              state. Read your own row as the habit you most need to unlearn.
            </p>
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {comparisonCallouts.map((comparison) => (
                <div key={comparison.title} className="rounded-lg border border-border bg-card p-4">
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
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">into_command</code> is
              the entire boundary. It runs two validation checks, and only on success does it move the request's owned
              strings and vectors into a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">CreateInvoiceCommand</code>.
              A missing customer or an empty invoice never reaches <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">InvoiceService</code>;
              it returns a <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">TransportError</code> at
              the edge. Trace that path before reading the code:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Req[CreateInvoiceRequest] --> Check1{customer_id empty?}\n  Check1 -->|yes| Err1[Err MissingCustomer]\n  Check1 -->|no| Check2{line_totals empty?}\n  Check2 -->|yes| Err2[Err EmptyInvoice]\n  Check2 -->|no| Cmd[move into CreateInvoiceCommand]\n  Cmd --> Svc[InvoiceService.create]`}
              caption="Validation gates first; only a clean request is moved into a domain command."
            />
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
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">into_command</code> is where
                  request validation and naming translation stay explicit.
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">classify</code> is a
              single match that turns a status code plus an idempotency flag into a yes/no retry decision, and the order
              of arms matters. Only <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Unavailable</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">DeadlineExceeded</code> on an idempotent
              call are transient; <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cancelled</code> is
              its own answer; everything else falls through to "do not retry." The separate{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">should_abort</code> function is the
              cancellation/deadline check. Follow the decision tree, then read the match:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Start[status + idempotent] --> Cancel{code == Cancelled?}\n  Cancel -->|yes| NoRetryC[retry = false: caller_cancelled]\n  Cancel -->|no| Transient{Unavailable or DeadlineExceeded AND idempotent?}\n  Transient -->|yes| Retry[retry = true: transient]\n  Transient -->|no| NoRetry[retry = false: do_not_retry]`}
              caption="One policy function, read top to bottom: cancellation, then transient-and-idempotent, then reject."
            />
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

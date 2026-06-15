"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  Boxes,
  Globe,
  Layers,
  Lock,
  Network,
  Radio,
  ShieldCheck,
  Workflow,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { PAGES } from "../types"
import { Button } from "@/components/ui/button"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"

const whyReadCards = [
  {
    icon: Globe,
    title: "Ship typed HTTP APIs with generated contracts",
    body: "Stand up a REST service whose OpenAPI document is derived from the same Rust types your handlers use, so the schema, the server, and any generated clients cannot quietly drift apart.",
  },
  {
    icon: Layers,
    title: "Wire services together over gRPC",
    body: "Define a service in Protobuf, generate strongly typed server and client stubs, and treat the .proto file as the single source of truth for shape, versioning, and streaming behavior.",
  },
  {
    icon: Radio,
    title: "Hold long-lived connections without leaking resources",
    body: "Model WebSocket sessions as owned state machines with explicit lifecycle, backpressure, and shutdown, instead of unbounded callback soup that leaks tasks on every disconnect.",
  },
  {
    icon: Lock,
    title: "Make the trust boundary explicit",
    body: "Terminate TLS deliberately, reason about certificates and identity, and decide where authentication and authorization live rather than assuming a proxy somewhere upstream handled it.",
  },
  {
    icon: Network,
    title: "Build systems with no central server",
    body: "Use libp2p to compose transports, peer identity, and pub/sub into peer-to-peer systems where every node is both client and server and discovery is part of the design.",
  },
]

const flavorSnippet = `// One Rust type backs the handler, the OpenAPI schema, and any
// generated client. There is no second copy to keep in sync.
#[derive(Serialize, Deserialize, ToSchema)]
struct CreateOrder {
    sku: String,
    quantity: u32,
}

async fn create_order(
    Json(req): Json<CreateOrder>,
) -> Result<Json<OrderId>, ApiError> {
    let id = orders::place(req.sku, req.quantity).await?;
    Ok(Json(id))
}`

const chapters = [
  {
    number: "46",
    title: "FastAPI-Style Web Apps, Swagger, and OpenAPI Codegen",
    id: "ch46-fastapi-style-web-apps-swagger-openapi-codegen",
    description:
      "Build ergonomic REST services where the OpenAPI document and client code are generated from your Rust types, not maintained by hand alongside them.",
  },
  {
    number: "47",
    title: "gRPC Services with Protobuf and Service API Codegen",
    id: "ch47-grpc-services-with-protobuf-and-service-api-codegen",
    description:
      "Treat a Protobuf service definition as the contract, generate typed servers and clients, and handle unary and streaming calls with explicit error and versioning rules.",
  },
  {
    number: "48",
    title: "WebSockets and Long-Lived Connections",
    id: "ch48-websockets-long-lived-connections",
    description:
      "Run persistent, bidirectional connections as owned session state with clear lifecycle, backpressure, and graceful shutdown rather than fire-and-forget tasks.",
  },
  {
    number: "49",
    title: "HTTPS, TLS, and Secure Service Boundaries",
    id: "ch49-https-tls-secure-service-boundaries",
    description:
      "Understand TLS, certificates, and identity well enough to decide where encryption terminates and where authentication and authorization actually belong.",
  },
  {
    number: "50",
    title: "libp2p and Peer-to-Peer Rust Systems",
    id: "ch50-libp2p-peer-to-peer-rust-systems",
    description:
      "Compose transports, peer identity, and gossip-based messaging into peer-to-peer systems where discovery, routing, and trust have no central authority to lean on.",
  },
]

export function PagePart7NetworkedServicesSecureBoundaries() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("part-7-networked-services-secure-boundaries")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Network className="h-4 w-4" />
          Part VII
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          The service layer that exposes your system to the outside world: REST and OpenAPI, gRPC, WebSockets, TLS, and
          peer-to-peer networking.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground leading-6">
            Everything before this part lived inside one process: ownership, concurrency, serialization, storage. This
            part is where the program stops being a private world and starts answering to other systems. The moment a
            request can arrive over a socket, the hard questions change. What exactly did the caller send, can you trust
            it, what happens when the connection dies mid-message, and who is allowed to ask in the first place?
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            If you come from C++, C#, Go, or Python, you have almost certainly shipped an HTTP handler or an RPC service
            before. What is worth your attention here is not the syntax of routing. It is that Rust pushes the wire
            contract into the type system: an OpenAPI document or a Protobuf service is generated from the same types
            your handlers use, so the schema, the server, and the clients move together instead of drifting into the kind
            of mismatch you only discover in production. The transport stops being a layer you bolt on and becomes
            something the compiler helps you keep honest.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-4">
            The five chapters walk outward from the most familiar boundary to the least. You start with typed REST, move
            to gRPC for service-to-service calls, hold connections open with WebSockets, make the security boundary
            explicit with TLS, and finally remove the central server entirely with libp2p. By the end the goal is not a
            collection of libraries you can name. It is the judgment to decide, for a given system, where the boundary
            sits and what it must guarantee.
          </p>
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
            <Workflow className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">The shape of the part</h3>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Every chapter in this part adds one boundary between your code and a caller you do not control. The arc
              runs from a single typed request and response out to a network of peers, with the security boundary woven
              through the middle rather than tacked on at the end.
            </p>
            <MermaidDiagram
              chart={`flowchart LR
  Caller([Untrusted caller]) --> Edge{Service edge}
  Edge -->|typed schema| REST[REST + OpenAPI]
  Edge -->|protobuf contract| GRPC[gRPC services]
  Edge -->|persistent session| WS[WebSockets]
  REST --> TLS[TLS + identity]
  GRPC --> TLS
  WS --> TLS
  TLS --> Core([Owned domain core])
  Core -.->|no central server| P2P[(libp2p peers)]`}
              caption="Each chapter is one boundary: typed REST, contract-driven gRPC, and long-lived WebSockets all pass through TLS and identity before reaching your domain core, and libp2p removes the center entirely."
            />
            <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{flavorSnippet}</code>
            </pre>
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              The flavor of this part: the type that validates the request is the same type that defines the public
              schema. Generate the contract from it, and the wire and the code cannot disagree.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Chapters in this part</h3>
          </div>
          <div className="space-y-3">
            {chapters.map((chapter) => (
              <div
                key={chapter.id}
                className="rounded-xl border border-border bg-card p-5 flex items-start gap-4"
              >
                <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-semibold">
                  {chapter.number}
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-foreground">{chapter.title}</h4>
                  <p className="text-sm text-muted-foreground leading-6 mt-1">{chapter.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Start with typed web APIs</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 46 begins at the most familiar boundary: an HTTP service whose OpenAPI contract is generated from
                the Rust types it already uses. Everything later in the part builds on that habit of letting the schema
                follow the code.
              </p>
            </div>
            <Button
              onClick={() => setCurrentPage(getPageIndexById("ch46-fastapi-style-web-apps-swagger-openapi-codegen"))}
              className="gap-2 shrink-0"
            >
              Begin Part VII
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

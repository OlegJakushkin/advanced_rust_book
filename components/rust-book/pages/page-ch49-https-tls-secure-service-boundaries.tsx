"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "HTTPS is plain HTTP that only starts after TLS has proven identity and agreed on keys",
    body: "It is tempting to picture HTTPS as 'an encrypted socket, somehow.' The real sequence is more specific. Before a single HTTP byte is exchanged, the client validates the server's certificate chain against a trust store, confirms that the hostname it asked for is actually covered by the certificate, and negotiates which application protocol the two sides will speak. Only when all of that succeeds does the connection carry HTTP. If you remember nothing else, remember that the security work happens in the handshake, and the handshake happens before your application code ever runs.",
  },
  {
    title: "Where TLS terminates is an architecture decision you make on purpose",
    body: "TLS can end at a public load balancer, at a reverse proxy on the same node, in a service-mesh sidecar, or directly inside your Rust process. Each option moves the certificates, the private keys, and the plaintext hops to a different place. That single choice cascades into everything else: which component renews certificates, which network segments carry unencrypted traffic, and which HTTP headers your application is allowed to believe. Treat it as a deliberate design choice, not a framework default you inherited.",
  },
  {
    title: "A secure boundary is mostly a set of written-down policies, not one switch",
    body: "Cookie flags, HTTP-to-HTTPS redirects, which proxy headers you trust, which peer identities mTLS accepts, how often certificates rotate, and how local tests obtain trust are all policy questions. None of them have a single correct universal answer, and all of them need to be decided explicitly. Rust's contribution is that you can encode these decisions as types and enums that a reviewer can read in a diff, rather than as ambient configuration scattered across the runtime.",
  },
]

const httpsModelCards = [
  {
    title: "Certificate chains and trust stores",
    body: "The server does not present a single certificate. It presents a leaf certificate for its own name, plus the intermediate certificates that link that leaf back toward a well-known root. The client accepts the chain only if it can assemble an unbroken path that anchors in a root it already trusts, and only if every certificate in the path is still valid for time and policy. A missing intermediate is one of the most common production failures: the leaf is fine, but the client cannot build the path to a root, so it rejects an otherwise healthy certificate.",
  },
  {
    title: "Hostnames, SANs, and SNI",
    body: "TLS authenticates a name, not just an IP address or a port. The client sends the hostname it wants in the SNI field of the handshake, and the certificate must list that exact name in its Subject Alternative Names. If the client connects to api.example.com but the certificate only covers www.example.com, verification fails even though the bytes flowed perfectly. Wildcards and multi-name certificates exist, but the rule is the same: the name the client asked for must be covered by the certificate it received.",
  },
  {
    title: "ALPN selects the application protocol",
    body: "During the same handshake, both sides use ALPN to agree on what runs on top of TLS, usually h2 for HTTP/2 or http/1.1. This matters because a valid certificate and a correct hostname can still produce a broken connection if the two ends disagree on protocol shape. An HTTP/2 client pointed at a server that only offers HTTP/1.1, or a proxy that downgrades the protocol silently, will fail in ways that look like a TLS bug but are really an ALPN mismatch.",
  },
  {
    title: "Trust is always relative to one client",
    body: "There is no single global notion of 'a trusted certificate.' A browser trusts the operating-system root store. Your Rust service trusts whatever roots you compiled in or loaded. A container image ships its own bundle, and a CI runner has yet another. The same certificate can be perfectly trusted in your laptop browser and completely untrusted inside a minimal container, simply because the container's root store is empty or stale. A large share of TLS incidents come from assuming these stores are identical when they are not.",
  },
]

const terminationCards = [
  {
    title: "Load balancer at the edge",
    body: "A public load balancer owns the public certificates and speaks HTTPS directly to clients, then forwards plaintext (or a fresh internal TLS hop) to your service. This centralizes certificate management at the edge, which is convenient, but it means your application never sees the original TLS connection. The original scheme survives only as a header such as X-Forwarded-Proto, and that header is trustworthy only when it arrives over the one network path you control.",
  },
  {
    title: "Reverse proxy on the node",
    body: "A proxy running on the same host or node can centralize certificate handling, HTTP-to-HTTPS redirects, HSTS, and the choice between HTTP/2 and HTTP/3. It keeps that policy out of every service and in one reviewable place. The cost is an extra hop and one more component where the forwarded scheme and the real client IP have to be propagated honestly, or your application will reason about the wrong request.",
  },
  {
    title: "Sidecar or service mesh",
    body: "In a mesh, a sidecar proxy owns service-to-service mTLS and local policy while your application sees plaintext on loopback or a single short local TLS hop. This is genuinely useful: identity and encryption become infrastructure concerns. But it is not a reason to stop reasoning about who the caller is. The sidecar authenticates the peer and then hands that identity to your app, and your app still has to decide whether that identity is authorized for the route.",
  },
  {
    title: "In-process in your Rust server",
    body: "Your Rust process can terminate TLS itself, owning the certificates, the ALPN list, and the peer policy directly. For a focused service with clear ownership of its trust store and rotation, this is often the calmest option: there is no header to second-guess and no handoff to trust, because the process that checks the certificate is the same process that serves the request. The tradeoff is that certificate loading, reload-on-rotation, and trust configuration now live in your code.",
  },
]

const tlsStackCards = [
  {
    title: "A Rust-native stack (rustls)",
    body: "A pure-Rust TLS implementation is attractive when you want a memory-safe stack with no C dependency, behavior that is identical across every platform you ship to, and explicit control over which trust roots you load. It shines in containers and static builds, where the surrounding OS trust store may be absent or minimal and you would rather carry your own well-defined bundle than depend on whatever the base image happens to provide.",
  },
  {
    title: "The platform's native stack",
    body: "Binding to the operating system's TLS implementation is the honest choice when the runtime contract is already defined by the platform: corporate root stores pushed by IT, smart-card or hardware-backed keys, or OS-level certificate distribution that other teams rely on. Here, fighting the platform to use a self-contained stack would mean re-implementing trust policy that the organization has already centralized, and your service would drift out of the enterprise's certificate lifecycle.",
  },
  {
    title: "The crate follows the architecture, not the reverse",
    body: "Which TLS library you pick is downstream of where TLS terminates. If a proxy terminates TLS in front of your service, the library question is almost moot and the real surface is which forwarded headers you trust. If your process terminates TLS, the library is load-bearing because it now owns chain validation, hostname checking, ALPN, and reload-on-rotation. Decide the topology first, then let it tell you how much TLS logic your code actually owns.",
  },
]

const mtlsCards = [
  {
    title: "mTLS just adds a second certificate check to the same handshake",
    body: "Ordinary HTTPS authenticates one direction: the client verifies the server. Mutual TLS adds the symmetric step, where the client also presents a certificate and the server verifies the caller. It is not a different protocol, only the same handshake with client-certificate presentation turned on. The server then evaluates that client certificate against a policy, typically based on the issuing CA, the SANs in the certificate, or a workload identity such as a SPIFFE identifier.",
  },
  {
    title: "Peer identity is an authorization input, not a boolean",
    body: "The trap is to collapse mTLS down to 'a client certificate was present, therefore allow.' Presence proves only that some peer holds some certificate your CA signed. The boundary that actually matters is which issuer, which SAN, and which workload identity is permitted to reach this specific route or service lane. Carry the verified identity as a typed value and authorize on it, the same way you would authorize a parsed JWT subject, rather than treating the handshake as a yes/no gate.",
  },
  {
    title: "Authenticate where you also authorize",
    body: "Be deliberate about where the certificate check happens relative to where access is decided. If a sidecar or proxy terminates mTLS, your application has to consciously trust the identity it hands over, which means trusting both the sidecar and the network path between you. If your Rust service terminates mTLS itself, the same process that verifies the peer also decides what that peer may do, which removes a handoff but puts the policy in your code.",
  },
]

const rotationCards = [
  {
    title: "Renewal is part of deployment automation, not a calendar reminder",
    body: "Short-lived certificates are good security hygiene because a leaked key stops being useful sooner. But that benefit only materializes if automation renews each certificate before it expires and then reloads or restarts the serving layer cleanly. A certificate that auto-renews on disk but is never reloaded into the running process is an outage waiting on a clock. Treat 'renew' and 'the live process now uses the new material' as two separate steps that both have to succeed.",
  },
  {
    title: "Keep private keys narrow",
    body: "Every place a private key can be read is a place it can leak. Keep keys out of code samples, out of logs, and out of broad environment-variable sprawl where any subprocess inherits them. Prefer one owned secret mount or one dedicated distribution path with tight file permissions and an explicit reload policy, so there is exactly one answer to 'where does the key live and who can read it.'",
  },
  {
    title: "Rollback has to stay certificate-compatible",
    body: "Having a previous build to roll back to is not enough if that older build cannot read the trust material or certificate format currently in production. A rollback that fails the handshake is not a rollback. Keep trust-store and key-format compatibility in the release plan so that the version you fall back to can still validate the chains it will be handed.",
  },
]

const secureDefaultCards = [
  {
    title: "Cookies",
    body: "Session cookies should normally carry Secure (only sent over HTTPS), HttpOnly (invisible to JavaScript, which blunts XSS-based theft), and SameSite set to Lax or Strict to limit cross-site sending, unless a genuine cross-site workflow forces something broader. The __Host- name prefix is the strongest option when your deployment shape allows it, because the browser enforces extra constraints on such cookies. The point is to make these flags an explicit, reviewed decision rather than whatever a framework defaulted to.",
  },
  {
    title: "Security response headers",
    body: "Once HTTPS is reliable, the edge should add HSTS so browsers refuse to fall back to plaintext, and usually a small set of other hardening headers: content-type options to stop MIME sniffing and a framing policy to control whether the page can be embedded. Keep these as a deliberate, short list tied to what the product needs, not a copied-in wall of headers nobody owns.",
  },
  {
    title: "CORS",
    body: "Cross-origin resource sharing decides which other web origins a browser will let read your responses. Keep it explicit: maintain an allow-list of exact origins and never combine a wildcard origin with credentialed (cookie-bearing) browser requests, a combination browsers reject for good reason. Remember what CORS is and is not: it is a browser-enforced boundary that limits cross-origin reads, not an authentication or authorization system, so it complements your auth rather than replacing it.",
  },
  {
    title: "Redirects",
    body: "Redirect plaintext HTTP to HTTPS at the trusted edge so no real traffic stays in the clear. Inside the application, never guess the scheme from an arbitrary header. Derive it either from the actual socket (when you terminate TLS yourself) or from a forwarded-scheme header that you trust only because it arrived through a known proxy at a known hop count. The redirect and the scheme detection have to agree, or you will create loops or false 'insecure' verdicts.",
  },
  {
    title: "HSTS",
    body: "HSTS instructs the browser to use HTTPS for all future requests to your domain for a stated duration, even if a link says http. That commitment is sticky and hard to undo, so enable it only after HTTPS is solid across the site. Adding includeSubDomains or submitting to the preload list extends the promise to every subdomain and bakes it into browsers, so reach for those only when the entire domain is genuinely ready to live on HTTPS forever.",
  },
]

const debuggingChecklist = [
  "Confirm the exact hostname, SNI name, and certificate SANs the client is using. Many failures are simple name mismatches.",
  "Inspect the full chain presented by the server, including intermediates, and compare it with the trust anchors available to this specific client.",
  "Check certificate validity windows and rotation state: not-before, not-after, and whether the running process has reloaded the new material.",
  "Check ALPN expectations on both sides when HTTP/2 or another protocol upgrade is involved.",
  "Verify proxy-header trust boundaries. If the app thinks the request was HTTP when the edge terminated HTTPS, scheme propagation is wrong somewhere.",
  "For mTLS, verify that the client certificate was actually presented and that issuer or SAN policy matches what the service expects.",
  "For local and CI environments, prefer a dedicated local CA or explicit test trust bundle instead of weakening verification.",
  "Do not disable certificate or hostname verification in production to 'make it work.' Fix the chain, hostname, trust store, or policy mismatch instead.",
]

const localTestingCards = [
  {
    title: "Local HTTPS with a real CA, not a disabled check",
    body: "Stand up a small development CA, issue a server certificate whose SANs match the names you actually connect to (localhost or a local dev hostname), and add that CA to the trust store your test client uses. This reproduces the real verification path on your laptop. The tempting alternative, turning off verification 'just for dev,' teaches the whole team a shortcut that eventually leaks into production. A local CA costs a few minutes once and keeps the verified path honest everywhere.",
  },
  {
    title: "Local mTLS as a fixture",
    body: "When you test one service calling another, mint a client certificate from the same local CA and make the peer identity an explicit part of the test fixture. Then your tests can assert the interesting behavior: that an authorized identity is accepted and an unauthorized or unsigned one is rejected. Peer identity belongs in the fixture you run, not in a sentence in the test plan that nobody executes.",
  },
  {
    title: "CI trust bundles",
    body: "In CI, generate ephemeral certificates and a CI-specific trust bundle, start the server with that material, and point the integration tests at that CA explicitly. The goal is for the CI run to exercise the same chain-assembly and hostname-verification path that a production client will, so a trust regression fails the build instead of surfacing after deploy. Ephemeral material also keeps no long-lived secret in the pipeline.",
  },
  {
    title: "Test the policy, not just an open port",
    body: "A green 'port 443 responded' check proves almost nothing about security. Assert the policy that actually defines the boundary: that HTTP redirects to HTTPS, that session cookies carry their hardened flags, that HSTS is present, that the origin allow-list behaves, and that mTLS accepts the right identities and rejects the wrong ones. Those assertions are what turn the secure-boundary design into something a regression can break visibly.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You have likely wired up OpenSSL contexts by hand and let a reverse proxy do TLS offload. The mental shift is not that Rust makes TLS magically simple; the handshake is still the handshake. It is that the trust boundary, the reload-on-rotation policy, and the secure defaults stop being conventions enforced by careful reviewers and become typed values the compiler and a diff can check. The trap is assuming 'we always front it with nginx' is a decision; in Rust, write down who terminates TLS and which forwarded headers you trust, because the language makes that cheap to encode.",
  },
  {
    title: "C# background",
    body: "Coming from a managed HTTP stack and the OS certificate store, much was ambient: Kestrel and the platform handled trust, and you mostly set a few options. In Rust there is no implicit platform on by default, so the architecture question moves to the front: do you bind the OS trust store, or carry your own roots with a Rust-native stack. The shift is that 'which trust store and who renews it' becomes an explicit choice you make and review, not a runtime default you inherit.",
  },
  {
    title: "Go background",
    body: "This is the closest analogue: you already think in terms of a tls.Config with explicit ServerName, RootCAs, NextProtos for ALPN, and ClientAuth. Rust asks for the same explicitness, and the instinct transfers almost directly. The added pressure is the one running through the whole book: the verified peer identity from mTLS is an owned, typed value you authorize on, not an ambient property of the connection, so model it as data that flows into your authorization decision.",
  },
  {
    title: "Python background",
    body: "In a typical Python web stack TLS is usually somebody else's job: gunicorn behind nginx, or a platform that terminates HTTPS and forwards plaintext, with the app reading request.is_secure or an X-Forwarded-Proto header. The shift in Rust is to stop trusting that header reflexively. Decide explicitly that the scheme is believable only because it came through a known proxy hop, and treat cookie flags, CORS origins, and HSTS as code you assert in tests rather than middleware defaults you assume are correct.",
  },
]

const productionPatterns = [
  "Pick the TLS termination point deliberately and document which headers or peer identity claims the Rust app is allowed to trust afterward.",
  "Keep certificates, trust bundles, and reload policy out of handler code and inside one narrow infrastructure boundary with clear ownership.",
  "Use secure cookie defaults, explicit CORS allow-lists, HTTPS redirects, and HSTS only when the corresponding deployment assumptions are true.",
  "Treat mTLS identity as a typed authorization input, not as a vague 'secure internal traffic' label.",
  "Automate certificate rotation, verify reload behavior in staging or CI, and test rollback compatibility for trust material as part of deployment engineering.",
  "Debug TLS failures by checking hostname, chain, trust store, ALPN, and proxy trust boundaries. Never normalize skip-verification as the fix.",
]

const pitfalls = [
  "Trusting `X-Forwarded-Proto` or similar headers from arbitrary callers instead of from a known proxy boundary.",
  "Mixing wildcard CORS with credentialed browser flows or leaving session cookies without `Secure` and `HttpOnly` because local development felt easier that way.",
  "Enabling HSTS broadly before the domain and subdomain story is actually ready.",
  "Putting mTLS in the architecture diagram and then never defining which client identities or SANs are actually authorized.",
  "Treating certificate rotation as a secret-management problem only, while forgetting reload timing, rollback compatibility, and client trust-store distribution.",
  "Chasing one framework TLS knob before confirming whether the real failure is certificate chain assembly, hostname mismatch, ALPN, or proxy termination policy.",
]

const summaryPoints = [
  "HTTPS is HTTP after TLS has validated certificate chain, hostname, trust, and ALPN policy.",
  "TLS termination at a load balancer, reverse proxy, sidecar, or in-process Rust server changes where certificates live and which headers or peer identities the app may trust.",
  "Rust-native and platform-native TLS stacks are both architectural options; choose from deployment and trust-store needs, not from habit.",
  "mTLS, certificate rotation, secret handling, cookies, headers, CORS, redirects, and HSTS are policy surfaces that deserve explicit engineering choices.",
  "Safe debugging means checking chain, hostname, trust store, ALPN, proxy, and mTLS evidence without weakening verification in production.",
]

export function PageCh49HttpsTlsSecureServiceBoundaries() {
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

  const pageIndex = getPageIndexById("ch49-https-tls-secure-service-boundaries")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter30PageIndex = getPageIndexById("ch30-amqp-and-message-brokers")
  const chapter43PageIndex = getPageIndexById("ch43-observability")
  const chapter46PageIndex = getPageIndexById("ch46-fastapi-style-web-apps-swagger-openapi-codegen")
  const chapter47PageIndex = getPageIndexById("ch47-grpc-services-with-protobuf-and-service-api-codegen")
  const chapter48PageIndex = getPageIndexById("ch48-websockets-long-lived-connections")
  const exercisesPageIndex = getPageIndexById("ch49-https-tls-secure-service-boundaries-exercises")
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
          Chapter 49 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          A secure service boundary is not one library call. It is a set of decisions about where TLS terminates, which
          identities you accept, how certificates rotate, which proxy headers you believe, and what your HTTP defaults
          are. This chapter treats HTTPS and TLS as those decisions made explicit, so that the boundary is something a
          reviewer can read rather than something the runtime quietly assumes.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Builds on Chapters 19, 25, 30, 43, 46, 47, and 48
              </h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 19 established contract-first serialization, Chapter 25 covered runtime boundaries, Chapter 30
                covered durable transport edges, Chapter 43 covered observability, Chapter 46 covered HTTP APIs,
                Chapter 47 covered gRPC transport policy, and Chapter 48 covered long-lived connections. HTTPS and TLS sit
                across all of those surfaces.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter30PageIndex)}>
                Chapter 30
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Chapter 43
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter46PageIndex)}>
                Chapter 46
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter47PageIndex)}>
                Chapter 47
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter48PageIndex)}>
                Chapter 48
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A single Rust API serves three very different audiences at once: browsers loading a web UI, other services
            calling it machine-to-machine, and long-lived administrative sessions. Some of that traffic crosses the
            public internet and some stays inside a private network. The team's job is to define one coherent boundary
            that answers every security question for all three audiences: where TLS terminates, who holds the
            certificates, and how peer identity is established and authorized. The same boundary also has to settle which
            proxy headers the application is allowed to believe, what the secure HTTP defaults are, how local and CI
            tests obtain trust, and how certificates rotate without an outage. None of those answers come from a
            framework. They are decisions, and this chapter is about making them on purpose and writing them down where a
            reviewer can see them.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            Before any of that policy makes sense, it helps to see exactly what happens on the wire. Notice that every
            security check below, certificate validation, hostname matching, and protocol selection, finishes
            <em> before</em> the first HTTP byte is sent. The handshake is where trust is established; HTTP is just what
            rides on top afterward.
          </p>
          <div className="mt-4">
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant C as Client\n  participant S as Server\n  C->>S: TCP connect\n  C->>S: ClientHello (SNI: api.example.com, ALPN: h2, http/1.1)\n  S-->>C: ServerHello + certificate chain (leaf + intermediates)\n  S-->>C: chosen ALPN = h2\n  C->>C: build chain to a trusted root\n  C->>C: check api.example.com is in the SANs\n  Note over C,S: TLS established, keys agreed\n  C->>S: HTTP request (now, and only now)\n  S-->>C: HTTP response`}
              caption="HTTPS is HTTP that only begins after the handshake. The client validates the chain, matches the hostname against the SANs, and confirms the negotiated protocol before sending a single HTTP byte."
            />
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Three ideas carry most of this chapter. The first is about what HTTPS actually is at the byte level. The
            second is about where the encryption boundary sits in your system. The third is about treating the boundary
            as policy you encode rather than behavior you hope for. Hold these three in mind and the rest of the chapter
            is mostly detail filling them in.
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
            <h3 className="text-lg font-semibold text-foreground">
              TLS handshake, termination topology, and HTTP-layer defaults
            </h3>
          </div>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              What HTTPS actually checks: chains, hostnames, ALPN, and whose trust store
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              When a TLS connection fails, it almost always fails for one of four reasons, and they map cleanly onto four
              questions. Could the client build a chain to a root it trusts? Did the certificate cover the hostname the
              client asked for? Did the two sides agree on a protocol? And, crucially, whose trust store are we even
              talking about? Most production TLS debugging is just figuring out which of these four boxes is the one that
              failed.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {httpsModelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Where TLS ends: load balancer, reverse proxy, sidecar, or your own process
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The single most consequential question in this chapter is where the public TLS connection actually ends.
              Follow the dotted plaintext segment in the diagram below: wherever it appears, that is a hop your
              application does not see as TLS, and therefore a hop where the original scheme and client identity survive
              only as headers you choose to trust. The further the termination point is from your code, the more you rely
              on the network path and on honest forwarding; the closer it is, the more certificate and trust logic your
              own process owns.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cl[Client] -->|HTTPS| Edge\n  subgraph Edge[Termination point]\n    LB[Load balancer]\n    RP[Reverse proxy]\n    SC[Sidecar]\n  end\n  Edge -.->|plaintext or local TLS| App[Rust service]\n  Cl ==>|HTTPS direct| App2[Rust service terminates TLS]`}
              caption="Solid lines are encrypted; the dotted line is the plaintext (or short local-TLS) hop the edge introduces. Terminating in-process removes that hop, at the cost of owning certificate and reload logic yourself."
            />
            <div className="grid gap-4 lg:grid-cols-2 mt-4">
              {terminationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The most common mistake here is to treat proxy headers as trustworthy simply because TLS terminated
                somewhere upstream. A header such as X-Forwarded-Proto is just bytes; any client can send it. Believe it
                only when it arrives through the specific proxy hops you operate, and strip or overwrite it at the edge
                so no external caller can forge it.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Picking a TLS library: Rust-native or the platform's stack
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              If your service terminates TLS itself, you choose a TLS implementation, and the two honest options pull in
              opposite directions. A Rust-native stack carries its own trust and behaves identically everywhere. The
              platform stack inherits the operating system's trust and certificate lifecycle. The right answer depends
              less on which API is shorter and more on whether you want to own your trust material or defer to the
              environment that already manages it.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {tlsStackCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-sm text-muted-foreground leading-6">
                A good senior-level decision is usually “which runtime trust-store and packaging contract do we want?” long
                before it is “which exact client or server API looks shortest in code?”
              </p>
            </div>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The examples in this chapter stay at the policy layer on purpose, so a single listing reads the same
                whichever stack you pick. When you do terminate in-process, the shape is small and identical in spirit
                across libraries: load the certificate chain and private key, build a server config (with a client-CA
                trust root if you want mTLS), set the ALPN protocols, and wrap each accepted TCP stream in the TLS
                acceptor before handing it to your HTTP server. With <code>tokio-rustls</code> that is a
                <code> ServerConfig</code> plus a <code>TlsAcceptor</code>; with the platform stack it is the equivalent
                native handle. The runnable files under{" "}
                <code>examples/ch49_https_tls_secure_service_boundaries/</code> (the topology-policy and
                security-defaults listings) encode the surrounding decisions this section is about, so the only piece
                left to bind to a concrete crate is that acceptor wrapper.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">mTLS: authenticating the caller, not just the server</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              For service-to-service traffic, you often want both ends to prove who they are. The diagram below shows the
              key addition over ordinary HTTPS: the server requests a certificate from the client, the client presents
              one, and then the server runs a policy check on the verified identity. Watch where that policy check lands.
              The handshake only proves the client holds a certificate your CA signed; deciding whether <em>this</em>
              identity may reach <em>this</em> route is a separate, deliberate step.
            </p>
            <MermaidDiagram
              chart={`sequenceDiagram\n  participant C as Caller service\n  participant S as Rust service\n  C->>S: ClientHello\n  S-->>C: ServerHello + server certificate\n  S-->>C: CertificateRequest\n  C-->>S: client certificate\n  S->>S: verify client cert against trusted CA\n  S->>S: authorize: is this SAN / workload allowed here?\n  alt identity allowed\n    S-->>C: handshake complete, serve request\n  else identity not allowed\n    S-->>C: reject\n  end`}
              caption="mTLS adds a client certificate to the handshake. Verifying it proves the caller is signed by a trusted CA; the separate authorization step decides whether that specific identity is permitted on this route."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
              {mtlsCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Certificate rotation as a lifecycle, not a one-off task
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A certificate is a secret with an expiry date, which makes rotation an ongoing state machine rather than a
              thing you do once. The transition that catches teams out is the one drawn in bold below: renewing the
              material on disk and actually reloading it into the running process are two different events, and if the
              second one never fires, you have a renewed certificate and a live outage at the same time. Read the diagram
              as the happy path you must automate, with the dashed edge as the failure you must alert on.
            </p>
            <MermaidDiagram
              chart={`stateDiagram-v2\n  [*] --> Serving\n  Serving --> RenewalDue: near expiry\n  RenewalDue --> Renewed: automation issues new cert\n  Renewed --> Serving: process reloads new material\n  Renewed --> Stale: reload never happens\n  Stale --> Expired: clock passes not-after\n  Expired --> [*]: handshakes fail`}
              caption="The dangerous edge is Renewed to Stale: the certificate on disk is fresh but the process is still serving the old one. Automate the reload, and alert when a renewed certificate has not been picked up."
            />
            <div className="grid gap-4 lg:grid-cols-3 mt-4">
              {rotationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              The HTTP defaults that make a TLS boundary actually secure
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A correct TLS handshake protects bytes in transit, but it does not by itself stop a session cookie from
              leaking, a cross-origin page from reading your responses, or a browser from quietly falling back to
              plaintext. Those are HTTP-level concerns, and each one is a small policy you set deliberately. The five
              below are the defaults worth treating as non-negotiable on a public boundary, with exceptions made
              consciously rather than by omission.
            </p>
            <div className="grid gap-4 lg:grid-cols-3">
              {secureDefaultCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Debugging TLS failures without weakening security</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              TLS failures feel opaque because the error often arrives as a generic 'handshake failed,' but the
              underlying cause is almost always one of a short list. Work through this checklist in order, from the most
              common cause (a name mismatch) to the more subtle ones (ALPN, proxy trust, mTLS policy). The discipline
              that matters most is the last item: never reach for 'disable verification' as a fix, because that converts
              a diagnosable configuration problem into a silent, permanent vulnerability.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {debuggingChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <div className="flex items-start gap-3">
                <TriangleAlert className="h-5 w-5 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                  A debugging checklist that ends with “turn verification off” is not a production checklist. Use a local
                  CA or explicit test trust bundle instead.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing HTTPS locally and in CI</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The whole point of this section is to test the secure path, not a weakened stand-in for it. The reliable
              approach is to run a small certificate authority you control, in development and in CI, so your tests
              exercise the same chain assembly and hostname verification a real client will. That keeps verification on
              everywhere and lets your tests assert the policy itself: redirects, cookie flags, HSTS, origin rules, and
              mTLS accept/reject behavior.
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              {localTestingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">How this lands depending on where you come from</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The TLS facts in this chapter are the same in every language. What differs is the habit you arrive with and
              the assumption you most need to drop. These cards are about the mental-model shift, not about which crate
              maps to which library.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
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
                  Example 1: choose a TLS termination and internal peer-auth strategy deliberately
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The point is not framework syntax. The point is that external termination, forwarded-proto trust, ALPN,
                  and internal mTLS policy are one explicit configuration surface.
                </p>
              </div>
              {codes.https_tls_topology_policy !== DEFAULT_CODES.https_tls_topology_policy && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("https_tls_topology_policy")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Before reading the code, picture the boundary it describes. The request crosses an external edge that
              terminates public TLS, then reaches the service over an internal hop that uses mTLS, and the service only
              believes the forwarded scheme because it came through that known edge. The struct in the listing is just
              this picture turned into typed fields, so a reviewer can confirm each decision in a diff.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cl[Client] -->|public TLS| Edge[External edge: load balancer]\n  Edge -->|forwarded-proto trusted| Svc[Rust service]\n  Edge -. internal mTLS .-> Svc\n  Svc -->|ALPN h2| Svc`}
              caption="The example encodes exactly this: external termination at the edge, mTLS on the internal hop, forwarded scheme trusted only from that edge, and ALPN pinned to h2."
            />
            <div className="mt-3">
            <RustCodeEditor
              code={codes.https_tls_topology_policy}
              onChange={(newCode) => updateCode("https_tls_topology_policy", newCode)}
              onRun={() => runCode("https_tls_topology_policy")}
              output={outputs.https_tls_topology_policy ?? null}
              isRunning={isRunning === "https_tls_topology_policy"}
              filename="tls_termination_topology.rs"
              expectedOutput={"external = load-balancer\ninternal = mtls\nforwarded proto = trusted-proxy-only\nalpn = h2"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.https_tls_topology_policy}
              onRevert={() => resetCode("https_tls_topology_policy")}
            />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">External edge</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One enum value makes the termination owner visible instead of implicit.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Internal auth</div>
                <p className="text-xs text-muted-foreground leading-5">
                  mTLS is modeled as peer-auth policy, not as a vague “secure internal” claim.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Proxy trust</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Forwarded scheme data is trusted only when a known proxy hop exists.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">ALPN</div>
                <p className="text-xs text-muted-foreground leading-5">
                  HTTP protocol selection belongs in the same boundary model as certificates and hostnames.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: encode secure cookie, CORS, HSTS, and rotation defaults explicitly
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  This is a configuration-oriented example for the application edge. The values are boring on purpose,
                  because boring secure defaults survive production review.
                </p>
              </div>
              {codes.https_tls_security_defaults !== DEFAULT_CODES.https_tls_security_defaults && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("https_tls_security_defaults")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Read each field as a policy statement. The cookie name prefix, the CORS mode, the HSTS flag, and the
              rotation window each represent one decision that a reviewer can evaluate in isolation and a test can
              assert against directly.
            </p>
            <RustCodeEditor
              code={codes.https_tls_security_defaults}
              onChange={(newCode) => updateCode("https_tls_security_defaults", newCode)}
              onRun={() => runCode("https_tls_security_defaults")}
              output={outputs.https_tls_security_defaults ?? null}
              isRunning={isRunning === "https_tls_security_defaults"}
              filename="security_defaults_and_rotation.rs"
              expectedOutput={"cookie = __Host-session\ncookie hardened = true\ncors = locked-down\nhsts = true\nrotate now = false"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.https_tls_security_defaults}
              onRevert={() => resetCode("https_tls_security_defaults")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Cookie</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Secure, HttpOnly, and SameSite stay visible instead of buried in one framework default.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">CORS</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Exact origin policy makes credentialed browser flows reviewable.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Redirects</div>
                <p className="text-xs text-muted-foreground leading-5">
                  HTTPS redirects and HSTS should reinforce each other, not contradict each other.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Rotation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Renewal windows are deployment policy, not a comment on a certificate ticket.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Reviewability</div>
                <p className="text-xs text-muted-foreground leading-5">
                  A typed config surface is much easier to diff and test in CI than scattered string settings.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch49_https_tls_secure_service_boundaries/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to choose a TLS termination strategy, harden cookie and header defaults,
            design cert rotation and mTLS boundaries, debug TLS failures safely, and set up local and CI HTTPS tests that
            do not weaken verification.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 49 Exercises
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

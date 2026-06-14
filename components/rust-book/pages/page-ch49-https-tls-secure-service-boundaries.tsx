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
    title: "HTTPS is HTTP after a successful TLS identity and key agreement step.",
    body: "The operational boundary is not 'encrypted socket somehow.' The client checks a certificate chain against a trust store, matches the hostname through SNI and SANs, negotiates ALPN, and only then speaks HTTP.",
  },
  {
    title: "TLS termination is an architecture choice, not a default framework checkbox.",
    body: "A load balancer, reverse proxy, sidecar, or in-process Rust server can own the TLS session. That choice decides where certificates live, which hops are plaintext inside the environment, and which headers the app may trust.",
  },
  {
    title: "Secure service boundaries are mostly policy boundaries.",
    body: "Cookies, redirects, proxy headers, mTLS peer identity, rotation windows, and local test trust all need explicit policy. Rust helps when those choices stay typed and reviewable instead of ambient.",
  },
]

const httpsModelCards = [
  {
    title: "Certificate chains and trust stores",
    body: "The server presents a leaf certificate plus intermediates. The client accepts that chain only if it anchors in a trusted root store and the chain is still valid for time and policy.",
  },
  {
    title: "Hostnames and SNI",
    body: "The TLS layer authenticates a name, not only a socket address. If the client asks for `api.example.com`, the certificate must cover that hostname in SANs and the client must send the right SNI name.",
  },
  {
    title: "ALPN",
    body: "ALPN is how the peers agree on the application protocol, commonly HTTP/1.1 or HTTP/2. If ALPN negotiation is wrong, you can have a healthy certificate and still a broken connection shape.",
  },
  {
    title: "Trust is local to the client boundary",
    body: "A browser, a Rust service, a container image, and a CI runner may all trust different root stores. Many TLS incidents come from assuming those stores are the same when they are not.",
  },
]

const terminationCards = [
  {
    title: "Load balancer termination",
    body: "The edge load balancer owns public certificates and speaks HTTPS to clients. The app usually trusts `X-Forwarded-Proto` or similar scheme hints only from that known proxy path.",
  },
  {
    title: "Reverse proxy termination",
    body: "A host-local or node-local proxy can centralize cert handling, redirects, HSTS, and HTTP/2 or HTTP/3 policy. The tradeoff is another hop and another place where scheme and client IP headers must stay trustworthy.",
  },
  {
    title: "Sidecar or service-mesh termination",
    body: "A sidecar can own service-to-service mTLS and local policy while the app sees loopback plaintext or one local TLS boundary. This is an infrastructure tradeoff, not an excuse to stop modeling identity or queue budgets.",
  },
  {
    title: "In-process Rust termination",
    body: "A Rust server can terminate TLS directly when the app should own certificates, ALPN, and peer policy itself. This is often calmer for dedicated services with clear trust-store and rotation ownership.",
  },
]

const tlsStackCards = [
  {
    title: "rustls-style choice",
    body: "A Rust-native TLS stack is attractive when you want a portable, memory-safe implementation, predictable behavior across platforms, and tighter control over trust material in containers or static deployments.",
  },
  {
    title: "Native TLS choice",
    body: "Platform TLS can be the honest fit when enterprise trust stores, smart-card or platform policy integration, or OS-level certificate distribution already define the runtime contract.",
  },
  {
    title: "Architectural translation",
    body: "The crate decision is downstream of the architecture decision. If TLS is terminated before the app, the app may mainly care about trusted proxy headers. If the app terminates TLS, the app owns far more certificate and trust logic directly.",
  },
]

const mtlsCards = [
  {
    title: "mTLS adds client authentication to the same handshake family",
    body: "Server-authenticated TLS proves the server to the client. mTLS adds client certificate presentation so the server can authenticate the caller too, usually against SAN, SPIFFE-like, or PKI policy.",
  },
  {
    title: "Peer identity should be typed and explicit",
    body: "Do not reduce mTLS to one opaque 'cert exists' boolean. The real boundary is which issuer, SAN, or workload identity is authorized for this route or service lane.",
  },
  {
    title: "Terminate mTLS where policy is enforced",
    body: "If a sidecar or proxy terminates mTLS, the application must trust the identity handoff from that layer deliberately. If the Rust service terminates mTLS in process, the service owns that identity check directly.",
  },
]

const rotationCards = [
  {
    title: "Rotation windows are part of deploy automation",
    body: "Shorter-lived certificates reduce stale secret risk, but only if automation renews them before expiry and restarts or reloads the serving layer cleanly.",
  },
  {
    title: "Secret handling should minimize file and process spread",
    body: "Keep private keys out of examples, logs, and wide environment-variable sprawl. Prefer one owned secret mount or one dedicated secret-distribution path with clear file permissions and reload policy.",
  },
  {
    title: "Rollback still needs certificate thought",
    body: "A rollback artifact is not enough if the older deployment cannot read the current trust or certificate format. Keep trust-store and key-rotation compatibility in the release plan.",
  },
]

const secureDefaultCards = [
  {
    title: "Cookies",
    body: "Session cookies should normally be `Secure`, `HttpOnly`, and `SameSite=Lax` or `Strict` unless a cross-site workflow truly requires something broader. The `__Host-` prefix is strong when the deployment shape supports it.",
  },
  {
    title: "Headers",
    body: "At the HTTPS edge, stable defaults often include HSTS once HTTPS is reliable, plus other response-header policies such as content-type hardening and framing policy where the product needs them.",
  },
  {
    title: "CORS",
    body: "Keep CORS explicit. Prefer an allow-list of exact origins and do not mix wildcard origins with credentialed browser flows. CORS is not an auth system, but it is still a security boundary.",
  },
  {
    title: "Redirects",
    body: "Redirect plaintext HTTP to HTTPS at the trusted edge. Inside the app, derive scheme only from direct socket reality or from proxy headers you trust from a known hop count.",
  },
  {
    title: "HSTS",
    body: "HSTS tells browsers to stay on HTTPS for future requests. Enable it only after HTTPS behavior is solid, and add subdomains or preload intent only when the whole domain is truly ready for that commitment.",
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
    title: "Local HTTPS",
    body: "Use a local development CA and certificates whose SANs match the names you actually hit, such as `localhost` or a local dev hostname. That gives you realistic trust behavior without teaching the team insecure shortcuts.",
  },
  {
    title: "Local mTLS",
    body: "For service-to-service local tests, mint a client cert from the same local CA and make peer identity part of the fixture, not a comment in the test plan.",
  },
  {
    title: "CI trust bundles",
    body: "Generate ephemeral CI certificates and a CI trust bundle, start the server with those materials, and point integration tests at that CA explicitly. The CI runner should prove the same verification path the production client will use.",
  },
  {
    title: "Test the policy, not only the port",
    body: "Assert redirects to HTTPS, secure cookie flags, HSTS presence, origin policy, and mTLS acceptance or rejection. A green port-open check is not a secure-boundary test.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You may already be comfortable with OpenSSL-shaped APIs and reverse-proxy TLS offload. Rust's gain is not that TLS becomes magically simple. It is that trust boundaries, cert reload policy, and secure defaults can be encoded more explicitly and reviewed with fewer hidden ownership assumptions.",
  },
  {
    title: "C# background",
    body: "If platform certificate stores and managed HTTP stacks are familiar, the Rust shift is mostly about architecture choice. The app may use a platform-integrated stack, or it may own a portable TLS stack directly. Either way, the secure-boundary policy still needs to be visible.",
  },
  {
    title: "Go background",
    body: "The practical comparison is similar to Go's `tls.Config` discipline: explicit server names, trust roots, ALPN, and client-auth settings. Rust adds the same systems-design pressure you already know from the rest of the book: keep the boundary typed, owned, and measurable.",
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
          Service security requires clear TLS termination, identity policy, credential rotation, proxy behavior, and safe
          HTTP defaults. This chapter covers HTTPS and TLS as reviewable service boundaries.
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
            A Rust API serves browsers, service clients, and long-lived admin sessions across public and internal
            networks. The business requirement is to define TLS termination, certificate custody, peer identity, proxy
            trust, secure HTTP defaults, local test trust, and rotation policy as one reviewable boundary.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">HTTPS flow as an operational model</div>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`client
  -> TCP connect
  -> TLS handshake
     -> SNI hostname
     -> certificate chain
     -> trust-store validation
     -> ALPN ("h2" or "http/1.1")
  -> HTTP request / response`}</code>
            </pre>
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
              HTTPS mental model: HTTP over TLS, certificate chains, hostnames, ALPN, and trust stores
            </h4>
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
              TLS termination at load balancers, reverse proxies, sidecars, and in-process Rust servers
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {terminationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                One of the most common mistakes is treating proxy headers as trustworthy just because TLS terminated
                somewhere. Trust those headers only from the explicit proxy hops you control.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Rustls, native TLS, and ecosystem tradeoffs as architectural options
            </h4>
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
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">mTLS for service-to-service authentication</h4>
            <div className="grid gap-4 lg:grid-cols-3">
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
              Certificate rotation, secret handling, and deployment automation
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
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
              Secure defaults for cookies, headers, CORS, redirects, and HSTS
            </h4>
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
            <RustCodeEditor
              code={codes.https_tls_security_defaults}
              onChange={(newCode) => updateCode("https_tls_security_defaults", newCode)}
              onRun={() => runCode("https_tls_security_defaults")}
              output={outputs.https_tls_security_defaults ?? null}
              isRunning={isRunning === "https_tls_security_defaults"}
              filename="security_defaults_and_rotation.rs"
              expectedOutput={"cookie = __Host-session\ncookie secure = true\ncors = locked-down\nhsts = true\nrotate now = false"}
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

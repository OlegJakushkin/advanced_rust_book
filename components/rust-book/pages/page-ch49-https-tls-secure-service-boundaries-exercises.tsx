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
    title: "Choose a TLS termination strategy from the real deployment boundary",
    objective:
      "Practice selecting load balancer, reverse proxy, sidecar, or in-process termination from trust, packaging, and ownership requirements instead of from habit.",
    starterPrompt:
      "You have one browser-facing Rust API behind a cloud load balancer, one internal admin tool on the same host as a reverse proxy, one service-mesh deployment, and one dedicated edge appliance written in Rust.",
    prompts: [
      "Which deployment naturally wants load-balancer termination?",
      "Which one fits reverse-proxy termination on the same host?",
      "Which one already has a sidecar trust boundary and should model identity handoff explicitly?",
      "Which one most plausibly wants in-process TLS because the Rust service itself owns the full external edge?",
    ],
    acceptanceCriteria: [
      "You choose at least two different termination strategies across the four cases.",
      "You justify one choice with trust-header policy and one with certificate ownership or packaging policy.",
      "You avoid pretending one termination strategy is always correct for every service.",
    ],
    hints: [
      "Ask who owns public certificates, who trusts proxy headers, and who needs the peer identity directly.",
      "The calm answer is often the one that keeps trust boundaries smallest and most reviewable.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Identify insecure HTTP, cookie, and header settings in one API edge",
    objective:
      "Read a sample configuration and explain which values are dangerous in production and which safer defaults belong instead.",
    starterPrompt:
      "A sample API config sets `redirect_http = false`, `allowed_origin = \"*\"`, `cookie.secure = false`, `cookie.http_only = false`, `same_site = \"None\"`, and `hsts_max_age_secs = 0`.",
    prompts: [
      "Which fields weaken browser-side transport or session safety directly?",
      "Which change is unsafe only in combination, such as wildcard CORS with credentials?",
      "Which settings should be different for production even if a local demo accepted them?",
      "What would you test in CI after changing these defaults?",
    ],
    acceptanceCriteria: [
      "You identify at least three concrete insecure settings.",
      "You propose secure replacements for cookies, redirects, CORS, or HSTS with a reason.",
      "You mention at least one CI assertion such as secure cookie flags, redirect behavior, or HSTS presence.",
    ],
    hints: [
      "The question is not whether the app still works. The question is whether the boundary stays safe under browsers and proxies.",
      "A secure answer usually names both the bad setting and the operational risk it creates.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Harden one API edge configuration deliberately",
    objective:
      "Translate insecure edge settings into a small typed policy that expresses secure defaults clearly and can be tested deterministically.",
    starterPrompt:
      "Refactor a tiny config so HTTPS redirects are on, the session cookie becomes hardened, the CORS origin becomes explicit, and HSTS is enabled.",
    prompts: [
      "Keep the config as small plain Rust types.",
      "Use one exact origin instead of `*`.",
      "Use a secure session-cookie shape instead of a weak browser default.",
      "Print one short summary that proves the values changed.",
    ],
    acceptanceCriteria: [
      "The config now expresses secure redirect and HSTS behavior.",
      "The session-cookie policy is hardened with at least `Secure` and `HttpOnly`.",
      "The CORS policy is no longer wildcard.",
      "The runnable lab prints the expected secure summary.",
    ],
    hints: [
      "This is a boundary-policy exercise, not a framework exercise.",
      "If the values are explicit and typed, the next CI or review step gets much easier.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Debug a TLS failure without weakening verification",
    objective:
      "Create a repair path for a real certificate or handshake failure while keeping production-safe verification intact.",
    starterPrompt:
      "A staging client fails with a certificate error. The server certificate recently rotated, traffic now goes through a different proxy layer, and an engineer suggests temporarily disabling verification to confirm the route.",
    prompts: [
      "Which evidence should you check first: hostname or SNI, full chain, trust store, or ALPN mismatch?",
      "Where could proxy termination or forwarded-scheme trust be the actual bug instead of the certificate itself?",
      "How would you reproduce the failure locally or in CI with a local CA rather than by skipping checks?",
      "Which change is acceptable for local diagnostics but unacceptable as a production workaround?",
    ],
    acceptanceCriteria: [
      "You produce a checklist that starts from hostname, chain, trust, and proxy evidence.",
      "You do not recommend disabling verification as a production fix.",
      "You include one safe local or CI reproduction strategy using explicit trust material.",
      "You mention at least one way a proxy or termination change can look like a certificate bug to the app.",
    ],
    hints: [
      "Most TLS failures are evidence problems before they are code problems.",
      "The safe diagnostic path is usually a local CA or explicit trust-bundle path, not a global skip-verify switch.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Design certificate rotation and mTLS boundaries for a service fleet",
    objective:
      "Make renewal, reload, trust distribution, and peer-identity policy explicit before the first expiry or mixed rollout incident.",
    starterPrompt:
      "You run one public API, one internal queue consumer, and one service-to-service path that requires mTLS. Certificates rotate every 30 days, and operators want zero-downtime renewals.",
    prompts: [
      "Which hops need only server-authenticated TLS and which need mTLS?",
      "Where should peer identity be checked: sidecar, reverse proxy, or in-process service?",
      "How will certificates and trust bundles reload without taking the service offline?",
      "Which metrics or alerts should warn before expiry or failed reload becomes user-visible?",
    ],
    acceptanceCriteria: [
      "You classify at least one path as server-auth TLS only and one path as mTLS.",
      "You define where peer identity is enforced and why that owner is appropriate.",
      "You mention one reload or rollout strategy for rotation.",
      "You mention at least two observability signals such as cert-expiry horizon, reload failure count, or mTLS rejection rate.",
    ],
    hints: [
      "Rotation is both a secret-distribution problem and a runtime-reload problem.",
      "mTLS is useful only if the peer identity still becomes a policy input somewhere explicit.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Test HTTPS locally and in CI with realistic trust behavior",
    objective:
      "Build a local and CI test plan that exercises real TLS policy without teaching the team insecure shortcuts.",
    starterPrompt:
      "You need browser-facing HTTPS tests, one service-to-service mTLS test, and one CI lane that verifies secure cookies, redirects, and HSTS.",
    prompts: [
      "Which SANs or hostnames should local certs cover?",
      "Which trust material should the browser or client test harness use in CI?",
      "How would you validate mTLS acceptance and rejection paths explicitly?",
      "Which assertions belong in the CI smoke test beyond 'port opens over TLS'?",
    ],
    acceptanceCriteria: [
      "You use a local or CI CA and explicit trust bundle rather than an insecure verification bypass.",
      "You include at least one mTLS acceptance or rejection test.",
      "You include at least three transport-policy assertions such as HTTPS redirect, secure cookie, HSTS, or origin policy.",
      "You explain how the plan keeps local and CI trust behavior close enough to production to be meaningful.",
    ],
    hints: [
      "A trusted local CA is usually the calmest path for realistic developer HTTPS.",
      "CI should prove policy, not only reachability.",
    ],
  },
]

const reviewQuestions = [
  "What is the practical difference between server-authenticated TLS and mTLS?",
  "Why should proxy-header trust be tied to a known network boundary instead of accepted from arbitrary callers?",
  "When is HSTS a safe default, and when is it premature?",
  "Why are local CA and CI trust bundles safer than skip-verification flags for HTTPS testing?",
  "What makes certificate rotation a deployment problem as much as a cryptography problem?",
]

const workingLoop = [
  "Name the TLS termination owner first.",
  "Name the trust store and peer-identity policy second.",
  "Harden cookies, CORS, redirects, and HSTS only from true deployment assumptions.",
  "Define rotation, reload, and test trust material before rollout.",
  "Debug from hostname, chain, trust, ALPN, and proxy evidence without weakening production verification.",
]

const tlsChecklist = [
  "Hostname and SNI are correct for the certificate SANs.",
  "The full certificate chain, including intermediates, is presented and trusted by this client.",
  "Proxy-header trust is limited to known hops only.",
  "mTLS peer identity is authorized by explicit issuer or SAN policy.",
  "Local and CI tests use explicit trust bundles instead of skip-verification shortcuts.",
]

export function PageCh49HttpsTlsSecureServiceBoundariesExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch49-https-tls-secure-service-boundaries-exercises")
  const mainPageIndex = getPageIndexById("ch49-https-tls-secure-service-boundaries")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 49 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice HTTPS and TLS design the way it survives production review: explicit termination choices, hardened edge
          defaults, mTLS and rotation policy, and debugging that fixes the trust boundary instead of weakening it.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a secure-boundary review. The strongest answer does not stop at “enable TLS.” It
                says who terminates it, what the client trusts, which browser or service defaults are hardened, how
                rotation works, and how failures are diagnosed safely.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 49
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
          <h3 className="text-lg font-semibold text-foreground mb-3">TLS incident checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {tlsChecklist.map((item) => (
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
                  HTTPS/TLS drill
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
          title="Runnable lab · Harden one API edge policy"
          description={
            <>
              Repair the starter so redirects are enabled, the session cookie is hardened, wildcard CORS is removed, and
              HSTS is enabled. The point is not framework syntax. The point is that secure edge defaults become explicit
              and testable.
            </>
          }
          filename="harden_edge_policy_lab.rs"
          runKey="ch49_ex_harden_api_defaults"
          expectedOutput={"redirect = true\ncookie secure = true\ncors = locked-down\nhsts = true"}
          helperText={
            <>
              Tip: change the configuration values, not the printed text. The easiest secure repair is usually explicit:
              one trusted origin, one hardened cookie, redirects on, and HSTS enabled once HTTPS is real.
            </>
          }
          initialCode={`#[derive(Debug)]
struct SessionCookiePolicy {
    name: &'static str,
    secure: bool,
    http_only: bool,
    same_site: &'static str,
}

#[derive(Debug)]
struct HttpSecurityPolicy {
    redirect_http: bool,
    hsts_max_age_secs: u64,
    allowed_origin: &'static str,
}

impl SessionCookiePolicy {
    fn is_hardened(&self) -> bool {
        self.secure && self.http_only && self.same_site != "None"
    }
}

impl HttpSecurityPolicy {
    fn cors_mode(&self) -> &'static str {
        if self.allowed_origin == "*" {
            "wildcard"
        } else {
            "locked-down"
        }
    }
}

fn main() {
    let cookie = SessionCookiePolicy {
        name: "session",
        secure: false,
        http_only: false,
        same_site: "None",
    };

    let policy = HttpSecurityPolicy {
        redirect_http: false,
        hsts_max_age_secs: 0,
        allowed_origin: "*",
    };

    println!("redirect = {}", policy.redirect_http);
    println!("cookie secure = {}", cookie.is_hardened());
    println!("cors = {}", policy.cors_mode());
    println!("hsts = {}", policy.redirect_http && policy.hsts_max_age_secs > 0);
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
            By the end of this page, you should be able to choose a TLS termination strategy from deployment shape, harden
            one API edge without hand-waving, design mTLS and rotation policy that operators can actually run, and debug
            trust failures through evidence instead of insecure shortcuts.
          </p>
        </section>
      </div>
    </div>
  )
}

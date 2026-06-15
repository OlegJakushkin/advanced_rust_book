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
    title: "Create a packaging matrix for native, container, wasm, and library outputs",
    objective:
      "Practice stating which artifact shape each consumer actually needs instead of collapsing every release into one vague 'build'.",
    starterPrompt:
      "Your team ships one service as a Linux binary, one container image, one browser-facing wasm bundle, and one native library for another product. Write a small packaging matrix for all four.",
    prompts: [
      "Which target triple or crate type belongs to each artifact?",
      "Which runtime assumption belongs to each artifact: libc, container base, browser glue, or foreign ABI?",
      "Which artifact should carry feature gates differently from the others?",
      "Which artifact deserves its own smoke test lane?",
    ],
    acceptanceCriteria: [
      "You define at least three artifact rows with distinct target or crate-type information.",
      "You name at least one runtime assumption per row.",
      "You mention at least one artifact-specific smoke test or validation step.",
    ],
    hints: [
      "A packaging matrix is most useful when every row answers who will run the artifact and how.",
      "If two artifacts have different consumers, they probably need different validation too.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Review a Docker multi-stage build and its minimal runtime image",
    objective:
      "Explain what the builder stage and runtime stage each guarantee, and identify what a too-minimal runtime image may still be missing.",
    starterPrompt:
      "Review a two-stage Docker build that compiles a Rust binary in one stage and copies it into `scratch` in the second stage.",
    prompts: [
      "What does the builder stage own that should not leak into the runtime stage?",
      "What does the runtime stage still need besides the executable, such as CA certificates or runtime user setup?",
      "When would distroless or Alpine be calmer than `scratch`?",
      "What final smoke test should run against the image rather than only against the binary on the build host?",
    ],
    acceptanceCriteria: [
      "You distinguish builder and runtime responsibilities clearly.",
      "You name at least one missing runtime dependency that a scratch image may still need.",
      "You justify one alternative runtime image choice with a workload reason.",
    ],
    hints: [
      "Smaller is not always calmer if the process still expects files or runtime metadata that the image does not contain.",
      "The final image deserves its own boot or health-check test.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement a packaging matrix for native, container, and wasm builds",
    objective:
      "Build a tiny release helper that turns one app name and version into three explicit artifact names.",
    starterPrompt:
      "Implement `artifact_name(app, version, target)` for a native musl binary, a container tag, and a wasm bundle.",
    prompts: [
      "Keep the target set explicit with an enum.",
      "Name the native output with a target triple suffix.",
      "Name the container output like a registry tag, using the format `ghcr.io/acme/<app>:<version>`.",
      "Name the wasm output like a wasm artifact rather than a native binary.",
    ],
    acceptanceCriteria: [
      "The enum clearly distinguishes native, container, and wasm targets.",
      "The function returns three different artifact naming shapes.",
      "The runnable lab prints the expected native, container, and wasm names.",
    ],
    hints: [
      "This exercise is about release contracts, not clever formatting.",
      "The point is that each artifact class has a different naming convention and consumer.",
    ],
  },
  {
    number: 4,
    kind: "design or analysis",
    title: "Design a feature-gated release workflow",
    objective:
      "Replace one catch-all default build with an explicit feature policy that matches real deployment shapes.",
    starterPrompt:
      "You inherit a crate where the default feature set includes metrics, admin endpoints, optional native bindings, and browser support, even though most service deployments only need the core server.",
    prompts: [
      "Which features should stay opt-in instead of default?",
      "Which CI lanes should build `default`, `minimal`, and at least one expanded feature set?",
      "Which runtime settings should remain runtime configuration instead of compile-time features?",
      "What artifact-size or attack-surface signal would you compare before and after the change?",
    ],
    acceptanceCriteria: [
      "You move at least one non-core feature out of the default set.",
      "You define at least two explicit CI feature combinations.",
      "You distinguish runtime config from compile-time packaging choices clearly.",
    ],
    hints: [
      "A good feature matrix makes the smallest honest artifact easy to build and test.",
      "Not every optional behavior belongs behind a compile-time flag.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Add supply-chain checks to CI before release day forces the issue",
    objective:
      "Design a release lane that validates dependency policy and final artifact trust data deliberately.",
    starterPrompt:
      "Your current pipeline runs tests and publishes artifacts, but it has no checksum step, no SBOM generation, and no dependency-policy or advisory gate.",
    prompts: [
      "Which checks belong before artifact publication and which belong after the artifact is built?",
      "What should be generated for operators: checksums, signatures, SBOMs, provenance, or all four?",
      "Which ecosystem checks would you treat as release gates versus advisory signals?",
      "How will the pipeline surface failure clearly enough that the team knows why publication stopped?",
    ],
    acceptanceCriteria: [
      "You define at least three concrete supply-chain checks or outputs.",
      "You place at least one gate before publication and one artifact metadata step after build.",
      "You explain how CI reports failure without leaving the release state ambiguous.",
    ],
    hints: [
      "The best release lane tells operators what to trust and tells engineers why a release was blocked.",
      "Generated metadata is only useful if it follows the final artifact that users actually download.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Write a release-engineering plan for a Rust service with several artifact shapes",
    objective:
      "Turn packaging into an operable rollout process with smoke tests, health checks, rollback, and artifact inventory.",
    starterPrompt:
      "You are shipping `gateway`, `gateway-wasm-admin`, and `gateway-risk-lib` from one repository. Operators require canary rollout, rollback instructions, and clear artifact validation on every release.",
    prompts: [
      "Which artifacts should release together and which can version independently?",
      "Which smoke tests should run on the final binary, the final image, the wasm package, and the native library harness?",
      "What health or observability checks gate promotion from canary to broad rollout?",
      "What rollback data must be published with the release so another team can act without rebuilding under pressure?",
    ],
    acceptanceCriteria: [
      "You define at least two artifact classes with distinct release validation.",
      "You include at least one promotion gate and one rollback requirement.",
      "You mention at least two observability or health signals that matter during rollout.",
    ],
    hints: [
      "A release plan is not complete until rollback is easier to execute than improvisation.",
      "The final artifact, not only the source commit, is what operators actually roll back to.",
    ],
  },
]

const reviewQuestions = [
  "What makes a static binary attractive, and what runtime assumptions can still remain outside the binary itself?",
  "Why should browser wasm and WASI packaging be treated as different release families?",
  "When would you choose `cdylib` instead of `staticlib`, and why is the ABI contract part of release engineering?",
  "Why should feature combinations be tested in CI rather than described only in docs?",
  "What should be smoke tested: the crate graph, the built binary, the image, or all of the above?",
]

const workingLoop = [
  "List artifact classes first: native, image, wasm, and library.",
  "State the target triple, crate type, and feature set for each one.",
  "Attach one target-like smoke test and one trust or provenance step to each release lane.",
  "Keep rollout, canary, and rollback rules visible next to the packaging policy.",
]

const releaseChecklist = [
  "Native binary: target-like smoke run plus checksum or signature.",
  "Container image: boot test, health probe, and base-image policy.",
  "WASM artifact: loader or runtime smoke test plus package metadata validation.",
  "Native library: ABI harness or loader smoke test plus versioned headers or bindings.",
  "Release lane: artifact inventory, changelog, rollback reference, and observability gate.",
]

export function PageCh44PackagingAndDeploymentExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch44-packaging-and-deployment-exercises")
  const mainPageIndex = getPageIndexById("ch44-packaging-and-deployment")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 44 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice packaging and deployment the way it survives review: explicit artifact matrices, feature-gated
          release lanes, supply-chain checks, and rollout plans tied to final artifacts instead of source-only hope.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a release review. The strongest answer does not say only “build it in CI.” It
                says which artifact exists, who consumes it, how it is verified, what trust data ships with it, and how
                rollback stays boring.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 44
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Minimal release checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {releaseChecklist.map((item) => (
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
                  Release drill
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
          title="Runnable lab · Packaging matrix"
          description={
            <>
              Repair the starter so one app name and version expand into three explicit artifact names: native musl
              binary, container tag, and wasm artifact. The checker expects the exact output shown below.
            </>
          }
          filename="packaging_matrix_lab.rs"
          runKey="ch44_ex_packaging_matrix"
          expectedOutput={
            "native = pricing-x86_64-unknown-linux-musl\ncontainer = ghcr.io/acme/pricing:1.2.0\nwasm = pricing-wasm32-unknown-unknown.wasm"
          }
          helperText={
            <>
              Tip: use a small target enum and a <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">match</code>{" "}
              expression. For the container target, use the registry-tag format{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">ghcr.io/acme/&lt;app&gt;:&lt;version&gt;</code>.
              The exercise is about naming explicit release artifacts, not about hiding the difference between them.
            </>
          }
          initialCode={`#[derive(Debug, Clone, Copy)]
enum Target {
    Native,
    Container,
    Wasm,
}

fn artifact_name(app: &str, version: &str, target: Target) -> String {
    let _ = version;
    let _ = target;
    app.to_string()
}

fn main() {
    let app = "pricing";
    let version = "1.2.0";

    println!("native = {}", artifact_name(app, version, Target::Native));
    println!("container = {}", artifact_name(app, version, Target::Container));
    println!("wasm = {}", artifact_name(app, version, Target::Wasm));
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
            By the end of this page, you should be able to describe a Rust release as a matrix of real artifacts,
            feature sets, validation steps, and trust data; design CI lanes for native, container, wasm, and library
            outputs; and explain how a release can be both smaller and more operationally trustworthy at the same time.
          </p>
        </section>
      </div>
    </div>
  )
}

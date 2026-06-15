"use client"

import { useEffect } from "react"
import {
  ArrowRight,
  BookOpen,
  Bug,
  Cpu,
  Gauge,
  Shield,
  TriangleAlert,
  Wrench,
} from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Packaging is a runtime contract, not only a build command",
    body: "Before you choose flags, decide what another system will actually execute: a Linux binary, a container image, a browser or WASI module, or a native library that some other process loads. Each of those is a different promise about how the artifact starts, what it links against, and what it expects to find on disk. Rust forces that decision into the open because the target triple, the linker story, the crate type, and the feature set all change the final contract. There is no ambient runtime quietly papering over the difference, so you make the choice on purpose instead of discovering it in production.",
  },
  {
    title: "The final artifact matters more than the local dev build",
    body: "A `cargo build --release` on your laptop is a convenience, not the thing production runs. Production runs one target-specific binary, one image, one wasm module, or one shared library, and that artifact carries its own libc, its own filesystem layout, its own certificate bundle, its own ABI, and its own startup behavior. The gap between a build that compiled and an artifact that runs correctly on the target is where most deployment incidents actually live, which is why the artifact deserves its own tests rather than borrowing confidence from the local build.",
  },
  {
    title: "Release engineering is part of system design",
    body: "Checksums, signatures, SBOMs, smoke tests, health probes, rollback plans, and feature-matrix discipline are not paperwork bolted on after the software is done. They are the part of the design that lets an operator trust, verify, and reverse a release under pressure. Treat them as first-class requirements that ship in the same lane as the code, and the difference between a confident rollout and a frightening one stops being luck.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already think in ABI, libc, linkers, and target environments, and all of that carries over. The shift is that Rust makes the surface smaller and the decision explicit by default: instead of a tangle of CMake toolchain files and ambient system assumptions, you usually choose one target triple, one crate type, and one static binary or one `cdylib`. The discipline you used to enforce by hand is now the path of least resistance.",
  },
  {
    title: "C# background",
    body: "Stop assuming a managed runtime and a standard packaging shell are already on the box. Rust deployment is artifact-specific, not framework-hosted: there is no shared CLR to target, so you decide the exact binary, image, wasm bundle, or native library and ship it self-contained. The win is that 'works on my machine' and 'works in production' converge, but only because you named the runtime contract up front instead of inheriting it.",
  },
  {
    title: "Go background",
    body: "Your instinct that one static binary is the goal is right, and Rust honors it for pure-Rust crate graphs. The trap is assuming it is always free: a crate that pulls in native C libraries or a custom linker does not land on a clean static binary by accident. Cross-compilation, libc choice (gnu versus musl), and feature gating stay visible, which means they stay reviewable rather than silently breaking your single-binary assumption.",
  },
  {
    title: "Python background",
    body: "There is no interpreter to install on the target and no virtualenv to reproduce: the artifact is the program, and dependencies are resolved at build time, not at runtime on the server. The mental shift is that 'deployment' stops meaning 'recreate my environment elsewhere' and starts meaning 'ship one verified artifact.' When you do reach back into a Python or browser host, you do it deliberately through a wasm module or a native library with a published ABI, not by assuming a shared runtime is already present.",
  },
]

const staticBinarySection = {
  title: "Static binaries: one file, fewer runtime surprises",
  body: "A static Linux binary is attractive because it folds its dependencies into a single file: there is no shared-library version to mismatch, and it drops cleanly into a near-empty container. In Rust the usual path is the musl target, which links against musl libc instead of glibc and produces a binary that does not need the host's C library at all. The tradeoff is subtler than 'static means self-sufficient.' A smaller runtime surface is not a zero runtime surface: your binary still reaches for CA certificate bundles when it makes TLS connections, for timezone data when it formats local times, for a working DNS resolver, and for whatever native libraries a dependency expects. Static linking removes the shared-object problem; it does not remove the filesystem-and-environment problem, so these assumptions still have to be tested on a target-like system.",
  code: `cargo build --release --target x86_64-unknown-linux-musl`,
}

const crossCompilationSection = {
  title: "Cross-compilation: compiling here, running there",
  body: "Rust's target model is genuinely strong, but it is worth separating two stories that beginners conflate. Adding a target triple with `rustup target add` and getting pure-Rust code to compile for it is easy and reliable. Producing a correct, runnable artifact for a crate graph that pulls in native C code, system libraries, or a custom linker is a different problem, because now you need the right cross-linker, the right system headers, and sometimes the right sysroot for the destination platform. The compiler succeeding for one architecture on your machine tells you the Rust compiled; it does not tell you the artifact will start and behave on the real target. That gap is exactly why cross-builds belong in target-aware CI and must be followed by a smoke test, not signed off on the strength of a green compile.",
  code: `rustup target add \\
    x86_64-unknown-linux-musl \\
    aarch64-unknown-linux-gnu \\
    wasm32-unknown-unknown`,
  notes: [
    "Pure Rust crates cross-compile more easily than crates that depend on target C libraries or custom linkers.",
    "Cross-building should be followed by a target-like smoke test, not only by successful local compilation.",
  ],
}

const dockerSection = {
  title: "Docker images: build heavy, ship light",
  body: "The point of a multi-stage build is to separate the machinery that produces the artifact from the machinery that runs it. The builder stage carries the full Rust toolchain, the C cross-tools, and the source tree; the runtime stage carries nothing but the compiled binary copied across the stage boundary. Everything the compiler needed is left behind, so the final image is small and its attack surface is narrow. The build reproduces deterministically in CI only when every input is pinned: note that the `rust:1` tag below is a floating tag that can quietly move to a new toolchain version between builds, so a production Dockerfile should pin a specific minor version (for example `rust:1.79`) or a digest and lock it in CI. Read the example as two distinct worlds joined by a single `COPY --from=builder` line: the left world compiles, the right world runs, and almost nothing crosses between them.",
  code: `# 'rust:1' floats; pin a minor version (e.g. rust:1.79) or a digest for reproducible builds.
FROM rust:1 AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y musl-tools && rm -rf /var/lib/apt/lists/*
RUN rustup target add x86_64-unknown-linux-musl
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/service /service
ENTRYPOINT ["/service"]`,
}

const minimalRuntimeSection = {
  title: "Minimal runtime containers: pick the floor your binary needs",
  body: "Minimal base images are not interchangeable, and choosing one by image-size alone is how teams ship a container that builds fine and then crashes on first TLS handshake. `scratch` is the smallest and the least forgiving: it is an empty filesystem, so anything your binary reads at runtime, including CA certificates and any user or directory it expects, has to be copied in by hand. Distroless-style images give you a little structure, such as certificates and a non-root user, without a full distro. Alpine hands you a package manager and a familiar shell, but it commits you to musl, which can surprise a crate graph that contains native code built against glibc. The right base is the smallest floor that still satisfies what the artifact genuinely reaches for, decided from the binary's real runtime needs rather than from aesthetics.",
  notes: [
    "A scratch image often needs copied CA certificates and any other files your binary expects at runtime.",
    "Alpine and musl are often a good pair, but they should be tested together if the crate graph includes native code.",
    "Distroless-style images are useful when you want a small runtime without a fully empty filesystem.",
  ],
}

const wasmSection = {
  title: "WASM packaging: browser modules and WASI modules are different artifact classes",
  body: "WebAssembly is not one packaging story; it is two release families that happen to share a file extension. Browser-oriented modules typically build for `wasm32-unknown-unknown` and ship alongside generated JavaScript glue and a bundler step, because the module has no operating system underneath it and reaches the outside world only through the host page's APIs. WASI-oriented modules build for a target like `wasm32-wasip1` and assume a runtime that provides a standardized, sandboxed system interface, so they look more like a portable command-line program than a browser component. Treating these as one artifact with a different file extension is a recurring mistake; they have different hosts, different capabilities, and different things that can go wrong at load time.",
  code: `# browser-oriented
cargo build --release --target wasm32-unknown-unknown

# wasi-oriented
cargo build --release --target wasm32-wasip1`,
}

const nativeLibrarySection = {
  title: "Native library packaging: you are publishing an ABI now",
  body: "Rust ships as a native library as readily as it ships as a binary, but the contract you are signing is fundamentally different. A binary talks to the world through `argv` and `stdout`, both of which are forgiving and easy to change between releases. A library talks to the world through exported symbols and a memory layout, and the moment another language links against those symbols you have committed to an ABI that you cannot quietly break. So the deliverables grow: you publish a crate type (`cdylib` or `staticlib`), a set of `extern \"C\"` symbols, a versioning policy for the ABI, and the headers or bindings the consumer needs to call you correctly. The smaller you keep that exported surface, the easier it is to keep the promise.",
  code: `[lib]
crate-type = ["cdylib"] # or ["staticlib"]`,
  notes: [
    "Choose `cdylib` when the consumer loads a shared object or DLL-style artifact at runtime, and `staticlib` when the consumer wants to link the Rust code statically into its own binary and needs no loader.",
    "The linking model is the deciding factor: a `cdylib` is loaded as a separate file the host can update independently, while a `staticlib` is baked into the host binary at the host's build time.",
    "Keep the public ABI narrow and versioned. A smaller exported surface is easier to preserve.",
  ],
}

const ciCdSection = {
  title: "CI/CD pipelines: prove the release path before release day",
  body: "A production Rust pipeline validates far more than 'does it compile.' It runs unit and integration tests, lints, one or more target builds, a smoke test of each packaged artifact, container builds, wasm packaging where relevant, and finally publication with its trust data. The reason to wire all of this into CI is timing: every stage that runs automatically on every change is a stage you are not improvising during an incident. The pipeline is itself part of the contract with operators and downstream teams, because it is the evidence that the artifact they pulled was produced and checked the same way every time. The stages flow as a gate sequence, where each gate must pass before the next runs.",
  code: `check -> test -> lint -> cross-build -> smoke-test-artifact -> package -> publish`,
  notes: [
    "Smoke test the final binary or image, not only the crate graph before packaging.",
    "Run target-specific packaging steps in CI so the release path is exercised before release day.",
  ],
}

const supplyChainSection = {
  title: "Supply-chain security: prove what went into the artifact",
  body: "Supply-chain discipline answers a blunt question: when an operator downloads your artifact, can they prove it is the one you built from the dependencies you reviewed? Rust gives you good materials for that answer, but only if you make them explicit. Commit `Cargo.lock` for applications so the dependency graph is pinned and reproducible, review dependency changes the way you review code, scan for known advisories and license violations, and emit checksums and signatures for the files operators actually pull. Provenance and SBOM data describe what went into the build, and they belong in the release lane where they are generated automatically, not in a wiki page assembled by hand after the fact.",
  notes: [
    "Well-known ecosystem tools each do one job: cargo-audit scans the dependency tree against the RustSec advisory database for known vulnerabilities, cargo-deny enforces dependency policy (license allowlists, banned crates, untrusted sources), and cargo-vet records human review of the crates you depend on.",
    "Checksums and signatures should be attached to the final artifacts operators actually download.",
    "SBOM and provenance generation belong in the release lane, not in a wiki page after the fact.",
  ],
}

const featureGateSection = {
  title: "Feature-gated builds: shape the artifact at compile time",
  body: "Cargo features let one codebase compile into materially different artifacts: a build with metrics, a build with admin endpoints, a build with native bindings, a build with optional protocol support, or a lean core with none of them. Used well, this is how you ship the smallest honest artifact for each consumer instead of one bloated binary that carries everyone's needs. Used carelessly, features become a quiet liability: when `default` enables everything and no CI lane ever builds the minimal or alternate sets, you are advertising configurations you have never actually compiled, let alone tested. The rule of thumb is to use compile-time features for artifact shape, leave ordinary toggles to runtime configuration, and build every feature combination you claim to support.",
  code: `[features]
default = ["core"]
metrics = []
admin = []
native-bindings = []`,
  notes: [
    "Use compile-time features for artifact shape, not as a substitute for ordinary runtime configuration.",
    "Test `default-features = false` or reduced-feature builds intentionally if you advertise them.",
  ],
}

const releaseEngineeringSection = {
  title: "Release engineering: make rollback boring",
  body: "Release engineering is the discipline that turns a pile of build outputs into something an operator can deploy, verify, and reverse with confidence. Version every artifact consistently so a human can read target, version, and shape from the name alone; attach checksums and signatures so the download can be verified; document the feature sets, migrations, and known flags that ship with the version; run a target-like smoke test before the release is blessed; and keep a rollback path that does not depend on rebuilding from memory at three in the morning. The measure of good release engineering is unglamorous: when something goes wrong, going back to the previous version is a known, rehearsed, boring procedure rather than an improvisation.",
  notes: [
    "Name artifacts so operators can tell target, version, and delivery shape quickly.",
    "Publish changelog, migration notes, and known feature flags with the artifact set.",
    "Canary, health checks, and rollback instructions belong to the release package, not only to the deploy script.",
  ],
}

const productionPatterns = [
  "Treat the build matrix as part of the product contract: native binary, image, wasm, and library releases should each have an explicit owner and test lane.",
  "Smoke test the final packaged artifact on a target-like environment, not only the crate before packaging.",
  "Keep compile-time features small, explicit, and tested in combinations that matter to real releases.",
  "Generate checksums, signatures, and release metadata from CI so humans do not hand-assemble trust data late.",
  "Use minimal runtime containers deliberately and copy only the runtime files the artifact truly needs.",
  "Version artifact names, native library ABI, wasm package shape, and deployment notes together so rollback stays boring.",
]

const pitfalls = [
  "Assuming the local release build is equivalent to the deployed artifact even though target triple, libc, or runtime filesystem changed underneath it.",
  "Shipping a scratch or minimal image without CA certificates, runtime user assumptions, or health probes the process actually needs.",
  "Turning on every optional feature in the default release and then discovering that image size, startup surface, and attack surface all grew together.",
  "Cross-compiling successfully and calling the job done before running a target-specific smoke test or ABI harness.",
  "Confusing browser wasm packaging, WASI packaging, and native library packaging as if they were the same artifact class with different file extensions.",
  "Treating supply-chain checks as advisory-only while operators still download unsigned or unchecksummed binaries during incidents.",
]

const summaryPoints = [
  "Packaging is a runtime contract: target triple, linker story, container shape, wasm environment, or native library ABI all change what you are really shipping.",
  "Static binaries, cross-compilation, and minimal containers are useful, but each still has runtime assumptions that should be tested on target-like systems.",
  "WASM and native library packaging are distinct release families with their own toolchains and compatibility contracts.",
  "CI/CD, supply-chain security, feature-gated builds, and release engineering are part of the product boundary, not optional cleanup.",
  "The final artifact deserves its own smoke tests, checksums, signatures, metadata, and rollback plan.",
]

export function PageCh44PackagingAndDeployment() {
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
  const pageIndex = getPageIndexById("ch44-packaging-and-deployment")
  const chapter03PageIndex = getPageIndexById("ch03-project-structure-and-tooling")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter25PageIndex = getPageIndexById("ch25-tokio")
  const chapter28PageIndex = getPageIndexById("ch28-cpp-integration")
  const chapter29PageIndex = getPageIndexById("ch29-js-and-cpp-integration-for-wasm")
  const chapter41PageIndex = getPageIndexById("ch41-error-handling-in-large-systems")
  const chapter43PageIndex = getPageIndexById("ch43-observability")
  const exercisesPageIndex = getPageIndexById("ch44-packaging-and-deployment-exercises")
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
          Chapter 44 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Deployment readiness requires reproducible builds, minimal runtime assumptions, artifact provenance, and
          rollback policy. This chapter covers Rust packaging as an operations contract.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Builds on Chapters 03, 19, 25, 28, 29, 41, and 43
              </h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 03 established Cargo, features, and workspace structure. Chapter 19 covered wire contracts.
                Chapter 25 covered service runtime shape. Chapters 28 and 29 covered native and wasm boundaries.
                Chapter 41 covered translated error contracts, and Chapter 43 covered health, telemetry, and operator
                signals. Packaging and deployment sit across all of them.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter03PageIndex)}>
                Chapter 03
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter25PageIndex)}>
                Chapter 25
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter28PageIndex)}>
                Chapter 28
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter29PageIndex)}>
                Chapter 29
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter41PageIndex)}>
                Chapter 41
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Chapter 43
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            One Rust codebase has to ship four different ways: as a static Linux binary for the fleet, as a container
            image for the orchestrator, as a browser Wasm module for the dashboard, and as a native library for a C++
            host that embeds the risk engine. They share source, but they do not share a runtime contract. The business
            requirement is to treat each artifact as its own promise, with its own target triple and feature set, its
            own smoke test, and its own provenance, signatures, and rollback instructions. The diagram below shows how
            one crate graph fans out into four distinct delivery shapes that must each be packaged and verified
            separately.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Src[one crate graph] --> Bin[static linux binary]\n  Src --> Img[container image]\n  Bin -->|musl + smoke test| ReleaseB[release: binary]\n  Img -->|distroless + health probe| ReleaseI[release: image]`}
            caption="Half one: the same crate graph fans out to a static Linux binary and a container image, each with its own target and verification."
          />
          <p className="text-sm text-muted-foreground leading-6">
            The same crate graph also feeds two more delivery shapes:
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  Src[one crate graph] --> Wasm[browser wasm module]\n  Src --> Lib[native library]\n  Wasm -->|glue + bundler| ReleaseW[release: wasm]\n  Lib -->|cdylib + ABI| ReleaseL[release: library]`}
            caption="Half two: the browser wasm module and the native library each pick a distinct packaging shell before they count as releasable."
          />
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <h4 className="font-semibold text-foreground mb-2">A practical decision order</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Choose the runtime contract first: binary, image, wasm module, or native library.</li>
              <li>Choose the target triple and feature set second.</li>
              <li>Choose the packaging shell third: filesystem image, loader metadata, or ABI surface.</li>
              <li>Attach smoke tests, checksums, signatures, and rollback rules before calling it releasable.</li>
            </ol>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">At a glance</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Treat every artifact shape as a runtime contract: binary, image, wasm module, or native library.</li>
              <li>Target triples, feature flags, and crate types are release decisions, not only compiler settings.</li>
              <li>Smoke-test the final packaged artifact on a target-like environment, not only the crate before packaging.</li>
              <li>Checksums, signatures, SBOMs, and rollback instructions belong to the release story from the start.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-lg font-semibold text-foreground mb-3">Release-engineering questions</h3>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              <li>Who runs this artifact, and what runtime assumptions does it make?</li>
              <li>Which feature set is the smallest honest release for this consumer?</li>
              <li>What trust data ships with the final artifact, and which CI lane proves it was produced correctly?</li>
              <li>Could another engineer roll back this release without rebuilding from memory during an incident?</li>
            </ul>
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

          {[
            staticBinarySection,
            crossCompilationSection,
            dockerSection,
            minimalRuntimeSection,
            wasmSection,
            nativeLibrarySection,
            ciCdSection,
            supplyChainSection,
            featureGateSection,
            releaseEngineeringSection,
          ].map((section) => (
            <article key={section.title} className="rounded-xl border border-border bg-card p-5">
              <h4 className="font-semibold text-foreground mb-3">{section.title}</h4>
              <p className="text-sm text-muted-foreground leading-6">{section.body}</p>
              {"code" in section && section.code ? (
                <pre className="mt-4 rounded-md bg-muted/30 px-3 py-2 text-xs overflow-x-auto">
                  <code className="font-mono text-foreground">{section.code}</code>
                </pre>
              ) : null}
              {"notes" in section && section.notes ? (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {section.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-2">
              How to think about deployment coming from C++, C#, Go, or Python
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              The useful comparison here is not 'which crate replaces which library.' It is where each background expects
              the runtime to come from, and how that expectation changes when the artifact has to stand on its own. Find
              your starting language and notice the shift it asks for.
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

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-2">The release pipeline as a gate sequence</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              This expands the CI/CD concept card above into a picture. The same stages read more clearly as a chain of
              gates than as a script: each stage only runs if the one before it passed, and the artifact only earns a
              signature and publication after the smoke test confirms it actually runs on a target-like environment. The
              key transition to watch is the one from build to smoke test: that is where a release stops being 'it
              compiled' and becomes 'it runs.'
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Check[cargo check] --> Test[unit + integration tests]\n  Test --> Lint[clippy + fmt]\n  Lint --> Build[cross-build per target]\n  Build --> Smoke[smoke test artifact]\n  Smoke -->|pass| Package[package image / wasm / lib]\n  Smoke -->|fail| Stop[block release]\n  Package --> Sign[checksum + sign + SBOM]\n  Sign --> Publish[publish artifacts]`}
              caption="Build proves the code compiles; the smoke test proves the packaged artifact runs. Only then do trust data and publication follow."
            />
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
                The most expensive deployment bug is often not a compiler failure. It is a “successful” release whose
                final artifact was never tested in the real runtime shape that production actually executes.
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
                <h4 className="font-semibold text-foreground">Example 1: target-aware artifact naming</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The point is not string formatting. The point is that each target class becomes an explicit artifact
                  contract instead of an implicit convention hidden in release scripts.
                </p>
              </div>
              {codes.packaging_target_matrix !== DEFAULT_CODES.packaging_target_matrix && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("packaging_target_matrix")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: the <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">match</code> in{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">artifact_name</code> is the whole
              idea. One <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">BuildTarget</code> value
              routes to exactly one naming rule, and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">is_static</code> records intent as
              data rather than as a comment in a release script. Follow how a single target flows through both functions
              to a fully described artifact.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  T[BuildTarget value] --> M{match target}\n  M -->|LinuxGnu| G[name: ...-linux-gnu]\n  M -->|LinuxMusl| Mu[name: ...-linux-musl]\n  M -->|Wasm| W[name: ....wasm]\n  M -->|NativeLib| L[name: lib....so]\n  Mu --> Cont[continues below]`}
              caption="First the match selects the artifact name: one enum variant routes to exactly one naming rule."
            />
            <p className="text-sm text-muted-foreground leading-6">
              From the musl name, the same target value then decides static intent:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Cont[continues below] --> Mu[name: ...-linux-musl]\n  Mu --> S{is_static?}\n  S -->|musl| Yes[static = true]`}
              caption="The musl target also records static intent as data: the enum, not a comment, decides the build is static."
            />
            <RustCodeEditor
              code={codes.packaging_target_matrix}
              onChange={(newCode) => updateCode("packaging_target_matrix", newCode)}
              onRun={() => runCode("packaging_target_matrix")}
              output={outputs.packaging_target_matrix ?? null}
              isRunning={isRunning === "packaging_target_matrix"}
              filename="target_matrix.rs"
              expectedOutput={
                "musl = payments-x86_64-unknown-linux-musl\nwasm = payments-wasm32-unknown-unknown.wasm\nstatic = true"
              }
              showResultComparison={true}
              originalCode={DEFAULT_CODES.packaging_target_matrix}
              onRevert={() => resetCode("packaging_target_matrix")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Target triple</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Artifact naming should make the target obvious to humans and automation.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Static intent</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Whether a build is intended to be static is a first-class release property, not tribal knowledge.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Multi-shape release</div>
                <p className="text-xs text-muted-foreground leading-5">
                  One codebase can legitimately emit binaries, wasm modules, and native libraries without pretending they
                  are the same delivery artifact.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: release bundle planning</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  A release is more than one executable. Feature selection, artifact list, and supply-chain outputs should
                  all be visible in one reviewable bundle plan.
                </p>
              </div>
              {codes.packaging_release_bundle !== DEFAULT_CODES.packaging_release_bundle && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("packaging_release_bundle")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              What to look at: watch how <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">build_bundle</code>{" "}
              starts from a core artifact-and-feature set and then conditionally accumulates more based on the{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">metrics</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">admin</code> flags. Each flag is a
              real packaging decision: <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">admin</code>{" "}
              does not just add a feature, it adds a whole new artifact (the native library). The diagram traces that
              branching before you read the code.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Core[core: linux-musl + container] --> Q1{metrics?}\n  Q1 -->|yes| AddM[+ metrics feature]\n  Q1 -->|no| Skip1[skip]\n  AddM --> Q2{admin?}\n  Skip1 --> Q2\n  Q2 -->|yes| AddA[+ admin feature + native-lib artifact]\n  Q2 -->|no| Skip2[skip]\n  AddA --> Bundle[ReleaseBundle: artifacts + features + SBOM + signature]\n  Skip2 --> Bundle`}
              caption="Flags do not just flip booleans; they grow the artifact inventory and feature list that the release bundle must account for."
            />
            <RustCodeEditor
              code={codes.packaging_release_bundle}
              onChange={(newCode) => updateCode("packaging_release_bundle", newCode)}
              onRun={() => runCode("packaging_release_bundle")}
              output={outputs.packaging_release_bundle ?? null}
              isRunning={isRunning === "packaging_release_bundle"}
              filename="release_bundle.rs"
              expectedOutput={
                "profile = release\nartifacts = linux-musl,container\nfeatures = core,metrics\nsigned = true"
              }
              showResultComparison={true}
              originalCode={DEFAULT_CODES.packaging_release_bundle}
              onRevert={() => resetCode("packaging_release_bundle")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Feature gates</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Feature selection changes the release artifact and should therefore be explicit in the release plan.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Artifact inventory</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Operators should know which shapes were built and published for a given version.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Supply-chain gate</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Checksums, signatures, and SBOM outputs belong to the bundle story, not only to the CI implementation.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch44_packaging_and_deployment/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to build a native, container, and wasm packaging matrix, design a
            feature-gated release workflow, add supply-chain checks to CI, and write a release checklist another senior
            engineer could operate during a real rollout.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 44 Exercises
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

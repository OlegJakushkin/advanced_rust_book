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
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Packaging is a runtime contract, not only a build command",
    body: "The real question is what artifact another system will execute: a Linux binary, a container image, a browser or WASI module, or a native library loaded by another process. Rust makes that boundary explicit because the target triple, linker story, crate type, and feature set all change the final contract.",
  },
  {
    title: "The final artifact matters more than the local dev build",
    body: "A `cargo build --release` on your laptop is not the thing production runs. Production runs one target-specific binary, one image, one wasm module, or one shared library with its own libc, filesystem, certificates, ABI, and startup behavior.",
  },
  {
    title: "Release engineering is part of system design",
    body: "Checksums, signatures, SBOMs, smoke tests, health probes, rollback plans, and feature-matrix discipline belong in the packaging story. They are not paperwork after the software is already done.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You may already think in terms of ABI, libc, linkers, and deployment environments. Rust keeps that discipline, but often makes the surface smaller: one static binary, one `cdylib`, or one explicit target triple instead of a larger ambient runtime assumption.",
  },
  {
    title: "C# background",
    body: "The main shift is that deployment is usually less framework-hosted and more artifact-specific. Instead of assuming one managed runtime and packaging shell, Rust often asks you to pick the exact binary, image, wasm bundle, or native library contract up front.",
  },
  {
    title: "Go background",
    body: "Go teams often expect one easy static binary path. Rust can absolutely do that, but not every crate graph or native dependency naturally lands there. Cross-compilation, libc choice, and feature gating stay more visible and therefore more reviewable.",
  },
]

const staticBinarySection = {
  title: "Static binaries",
  body: "Static Linux binaries are attractive because they shrink runtime dependencies and fit minimal containers well. In Rust, the common path is a musl target for Linux. The operational tradeoff is that smaller runtime surface does not mean zero environment assumptions: CA bundles, timezone data, DNS behavior, and native library expectations still need target testing.",
  code: `cargo build --release --target x86_64-unknown-linux-musl`,
}

const crossCompilationSection = {
  title: "Cross-compilation",
  body: "Rust's target model is strong, but pure-Rust success and native-dependency success are different stories. Adding a target triple is easy. Producing a correct final artifact for a crate graph with native code, system libraries, or linker assumptions still requires target-aware CI and smoke tests.",
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
  title: "Docker images",
  body: "Multi-stage builds keep the Rust toolchain in the builder layer and copy only the final artifact into the runtime layer. That reduces image size and narrows the attack surface while keeping the build reproducible in CI.",
  code: `FROM rust:1 AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/service /service
ENTRYPOINT ["/service"]`,
}

const minimalRuntimeSection = {
  title: "Minimal runtime containers",
  body: "Minimal images are not all equivalent. `scratch` is the smallest and least forgiving. Distroless-style images provide a little more runtime structure. Alpine gives you package tooling but also locks you into musl expectations. The right choice follows the artifact's real runtime needs, not image-size aesthetics alone.",
  notes: [
    "A scratch image often needs copied CA certificates and any other files your binary expects at runtime.",
    "Alpine and musl are often a good pair, but they should be tested together if the crate graph includes native code.",
    "Distroless-style images are useful when you want a small runtime without a fully empty filesystem.",
  ],
}

const wasmSection = {
  title: "WASM packaging",
  body: "WASM packaging is really two families of release: browser-oriented modules and WASI-oriented modules. Browser builds usually pair `wasm32-unknown-unknown` with generated glue and bundler integration. WASI-compatible packaging targets a runtime contract rather than a browser DOM contract.",
  code: `# browser-oriented
cargo build --release --target wasm32-unknown-unknown

# wasi-oriented
cargo build --release --target wasm32-wasip1`,
}

const nativeLibrarySection = {
  title: "Native library packaging",
  body: "Rust can ship as a native library just as easily as it can ship as a binary, but the contract changes. Instead of argv and stdout, you now publish symbols, crate type, ABI rules, versioning policy, and header or binding generation for another language to consume.",
  code: `[lib]
crate-type = ["cdylib"] # or ["staticlib"]`,
  notes: [
    "Use `cdylib` when another runtime loads a shared object or DLL-style artifact.",
    "Use `staticlib` when the embedding side wants static linking and the release story can support it.",
    "Keep the public ABI narrow and versioned. A smaller exported surface is easier to preserve.",
  ],
}

const ciCdSection = {
  title: "CI/CD pipelines",
  body: "A production Rust pipeline usually validates more than one build path: unit and integration tests, linting, one or more target builds, artifact smoke tests, container builds, wasm packaging when relevant, and release publication. The matrix itself is part of the contract with operators and downstream teams.",
  code: `check -> test -> lint -> cross-build -> smoke-test-artifact -> package -> publish`,
  notes: [
    "Smoke test the final binary or image, not only the crate graph before packaging.",
    "Run target-specific packaging steps in CI so the release path is exercised before release day.",
  ],
}

const supplyChainSection = {
  title: "Supply-chain security",
  body: "Rust's packaging story is strongest when dependency and artifact discipline are explicit. Commit `Cargo.lock` for applications, review dependency changes, scan for advisories and license policy, emit checksums, and publish provenance and SBOM data through platform tooling or ecosystem options where required.",
  notes: [
    "Well-known ecosystem options include advisory, license, and dependency-policy tools such as cargo-audit, cargo-deny, or cargo-vet.",
    "Checksums and signatures should be attached to the final artifacts operators actually download.",
    "SBOM and provenance generation belong in the release lane, not in a wiki page after the fact.",
  ],
}

const featureGateSection = {
  title: "Feature-gated builds",
  body: "Feature flags are powerful when they model real packaging differences, such as metrics, admin endpoints, native bindings, or optional protocol support. They become dangerous when one artifact quietly enables everything by default and no CI lane exercises the minimal or alternate sets.",
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
  title: "Release engineering",
  body: "Release engineering is where packaging becomes operationally trustworthy. Version artifacts consistently, attach checksums and signatures, document feature sets and migrations, run a target-like smoke test, and keep a rollback path that does not depend on rebuilding from memory during an incident.",
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
          Rust deployment work gets easier when you treat packaging as a product surface: one target, one artifact, one
          runtime contract, and one release process operators can trust.
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
            Your team ships the same Rust codebase in four shapes: a static Linux service for one edge environment, a
            multi-stage container image for the main platform, a browser-facing wasm bundle for an admin console, and a
            native library consumed by another product. The temptation is to call all of that “the release.” The useful
            engineering answer is narrower: each artifact has its own runtime assumptions, feature set, smoke tests,
            security metadata, and rollback story.
          </p>
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
            <h4 className="font-semibold text-foreground mb-3">
              Comparing Rust deployment with C++, C#, and Go
            </h4>
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
                The most expensive deployment bug is often not a compiler failure. It is a “successful” release whose
                final artifact was never tested in the real runtime shape that production actually executes.
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

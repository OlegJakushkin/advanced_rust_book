"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Package, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "Package",
    body: "A package is the Cargo unit described by one Cargo.toml. A single package may produce one library crate, multiple binary crates, or both.",
  },
  {
    title: "Crate",
    body: "A crate is the compiler unit. Modules organize source inside the crate, but modules are not separate crates just because they live in separate files.",
  },
  {
    title: "Workspace",
    body: "A workspace is the repository-level coordination layer: shared lockfile, shared target directory, shared commands, and usually shared dependency policy.",
  },
]

const comparisons = [
  {
    title: "C++ background",
    body: "Your instinct is to map a module to a header and a translation unit. Resist it: the compilation unit in Rust is the whole crate, not the file, so moving code between files inside a crate does not create a new compile boundary the way splitting a .cpp file does. Cargo is also a real dependency resolver and build system in one, not a hand-written Makefile plus a package manager you bolted on afterward.",
  },
  {
    title: "C# background",
    body: "A crate is not an assembly you load and inspect at runtime. There is no reflection-friendly metadata or runtime type discovery to fall back on, so the API surface has to be made explicit at compile time through exports, traits, and features. The shift is that what an assembly would decide late, a crate decides when it builds.",
  },
  {
    title: "Go background",
    body: "Go fuses the ideas: a directory is a package is the unit of import and roughly the unit of build. Rust pulls them apart into three distinct things — a package is what Cargo manages, a crate is what the compiler builds, and a module is how source is organized inside that crate. Once you keep those three words separate, the rest of the chapter stops feeling arbitrary.",
  },
  {
    title: "Python background",
    body: "There is no runtime import system discovering modules from the filesystem as the program starts. Visibility, the dependency graph, and optional capabilities are all decided when the crate compiles, not when it runs, so a missing or private item is a build error rather than an ImportError or AttributeError you hit on a code path in production.",
  },
]

const workspaceLayout = [
  "Cargo.toml at the workspace root for shared members and policy",
  "crates/domain for business types and invariants",
  "crates/adapters for database, HTTP, or queue integration boundaries",
  "apps/api for the service binary",
  "apps/worker for the background processor binary",
]

const testingLayers = [
  {
    title: "Unit tests",
    body: "Keep fast behavioral checks close to the code with `#[cfg(test)] mod tests`. This is the right place for small ownership and parsing invariants.",
  },
  {
    title: "Integration tests",
    body: "Use the `tests/` directory when the behavior crosses crate boundaries or needs a public API view rather than an internal module view.",
  },
  {
    title: "Doc tests",
    body: "Rustdoc examples double as executable documentation. For public libraries, that is part of the API contract, not ornamental prose.",
  },
  {
    title: "Benchmarks",
    body: "Benchmarking in Rust is often an ecosystem workflow rather than one universal standard-library story. Many teams use Criterion, which runs on stable through its own bench harness wired up as a `[[bench]]` target with `harness = false` and invoked through `cargo bench`, since the built-in `#[bench]` harness still requires nightly.",
  },
]

const workflowCommands = [
  {
    command: "cargo check --workspace",
    why: "Fast structural feedback while you are still moving modules, traits, and boundaries around.",
  },
  {
    command: "cargo test --workspace --all-targets --all-features",
    why: "Covers unit tests, integration tests, examples, and other defined targets from one command entry point, with every feature-gated path compiled so optional code cannot rot.",
  },
  {
    command: "cargo fmt --all --check",
    why: "Keeps formatting deterministic in CI. Run `cargo fmt --all` locally when you want to rewrite files.",
  },
  {
    command: "cargo clippy --workspace --all-targets --all-features -- -D warnings",
    why: "Treats lint findings as design feedback, especially around needless allocation, API shape, and suspicious control flow.",
  },
  {
    command: "cargo bench",
    why: "Use when the workspace defines benchmark targets or a benchmark harness. If it does not, set up a real benchmark before measuring instead of guessing.",
  },
]

const productionPatterns = [
  "Split crates at real boundaries: public API, dependency isolation, separate release cadence, or a materially different ownership model. Do not split crates only because a directory feels busy.",
  "Use modules to hide internal mechanics and crate roots to shape the exported surface with deliberate `pub use` re-exports.",
  "Prefer `pub(crate)` or `pub(super)` before `pub`. Wider visibility is an API promise and a refactoring tax.",
  "Keep features additive. Use runtime configuration for modes and compile-time features for optional capability, platform selection, or expensive integrations.",
  "Review dependency additions the way you review schema changes: new crate, new feature set, new compile graph, new long-term obligation.",
]

const pitfalls = [
  "Creating many tiny crates too early. Each crate adds compile-graph edges, versioning surface, and another place to leak unstable abstractions.",
  "Making fields public because it feels faster in the moment. Public fields turn internal layout into API, which later makes invariants harder to enforce.",
  "Using Cargo features as a runtime mode system. Features are compile-time graph shaping tools; they are usually a poor place to encode mutually exclusive operational states.",
  "Letting one crate depend on several adjacent layers because 'it is convenient right now'. Dependency shortcuts accumulate architectural debt quickly in Rust workspaces.",
  "Treating Clippy and formatting as late cleanup. Wire them into ordinary local and CI flow instead of leaving them for a release-week pass.",
]

export function PageCh03ProjectStructureAndTooling() {
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
  const pageIndex = getPageIndexById("ch03-project-structure-and-tooling")
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
          Chapter 03 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Large Rust repositories need predictable crate boundaries, module visibility, feature flags, dependency policy,
          and CI commands. This chapter sets the project structure that keeps builds repeatable and maintainable.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Repository note</h3>
              <p className="text-sm text-muted-foreground leading-6">
                The current repository is a web book template, not a live Cargo workspace. To stay aligned with the
                existing template, this chapter uses standalone Rust example files under{" "}
                <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">
                  examples/ch03_project_structure_and_tooling/
                </code>{" "}
                and explains the Cargo layouts you would create in a real Rust repository.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(getPageIndexById("ch02-the-rust-mental-model"))} className="shrink-0">
              Revisit Chapter 02
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A product repository must deliver an API service, a worker, a support CLI, and a shared domain model from one
            Rust workspace. The business requirement is clear package ownership, crate boundaries that match release and
            dependency policy, module visibility that protects invariants, and repeatable Cargo commands in CI.
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
            <Package className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Cargo, crates, packages, and workspaces</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  The easiest mistake is to treat these words as synonyms. They are not. A package is what Cargo
                  manages from one <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cargo.toml</code>.
                  A crate is what the compiler builds. A workspace groups packages so the repository can share one{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cargo.lock</code>, one target
                  directory, and one top-level command set.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  In practice, start with fewer crates than your instincts may suggest. A new crate is justified when it
                  gives you a real boundary: dependency isolation, compile-time separation, reuse with a stable surface,
                  or a clean public/private split. If the change is only organizational, a module is often the cheaper
                  unit.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The relationship is strictly nested, and the diagram is worth fixing in memory before anything else: a
              workspace contains packages, each package is defined by exactly one{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cargo.toml</code> and produces one or
              more crates, and each crate contains a tree of modules. Note where the units do and do not line up: one
              package can yield several crates, but a module never escapes its crate.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  W[Workspace one Cargo.lock and target dir] --> P1[Package domain]\n  W --> P2[Package api]\n  P1 --> L1[lib crate]\n  P2 --> B1[bin crate]\n  P2 --> L2[lib crate]\n  L1 --> M1[mod model]\n  L1 --> M2[mod error]\n  B1 --> M3[mod routes]`}
              caption="Workspace contains packages, a package can build several crates, and modules live inside one crate. Cargo manages the package; the compiler manages the crate."
            />

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-3">A practical workspace layout</div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {workspaceLayout.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <div className="font-medium text-foreground mb-3">When to make a new crate</div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  <li>The dependency graph truly differs and you want to keep heavyweight crates out of the core.</li>
                  <li>The package exports a stable API consumed by multiple binaries or external users.</li>
                  <li>The team wants a separate release cadence or a separately testable integration layer.</li>
                  <li>You need a compile boundary, not just a folder boundary.</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Modules and visibility</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Modules are how you hide detail inside a crate. The default visibility is private, which is a strong
                  default to keep. Reach first for{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pub(super)</code>, then{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pub(crate)</code>, and only then
                  full <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pub</code> when you truly
                  mean external callers.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  The crate root is where you shape the surface. Internal modules may stay deep and specific while the
                  public API becomes smaller and calmer through deliberate{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pub use</code> re-exports. That
                  keeps callers stable while giving you room to refactor internals.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground leading-6">
              Visibility is a ladder, not a switch. Each rung widens who can reach an item, and each
              rung up is harder to walk back later because more callers can depend on it. Climb only as far as a real
              caller forces you to, and shape the public path with a deliberate{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">pub use</code> at the crate root.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  A[private default] --> B[pub super]\n  B --> C[pub crate]\n  C --> D[pub re-exported at crate root]\n  D --> E[external callers]\n  A -.->|widening is an API promise| E`}
              caption="Each step widens the audience for an item. Default private is the cheapest to change; a name re-exported at the crate root is the hardest, because outside code can now depend on it."
            />

            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="font-medium text-foreground mb-3">Visibility rule of thumb</div>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Fields stay private until callers truly need direct structural access.</li>
                <li>Constructors and accessors are often cheaper than exposing layout forever.</li>
                <li>Re-export names at the crate root when you want a stable path but flexible internals.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Features and conditional compilation</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Cargo features work best as additive capability switches: optional integrations, platform-specific
                  plumbing, or extra instrumentation. The real tools are compile-time conditions such as{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">#[cfg(feature = "metrics")]</code>,{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">#[cfg(test)]</code>, and
                  optional dependencies.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  The trap is to encode runtime mode systems as feature matrices. Features are resolved once for the
                  whole build graph. If the question is “what mode is this service in today?”, a runtime config file or
                  environment variable is usually the better abstraction.
                </p>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground leading-6">
              In the diagram, the feature is decided once, on the left, before the compiler runs, and
              everything downstream is fixed for that whole build. A runtime decision sits on the opposite side — it
              branches per request inside a single binary. Choosing the wrong side is the classic feature-flag mistake.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  F[Cargo feature on or off] --> R[Cargo resolves graph once]\n  R --> G1[cfg metrics on: code compiled in]\n  R --> G2[cfg metrics off: code absent from binary]`}
              caption="Compile-time side: a feature is a fork resolved once, before the binary exists. The code is either compiled in or absent from the shipped binary."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The runtime side is the opposite: one already-built binary that branches per request.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  subgraph Runtime[Single built binary]\n    CFG[config or env var] --> Mode1[mode A this request]\n    CFG --> Mode2[mode B next request]\n  end`}
              caption="Runtime side: a mode is a branch inside the one binary you shipped, chosen per request. Capability belongs on the compile-time side; operational state belongs here."
            />

            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                Keep feature design boring. Additive features compose. Mutually exclusive features multiply test
                matrices, documentation burden, and integration surprises.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Dependency management</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Be strict about direct dependencies. Each direct crate becomes part of your maintenance surface, your
                  security review surface, and sometimes your public API surface. If several packages share the same
                  policy, centralize it with workspace-level dependency declarations such as{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">workspace.dependencies</code>{" "}
                  instead of duplicating versions.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground leading-6">
                  Commit <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">Cargo.lock</code> for
                  binaries and services so production resolution stays reproducible. Library crates also keep a lockfile
                  in the repository for CI sanity, but downstream consumers still resolve their own graph. A library
                  cannot pin its consumers&apos; versions because each consumer resolves the full dependency graph from
                  its own set of dependencies, so the library&apos;s lockfile only governs its own CI build, never the
                  builds that depend on it.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="font-medium text-foreground mb-3">Dependency rules</div>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                <li>Prefer fewer transitive surfaces over convenient one-off crates.</li>
                <li>Audit default features before accepting them blindly.</li>
                <li>Ask whether a dependency belongs in the core crate or at an outer adapter layer.</li>
                <li>Review version and feature changes the way you review schema and protocol changes.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Testing, benchmarking, linting, and formatting</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {testingLayers.map((layer) => (
                <div key={layer.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{layer.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{layer.body}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <div className="font-medium text-foreground mb-3">Commands for a real Rust workspace</div>
              <ul className="space-y-3">
                {workflowCommands.map((item) => (
                  <li key={item.command} className="rounded-lg border border-border bg-muted/30 p-3">
                    <code className="text-xs font-mono text-foreground">{item.command}</code>
                    <p className="mt-2 text-sm text-muted-foreground leading-6">{item.why}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted-foreground leading-5">
                The repository also includes{" "}
                <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                  examples/ch03_project_structure_and_tooling/testing_layers.rs
                </code>{" "}
                as a small, standalone example of colocated tests.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">A recommended Rust workflow</h4>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Sketch the crate boundary first: core domain, adapters, binaries, and external integration points.</li>
              <li>Start with modules inside one crate, then split crates only where the dependency or API boundary is real.</li>
              <li>Run fast structural checks early and often: check, test, format, then Clippy.</li>
              <li>Keep feature flags additive and dependency additions reviewed, not casual.</li>
              <li>Only benchmark after the boundary and ownership model are stable enough to interpret the numbers.</li>
            </ol>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">How prior instincts translate</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6 max-w-3xl">
            Almost every confusion in this chapter comes from carrying a structural assumption from another language and
            quietly assuming Rust agrees. It usually does not. The cards below name the one shift to make for each
            background before any of the concrete layout advice will land.
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {comparisons.map((comparison) => (
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
                Repository structure is architecture. In Rust, visibility, crate boundaries, and feature design are not
                cleanup chores after the code works. They are part of how the code keeps working.
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
                <h4 className="font-semibold text-foreground">Example 1: shape a narrow module surface</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Keep layout private where possible and expose behavior or focused accessors instead of raw structure.
                </p>
              </div>
              {codes.project_structure_module_visibility !== DEFAULT_CODES.project_structure_module_visibility && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("project_structure_module_visibility")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              Here <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">service_name</code> is
              public, but <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">bind_addr</code> is a
              private field reached only through a method. The public field is kept here on purpose so the two paths sit
              side by side: a real service usually hides both behind accessors, but exposing one and gating the other
              makes the contrast visible. Callers read <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">bind_addr</code>{" "}
              without getting the right to depend on how it is stored, which is exactly the seam the diagram traces.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  C[main caller] -->|new| K[AppConfig::new constructor]\n  K --> S[(private bind_addr field)]\n  C -->|read| A[bind_addr accessor]\n  A --> S\n  C -.->|cannot touch directly| S`}
              caption="The caller reaches the private field only through the constructor and accessor. The dashed edge is the path the compiler refuses, which is what frees you to change the field's storage later."
            />
            <RustCodeEditor
              code={codes.project_structure_module_visibility}
              onChange={(newCode) => updateCode("project_structure_module_visibility", newCode)}
              onRun={() => runCode("project_structure_module_visibility")}
              output={outputs.project_structure_module_visibility ?? null}
              isRunning={isRunning === "project_structure_module_visibility"}
              filename="module_visibility_service.rs"
              expectedOutput="api@127.0.0.1:8080"
              showResultComparison={true}
              originalCode={DEFAULT_CODES.project_structure_module_visibility}
              onRevert={() => resetCode("project_structure_module_visibility")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: run the baseline, then change the constructor arguments and keep the private field private.
              The point is not accessor boilerplate; it is preserving the right to change internal layout later.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">Example 2: model an optional capability cleanly</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The editor uses a simple constant so you can run the idea in one file. The repository example{" "}
                  <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                    feature_gated_metrics.rs
                  </code>{" "}
                  shows the real `#[cfg(feature = "metrics")]` shape.
                </p>
              </div>
              {codes.project_structure_feature_flags !== DEFAULT_CODES.project_structure_feature_flags && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("project_structure_feature_flags")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-1">
              The example uses a plain{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">const</code> so it runs in one file,
              but read it as the right-hand runtime branch in the diagram below. The exercise is to decide whether this
              choice should instead move left, to a compile-time feature, so the unused backend never enters the binary
              at all.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Q[Is this a capability or a mode?] --> Cap[Capability: optional integration]\n  Q --> Mode[Mode: which way today]\n  Cap --> Feat[cfg feature metrics at compile time]\n  Mode --> Const[const or env check at runtime]\n  Const --> Out[metrics backend = disabled]`}
              caption="The decision tree behind the example: a true optional capability belongs in a Cargo feature, while a 'which mode right now' question belongs at runtime. The const here stands in for the runtime branch."
            />
            <RustCodeEditor
              code={codes.project_structure_feature_flags}
              onChange={(newCode) => updateCode("project_structure_feature_flags", newCode)}
              onRun={() => runCode("project_structure_feature_flags")}
              output={outputs.project_structure_feature_flags ?? null}
              isRunning={isRunning === "project_structure_feature_flags"}
              filename="feature_gated_metrics.rs"
              expectedOutput="metrics backend = disabled"
              showResultComparison={true}
              originalCode={DEFAULT_CODES.project_structure_feature_flags}
              onRevert={() => resetCode("project_structure_feature_flags")}
            />
            <p className="text-xs text-muted-foreground mt-2 leading-5">
              Quick check: toggle <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">METRICS_ENABLED</code>{" "}
              between <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">false</code> and{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">true</code>. Then ask whether the
              decision really belongs at runtime or should move to a compile-time feature.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to design a multi-crate product layout, repair a feature matrix, choose
            dependency policy, and write the baseline test/lint/benchmark commands you would expect in a
            production Rust workspace.
          </p>
          <Button onClick={() => setCurrentPage(6)} className="gap-2">
            Open Chapter 03 Exercises
            <ArrowRight className="h-4 w-4" />
          </Button>
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Summary</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            <li>Package, crate, module, and workspace are different units with different jobs. Keep the distinctions crisp.</li>
            <li>Split crates only where the architectural boundary is real; use modules for cheaper internal structure.</li>
            <li>Visibility is design. Narrow it by default and shape public API intentionally at the crate root.</li>
            <li>Features work best as additive compile-time capability switches, not as a runtime mode system in disguise.</li>
            <li>A strong Rust workflow is ordinary and repeatable: check, test, format, lint, and benchmark deliberately.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

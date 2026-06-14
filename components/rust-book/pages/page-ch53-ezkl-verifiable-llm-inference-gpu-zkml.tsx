"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const architectureSketch = `HTTP / gRPC submitter
  -> auth + tokenizer/version selection
  -> artifact manifest lookup
  -> zkml job queue
  -> witness builder
  -> GPU-capable prover lane
     -> model graph artifact store
     -> quantization / calibration manifest
     -> proof artifact store
  -> lightweight verifier API
  -> result store + audit log + downstream queue`

const mentalModelPoints = [
  {
    title: "Verifiable inference is an artifact pipeline first.",
    body: "The operational unit is not only a model call. It is a versioned graph export, tokenization policy, quantization manifest, witness material, proof artifact, and verification request that all need to line up reproducibly.",
  },
  {
    title: "LLM proving is usually asymmetric and queue-shaped.",
    body: "Verification is the small lane. Witness generation and proof creation are the heavy lane. Treat proving like a specialized worker pool with bounded admission, not like an ordinary inline request helper.",
  },
  {
    title: "GPU acceleration is conditional and measurement-driven.",
    body: "Some ZKML stages benefit from accelerators, but the right question is always where wall time is going: host-device copies, witness construction, proving kernels, artifact serialization, or queue wait.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Think of the proof flow more like a compiler and artifact pipeline around a model graph than like one ordinary inference function call. Rust helps most by making ownership, queueing, and artifact versioning explicit.",
  },
  {
    title: "C# background",
    body: "Do not expect runtime reflection or one framework object to describe the whole workflow. In Rust, the calm design keeps public claims, witness inputs, proof artifacts, and verifier requests as separate typed boundaries.",
  },
  {
    title: "Go background",
    body: "A proving lane is usually more like a bounded job system than like a light goroutine fan-out. Queue age, artifact size, and retry policy matter as much as the math.",
  },
]

const zkmlMentalModelCards = [
  {
    title: "Model graph",
    body: "Freeze the computation into one reproducible graph or circuit input. If graph export, operator fusion, or preprocessing changes, the proof system boundary has changed too.",
  },
  {
    title: "Quantization and reproducibility",
    body: "Most practical ZKML flows rely on quantized, bounded numeric representations. Quantization bits, calibration policy, and rounding behavior are protocol inputs, not incidental tuning.",
  },
  {
    title: "Witness generation",
    body: "The witness usually contains the private inputs and internal execution material needed by the prover. It should stay off verifier boundaries and out of casual logs.",
  },
  {
    title: "Proof and verification",
    body: "The verifier should receive only public statement data plus proof artifact and version metadata. Verifiable inference proves that a chosen computation was followed, not that the model is good, safe, or truthful.",
  },
]

const ezklWorkflowCards = [
  {
    title: "EZKL as an ecosystem workflow",
    body: "Treat EZKL as one ecosystem option for compiling model-graph workloads into proof-oriented pipelines. Exact commands and file layouts evolve, but the stable engineering pattern is: export graph, quantize or calibrate, generate witness, prove, verify, and version the artifacts.",
  },
  {
    title: "Keep the toolchain outside the request path",
    body: "Compilation, setup, and heavy proof generation usually belong in CI, admin tooling, or dedicated worker lanes. The API edge should mainly select artifacts, enqueue work, and return status or receipts.",
  },
  {
    title: "Artifact IDs matter",
    body: "Circuit ID, model hash, quantization bits, tokenizer version, proof blob path, and verification key ID should all be attributable. If a proof fails after rollout, another engineer should know which exact artifact drifted.",
  },
  {
    title: "Analytics and inference share the same discipline",
    body: "Whether the workload is one ML model, one tabular analytics graph, or one partial LLM step, the same rules apply: canonical inputs, versioned artifacts, and thin verifier boundaries.",
  },
]

const llmChallengeCards = [
  {
    title: "Tokenization is part of the contract",
    body: "If the tokenizer, special-token handling, or truncation rule changes, the proof no longer describes the same inference job. Version tokenizer policy explicitly.",
  },
  {
    title: "Attention and sequence length are expensive",
    body: "Long context windows and attention-heavy workloads multiply proving cost quickly. In practice, teams often prove smaller subgraphs, bounded windows, or specific scoring steps rather than full open-ended generation.",
  },
  {
    title: "Numerical precision is not free",
    body: "Range checks, fixed-point encodings, and quantized operators may be required to keep the proof system practical. That means reproducibility and numerical drift become part of the API story.",
  },
  {
    title: "Batching changes proof economics",
    body: "Batching can improve accelerator utilization and artifact reuse, but it also changes queueing, memory spikes, and replay size. Measure the real lane, not only one isolated kernel.",
  },
  {
    title: "Deterministic decoding is easier to reason about",
    body: "Open-ended sampling or temperature-based generation adds more sources of nondeterminism and policy drift. Proof-backed systems often start from deterministic or tightly bounded inference subproblems.",
  },
]

const gpuAwareCards = [
  {
    title: "Acceleration opportunities",
    body: "Witness preprocessing, proving kernels, and some model-evaluation stages may benefit from GPU lanes when the backend and batch shape justify it.",
  },
  {
    title: "Host-device transfer still counts",
    body: "Proof systems with GPU backends still pay host-device staging, queue wait, and synchronization cost. A fast proving kernel can still lose the product decision if copies dominate.",
  },
  {
    title: "Failure modes are systems failures",
    body: "GPU OOM, driver reset, queue saturation, or mixed CPU/GPU artifact mismatches are operational incidents, not merely math problems. Keep fallback and retry rules explicit.",
  },
  {
    title: "Measurement comes before claims",
    body: "Treat GPU use as workload-dependent. Measure witness time, prove time, transfer time, and queue wait before declaring the accelerator path superior.",
  },
]

const integrationCards = [
  {
    title: "CLI and generated artifact boundary",
    body: "Rust often orchestrates CLI tools, generated files, or external runtimes rather than calling one stable library API directly. Keep process launches, stderr capture, and artifact manifests reviewable.",
  },
  {
    title: "Service and queue boundary",
    body: "The API layer should accept requests, normalize inputs, resolve artifact versions, and enqueue one owned proving job. It should not hold the user open for heavyweight proving by default.",
  },
  {
    title: "Verifier boundary",
    body: "The verifier service should accept public claims, proof artifact references or bytes, and version metadata only. Witness paths and private inputs should remain proving-side custody.",
  },
  {
    title: "Storage boundary",
    body: "Store proof blobs, verifier metadata, model or circuit manifests, and optionally public result commitments. Be deliberate about whether witness files are ephemeral or auditable and who may read them.",
  },
]

const trustCards = [
  {
    title: "What computation verification means",
    body: "A successful proof means the verified computation was followed with respect to the chosen graph, public inputs, and proving system assumptions. It does not prove model quality, fairness, safety, or truthfulness.",
  },
  {
    title: "Privacy is only as good as the public boundary",
    body: "Public claims, metadata, request timing, artifact sizes, and logs can still leak meaningful information. Keep the zero-knowledge claim precise and narrow.",
  },
  {
    title: "Reproducibility is part of correctness",
    body: "Tokenizer version, graph export, quantization policy, public input ordering, and transcript domain all belong to the compatibility story. A prover and verifier that disagree on any of them are simply different systems.",
  },
  {
    title: "Artifact integrity matters",
    body: "Version proof artifacts, circuit IDs, verification keys, and manifests together. A correct proof under the wrong verifier artifact is still an integration failure.",
  },
]

const profilingCards = [
  {
    title: "Profile the full proving lane",
    body: "Measure queue wait, witness generation, proving, verification, artifact serialization, and storage or publish time separately. End-to-end latency is layered here too.",
  },
  {
    title: "Witness generation can dominate",
    body: "Canonicalization, tokenization, commitment building, or model export prep can be hotter than the proof engine itself. Do not profile only the prover binary and call the story complete.",
  },
  {
    title: "Verification is smaller, but still observable",
    body: "Count verification failures, proof size, verifier latency, and version mismatches. The small lane still needs real SLOs and error budgets.",
  },
  {
    title: "Hardware lanes need their own telemetry",
    body: "For GPU-backed proving, track transfer bytes, queue age, saturation, fallback rate, and job failure class. Otherwise the accelerator becomes a black box inside the incident.",
  },
]

const productizingCards = [
  {
    title: "APIs",
    body: "Expose clear submit, status, and verify surfaces. Make long-running proof generation look like a job system with receipts and artifact IDs, not like a synchronous toy endpoint.",
  },
  {
    title: "Job orchestration",
    body: "Bound proving queues, separate CPU and GPU lanes where useful, and keep retries explicit. Invalid proofs, model-version mismatches, and transient infrastructure failures are different events.",
  },
  {
    title: "Artifact versioning",
    body: "Model hash, circuit ID, verifier key ID, quantization manifest, tokenizer version, and proof artifact path should all move together in one manifest or registry record.",
  },
  {
    title: "Observability",
    body: "Metrics should cover queue age, witness_ms, prove_ms, verify_ms, artifact_bytes, accelerator fallback rate, and verification failure rate. Traces should link submitter, worker, artifact store, and verifier.",
  },
  {
    title: "Caveat about scale",
    body: "Full LLM-scale proving is often too expensive for naive designs. Production systems frequently prove bounded subgraphs, deterministic slices, or audit-oriented outputs instead of unconstrained end-to-end generation.",
  },
]

const productionPatterns = [
  "Keep public claims, witness material, proof blobs, and verifier requests as separate Rust types.",
  "Treat EZKL-style compilation, quantization, witness generation, and proving as explicit stages with distinct owners and caches.",
  "Route heavyweight proving jobs through bounded queues and specialized worker lanes, not directly through request handlers.",
  "Version tokenizer policy, graph or circuit ID, quantization config, and verifier key metadata together so mixed deployments stay attributable.",
  "Measure witness, prove, verify, transfer, and queue time separately before changing hardware lanes or product promises.",
  "Remember the trust boundary: computation verification is not the same thing as model safety, model quality, or output truth.",
]

const pitfalls = [
  "Inlining proof generation into low-latency request paths and discovering too late that witness generation or proving dominates p99 latency.",
  "Treating tokenizer, quantization, or graph export changes as harmless refactors when they actually changed the proof boundary.",
  "Sending witness material, raw prompt data, or overly revealing metadata through verifier or audit surfaces unnecessarily.",
  "Claiming GPU acceleration is a win without measuring host-device copies, queue age, or fallback behavior.",
  "Assuming verifiable inference automatically proves fairness, safety, alignment, or factuality. It does not.",
  "Keeping artifact versioning vague enough that proof failures, verifier mismatches, and mixed rollouts become operational mysteries.",
]

const summaryPoints = [
  "ZKML and verifiable inference are artifact pipelines: graph export, quantization, witness generation, proof, verification, and manifest versioning.",
  "LLM-specific proving is constrained by tokenization, attention cost, numerical precision, batching, and proof economics.",
  "GPU-aware ZKML should be evaluated from measured queue, transfer, and proving cost, not from accelerator optimism.",
  "Rust adds the most value at the boundaries: typed job requests, thin verifier surfaces, safe process or FFI wrappers, queue discipline, and artifact custody.",
  "Computation verification proves the chosen computation under the chosen artifacts. It does not prove model quality, fairness, safety, or truthfulness.",
]

export function PageCh53EzklVerifiableLlmInferenceGpuZkml() {
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

  const pageIndex = getPageIndexById("ch53-ezkl-verifiable-llm-inference-gpu-zkml")
  const chapter37PageIndex = getPageIndexById("ch37-cuda-and-gpu-acceleration")
  const chapter43PageIndex = getPageIndexById("ch43-observability")
  const chapter47PageIndex = getPageIndexById("ch47-grpc-services-with-protobuf-and-service-api-codegen")
  const chapter51PageIndex = getPageIndexById("ch51-zero-knowledge-proofs-rust-engineers")
  const chapter52PageIndex = getPageIndexById("ch52-zokrates-workflows-ethereum-verifiers")
  const exercisesPageIndex = getPageIndexById("ch53-ezkl-verifiable-llm-inference-gpu-zkml-exercises")
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
          Chapter 53 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Verifiable ML inference needs model artifacts, input commitments, proving capacity, accelerator budgets, and
          verifier integration. This chapter covers EZKL-style ZKML pipelines as production service architecture.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 37, 43, 47, 51, and 52</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 37 covered GPU cost models and safe host-side wrappers. Chapter 43 covered observability for
                heavy asynchronous systems. Chapter 47 covered typed service and transport boundaries. Chapter 51 covered
                statements, witnesses, transcripts, and proof artifacts. Chapter 52 covered proof workflow orchestration
                and verifier artifact custody. This chapter applies those ideas to verifiable ML and LLM-serving
                workflows.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter37PageIndex)}>
                Chapter 37
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter43PageIndex)}>
                Chapter 43
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter47PageIndex)}>
                Chapter 47
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter51PageIndex)}>
                Chapter 51
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter52PageIndex)}>
                Chapter 52
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Opening scenario</h3>
          <p className="text-sm text-muted-foreground leading-6">
            A multi-tenant inference gateway must provide audit evidence that a published model artifact and inference
            policy produced a result while private prompts and intermediate state remain restricted. The business
            requirement is an artifact pipeline with versioned tokenization, quantization, witness custody, bounded proving
            lanes, verifier APIs, and resource telemetry.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">Rust service topology sketch</h4>
            </div>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{architectureSketch}</code>
            </pre>
          </div>
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
              Verifiable inference proves a computation claim under chosen artifacts. It does{" "}
              <strong>not</strong> automatically prove that the model is truthful, fair, safe, aligned, or even useful.
            </p>
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
              ZKML mental model: model graph, quantization, witnesses, proofs, verification, and reproducibility
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {zkmlMentalModelCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              EZKL workflow for verifiable AI and analytics at a senior-engineer level
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {ezklWorkflowCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              LLM-specific challenges: model size, tokenization, attention, numerical precision, batching, and proof cost
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {llmChallengeCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              GPU-aware execution: acceleration opportunities, host-device transfer costs, and failure modes
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {gpuAwareCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                GPU usage in ZKML should stay measurement-driven. The same proof backend may shift from CPU-favorable to
                GPU-favorable or back again as batch size, witness shape, and artifact transfer cost change.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Rust integration boundaries around CLI tools, generated artifacts, services, and queues
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {integrationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Privacy, correctness, and trust assumptions for verifiable inference
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {trustCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Profiling proof generation and verification latency
            </h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {profilingCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Productizing ZKML: APIs, job orchestration, artifact versioning, and observability
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {productizingCards.map((card) => (
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
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <TriangleAlert className="h-5 w-5 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
                The most expensive ZKML mistake is often contract drift: one tokenizer change, one quantization tweak,
                one graph export difference, or one verifier-key mismatch that was never treated as a versioned systems
                boundary.
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
                  Example 1: keep public claims, witness material, and verification requests separate
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The main lesson is boundary honesty. The verifier-facing request carries the public claim and proof
                  artifact only. Witness material remains proving-side custody.
                </p>
              </div>
              {codes.zkml_verification_boundary_types !== DEFAULT_CODES.zkml_verification_boundary_types && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("zkml_verification_boundary_types")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.zkml_verification_boundary_types}
              onChange={(newCode) => updateCode("zkml_verification_boundary_types", newCode)}
              onRun={() => runCode("zkml_verification_boundary_types")}
              output={outputs.zkml_verification_boundary_types ?? null}
              isRunning={isRunning === "zkml_verification_boundary_types"}
              filename="verification_boundary_types.rs"
              expectedOutput={"model = llm-int8:v3\npublic tokens = 128\nproof bytes = 2048\nwitness kept private = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.zkml_verification_boundary_types}
              onRevert={() => resetCode("zkml_verification_boundary_types")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Public claim</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Model ID, quantization choice, and public token count are verifier-facing contract fields here.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Witness</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Prompt tokens and masks stay proving-side. If they leak into verification DTOs, the boundary already widened.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Artifact IDs</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Circuit and verifier key identifiers make mixed deployments and failures attributable.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Operational fit</div>
                <p className="text-xs text-muted-foreground leading-5">
                  This is the shape to keep whether the prover is a local binary, a GPU lane, or an external worker service.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: route heavyweight proving through one queue and profile the slow stage explicitly
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The route, dominant stage, and end-to-end timing are all explicit. That is a more production-honest
                  starting point than “call prove() somewhere inside the handler.”
                </p>
              </div>
              {codes.zkml_proving_queue_profile !== DEFAULT_CODES.zkml_proving_queue_profile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("zkml_proving_queue_profile")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.zkml_proving_queue_profile}
              onChange={(newCode) => updateCode("zkml_proving_queue_profile", newCode)}
              onRun={() => runCode("zkml_proving_queue_profile")}
              output={outputs.zkml_proving_queue_profile ?? null}
              isRunning={isRunning === "zkml_proving_queue_profile"}
              filename="proving_queue_profile.rs"
              expectedOutput={"route = zkml.gpu\ndominant = prove\ne2e ms = 1880\nartifact = model-sha256:abc123"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.zkml_proving_queue_profile}
              onRevert={() => resetCode("zkml_proving_queue_profile")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Queue lane</div>
                <p className="text-xs text-muted-foreground leading-5">
                  GPU preference becomes one routing policy, not one invisible local branch inside business logic.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Dominant stage</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Prove time is the largest contributor here, but witness and transfer are still material and measurable.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Artifact traceability</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The job carries one artifact ID so proof results can be tied back to one exact model snapshot.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Scaling warning</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Large LLM proofs often need narrower subgraphs or different product promises than small analytics proofs do.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch53_ezkl_verifiable_llm_inference_gpu_zkml/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to classify public versus private inference material, design Rust service
            boundaries around EZKL-style proving jobs, profile a GPU-backed ZKML lane, and reason about artifact
            reproducibility under rollout pressure.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 53 Exercises
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

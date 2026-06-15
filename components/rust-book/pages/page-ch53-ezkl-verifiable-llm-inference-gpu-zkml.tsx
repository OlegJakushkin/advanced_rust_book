"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Network, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"

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
    body: "The operational unit is not a model call. It is a versioned graph export, a tokenization policy, a quantization manifest, witness material, a proof artifact, and a verification request that all have to line up byte-for-byte. If any one of them drifts, the proof either fails to generate or verifies against the wrong claim. You are operating a pipeline of frozen inputs, not invoking a function.",
  },
  {
    title: "Proving and verifying are wildly asymmetric.",
    body: "Verification is the cheap lane: small inputs, milliseconds, embeddable anywhere. Witness generation and proof creation are the heavy lane: seconds to minutes, large memory, sometimes a pinned accelerator. Design accordingly. The verifier can sit on the request path, but proving belongs in a bounded worker pool with admission control, never inline behind a user's spinner.",
  },
  {
    title: "GPU acceleration is conditional, not a given.",
    body: "Some stages benefit from accelerators and some do not, and the same backend can flip from CPU-favorable to GPU-favorable as batch size and witness shape change. The honest question is always where wall time actually went: host-to-device copies, witness construction, proving kernels, artifact serialization, or plain queue wait. Measure first, then claim.",
  },
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "You already think in terms of build pipelines and toolchains, so port that instinct: the proof flow is closer to a compiler that lowers a model graph into a circuit than to a single inference call. The shift is that Rust makes the artifacts of that pipeline first-class. Circuit IDs, witness buffers, and proof blobs become owned values with lifetimes, not loose files you remember to clean up by convention.",
  },
  {
    title: "C# background",
    body: "There is no managed runtime, reflection layer, or single framework object that quietly stitches the workflow together for you. The mental shift is to stop looking for the one orchestrating class and instead model each stage as its own typed boundary. Public claims, witness inputs, proof artifacts, and verifier requests are deliberately different types so the compiler stops you from passing private material where only public data belongs.",
  },
  {
    title: "Go background",
    body: "Your service instinct transfers well, but a proving lane is not a cheap goroutine fan-out. Each job can pin a GPU, hold gigabytes of witness data, and run for seconds, so the trap is treating proving like a lightweight handler. Think bounded worker pool with admission control. Queue age, artifact size, and retry classification matter as much as the cryptography.",
  },
  {
    title: "Python background",
    body: "This is where the largest mental shift lives. In Python ML the model object, tokenizer, and numpy arrays float around as mutable, dynamically typed values. ZKML reverses that: the tokenizer version, quantization scheme, and graph export are frozen protocol inputs, and a float that drifts by one ULP is a different computation the verifier will reject. Rust pushes you to pin every one of those as an explicit, versioned, typed artifact rather than an incidental runtime detail.",
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
          Verifiable inference lets a server prove it ran a specific model on specific inputs, so a third party can check
          the result without rerunning the model or seeing the private data. Doing that for an LLM, on a GPU, in
          production, turns into an artifact pipeline: frozen model graphs, input commitments, witness generation, proving
          capacity, accelerator budgets, and a thin verifier. This chapter treats EZKL-style ZKML not as a math demo but as
          a service architecture you have to own and operate.
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
            You run a multi-tenant inference gateway. A regulated customer asks a fair question: how do they know the model
            you advertised, with the inference policy you published, is actually the model that produced their result? They
            cannot rerun it because they do not have the weights, and you cannot hand them the private prompts of other
            tenants. Verifiable inference resolves the standoff. The server attaches a cryptographic proof that a named
            computation, over committed public inputs, produced the claimed output, and the customer checks that proof in
            milliseconds without seeing anything private.
          </p>
          <p className="text-sm text-muted-foreground leading-6 mt-3">
            That single product promise expands into a surprising amount of infrastructure. You need a frozen model graph,
            a versioned tokenization and quantization policy, a witness builder that assembles the private execution trace,
            bounded proving lanes that may reach for a GPU, a small verifier API, and telemetry across every stage. The
            rest of this chapter walks that pipeline. Before the prose, here is the shape of the request as it moves from
            an HTTP submitter all the way to an audit log.
          </p>

          <div className="mt-4">
            <MermaidDiagram
              chart={`flowchart TD\n  Sub[HTTP / gRPC submit] --> Auth[auth + tokenizer version]\n  Auth --> Manifest[artifact manifest lookup]\n  Manifest --> Queue[(zkml job queue)]\n  Queue --> Witness[witness builder]\n  Witness --> Prover[GPU prover lane]\n  Prover --> ProofStore[(proof artifact store)]\n  ProofStore --> Verifier[verifier API]\n  Verifier --> Result[(result + audit log)]`}
              caption="The heavy lane (witness, prover) sits behind a queue; the verifier on the right is the small, fast lane."
            />
          </div>

          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Network className="h-5 w-5 text-primary" />
              <h4 className="font-semibold text-foreground">The same topology as a service sketch</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Read the diagram top to bottom in code form. The indentation shows which stores and manifests each stage
              reaches into. The submit edge and the verifier API are deliberately thin; everything expensive hides behind
              the queue.
            </p>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{architectureSketch}</code>
            </pre>
          </div>
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-sm text-amber-900 dark:text-amber-200 leading-6">
              Hold onto the one boundary that beginners always blur: verifiable inference proves a computation claim under
              chosen artifacts. It does{" "}
              <strong>not</strong> automatically prove that the model is truthful, fair, safe, aligned, or even useful. A
              perfectly valid proof can wrap a terrible answer.
            </p>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            If you remember three things from this chapter, make them these. ZKML is an artifact pipeline before it is a
            model call, the cost is wildly asymmetric between proving and verifying, and any claim about GPU acceleration
            has to be earned with a measurement. The three cards below unpack each one. They are the lens you should hold
            while reading every later section, because almost every production mistake in this space is really a violation
            of one of them.
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
            <h3 className="text-lg font-semibold text-foreground">Core concepts</h3>
          </div>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              The five stages every ZKML pipeline shares
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              Strip away the tooling and every verifiable-inference flow is the same five steps in the same order. You
              freeze the computation into a graph, you pin a numeric representation so the proof system can reason about
              it, you build the witness from the actual run, you prove, and you verify. Each arrow in the diagram below is
              a place where a version mismatch can silently change what the proof means, which is why the cards that follow
              treat each stage as a contract rather than a convenience.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Graph[freeze model graph] --> Quant[quantize / calibrate]\n  Quant --> Witness[generate witness]\n  Witness --> Prove[prove]\n  Prove --> Verify[verify]\n  Verify -->|public claim only| Caller[caller]\n  Witness -.private, never leaves prover.-x Caller`}
              caption="One direction, five stages. The witness is the only stage that must never cross to the verifier side."
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
              Where EZKL fits, and what to keep out of the request path
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              EZKL is one mature option for compiling a model graph into a proof-oriented circuit and driving the
              export-quantize-witness-prove-verify cycle. Its exact commands and file layouts change between releases, so do
              not memorize them. Memorize the boundary instead: compilation, trusted setup, and heavy proof generation
              belong in CI, admin tooling, or dedicated workers, while the API edge does almost nothing but select
              artifacts, enqueue work, and hand back a receipt. The four cards spell out what that discipline buys you.
            </p>
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
              Why LLMs are the hard case
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Everything above applies to any model, but LLMs stress every part of it at once. The tokenizer becomes part
              of the signed contract, attention makes proving cost scale brutally with sequence length, fixed-point
              encoding has to stand in for the floats you took for granted, batching reshapes both your accelerator math
              and your replay size, and open-ended sampling adds nondeterminism a proof cannot tolerate. The practical
              consequence, which the last card states plainly, is that mature systems rarely prove free-form generation.
              They prove a bounded, deterministic slice and are honest about it.
            </p>
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
              GPU-aware execution: opportunities, transfer costs, and failure modes
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The temptation is to assume the GPU is always faster and move on. Chapter 37 already warned against that, and
              ZKML makes the warning sharper because the proving kernel is only one slice of wall time. A blazing kernel
              still loses if host-to-device copies, queue wait, or artifact serialization dominate, and a GPU lane brings
              its own incident class: out-of-memory, driver resets, and CPU/GPU artifact mismatches. The cards below frame
              the accelerator as a workload-dependent option you justify with telemetry, not a default.
            </p>
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
              The four boundaries Rust should keep separate
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              This is where Rust earns its place. The job is mostly about who is allowed to hold what, and the type system
              is the cheapest enforcement you will ever get. Watch the witness in the diagram: it is born in the prover lane
              and must never appear on the verifier edge. The service layer takes a request and hands off one owned job; the
              prover keeps private custody of the witness; the verifier sees only public claims plus a proof reference; and
              storage decides, deliberately, whether witness files are ephemeral or auditable.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Client[client request] --> API[service: normalize + resolve version]\n  API -->|owned job| Queue[(job queue)]\n  Queue --> Prover[prover: builds + holds witness]\n  Prover -->|public claim + proof ref| Verifier[verifier API]\n  Prover -->|proof blob| Store[(artifact store)]\n  Verifier --> Client\n  Prover -. witness stays here .- Prover`}
              caption="Ownership handoff: the witness never crosses to the verifier or the client side."
            />
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
              What a proof actually promises, and what it does not
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              It is worth being precise about the guarantee, because the marketing around zero-knowledge tends to oversell
              it. A passing proof says the chosen computation was followed over the chosen public inputs under the chosen
              proving assumptions. It says nothing about whether the model is good, and the privacy it offers is only as
              tight as your public boundary: timing, artifact sizes, and metadata can all leak. Reproducibility belongs in
              this section too, because a prover and verifier that disagree on any frozen input are simply two different
              systems that happen to share a name.
            </p>
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
              Profiling the whole lane, not just the prover binary
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              When you go to optimize, the prover binary is the obvious suspect and frequently the wrong one. Witness
              generation, with its canonicalization and commitment building, can be hotter than the proof engine itself, and
              queue wait can dwarf both under load. Measure each stage separately, give the small verifier lane its own SLOs
              rather than waving it off as cheap, and give any GPU lane its own telemetry so the accelerator does not become
              a black box the moment an incident starts.
            </p>
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
              Turning the pipeline into a product you can operate
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Everything converges here. A shippable ZKML service exposes submit, status, and verify surfaces that behave
              like a job system with receipts, not a synchronous toy endpoint; it bounds its proving queues and separates
              CPU from GPU lanes; it moves model hash, circuit ID, verifier key, quantization manifest, and tokenizer
              version together as one record; and it emits the metrics that let you reason about all of the above. The final
              card is the reality check: full LLM-scale proving is usually too expensive to ship naively, so most production
              systems prove bounded subgraphs or audit-oriented outputs instead.
            </p>
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
            <h4 className="font-semibold text-foreground mb-3">How this lands depending on where you came from</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The hard part of ZKML is rarely the cryptography itself; it is unlearning the habits your previous language
              encouraged. Each background brings a different instinct to the table, and each instinct trips on a different
              part of this pipeline. Find the card that matches your history and notice the specific mental shift it asks
              for.
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
          <p className="text-sm text-muted-foreground leading-6">
            These are the habits that separate a demo from a service you can keep running. None of them are exotic; they are
            the same discipline applied at every boundary the diagrams above traced. Treat each as a default you deviate
            from only with a reason.
          </p>
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
          <p className="text-sm text-muted-foreground leading-6">
            Most of these are the mental-model violations made flesh. They are easy to commit because each one looks like a
            harmless shortcut at the time: inline the prover just this once, treat a tokenizer bump as a refactor, assume
            the GPU helped. The callout at the end names the single most expensive one.
          </p>
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
          <p className="text-sm text-muted-foreground leading-6">
            Two runnable examples make the abstractions concrete. The first shows how to encode the public/private boundary
            in the type system so a leak becomes a compile error rather than an audit finding. The second shows a proving
            job routed through a queue and profiled by stage. Read the short orientation and diagram above each listing
            first, then run it and change a value to see the behavior move.
          </p>

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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: notice that the witness fields and the public-claim fields live in separate structs, and the
              verification request only ever holds the public type plus a proof reference. The diagram traces which field
              is allowed to reach the verifier. If you tried to put a prompt token into the verification request, it simply
              would not type-check.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Inputs[inference inputs] --> Witness[Witness struct: prompt tokens, masks]\n  Inputs --> Claim[PublicClaim: model id, quant, token count]\n  Witness -->|stays prover-side| Prove[prove]\n  Claim --> VReq[VerificationRequest]\n  Prove -->|proof bytes| VReq\n  VReq --> Verifier[verifier]`}
              caption="Two structs in, one verification request out. The witness has no path to the verifier."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-3">
              What to look at: the job picks a lane by routing policy, runs through the witness, prove, and transfer stages
              while recording each one, then reports which stage dominated and the end-to-end total. The diagram is that
              control flow. The point of the example is that the dominant stage and the artifact ID are first-class outputs,
              not values you have to reconstruct from logs after an incident.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Submit[submit job + artifact id] --> Route{lane?}\n  Route -->|gpu preferred| Gpu[zkml.gpu lane]\n  Route -->|fallback| Cpu[zkml.cpu lane]\n  Gpu --> Stages[record witness / prove / transfer]\n  Cpu --> Stages\n  Stages --> Pick[pick dominant stage]\n  Pick --> Report[report route, dominant, e2e ms, artifact]`}
              caption="Routing, per-stage timing, and a dominant-stage verdict are explicit, not hidden inside a handler."
            />
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

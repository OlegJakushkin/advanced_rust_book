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
    title: "Classify which parts of an LLM inference workflow are public, private, deterministic, or artifact-bound",
    objective:
      "Practice separating verifier-visible claims from witness-only material and from versioned artifacts before the first proving job is queued.",
    starterPrompt:
      "Classify one LLM scoring workflow with a tokenizer version, prompt token IDs, attention mask, quantization bits, output commitment, proof blob, verifier key ID, and a public model hash.",
    prompts: [
      "Which fields are public inputs the verifier is expected to see?",
      "Which fields are witness-only and should stay on the proving side?",
      "Which fields are artifacts that must be versioned even if they are not secret?",
      "Which parts must be deterministic for the workflow to stay reproducible across prover and verifier deployments?",
    ],
    acceptanceCriteria: [
      "You separate public claims from witness material clearly.",
      "You identify at least two artifact-bound fields such as model hash, verifier key ID, or tokenizer version.",
      "You name at least one reproducibility consequence of getting the classification wrong.",
    ],
    hints: [
      "Ask what the verifier is supposed to learn, what the prover must know, and what both sides must agree on.",
      "Artifact-bound does not automatically mean secret; it often means versioned and attributable.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Design a Rust service boundary around an EZKL-style proving job",
    objective:
      "Read one service workflow and decide where HTTP or gRPC transport ends, where the proving queue begins, and where the verifier lane becomes witness-free.",
    starterPrompt:
      "A service currently accepts an API request, tokenizes input inline, generates a witness inline, proves inline, verifies inline, and stores prompt text together with the proof blob in one response record.",
    prompts: [
      "Which steps belong in the submitter edge versus a proving worker lane?",
      "Which boundary should first own an artifact manifest instead of raw request-local state?",
      "Which data should never appear in the verifier-facing request type?",
      "Which metric would tell you the inline design is already hurting the API edge?",
    ],
    acceptanceCriteria: [
      "You move at least one heavyweight step out of the request handler.",
      "You identify at least one verifier boundary that should be witness-free.",
      "You place artifact versioning or manifest lookup at one explicit boundary.",
      "You mention at least one latency or queue signal that the repaired design should expose.",
    ],
    hints: [
      "The proving lane should look like a worker boundary, not like a convenience helper.",
      "If the verifier sees prompt tokens or witness paths, the boundary is already too wide.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement separate proving and verification request types",
    objective:
      "Build small Rust types that force the proving request and verification request to stay distinct.",
    starterPrompt:
      "Design one `ProvingJob`, one `ProofArtifact`, and one `VerificationJob` for a workflow that proves a public output commitment was produced from one model artifact without revealing the raw prompt.",
    prompts: [
      "Keep witness fields only on the proving side.",
      "Keep verifier fields limited to public claims and proof artifact references.",
      "Add one circuit or model version field.",
      "Name at least one artifact ID explicitly instead of hiding it in a path string only.",
    ],
    acceptanceCriteria: [
      "The proving and verification types are structurally distinct.",
      "The verifier-facing type does not require witness-only data.",
      "You include one version or artifact-identity field explicitly.",
      "The design is small enough that another engineer could review it quickly.",
    ],
    hints: [
      "If one struct does every job, the boundary is probably still vague.",
      "Versioning belongs in the type shape early, not after the first migration pain.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair numerical reproducibility drift before the prover and verifier split across services",
    objective:
      "Fix the class of bugs where prover and verifier disagree because preprocessing or transcript policy drifted, not because the proof backend is broken.",
    starterPrompt:
      "One deployment changed quantization bits, another changed tokenizer special-token handling, and a third reordered public inputs in one manifest serializer. Cross-service verification now fails intermittently.",
    prompts: [
      "Which parts of the workflow need canonical ordering or stable field layout?",
      "Which fields belong in the artifact manifest so a mismatch is visible before prove or verify happens?",
      "Why is quantization or tokenization drift a protocol break rather than just a model-tuning difference?",
      "Which CI or contract test should fail before rollout next time?",
    ],
    acceptanceCriteria: [
      "You identify at least one canonical serialization repair and one preprocessing-version repair.",
      "You explain why the issue is a protocol-compatibility bug, not only a runtime bug.",
      "You propose at least one CI or contract gate for drift detection.",
    ],
    hints: [
      "If both sides compute a different graph or public input ordering, the proof boundary changed.",
      "A deterministic artifact manifest is often the simplest first repair.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Profile a hypothetical GPU-backed ZKML pipeline and identify the real bottleneck",
    objective:
      "Separate transfer-bound, witness-bound, prove-bound, verify-bound, and queue-bound cases clearly before changing hardware or code.",
    starterPrompt:
      "A window summary shows queue wait 700 ms, witness generation 260 ms, proof generation 1100 ms, verification 35 ms, and GPU transfer 220 ms for one batch path.",
    prompts: [
      "Which category dominates wall time right now?",
      "Which rewrite is probably premature because the bottleneck is elsewhere?",
      "What next measurement would you take inside the dominant category?",
      "Which signals would prove the repair moved the real bottleneck instead of only changing one micro-metric?",
    ],
    acceptanceCriteria: [
      "You identify the current dominant latency layer correctly.",
      "You reject at least one likely but wrong optimization target.",
      "You propose one deeper measurement and at least one before-and-after validation metric.",
      "You treat GPU usage as workload-dependent rather than automatically correct.",
    ],
    hints: [
      "If queue wait is already high, faster kernels may not move the user-visible story enough.",
      "Keep witness, prove, verify, and transfer as separate buckets.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Productize ZKML with APIs, job orchestration, artifact versioning, and observability",
    objective:
      "Turn one proof-backed inference prototype into an operable service design with bounded queues and reviewable artifact custody.",
    starterPrompt:
      "You are shipping a service with submit, status, and verify endpoints; CPU and GPU proving lanes; one artifact registry; and one downstream audit sink. Mixed model versions and canary rollout are expected.",
    prompts: [
      "Which artifacts should be versioned and content-addressed: model hash, circuit ID, quantization manifest, verifier key ID, proof blob, tokenizer manifest?",
      "Which queues or worker pools deserve separate budgets?",
      "Where should fallback from GPU to CPU happen, and how should it be exposed to operators?",
      "Which metrics, traces, and alerts would you require before the service is called production-ready?",
    ],
    acceptanceCriteria: [
      "You name at least three explicit artifacts and one custody or version rule for each class.",
      "You define at least one separate queue or worker-lane budget.",
      "You include one fallback or failure-isolation rule around the GPU lane.",
      "You mention at least three observability hooks such as queue age, proof bytes, verification failures, or fallback rate.",
    ],
    hints: [
      "A good answer makes proving heavy, verification light, and artifacts attributable.",
      "If mixed model versions are expected, treat version lookup as a first-class service concern.",
    ],
  },
]

const reviewQuestions = [
  "Why should verification requests usually stay witness-free?",
  "What makes tokenization, quantization, and public-input ordering protocol concerns instead of private implementation details?",
  "Why is a proving lane usually a queue and capacity problem as much as a cryptography problem?",
  "What does a verifiable inference system prove, and what does it not prove?",
  "Why should GPU-backed proving still be treated as an optional execution lane rather than as the whole architecture?",
]

const workingLoop = [
  "Classify public claims, private witness material, and versioned artifacts first.",
  "Separate submitter, proving, and verifier boundaries second.",
  "Version tokenizer, graph, quantization, and verifier metadata before mixed deployments force it.",
  "Measure queue wait, witness, prove, verify, and transfer separately.",
  "Treat privacy, correctness, and denial-of-service as one joined review, not three unrelated discussions.",
]

export function PageCh53EzklVerifiableLlmInferenceGpuZkmlExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch53-ezkl-verifiable-llm-inference-gpu-zkml-exercises")
  const mainPageIndex = getPageIndexById("ch53-ezkl-verifiable-llm-inference-gpu-zkml")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 53 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice EZKL-style ZKML design the way it survives production review: artifact classification, queue-backed
          proving lanes, witness-free verifier requests, and profiling that keeps GPU claims honest.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a proof-boundary and systems-design review. The strongest answer does not stop at
                “prove the model.” It says which data is public, which stays witness-only, which artifact versions must be
                pinned, which worker lane owns the heavy cost, and how operators would observe the result.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 53
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
                  ZKML drill
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
          title="Runnable lab · Build a verifier request without leaking witness material"
          description={
            <>
              Repair the starter so the proving side can still request the GPU lane, but the verifier-facing request carries
              only proof-path and public-output information. The checker expects the exact output below.
            </>
          }
          filename="gpu_queue_boundary_lab.rs"
          runKey="ch53_ex_gpu_queue_boundary"
          expectedOutput={"prove queue = zkml.gpu\nverify payload = 2\nwitness leaked = false"}
          helperText={
            <>
              Tip: the proving lane and verification lane are different contracts. Keep{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">witness_included</code> false, count the
              public outputs with <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">len()</code>, and copy
              the proof path rather than the witness path into the verifier request.
            </>
          }
          initialCode={`#[derive(Debug, Clone)]
struct ProvingJob {
    model_id: String,
    gpu_requested: bool,
    public_outputs: Vec<String>,
    witness_path: String,
    proof_path: String,
}

#[derive(Debug, Clone)]
struct VerificationJob {
    proof_path: String,
    public_output_count: usize,
    witness_included: bool,
}

fn build_verification_job(job: &ProvingJob) -> VerificationJob {
    VerificationJob {
        proof_path: job.witness_path.clone(),
        public_output_count: 0,
        witness_included: true,
    }
}

fn main() {
    let job = ProvingJob {
        model_id: String::from("llm-int8:v3"),
        gpu_requested: true,
        public_outputs: vec![String::from("token_hash"), String::from("score_hash")],
        witness_path: String::from("artifacts/witness.json"),
        proof_path: String::from("artifacts/proof.pf"),
    };

    let verify = build_verification_job(&job);
    let prove_queue = if job.gpu_requested { "zkml.gpu" } else { "zkml.cpu" };

    println!("prove queue = {}", prove_queue);
    println!("verify payload = {}", verify.public_output_count);
    println!("witness leaked = {}", verify.witness_included);
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
            By the end of this page, you should be able to classify the artifacts in a verifiable inference workflow,
            separate proving from verification in Rust type design, identify the real bottleneck in a GPU-backed ZKML
            path, and defend an operational artifact and queue policy another senior engineer could review quickly.
          </p>
        </section>
      </div>
    </div>
  )
}

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
    title: "Split the ZoKrates workflow into build-time, release-time, and runtime responsibilities",
    objective:
      "Practice assigning each ZoKrates step to the right operational lane instead of letting the whole pipeline collapse into one opaque script.",
    starterPrompt:
      "Classify `compile`, `setup`, `compute-witness`, `generate-proof`, `export-verifier`, and `verify` across build-time, release-time, and runtime boundaries for one proof-backed service.",
    prompts: [
      "Which steps happen once per circuit or release rather than once per request?",
      "Which steps belong in a proving worker instead of a request handler?",
      "Which steps can happen in CI or a controlled admin CLI lane rather than in build.rs?",
      "Which step should stay verifier-side and witness-free?",
    ],
    acceptanceCriteria: [
      "You place compile, setup, witness generation, proof generation, export, and verification in distinct operational lanes.",
      "You identify at least one step that should not run per request.",
      "You explain why verifier input should exclude witness material.",
    ],
    hints: [
      "Start by asking which artifact is expensive and which one is durable.",
      "A good answer treats proof generation like a worker job, not like a tiny helper function.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Review a proof workflow for proof-friendly input modeling",
    objective:
      "Spot the places where transport-shaped data is being pushed into the ZoKrates boundary without enough normalization or commitment discipline (commitments are hash-based digests of the private data).",
    starterPrompt:
      "A Rust API currently forwards raw JSON strings, variable-length lists, and unbounded notes fields directly into a proof step that is supposed to justify only one public total and one public limit.",
    prompts: [
      "Which parts should become canonical numeric inputs before witness generation?",
      "Which large or irregular fields should become commitments or stay witness-only?",
      "Which fields should never become public verifier inputs just because they already existed in the HTTP payload?",
      "Which tests would prove the normalization contract is stable across versions?",
    ],
    acceptanceCriteria: [
      "You identify at least one field that should be normalized in Rust before the ZoKrates step.",
      "You identify at least one field that should remain witness-only or become a commitment.",
      "You mention at least one reproducibility or contract test for the mapping.",
    ],
    hints: [
      "Transport convenience and proof convenience are rarely the same thing.",
      "If the verifier does not need a field, it probably should not become a public input by accident.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Design a versioned artifact manifest for proof generation and verification",
    objective:
      "Build a small Rust-facing manifest that keeps circuit, keys, proof blobs, and verifier contract metadata attributable.",
    starterPrompt:
      "Design one `ArtifactManifest` or equivalent set of Rust types that names a circuit ID, proving key ID, verification key ID, proof path, and verifier contract path or address.",
    prompts: [
      "Keep proving-side and verifying-side metadata distinguishable.",
      "Include one protocol or circuit version field.",
      "Decide which artifact fields are safe to expose to verifier callers and which are proving-only.",
      "Think about retention policy and auditability while naming the fields.",
    ],
    acceptanceCriteria: [
      "Your design names at least four distinct artifacts explicitly.",
      "You include one version or circuit-identity field.",
      "You separate at least one proving-only field from a verifier-facing field.",
      "The resulting type set is small enough for another engineer to review quickly.",
    ],
    hints: [
      "If one struct does every job, the custody model is probably too vague.",
      "Versioning belongs on artifacts early, not after the first migration failure.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a verifier integration that leaks witness or mixes versions",
    objective:
      "Fix the most common production mistakes around verifier requests: witness exposure, wrong key pairing, or wrong contract version.",
    starterPrompt:
      "You inherit a verifier service that stores witness paths next to verifier request DTOs, chooses the verifier contract from a mutable config string at runtime, and sometimes pairs a new proof blob with an older verification key.",
    prompts: [
      "Which fields should disappear from verifier-facing request types immediately?",
      "How should contract address or path selection become versioned and explicit?",
      "Which key or circuit mismatch should fail before any external verifier call is attempted?",
      "Which log or trace fields belong on that failure path?",
    ],
    acceptanceCriteria: [
      "You remove at least one witness-related field from the verifier boundary.",
      "You define one explicit version or key-matching rule.",
      "You identify one preflight validation that should fail before a verifier call or transaction submit happens.",
      "You mention at least one structured field such as circuit ID, key ID, or contract version.",
    ],
    hints: [
      "If the verifier can see the witness path, the boundary is already too wide.",
      "Version mismatch is a contract failure, not a 'maybe verify and see' runtime strategy.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Design reproducibility and negative tests for the proof pipeline",
    objective:
      "Turn proof generation and verification into a testable workflow rather than a one-off manual command sequence.",
    starterPrompt:
      "You want CI confidence that proof generation still works after refactors, and that wrong inputs, wrong versions, or wrong keys fail clearly rather than failing as one generic false result.",
    prompts: [
      "Which artifact versions should be pinned in CI fixtures?",
      "Which negative cases must exist: wrong public inputs, wrong verification key, wrong contract version, or wrong witness?",
      "Where should you use native verification versus Ethereum-oriented verifier tests?",
      "How would you keep the fixtures reproducible and reviewable over time?",
    ],
    acceptanceCriteria: [
      "You define at least two positive and two negative workflow tests.",
      "You separate native verify tests from contract or deploy-path tests.",
      "You mention at least one artifact pinning or manifest rule that improves reproducibility.",
      "You explain how failing cases become attributable rather than generic.",
    ],
    hints: [
      "A fast native verify path is a good first CI gate, but it is not the same as a deploy-path test.",
      "The best negative test is the one that tells you which contract or artifact drifted.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Plan audits, upgrades, and rollout for an Ethereum verifier integration",
    objective:
      "Make trusted setup, verifier deployment, dual-version rollout, and operational ownership explicit before the first circuit upgrade.",
    starterPrompt:
      "You are shipping a proof-backed service whose verifier contract lives in an Ethereum-oriented environment. A circuit update is coming, setup provenance matters, and operators want canary rollout plus rollback.",
    prompts: [
      "Which audit surfaces exist separately: proving scheme assumptions, circuit logic, Rust artifact custody, and Solidity verifier deployment?",
      "How will old and new verifier versions coexist during rollout?",
      "Which artifact or address mapping must be published for operators and downstream consumers?",
      "Which telemetry or failure rates gate promotion or trigger rollback?",
    ],
    acceptanceCriteria: [
      "You name at least three distinct audit or review surfaces.",
      "You describe one mixed-version rollout or dual-verifier strategy.",
      "You include at least one published artifact mapping such as circuit ID to contract address.",
      "You mention at least two rollout signals such as verification failure rate, proving queue age, or contract-submit failure rate.",
    ],
    hints: [
      "An upgrade is rarely just one code deploy. It is usually an artifact and contract migration too.",
      "Keep the rollback story boring enough that another engineer can execute it under pressure.",
    ],
  },
]

const reviewQuestions = [
  "Why should compile and setup usually live in different operational lanes from witness generation and proof generation?",
  "What makes a proof request different from a verifier request in Rust terms?",
  "Why is contract or key version drift often a bigger operational risk than one single failed proof?",
  "What does native verification prove, and what does it not prove about the Ethereum deployment path?",
  "Why should generated verifier contracts still go through normal Solidity review and release discipline?",
  "Where in the pipeline does latency actually accumulate: witness generation, proof generation, or the verifier call, and how should that shape the queue design?",
]

const workingLoop = [
  "State which inputs are public, private, or artifact identifiers first.",
  "Assign each ZoKrates step to build-time, release-time, or runtime explicitly.",
  "Keep verifier-facing request types witness-free.",
  "Version circuit IDs, keys, and verifier contracts together.",
  "Test both happy-path and wrong-version or wrong-key failures before rollout.",
]

const artifactChecklist = [
  "Circuit or program ID is explicit and versioned.",
  "Proving key and verification key identifiers are stored separately.",
  "Witness retention policy is explicit and usually short-lived.",
  "Proof artifact and verifier contract path or address are attributable.",
  "CI exercises both native verify and at least one deployment-facing verifier check.",
]

export function PageCh52ZoKratesWorkflowsAndEthereumVerifiersExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch52-zokrates-workflows-ethereum-verifiers-exercises")
  const mainPageIndex = getPageIndexById("ch52-zokrates-workflows-ethereum-verifiers")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 52 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice ZoKrates and Ethereum verifier integration the way it survives review: split workflow ownership, version
          artifacts deliberately, keep witnesses out of verifier boundaries, and plan upgrades and audits before the first
          mixed deployment.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a workflow and trust-boundary review. The strongest answer does not stop at
                “generate a proof.” It says which stage runs where, which artifacts are versioned, who may see the witness,
                how verifier requests stay small, and how rollout stays reviewable later.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 52
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Artifact checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {artifactChecklist.map((item) => (
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
                  ZoKrates drill
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
              Repair the starter so the verifier-facing request is built from the verifier contract, proof path, and public
              input count only. The witness path exists in the proving artifact bundle but must not be exposed as part of
              the verifier request boundary.
            </>
          }
          filename="verifier_request_boundary.rs"
          runKey="ch52_ex_verifier_request"
          expectedOutput={
            "contract = contracts/AgeCheckVerifier.sol\npublic inputs = 2\nproof path = artifacts/proof.json\nwitness included = false"
          }
          helperText={
            <>
              Tip: clone the verifier contract path, count the public inputs with{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">len()</code>, keep the proof path on the
              request, and make <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">witness_included</code>{" "}
              explicitly false.
            </>
          }
          initialCode={`#[derive(Debug, Clone)]
struct ProofBundle {
    verifier_contract: String,
    public_inputs: Vec<String>,
    proof_path: String,
    witness_path: String,
}

#[derive(Debug, Clone)]
struct VerificationRequest {
    contract: String,
    public_inputs_len: usize,
    proof_path: String,
    witness_included: bool,
}

fn to_verification_request(bundle: &ProofBundle) -> VerificationRequest {
    VerificationRequest {
        contract: String::new(),
        public_inputs_len: 0,
        proof_path: bundle.witness_path.clone(),
        witness_included: true,
    }
}

fn main() {
    let bundle = ProofBundle {
        verifier_contract: String::from("contracts/AgeCheckVerifier.sol"),
        public_inputs: vec![String::from("45"), String::from("50")],
        proof_path: String::from("artifacts/proof.json"),
        witness_path: String::from("artifacts/witness"),
    };

    let request = to_verification_request(&bundle);

    println!("contract = {}", request.contract);
    println!("public inputs = {}", request.public_inputs_len);
    println!("proof path = {}", request.proof_path);
    println!("witness included = {}", request.witness_included);
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
            By the end of this page, you should be able to place each ZoKrates step in the right operational lane, design
            versioned artifact manifests another engineer can audit, keep verifier requests witness-free, and explain how
            upgrades, contract deployment, and proof verification stay safe and reviewable in a real Ethereum-oriented
            system.
          </p>
        </section>
      </div>
    </div>
  )
}

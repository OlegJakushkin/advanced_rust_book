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
    title: "Separate public inputs, private witnesses, and proofs",
    objective:
      "Practice saying which data the verifier may know, which data must stay private, and which artifact is only the proof.",
    starterPrompt:
      "Classify one proof-backed billing flow with a public credit limit, a public committed digest, private line items, and one proof sent to a verifier API.",
    prompts: [
      "Which fields are public inputs the verifier is expected to see?",
      "Which fields are witness-only and should never cross the verification boundary?",
      "Which artifact is the proof, and which artifacts are proving or verification keys?",
      "Which fields would still be safe to log at the verifier boundary, and which would not?",
    ],
    acceptanceCriteria: [
      "You distinguish public statement data from witness data clearly.",
      "You name the proof as a separate artifact instead of treating it like the witness itself.",
      "You identify at least one logging or transport consequence of that separation.",
    ],
    hints: [
      "Ask what the verifier is supposed to learn by design.",
      "If the verifier sees raw private inputs, the system may still be correct but it is no longer zero-knowledge in the intended sense.",
    ],
  },
  {
    number: 2,
    kind: "architecture review",
    title: "Refactor an API workflow so proving and verification are isolated",
    objective:
      "Read one service path and explain why the prover boundary should not look like the verifier boundary.",
    starterPrompt:
      "A request handler currently derives the witness, generates the proof inline, verifies it again locally, and stores both proof and witness in the same outbound record.",
    prompts: [
      "Which steps belong in a proving worker or background lane rather than in the request handler?",
      "Which boundary should receive only statement plus proof artifact?",
      "Which artifact custody mistake makes private witness data too easy to leak or over-retain?",
      "What metric would tell you the inline proving path is already hurting the API edge?",
    ],
    acceptanceCriteria: [
      "You move at least one heavy step out of the request handler.",
      "You separate verifier input from witness input explicitly.",
      "You identify one privacy or retention problem in the original workflow.",
      "You mention at least one latency or queue signal that the repaired design should expose.",
    ],
    hints: [
      "The verifier should not need the witness.",
      "The fact that the server can verify locally does not mean the same process should always do both jobs inline.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Define typed proving and verification requests",
    objective:
      "Design Rust types that force the prover and verifier boundaries to stay honest.",
    starterPrompt:
      "Create one `ProofRequest`, one `VerificationRequest`, and one `ProofArtifact` shape for a service that proves a public total is below a public limit without revealing the hidden addends.",
    prompts: [
      "Keep witness fields only in the proving request.",
      "Keep verifier-facing types free of witness material.",
      "Carry a circuit ID or protocol version explicitly.",
      "Add one place for public statement fields such as total and limit.",
    ],
    acceptanceCriteria: [
      "The proving and verification structs are distinct.",
      "The verification path does not require witness-only fields.",
      "You include one version or circuit-identity field.",
      "The design is small enough that another engineer could review it quickly.",
    ],
    hints: [
      "If one struct is doing every job, the boundary is probably too wide.",
      "Versioning belongs on artifacts and requests early, not only after the first migration pain.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair transcript and serialization bugs before proofs go cross-service",
    objective:
      "Fix the integration mistakes that let a prover and verifier disagree even though both local components 'work.'",
    starterPrompt:
      "One service serializes public inputs through a map with unstable key order, another service changed the transcript domain string during a refactor, and verification now fails intermittently across deployments.",
    prompts: [
      "Which part of the system needs canonical ordering or stable field layout?",
      "Why is a changed transcript domain string a protocol break rather than a cosmetic edit?",
      "Which CI or contract test should fail before rollout next time?",
      "What artifact should carry the protocol or circuit version explicitly?",
    ],
    acceptanceCriteria: [
      "You identify at least one canonical serialization repair and one domain-separation repair.",
      "You explain why the issue is a protocol-compatibility bug rather than only a runtime bug.",
      "You propose at least one drift-prevention check in CI or contract tests.",
    ],
    hints: [
      "A prover and verifier that hash the same fields in different order are not interoperable.",
      "Domain strings are part of the transcript contract, not a free rename surface.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Threat-model a proof-backed API or game mechanic",
    objective:
      "Make privacy, integrity, denial-of-service, and operator risks explicit before the system ships.",
    starterPrompt:
      "Design a threat model for one proof-backed API or game mechanic where clients submit proofs to unlock rewards or verify hidden state transitions.",
    prompts: [
      "What must remain private, and what can still leak through public inputs or metadata?",
      "Which attack path is resource exhaustion: giant artifacts, repeated invalid proofs, or expensive witness requests?",
      "Which trust assumption would you call out explicitly: setup artifacts, circuit correctness, key distribution, or transcript policy?",
      "What telemetry would let operators see an attack or misconfiguration early?",
    ],
    acceptanceCriteria: [
      "You describe at least one privacy risk, one integrity risk, and one denial-of-service risk.",
      "You separate cryptographic assumptions from Rust implementation or deployment assumptions.",
      "You mention at least two observability hooks such as verification failure rate, artifact size, or proving queue age.",
    ],
    hints: [
      "A proof-backed design can still leak metadata or fall over under load.",
      "Threat models are strongest when they include both adversarial and operator-failure cases.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Plan witness generation, artifact custody, and hardware lanes for a proof workflow",
    objective:
      "Turn one abstract proving story into an operable Rust system with explicit artifacts and specialized execution boundaries.",
    starterPrompt:
      "You are integrating a proof workflow that may involve an external circuit DSL or ML proof toolchain, witness files, proving parameters, GPU acceleration, and a lightweight verifier service.",
    prompts: [
      "Where does circuit or model compilation end and witness generation begin?",
      "Which artifacts should be cached, versioned, or content-addressed: circuit ID, proving key, verification key, witness schema, proof blob?",
      "Which stage might justify GPU acceleration, and how would you isolate that boundary from the API edge?",
      "Which rollout or testing rule would you require before several teams depend on the verifier output?",
    ],
    acceptanceCriteria: [
      "You distinguish compiled circuit or model artifacts from witness generation and proof artifacts.",
      "You name at least three explicit artifacts and one versioning or custody rule.",
      "You isolate the heavy proving lane from the lightweight verifier lane.",
      "You mention at least one testing or rollout gate for mixed deployments.",
    ],
    hints: [
      "This is where external ecosystems such as ZoKrates or EZKL still need ordinary systems design.",
      "A good answer makes artifact ownership boring enough that operations and incident response stay possible.",
    ],
  },
]

const reviewQuestions = [
  "Why should witness generation and verification usually live at different service boundaries?",
  "What makes transcript domain separation a protocol rule instead of one local implementation detail?",
  "Why is a proof artifact not the same thing as a witness or proving key?",
  "What does zero knowledge fail to protect if public inputs or metadata are already too revealing?",
  "Why should proof-backed systems still be reviewed for ordinary Rust concerns such as queues, logging, unsafe wrappers, and resource limits?",
]

const workingLoop = [
  "State what is public, what is private, and what is an artifact.",
  "Keep proving, verification, and witness generation in separately reviewable boundaries.",
  "Version transcript policy, public input ordering, and circuit identity explicitly.",
  "Model proving as a bounded worker lane, not as a tiny inline function call.",
  "Threat-model the cryptography and the Rust system separately, then rejoin them in one deployment plan.",
]

const threatModelChecklist = [
  "Privacy leakage through public inputs, metadata, or logs.",
  "Integrity failure through wrong circuit logic or wrong artifact version.",
  "DoS risk from huge proof blobs, repeated invalid proofs, or overloaded proving queues.",
  "Transcript or serialization drift between prover and verifier deployments.",
  "Unsafe, FFI, or accelerator boundary bugs around heavy proving backends.",
]

export function PageCh51ZeroKnowledgeProofsRustEngineersExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch51-zero-knowledge-proofs-rust-engineers-exercises")
  const mainPageIndex = getPageIndexById("ch51-zero-knowledge-proofs-rust-engineers")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 51 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice zero-knowledge systems the way they survive review: explicit public and private boundaries, typed proof
          artifacts, transcript discipline, and threat models that cover both cryptography and Rust integration risk.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a proof-boundary review. The best answer does not stop at “use ZK.” It says which
                data is public, which data is witness-only, which artifacts exist, where the prover runs, and which checks
                prevent transcript or artifact drift later.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 51
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Threat-model checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {threatModelChecklist.map((item) => (
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
          title="Runnable lab · Keep verification separate from the witness"
          description={
            <>
              Repair the starter so the proof is accepted only when the public statement and proof artifact line up. The
              proving function already checks the witness. Your job is to make the verifier use only the public statement
              and proof artifact.
            </>
          }
          filename="proof_boundary_lab.rs"
          runKey="ch51_ex_proof_boundary"
          expectedOutput={"public total = 45\nproof bytes = 96\nverified = true"}
          helperText={
            <>
              Tip: the verification function should not need the witness at all. Compare the statement against the proof
              artifact and check that the proof artifact is structurally non-empty.
            </>
          }
          initialCode={`#[derive(Debug, Clone, Copy)]
struct Statement {
    public_total: u64,
    public_limit: u64,
}

#[derive(Debug, Clone, Copy)]
struct Witness {
    left: u64,
    right: u64,
}

#[derive(Debug, Clone, Copy)]
struct ProofArtifact {
    public_total: u64,
    public_limit: u64,
    proof_bytes_len: usize,
}

fn prove(statement: Statement, witness: Witness) -> Result<ProofArtifact, &'static str> {
    if witness.left + witness.right != statement.public_total {
        return Err("sum constraint failed");
    }

    if statement.public_total > statement.public_limit {
        return Err("limit violated");
    }

    Ok(ProofArtifact {
        public_total: statement.public_total,
        public_limit: statement.public_limit,
        proof_bytes_len: 96,
    })
}

fn verify(_statement: Statement, _proof: ProofArtifact) -> bool {
    false
}

fn main() {
    let statement = Statement {
        public_total: 45,
        public_limit: 50,
    };
    let witness = Witness { left: 20, right: 25 };
    let proof = prove(statement, witness).unwrap();

    println!("public total = {}", statement.public_total);
    println!("proof bytes = {}", proof.proof_bytes_len);
    println!("verified = {}", verify(statement, proof));
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
            By the end of this page, you should be able to explain public inputs, private witnesses, and proof artifacts
            precisely; separate proving from verification in a service workflow; fix transcript or serialization drift; and
            design a threat model that covers both proof-system assumptions and ordinary Rust systems risk.
          </p>
        </section>
      </div>
    </div>
  )
}

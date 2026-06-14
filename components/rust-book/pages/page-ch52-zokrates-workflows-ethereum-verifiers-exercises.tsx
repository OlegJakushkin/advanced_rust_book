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
      "Spot the places where transport-shaped data is being pushed into the ZoKrates boundary without enough normalization or commitment discipline.",
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
            "contract = contracts/AgeCheckVerifier.sol\npublic inputs = 2\nwitness included = false"
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
/*
````

### File: `components/rust-book/pages/page-ch54-no-std-rust-constrained-runtime-derivatives-exercises.tsx`
```tsx
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
    title: "Choose std, alloc-only, or no_std from the real runtime contract",
    objective:
      "Practice classifying components by runtime assumptions instead of by habit or team folklore.",
    starterPrompt:
      "Classify five components: a pure checksum crate, a ring-buffer telemetry queue, a browser wasm guest, a Linux daemon with file and socket IO, and a microcontroller driver that talks to a DMA engine.",
    prompts: [
      "Which component is truly `core`-only?",
      "Which component needs owned heap-backed helpers but not the full standard library?",
      "Which component clearly wants full `std` because OS services are part of the job?",
      "Which component wants a host-specific adapter around a portable core instead of one monolithic crate surface?",
    ],
    acceptanceCriteria: [
      "You distinguish at least one `std`, one `alloc`-only, and one `core`-only component clearly.",
      "You justify the classification from runtime services such as heap, OS IO, or host ABI rather than from target buzzwords alone.",
      "You explicitly avoid treating `no_std` as embedded-only.",
    ],
    hints: [
      "Start from what the caller needs: heap, files, sockets, interrupts, or none of them.",
      "If the component's real job is pure computation over borrowed input, it may not need much runtime at all.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Strip std leakage out of a portable crate surface",
    objective:
      "Read one API and explain which parts belong in core, which belong behind alloc, and which belong behind std adapters.",
    starterPrompt:
      "A crate currently returns `String` from every parser helper, logs through `std::io::Write`, and pulls one std-bound dependency into a library that should also run in firmware and wasm guests.",
    prompts: [
      "Which APIs could return borrowed slices, fixed-capacity values, or caller-provided buffers instead?",
      "Which helpers deserve an `alloc` feature because owned convenience is real but not fundamental?",
      "Which logic should stay in a host-only `std` adapter crate or module?",
      "Which dependency check would you add before claiming the crate is portable?",
    ],
    acceptanceCriteria: [
      "You move at least one API from unconditional `std` assumptions toward `core` or `alloc` honestly.",
      "You identify one host-only adapter boundary explicitly.",
      "You mention dependency hygiene, such as `default-features = false` or a transitive `std` audit.",
    ],
    hints: [
      "The calm repair usually starts by shrinking the public API, not by adding more cfg branches everywhere.",
      "A parser and a logger rarely deserve the same portability contract.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Design a fixed-capacity data path with explicit ownership handoff",
    objective:
      "Implement a small static pool or ring buffer where allocation failure and release are visible in the type system.",
    starterPrompt:
      "Build a fixed-capacity packet or frame pool where producers allocate one slot, hand the slot to a consumer or DMA boundary, and later release it.",
    prompts: [
      "Keep capacity in the type, not in a hidden runtime global.",
      "Make slot acquisition fallible with `Option` or `Result`.",
      "Use a token or handle instead of borrowed references that outlive the allocation call.",
      "Expose one read-only view method for the currently owned bytes.",
    ],
    acceptanceCriteria: [
      "The implementation uses fixed capacity and a fallible allocation path.",
      "Ownership transfer is modeled with a handle or token rather than with long-lived mutable borrows.",
      "Release is explicit and reviewable.",
      "The runnable lab prints the expected first length, overflow status, and available-slot count.",
    ],
    hints: [
      "This is the same design pressure many DMA and driver APIs have: make authority explicit.",
      "A slot handle is often calmer than a reference once work can outlive the caller frame.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Audit an unsafe constrained-runtime boundary around MMIO, interrupts, or custom allocation",
    objective:
      "Turn one vague unsafe region into an auditable boundary with explicit invariants and concurrency assumptions.",
    starterPrompt:
      "You inherit a register-access wrapper that uses raw pointers directly from application code, shares state with an interrupt handler, and never documents whether volatile access or atomics are required.",
    prompts: [
      "What invariant belongs above every unsafe read or write?",
      "Which access should become volatile rather than an ordinary dereference?",
      "Where would a critical-section boundary or an atomic be more honest than one ordinary mutable reference?",
      "What small host-side or simulation test could still exercise the safe wrapper logic?",
    ],
    acceptanceCriteria: [
      "You name at least one explicit unsafe invariant.",
      "You identify one place where volatile access or a vendor register wrapper is required.",
      "You describe one interrupt-concurrency repair such as critical sections or atomics.",
      "You include one test or simulation idea that still validates the safe layer.",
    ],
    hints: [
      "The goal is not to eliminate every unsafe block. It is to make each one small and justified.",
      "Interrupt concurrency is not the same thing as ordinary thread scheduling, but it still needs a memory model.",
    ],
  },
  {
    number: 5,
    kind: "design or production scenario",
    title: "Build a host-side testing, fuzzing, and profiling plan for a no_std crate",
    objective:
      "Keep portable logic easy to validate on the host while still respecting target-specific debug limits.",
    starterPrompt:
      "You own a `no_std` parser and protocol crate used in firmware, wasm guests, and Linux services. The target devices have weak debug output and limited profiling support.",
    prompts: [
      "Which tests should run as ordinary host-side std tests?",
      "Which parts deserve fuzzing or property testing before they ever hit hardware?",
      "Which target-specific checks still need emulator, QEMU, or hardware-in-the-loop coverage?",
      "Which counters or ring-buffer diagnostics would you add when stdout and files are unavailable?",
    ],
    acceptanceCriteria: [
      "You define at least one host-side logic test layer and one target-specific integration layer.",
      "You include fuzzing or property testing for a hostile boundary such as a parser or state machine.",
      "You mention one constrained-target observability technique such as counters, serial output, or ring buffers.",
    ],
    hints: [
      "The host can do far more work for you than the target can. Use it.",
      "If a parser bug is discoverable on the host, do not wait for a board lab to find it.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Decide whether a production component should be std, alloc-only, or no_std",
    objective:
      "Make one deployment and release decision with explicit tradeoffs around portability, binary size, observability, and engineering cost.",
    starterPrompt:
      "You are designing a telemetry agent, a kernel-adjacent parser library, a wasm plugin, and a board driver. The organization wants as much code reuse as possible but not at any maintenance cost.",
    prompts: [
      "Which component should stay full `std` because the runtime services are a feature, not a liability?",
      "Which component should be split into a portable core plus host adapters?",
      "Which component should stay `alloc`-only or `core`-only because portability is central to its value?",
      "Which release-engineering or CI lanes would prove the chosen target matrix stays healthy over time?",
    ],
    acceptanceCriteria: [
      "You assign each component to a plausible runtime surface with a reason.",
      "You mention at least one tradeoff involving binary size, observability, host features, or maintenance cost.",
      "You include at least one CI or packaging implication such as cross-target smoke tests or feature-matrix lanes.",
    ],
    hints: [
      "Code reuse is valuable only when the runtime contract stays honest.",
      "One repository can legitimately ship several runtime surfaces if the boundaries stay clear.",
    ],
  },
]

const reviewQuestions = [
  "What practical difference separates `core`, `alloc`, and `std` in a Rust crate contract?",
  "Why is `no_std` not the same thing as heapless?",
  "Why are token or handle-based ownership transfers often calmer than borrows in DMA-style or queue-style designs?",
  "What should be audited first when a `no_std` crate contains unsafe MMIO or FFI boundaries?",
  "Why are host-side std tests such a strong default for validating portable `no_std` logic?",
]

const workingLoop = [
  "State the smallest honest runtime surface first: core, alloc, or std.",
  "Keep owned convenience and host integration outside the minimal surface until they are justified.",
  "Use fixed-capacity or fallible-memory designs where the budget is real.",
  "Document unsafe invariants before tuning performance or hardware details.",
  "Test portable logic on the host, then add target-specific runners only where the hardware contract changes.",
]

const runtimeChecklist = [
  "Portable core logic is explicit and host-testable.",
  "Alloc-backed convenience is feature-gated instead of assumed.",
  "Unsafe MMIO or FFI surfaces have written invariants.",
  "Fixed-capacity or fallible-growth paths exist where the memory budget is real.",
  "Cross-target CI proves the advertised runtime contract instead of leaving it to documentation alone.",
]

export function PageCh54NoStdRustConstrainedRuntimeDerivativesExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch54-no-std-rust-constrained-runtime-derivatives-exercises")
  const mainPageIndex = getPageIndexById("ch54-no-std-rust-constrained-runtime-derivatives")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 54 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice `no_std` design the way it survives review: explicit runtime contracts, fixed-capacity or fallible memory,
          tiny unsafe surfaces, and host-testable logic even when the final target is constrained.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a runtime-boundary review. The strongest answer does not stop at “make it no_std.”
                It says which layer belongs in core, which helpers require alloc, which adapter needs std or a host ABI,
                and how memory failure or unsafe access stays explicit.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 54
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Minimal portability checklist</h3>
          <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
            {runtimeChecklist.map((item) => (
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
                  no_std drill
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
          title="Runnable lab · Fixed-capacity DMA pool"
          description={
            <>
              Repair the starter so slot allocation is fallible, reading a live slot returns the right byte slice, and
              releasing the slot returns capacity to the pool. Capture the first slot length before release so the success
              condition stays semantically honest as well as mechanically correct.
            </>
          }
          filename="fixed_capacity_dma_lab.rs"
          runKey="ch54_ex_dma_pool"
          expectedOutput={"first len = 3\noverflow = true\navailable = 1"}
          helperText={
            <>
              Tip: copy the bytes into the first free slot, record the length, return a{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">SlotId</code>, and make{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">release</code> clear the used flag so the
              capacity becomes visible again.
            </>
          }
          initialCode={`#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct SlotId(usize);

struct Pool<const SLOTS: usize, const BYTES: usize> {
    used: [bool; SLOTS],
    lens: [usize; SLOTS],
    data: [[u8; BYTES]; SLOTS],
}

impl<const SLOTS: usize, const BYTES: usize> Pool<SLOTS, BYTES> {
    const fn new() -> Self {
        Self {
            used: [false; SLOTS],
            lens: [0; SLOTS],
            data: [[0; BYTES]; SLOTS],
        }
    }

    fn alloc_copy(&mut self, _bytes: &[u8]) -> Option<SlotId> {
        None
    }

    fn view(&self, _id: SlotId) -> &[u8] {
        &[]
    }

    fn release(&mut self, _id: SlotId) {}

    fn available(&self) -> usize {
        self.used.iter().filter(|&&used| !used).count()
    }
}

fn main() {
    let mut pool = Pool::<2, 8>::new();

    let first = pool.alloc_copy(b"abc").unwrap();
    let first_len = pool.view(first).len();
    let _second = pool.alloc_copy(b"xy").unwrap();
    let overflow = pool.alloc_copy(b"zzz").is_none();

    pool.release(first);

    println!("first len = {}", first_len);
    println!("overflow = {}", overflow);
    println!("available = {}", pool.available());
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
            By the end of this page, you should be able to choose the right runtime surface for a production component,
            refactor a std-bound crate into a more portable shape, design a fixed-capacity or fallible memory path, audit
            one unsafe constrained-runtime boundary, and explain how host-side testing still supports `no_std` development
            without pretending the target behaves like a server.
          </p>
        </section>
      </div>
    </div>
  )
}
*/

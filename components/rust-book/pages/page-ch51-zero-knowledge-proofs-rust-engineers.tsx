"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"

const mentalModelPoints = [
  {
    title: "A proof is about a statement, not about a secret blob.",
    body: "The verifier checks that one public claim is true. The witness is private data that makes the claim true. If you blur those roles in your Rust types, you usually leak secrets into the wrong boundary later.",
  },
  {
    title: "Constraint systems are compiled operating models.",
    body: "A ZK system does not prove your Rust function directly. It proves a lower-level constraint model or circuit. Arithmetic, hashes, ranges, and comparisons all have different constraint costs.",
  },
  {
    title: "Proof generation and verification have asymmetric cost.",
    body: "Proving is often heavy in CPU, memory, and wall time. Verification is usually smaller, but not free. Design the proving side like a specialized worker lane, not like a tiny inline helper.",
  },
]

const artifactCards = [
  {
    title: "Statement",
    body: "The public claim the verifier is allowed to know. Example: 'this committed order total is at most the published credit limit.'",
  },
  {
    title: "Witness",
    body: "Private data that satisfies the statement. Example: hidden line items, a secret preimage, or model inputs that should not be revealed directly.",
  },
  {
    title: "Constraints",
    body: "The compiled form of the computation the prover must satisfy. In many ecosystems this becomes an arithmetic circuit, R1CS-like system, AIR, or another proving-system-specific representation.",
  },
  {
    title: "Proving key",
    body: "A proving artifact used by the prover. Some proving systems require setup artifacts whose trust model must be reviewed explicitly.",
  },
  {
    title: "Verification key",
    body: "The verifier-side artifact that binds the verifier to one circuit or proving-system configuration.",
  },
  {
    title: "Proof artifact",
    body: "The output object the verifier receives. It is not the witness. It is a separate artifact tied to a statement, proving system, and transcript.",
  },
  {
    title: "Verifier",
    body: "The boundary that checks proof plus public inputs. In Rust systems, this is often a small API edge, worker step, or on-chain or off-chain adapter.",
  },
]

const guaranteeCards = [
  {
    title: "What zero knowledge can give you",
    bullets: [
      "A verifier can check a statement without learning the full private witness, assuming the proving system and circuit are sound.",
      "You can bind public claims to committed data or prior state roots.",
      "You can separate expensive proving from cheaper verification in a system design.",
    ],
  },
  {
    title: "What zero knowledge does not give you automatically",
    bullets: [
      "It does not hide metadata, request timing, proof size, or public inputs by itself.",
      "It does not prove your business logic was encoded correctly. A wrong circuit can be proven perfectly.",
      "It does not make a system decentralized, secure, or production-ready just because a proof exists.",
      "It does not remove trusted setup, transcript, side-channel, or implementation-risk questions.",
    ],
  },
]

const proofSystemCards = [
  {
    title: "SNARKs",
    body: "A pragmatic summary: often small proofs and fast verification, but some constructions rely on setup artifacts that carry trust and ceremony implications.",
  },
  {
    title: "STARKs",
    body: "A pragmatic summary: often larger proofs with a more transparent setup story, but different verifier and bandwidth tradeoffs. Bigger proof artifacts can matter at service or chain boundaries.",
  },
  {
    title: "Commitments",
    body: "Commitments bind data to one digest without revealing the full contents. Merkle roots are one common commitment structure for large witness-related state.",
  },
  {
    title: "Hashes",
    body: "Hashes often appear in commitments, transcript construction, Fiat-Shamir style challenge derivation, and witness binding. Hash choice and encoding policy are protocol decisions.",
  },
  {
    title: "Circuits and gadgets",
    body: "A range check, a hash, a Merkle-path check, and a simple addition all have very different proving cost. 'It is one function call in Rust' does not mean 'it is one cheap thing in constraints.'",
  },
]

const integrationCards = [
  {
    title: "Prover worker boundary",
    body: "Treat proving like a heavy background job. Queue one owned proof request, build or load witness material, run the prover, and return one proof artifact plus public output summary.",
  },
  {
    title: "Verifier API boundary",
    body: "Keep verification thin. Accept public inputs, proof artifact, and versioned verifier metadata. Do not require the verifier to reconstruct private witness state.",
  },
  {
    title: "Artifact inventory",
    body: "Circuit ID, proving key, verification key, witness schema version, transcript domain, and proof artifact all deserve explicit names and versioning. 'Call prove()' is not enough for production custody.",
  },
  {
    title: "External toolchain workflows",
    body: "For ecosystems such as ZoKrates or EZKL, keep these steps separate: compile model or circuit, generate witness, load proving parameters, produce proof artifact, then integrate the verifier. Do not collapse the artifacts into one opaque side effect.",
  },
  {
    title: "Process, FFI, and GPU boundaries",
    body: "Many real provers live behind external binaries, FFI, or accelerator runtimes. Bound input sizes, version output files, capture stderr meaningfully, and keep unsafe or process-launch surfaces auditable.",
  },
]

const transcriptRules = [
  "Use canonical serialization for public inputs and transcript messages. Do not let incidental map iteration order define proof bytes.",
  "Domain-separate transcripts by protocol, circuit, and version. A billing proof and an inventory proof should not share challenge space accidentally.",
  "Version public input ordering explicitly. The verifier should know exactly which field sequence was hashed or absorbed.",
  "Keep witness generation deterministic where reproducibility matters, even if the proving system itself uses randomness internally.",
  "Bind transcript construction to the same circuit ID or verification key hash the verifier expects.",
]

const performanceCards = [
  {
    title: "Witness generation can dominate.",
    body: "In many systems, the expensive step is not only the prover. Preprocessing data, canonicalizing inputs, computing Merkle paths, or exporting model tensors can dominate wall time or memory first.",
  },
  {
    title: "Proving is usually the hottest lane.",
    body: "Expect peak memory, long CPU phases, and possible hardware acceleration boundaries here. If you inline proving into a request handler, you are usually choosing the wrong service topology.",
  },
  {
    title: "Verification is cheaper, not free.",
    body: "Batch verification, network bandwidth, and artifact parsing still matter. Small proofs help, but the verifier still has to parse, validate, and often version-check the request.",
  },
  {
    title: "Hardware acceleration is conditional.",
    body: "GPU or specialized hardware can help some proving workloads, but only when the chosen proving backend and batch shape justify the added integration and audit surface.",
  },
]

const cryptoVsRustCards = [
  {
    title: "Cryptographic assumptions",
    body: "Review proving-system soundness, zero-knowledge assumptions, trusted setup or transparency story, circuit correctness, transcript construction, and hash or commitment selection. These are not Rust type-system questions.",
  },
  {
    title: "Rust implementation safety",
    body: "Review secret handling, canonical serialization, queue and memory budgets, unsafe FFI or accelerator wrappers, log redaction, panic boundaries, and which types can cross threads or processes. These are not cryptography questions, but they still break proof-backed systems.",
  },
]

const securityChecklist = [
  "Does the public statement say exactly what the verifier should learn, and nothing more?",
  "Is witness generation versioned, testable, and separate from the verifier boundary?",
  "Are proving keys, verification keys, transcripts, and circuit IDs versioned and attributable?",
  "Are transcript domain strings and public input ordering explicit and stable?",
  "Are proof artifacts bounded in size and parsed defensively before expensive work happens?",
  "Does the system avoid logging witness material, secret seeds, or raw model inputs accidentally?",
  "If external provers or accelerators are used, are their process, FFI, or unsafe boundaries audited and observable?",
]

const comparisonCallouts = [
  {
    title: "C++ background",
    body: "Think of the circuit as compiled IR with a separate proving runtime, not as a direct template-like execution of your Rust function. Artifact custody and verifier integration matter as much as the math.",
  },
  {
    title: "C# background",
    body: "Do not expect runtime reflection or serializer attributes to rescue a proof boundary later. Rust ZK integrations are calmer when public inputs, witnesses, and artifact types are explicit from the start.",
  },
  {
    title: "Go background",
    body: "A proof request should look more like a heavy queued job than like one lightweight handler branch. Keep backpressure, retry policy, and proof artifact custody visible in the service design.",
  },
]

const productionPatterns = [
  "Keep one explicit separation between statement DTOs, witness input, proof artifact, and verification request types.",
  "Run proving in a bounded worker lane with owned inputs, strong resource limits, and observable artifact outputs.",
  "Version circuit IDs, transcript domains, public input ordering, and verifier metadata together so mixed deployments stay reviewable.",
  "Use commitments or Merkle roots to bind large private state, but remember that commitment policy and encoding are part of the protocol.",
  "Test the witness-generation path separately from the verifier path. A system can verify correctly and still be building the wrong witness.",
  "If you rely on external tools or acceleration, make the artifact pipeline, failure handling, and trust assumptions explicit in code and CI.",
]

const pitfalls = [
  "Treating the proof as a privacy blanket and forgetting that public inputs, metadata, or network timing may still leak meaningful information.",
  "Encoding business logic incorrectly and then trusting the proof because the prover and verifier both agree on the same wrong circuit.",
  "Building proofs inline on request threads and discovering too late that the real bottleneck was witness generation or memory pressure.",
  "Skipping domain separation or canonical serialization and later producing unverifiable proofs across versions or services.",
  "Collapsing compiled circuits, witnesses, proving keys, verification keys, and proof blobs into one opaque file or one opaque API call.",
  "Confusing cryptographic review with Rust safety review. A sound proving system can still be shipped through an unsafe, leaky, or non-deterministic integration.",
]

const summaryPoints = [
  "A ZK system revolves around one public statement, one private witness, one constraint model, and explicit proof artifacts.",
  "SNARKs, STARKs, commitments, hashes, and circuits have different operational tradeoffs, especially around proof size, verifier cost, and trust setup.",
  "Rust integrations are strongest when proving and verification boundaries stay separate and typed.",
  "Transcript handling, deterministic serialization, and domain separation are protocol requirements, not cleanup tasks.",
  "Production ZK work needs both cryptographic review and ordinary Rust systems review: resource limits, secret handling, FFI safety, and observability.",
]

const pseudoCircuit = `Pseudo-circuit — prove two private amounts sum to a public total without revealing the amounts

private line_a, line_b, nonce
public total, limit, commitment

constraint 1: line_a + line_b = total
constraint 2: total <= limit          // usually a range-check gadget, not one native field comparison
constraint 3: hash(line_a, line_b, nonce) = commitment`

export function PageCh51ZeroKnowledgeProofsRustEngineers() {
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
  const pageIndex = getPageIndexById("ch51-zero-knowledge-proofs-rust-engineers")
  const chapter19PageIndex = getPageIndexById("ch19-serialization-and-data-contracts")
  const chapter37PageIndex = getPageIndexById("ch37-cuda-and-gpu-acceleration")
  const chapter38PageIndex = getPageIndexById("ch38-merkle-tree-games-and-challenges")
  const chapter43PageIndex = getPageIndexById("ch43-observability")
  const exercisesPageIndex = getPageIndexById("ch51-zero-knowledge-proofs-rust-engineers-exercises")
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
          Chapter 51 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Zero-knowledge proof integration needs a public statement, private witness custody, versioned artifacts, proving
          capacity, and small verifier APIs. This chapter maps those requirements into Rust service boundaries.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Builds on Chapters 19, 37, 38, and 43</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Chapter 19 established canonical serialization and transport DTO discipline. Chapter 37 covered heavy
                accelerator lanes and their integration costs. Chapter 38 covered commitments, Merkle trees, and proof
                artifacts. Chapter 43 covered observability for specialized worker boundaries. This chapter recombines
                those ideas for proof-backed systems.
              </p>
            </div>
            <div className="flex gap-2 shrink-0 flex-wrap">
              <Button variant="outline" onClick={() => setCurrentPage(chapter19PageIndex)}>
                Chapter 19
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter37PageIndex)}>
                Chapter 37
              </Button>
              <Button variant="outline" onClick={() => setCurrentPage(chapter38PageIndex)}>
                Chapter 38
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
            A service must verify billing or scoring claims without exposing private inputs. The business requirement is
            to separate public statements, private witnesses, constraints, proof artifacts, verifier metadata, and proving
            capacity so the verifier learns only the intended claim.
          </p>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="font-medium text-foreground mb-2">One practical proof pipeline</div>
            <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
              <code className="font-mono text-foreground">{`statement(public) + witness(private)
          -> witness generation
          -> constraints / circuit
          -> prover(proving key, transcript)
          -> proof artifact
          -> verifier(verification key, statement, transcript)`}</code>
            </pre>
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
              ZKP mental model: statements, witnesses, constraints, keys, proofs, and verifiers
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {artifactCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">What zero knowledge does and does not guarantee</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {guaranteeCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-3">{card.title}</div>
                  <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                    {card.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              SNARKs, STARKs, commitments, hashes, and circuits at a pragmatic level
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {proofSystemCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Encoding computations as constraints</h4>
            <p className="text-sm text-muted-foreground leading-6">
              Engineers coming from C++, C#, or Go often expect the cost model of the original function to carry over.
              It does not. A simple sum is usually cheap in constraints. Range checks, hashes, Merkle paths, and non-native
              field arithmetic are often much more expensive. That is why constraint review is an architecture review, not
              only a math exercise.
            </p>
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Pseudo-code · conceptual circuit</div>
              <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{pseudoCircuit}</code>
              </pre>
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The key subtlety is intentional: inequality and hashing are written as one line here, but they are not one
              cheap primitive inside most proving systems. They expand into gadgets with real prover and verifier cost.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Rust integration patterns for proof generation and verification boundaries
            </h4>
            <div className="grid gap-4 lg:grid-cols-3">
              {integrationCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground leading-6">
                The load-bearing design rule is simple: proving and verification are different service shapes. The prover
                should own witness generation and heavy compute. The verifier should own public inputs and a small proof
                check. That split stays valuable even if the underlying ecosystem is pure Rust, FFI-backed, GPU-backed, or
                toolchain-driven.
              </p>
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Serialization, transcript handling, deterministic inputs, and domain separation
            </h4>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {transcriptRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Performance, memory, and hardware considerations</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {performanceCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Security review checklist and production caveats</h4>
            <div className="grid gap-4 lg:grid-cols-2">
              {cryptoVsRustCards.map((card) => (
                <div key={card.title} className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="font-medium text-foreground mb-2">{card.title}</div>
                  <p className="text-sm text-muted-foreground leading-6">{card.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <h5 className="font-medium text-foreground mb-2">Minimal review checklist</h5>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                {securityChecklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
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
                The biggest production mistake is often not “the prover was slow.” It is that the team never made witness
                generation, transcript policy, proving artifacts, and verifier integration reviewable as separate things.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Examples</h3>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The runnable examples here model proof boundaries and transcript discipline without depending on one specific
              proving crate. They are intentionally about systems shape, not about claiming a browser demo is real
              cryptography.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 1: keep statement, witness, and proof artifact separate
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The verifier checks only the public statement plus proof artifact. The witness exists only on the proving
                  side. That separation is the main systems lesson.
                </p>
              </div>
              {codes.zkp_statement_witness_proof !== DEFAULT_CODES.zkp_statement_witness_proof && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("zkp_statement_witness_proof")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.zkp_statement_witness_proof}
              onChange={(newCode) => updateCode("zkp_statement_witness_proof", newCode)}
              onRun={() => runCode("zkp_statement_witness_proof")}
              output={outputs.zkp_statement_witness_proof ?? null}
              isRunning={isRunning === "zkp_statement_witness_proof"}
              filename="proof_boundary_types.rs"
              expectedOutput={"public total = 45\nproof bytes = 96\nverified = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.zkp_statement_witness_proof}
              onRevert={() => resetCode("zkp_statement_witness_proof")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Statement</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Public values belong in the verifier-facing boundary and can be logged or routed more broadly.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Witness</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Private inputs stay proving-side only. If they appear in your verification DTOs, the design already
                  drifted.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Proof artifact</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The proof is its own typed artifact. Treat it like versioned transport data, not like a hidden field on a witness struct.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 2: domain-separated transcripts and deterministic public inputs
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  The transcript here is intentionally simple and not cryptographic. The point is that prover and verifier
                  must derive the same challenge for the same domain and a different challenge for a different protocol.
                </p>
              </div>
              {codes.zkp_transcript_domain_separation !== DEFAULT_CODES.zkp_transcript_domain_separation && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => resetCode("zkp_transcript_domain_separation")}
                  className="gap-1.5 text-xs text-muted-foreground h-7"
                >
                  Reset
                </Button>
              )}
            </div>
            <RustCodeEditor
              code={codes.zkp_transcript_domain_separation}
              onChange={(newCode) => updateCode("zkp_transcript_domain_separation", newCode)}
              onRun={() => runCode("zkp_transcript_domain_separation")}
              output={outputs.zkp_transcript_domain_separation ?? null}
              isRunning={isRunning === "zkp_transcript_domain_separation"}
              filename="transcript_domain_separation.rs"
              expectedOutput={"domain = billing-proof:v1\nchallenge match = true\ndomain separation = true"}
              showResultComparison={true}
              originalCode={DEFAULT_CODES.zkp_transcript_domain_separation}
              onRevert={() => resetCode("zkp_transcript_domain_separation")}
            />
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Determinism</div>
                <p className="text-xs text-muted-foreground leading-5">
                  The same public inputs and same domain should yield the same verifier-visible transcript state.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Domain separation</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Different protocol domains should not accidentally share challenge space or artifact interpretation.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Integration</div>
                <p className="text-xs text-muted-foreground leading-5">
                  Public input ordering and transcript rules are protocol compatibility decisions between prover and verifier.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground leading-6">
              The repository also includes standalone Rust source under{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                examples/ch51_zero_knowledge_proofs_rust_engineers/
              </code>{" "}
              so the chapter examples can be reviewed as ordinary files outside the in-browser editor.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-lg font-semibold text-foreground mb-3">Exercises</h3>
          <p className="text-sm text-muted-foreground leading-6 mb-4">
            The companion exercise page asks you to separate public inputs, private witnesses, and proof artifacts; isolate
            proving from verification in an API workflow; fix transcript or serialization bugs; and threat-model one
            proof-backed service boundary.
          </p>
          <Button onClick={() => setCurrentPage(exercisesPageIndex)} className="gap-2">
            Open Chapter 51 Exercises
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

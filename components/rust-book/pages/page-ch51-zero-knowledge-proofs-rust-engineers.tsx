"use client"

import { useEffect } from "react"
import { ArrowRight, BookOpen, Bug, Cpu, Gauge, Shield, TriangleAlert, Users, Wrench } from "lucide-react"
import { useBook } from "../book-context"
import { getPageIndexById } from "../page-index"
import { DEFAULT_CODES, PAGES } from "../types"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { simulateRustExecution } from "../rust-simulator"
import { Button } from "@/components/ui/button"
import { MermaidDiagram } from "@/components/rust-book/mermaid-diagram"

const mentalModelPoints = [
  {
    title: "A proof is about a statement, not about a secret blob.",
    body: "The verifier checks that one public claim holds. The witness is the private data that makes the claim true, and it never travels with the proof. New engineers often picture the proof as an encrypted copy of the secret; it is not. It is evidence about a statement. If your Rust types blur the two roles, the secret eventually leaks across a boundary where only the statement belonged.",
  },
  {
    title: "Constraint systems are compiled operating models.",
    body: "The prover does not run your Rust function. It satisfies a lower-level constraint model the function was compiled into, the way a CPU runs machine code rather than source. That compilation throws away the cost intuition you brought with you. Field arithmetic is cheap, but ranges, comparisons, and hashes expand into gadgets with their own size. Reviewing a circuit is therefore an architecture review, not just a math check.",
  },
  {
    title: "Proof generation and verification have asymmetric cost.",
    body: "These two halves are not mirror images. Proving is often the heaviest thing in the system, measured in seconds, gigabytes, and sometimes a GPU. Verification is comparatively small but never truly free, since the verifier still parses, validates, and version-checks the request. Design the proving side as a specialized worker lane with real resource limits, and the verifier side as a thin, fast edge.",
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
    body: "You already think in terms of a compile step that produces an artifact with its own runtime cost. Carry that instinct here: your Rust logic is not executed by the prover, it is compiled into a constraint system the way source is compiled into an object file. The trap is assuming the cost model survives compilation. A branch or a comparison is nearly free in C++; in a circuit it expands into a range-check gadget. Treat artifact custody and verifier integration as seriously as you would treat ABI stability across a shared-library boundary.",
  },
  {
    title: "C# background",
    body: "There is no managed runtime, reflection, or serializer attribute that will reconstruct intent at the boundary for you. In a .NET service you can often defer the shape of a contract because the runtime fills gaps; a ZK boundary punishes that. Decide up front, in the type system, what is a public statement, what is a private witness, and what is a proof artifact. The mental shift is from late binding to a contract that is fixed before the first proof is ever generated.",
  },
  {
    title: "Go background",
    body: "Your instinct to model work as a job moving through goroutines and channels is exactly right, but a proof request is a heavy job, not a cheap handler branch. Do not inline proving into the request path the way you might inline a quick computation. Push it onto a bounded worker lane with explicit backpressure, retry policy, and artifact ownership, and keep the verifier as the small, fast edge that goroutines and load balancers expect.",
  },
  {
    title: "Python background",
    body: "If you arrive through ML tooling such as EZKL, resist treating the proving pipeline like a notebook cell where compile, witness, prove, and verify blur into one call. Rust forces the artifacts apart, and that is the point: the model export, the witness, the proving parameters, and the proof are distinct files with distinct trust and versioning. The shift is from dynamic, single-process convenience to an explicit multi-stage pipeline you can audit stage by stage.",
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
          A zero-knowledge proof lets one party convince another that a statement is true without revealing why it is
          true. For a Rust engineer the cryptography is rarely the hard part to ship. The hard part is the systems
          shape: a public statement, private witness custody, versioned artifacts, expensive proving capacity, and a
          small verifier API. This chapter treats those as boundaries you can name and review, not as one opaque
          call to a crate.
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
            Picture a service that has to vouch for a number it is not allowed to disclose. A lender wants to confirm
            that a customer&apos;s committed order total stays under their published credit limit without seeing the line
            items. A risk team wants to prove a score was computed from an approved model without exposing the model
            inputs. In both cases the business requirement is the same shape: let the verifier learn one specific claim
            and nothing else. To deliver that, you have to keep public statements, private witnesses, constraints, proof
            artifacts, verifier metadata, and proving capacity as separate, named things rather than letting them
            collapse into a single function that &quot;does the proof.&quot;
          </p>
          <p className="mt-4 text-sm text-muted-foreground leading-6">
            The pipeline below is the spine of the whole chapter. Read it left to right and notice where the boundary
            flips: everything up to and including the prover holds the secret witness, and from the proof artifact
            onward only public data crosses. That single handoff is what every design decision in this chapter is
            protecting.
          </p>
          <MermaidDiagram
            chart={`flowchart TD\n  S[public statement] --> WG[witness generation]\n  W[private witness] --> WG\n  WG --> C[constraints / circuit]\n  C --> P[prover]\n  PK[proving key] --> P\n  P --> Proof[proof artifact]\n  Proof --> V[verifier]\n  VK[verification key] --> V\n  S --> V\n  V --> Out[accept / reject]`}
            caption="The proving side owns the witness; only the proof artifact and public statement cross to the verifier."
          />
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Mental model</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            Before any crate names or APIs, three ideas reorganize how you reason about this topic. Each one is a place
            where the obvious intuition from ordinary backend work quietly leads you wrong, and each one shows up later
            as a concrete type or service boundary.
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
              The seven things a proof system actually traffics in
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              When people say &quot;the ZK part&quot; they usually mean a tangle of seven distinct objects. The reason
              integrations rot is that teams keep them implicit and let two of them merge. The fastest way to stay sane
              is to give each one a name and a home in your type system, exactly as you would for the inputs, outputs,
              and configuration of any other pipeline. The diagram earlier is just these seven objects wired together;
              the cards below define each one on its own terms.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              It is worth being blunt about the boundaries of the guarantee, because &quot;zero knowledge&quot; sounds
              like it solves more than it does. The math protects one thing well: a verifier can be convinced of a
              statement without learning the witness, provided the proving system is sound and the circuit is correct.
              Everything outside that sentence is still your problem. The two columns below separate the promise from
              the things teams keep wishing it covered.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              You do not need to derive these systems to integrate them well, but you do need a working sense of the
              tradeoffs they push onto your service. The choice between a SNARK and a STARK is rarely about elegance; it
              shows up in your design as proof size on the wire, verifier cost, and whether you inherit a trusted-setup
              ceremony you now have to document and defend. A trusted setup is a one-time ceremony that produces the
              proving and verification keys; its soundness depends on at least one participant having discarded their
              secret contribution, so if every contributor is compromised the system&apos;s soundness fails. The
              summaries below are deliberately operational rather than mathematical.
            </p>
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
              Engineers coming from C++, C#, or Go usually expect the cost model of the original function to carry over.
              It does not. A simple sum is cheap in constraints because it maps almost directly onto field arithmetic.
              Range checks, hashes, Merkle paths, and non-native field arithmetic are often far more expensive, because
              each one expands into a gadget made of many low-level constraints. The lesson is uncomfortable but useful:
              a one-line operation in your source can be the dominant cost in the circuit, so constraint review is an
              architecture review, not only a math exercise.
            </p>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              Read the two diagrams below, then the pseudo-circuit listing. It proves that two private amounts sum to a
              public total, stay under a limit, and match a public commitment. Watch the right-hand column of the
              diagram: the addition stays cheap, but the innocent-looking <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">total &lt;= limit</code> and the hash each blow up into a multi-constraint gadget. That asymmetry is the
              whole point.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  A[line_a + line_b = total] --> G1[a few add constraints]\n  G1 --> Cost[total prover cost]`}
              caption="The cheap row: a sum maps almost directly onto field arithmetic."
            />
            <p className="text-sm text-muted-foreground leading-6">
              The other two rows look just as innocent in source, but each expands into a gadget that
              dominates the same total cost:
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  B[total less-equal limit] --> G2[range-check gadget: many bit constraints]\n  C[hash equals commitment] --> G3[hash gadget: many round constraints]\n  G2 --> Cost[total prover cost]\n  G3 --> Cost`}
              caption="The expensive rows: a comparison and a hash each blow up into many constraints."
            />
            <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-primary mb-2">Pseudo-code · conceptual circuit</div>
              <pre className="rounded-md bg-card px-3 py-2 text-xs overflow-x-auto">
                <code className="font-mono text-foreground">{pseudoCircuit}</code>
              </pre>
            </div>
            <p className="mt-4 text-sm text-muted-foreground leading-6">
              The subtlety is intentional. Inequality and hashing are written as a single line each, but neither is one
              cheap primitive inside most proving systems. They expand into gadgets with real prover and verifier cost,
              which is exactly why estimating circuit size from the source listing alone will mislead you.
            </p>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">
              Rust integration patterns for proof generation and verification boundaries
            </h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              The single most important architectural decision is to stop treating proving and verifying as two ends of
              one function. They want to live on different machines, scale on different curves, and fail in different
              ways. The diagram shows the topology that keeps working whether the underlying prover is pure Rust,
              FFI-backed, GPU-backed, or a separate toolchain process: a thin API that enqueues owned proof requests, a
              bounded prover lane that holds all the heavy state, and a small verifier edge that only ever sees public
              data. The cards then break down the boundaries that diagram implies.
            </p>
            <MermaidDiagram
              chart={`flowchart TD\n  Client -->|proof request| API[thin API]\n  API -->|owned request| Queue[(bounded queue)]\n  Queue --> Prover[prover worker lane]\n  Prover -->|proof + public output| Store[(artifact store)]\n  Client -->|public inputs + proof| Verifier[verifier edge]\n  Store --> Verifier\n  Verifier --> Result[accept / reject]`}
              caption="Heavy proving lives behind a queue; the verifier edge stays small and never touches the witness."
            />
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Most non-cryptographic proof failures trace back to this section. Prover and verifier must agree, byte for
              byte, on what was hashed and in what order, and they must derive their challenges from the same transcript.
              A transcript is just the running record of public values and messages that both sides absorb to derive
              challenges; if one side serializes a map in a different iteration order, or shares challenge space between
              two unrelated protocols, the proof becomes unverifiable even though the math is correct. These rules are
              protocol requirements, not cleanup tasks, and they belong in tests from the first commit.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
              {transcriptRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </article>

          <article className="rounded-xl border border-border bg-card p-5">
            <h4 className="font-semibold text-foreground mb-3">Performance, memory, and hardware considerations</h4>
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              Teams new to this work tend to budget for the prover and forget everything around it. In practice the cost
              is spread across the pipeline, and the surprise is usually that witness preparation, not the prover itself,
              is the first thing to fall over. Read these four notes as a profiling checklist: find where wall time and
              peak memory actually go before you reach for a GPU, because hardware acceleration only pays off for some
              backends and some batch shapes.
            </p>
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
            <p className="text-sm text-muted-foreground leading-6 mb-4">
              A proof-backed system has two review surfaces that are easy to confuse, and confusing them is how sound
              cryptography still ships an insecure service. One surface is the cryptography: soundness, the trusted-setup
              or transparency story, circuit correctness, transcript construction. The other is the ordinary Rust
              systems surface: secret handling, canonical serialization, resource budgets, unsafe FFI wrappers, log
              redaction. A sound proving system put behind a leaky, non-deterministic integration is still a broken
              system, so both columns below need an owner.
            </p>
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

        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Adjustments by starting language</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-6">
            The cryptography is the same regardless of where you came from, but the instinct that misleads you is not.
            Each of these backgrounds brings one habit that helps here and one that quietly works against you. Read the
            card for your starting language as a mental-model adjustment, not a list of crate equivalents.
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            {comparisonCallouts.map((comparison) => (
              <div key={comparison.title} className="rounded-xl border border-border bg-card p-5">
                <div className="font-semibold text-foreground mb-2">{comparison.title}</div>
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
          <p className="text-sm text-muted-foreground leading-6">
            None of these patterns are exotic. They are the same separation-of-concerns and versioning discipline you
            would apply to any pipeline that crosses a trust boundary, applied here to the specific artifacts a proof
            system produces. The thread running through all of them is to keep the four moving parts, witness, proof,
            verifier request, and circuit version, individually nameable and testable.
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
            Each of these is a real way teams have shipped a proof-backed system that looked correct and was not. They
            cluster around two illusions: that a proof equals privacy, and that a passing verification equals a correct
            circuit. Hold both of those suspect.
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
              The runnable examples model proof boundaries and transcript discipline without depending on one specific
              proving crate. They are intentionally about systems shape rather than real cryptography, so a browser demo
              cannot mislead you into thinking it produced a sound proof. What they do show faithfully is how the types
              keep the witness on one side of the boundary and how both sides agree on a transcript.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-foreground">
                  Example 1: keep statement, witness, and proof artifact separate
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Before you read the code, fix the one rule it enforces in your head: the witness never appears in any
                  type the verifier touches. Follow the data in the diagram below. The witness flows only into the
                  prover; the verifier is handed a statement and a proof and nothing else. If you ever find the witness
                  type imported on the verifier side, the design has already drifted.
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
            <MermaidDiagram
              chart={`flowchart TD\n  Witness[Witness: private amounts] --> Prover\n  Statement[Statement: public total] --> Prover\n  Prover --> Proof[Proof artifact]\n  Statement --> Verifier\n  Proof --> Verifier\n  Verifier --> OK[verified = true]`}
              caption="The witness type reaches the prover only; the verifier sees statement and proof."
            />
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
                  The transcript here is intentionally simple and not cryptographic. The behavior to watch is the
                  branching shown below: the same public inputs under the same domain string must converge on one
                  challenge, while a different domain must land on a different one. The first property gives prover and
                  verifier a shared challenge; the second keeps a billing proof from ever colliding with an inventory
                  proof in the same challenge space.
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
            <MermaidDiagram
              chart={`flowchart TD\n  Inputs[public inputs] --> Absorb[absorb into transcript]\n  Domain[domain string] --> Absorb\n  Absorb --> Challenge[derive challenge]\n  Challenge --> Same{same domain and inputs?}\n  Same -->|yes| Match[challenge match = true]\n  Same -->|no| Diff[domain separation = true]`}
              caption="Same domain and inputs converge on one challenge; a different domain diverges by design."
            />
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

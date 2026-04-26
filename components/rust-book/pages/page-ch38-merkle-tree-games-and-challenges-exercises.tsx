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
    title: "State the commitment policy before you state the code",
    objective: "Practice turning Merkle tree folklore into one explicit contract another team can reproduce.",
    starterPrompt:
      "Write down the policy for one Merkle system over chunked file data: leaf encoding, node encoding, odd-leaf handling, and what the proof envelope must carry.",
    prompts: [
      "Which bytes are hashed at the leaf boundary?",
      "How are internal nodes domain-separated from leaves?",
      "What happens when a level has an odd number of hashes?",
      "Which proof fields must be explicit for another process to verify the path correctly?",
    ],
    acceptanceCriteria: [
      "You define leaf and internal-node encoding separately.",
      "You pick and justify one odd-leaf policy explicitly.",
      "You include at least leaf index, leaf count, and sibling orientation in the proof contract.",
    ],
    hints: [
      "A Merkle proof is reproducible only if the policy is reproducible.",
      "Two locally correct implementations can still disagree if the policy is underspecified.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Read a pointer tree and explain why flat levels are calmer",
    objective: "Compare a pointer-rich node tree with a flat level representation from an ownership and operations perspective.",
    starterPrompt:
      "You inherit one design with `Rc<Node>` parent and child pointers and another design with `Vec<Vec<Hash>>` plus proof steps as value types.",
    prompts: [
      "Which design is easier to serialize or send across a queue?",
      "Which design is easier to parallelize level by level?",
      "Which design is easier to make persistent through copy-on-write snapshots?",
      "Which design carries less incidental ownership machinery for the same proof workload?",
    ],
    acceptanceCriteria: [
      "You explain why Merkle operations usually do not need a pointer graph at all.",
      "You identify at least one win for flat levels in serialization or parallelism.",
      "You mention one tradeoff if a system later needs richer navigation than proof generation and verification alone.",
    ],
    hints: [
      "The question is not whether pointers can work. It is whether they help this workload.",
      "Merkle trees are often commitment layers first and navigation trees second.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Implement a basic Merkle tree API",
    objective: "Build a small owner that constructs levels from leaves and exposes a root plus proof generation.",
    starterPrompt:
      "Implement a `MerkleTree` over `&str` leaves with `from_leaves`, `root`, and `proof(index)` using flat per-level storage.",
    prompts: [
      "Keep the owner as flat vectors of hashes.",
      "Make odd-leaf handling explicit in the build loop.",
      "Keep proof steps as small value types rather than borrowed references into the tree.",
      "Do not use `Rc`, `RefCell`, or raw pointers.",
    ],
    acceptanceCriteria: [
      "The tree owns its hashed levels directly.",
      "Proof generation returns a deterministic sibling path.",
      "The design stays easy to serialize and easy to move.",
      "The chapter lab or your local run demonstrates a valid proof for one leaf.",
    ],
    hints: [
      "A level builder over `chunks(2)` is enough for the core logic.",
      "Proof generation is just sibling selection plus parent index movement.",
    ],
  },
  {
    number: 4,
    kind: "debugging or refactoring",
    title: "Repair a proof verifier that forgot orientation",
    objective: "Fix one of the most common practical proof bugs: sibling value without sibling position.",
    starterPrompt:
      "You inherit `verify_proof` that hashes sibling values in one fixed order and ignores whether the sibling was left or right of the current hash.",
    prompts: [
      "Why is sibling order part of the proof contract?",
      "Which branch should hash `sibling || acc` and which should hash `acc || sibling`?",
      "What test vector would catch this bug immediately?",
      "How would canonical serialization mistakes create the same kind of disagreement?",
    ],
    acceptanceCriteria: [
      "You explain the orientation bug concretely.",
      "You repair the verifier with an explicit left-or-right branch.",
      "You mention one small deterministic test case that proves the repair.",
    ],
    hints: [
      "A sibling value alone is not enough information.",
      "The smallest four-leaf tree is usually the best proof bug trap.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Parallelize the wide levels, not the whole idea blindly",
    objective: "Choose where parallelism helps and where it only adds scheduler cost.",
    starterPrompt:
      "You want faster tree construction for large batches. Sketch a level-wise parallel build with Rayon or another worker strategy, then decide when the build should fall back to serial work near the root.",
    prompts: [
      "What is the independent unit of work within one level?",
      "What threshold would stop parallelism on tiny upper levels?",
      "Would the parallel path still own the same flat data structure?",
      "What metric would confirm the parallel build actually helps the target workload?",
    ],
    acceptanceCriteria: [
      "You parallelize sibling-pair hashing within a level, not arbitrary cross-level dependencies.",
      "You define one threshold or condition for switching back to serial work.",
      "You keep the ownership model compatible with the serial version.",
      "You mention one measurement such as build latency, CPU utilization, or batch throughput.",
    ],
    hints: [
      "Level-by-level parallelism is the calm default because the dependency graph is already staged for you.",
      "Parallel work that becomes smaller every round usually wants a cutoff.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose challenge tracks for content-addressed storage, game integrity, and distributed verification",
    objective: "Turn the chapter topics into three production-shaped challenge designs with explicit budgets and replay policy.",
    starterPrompt:
      "Design three systems: a chunk store keyed by hash, a tamper-evident game checkpoint feed, and a verifier service that checks remote proofs before downloading full payloads.",
    prompts: [
      "Which system needs proof envelopes versioned across services?",
      "Which system needs snapshot roots durable enough for replay or dispute resolution?",
      "Which system wants batch verification or bounded worker pools?",
      "Which failure and observability signals would you require before rollout?",
    ],
    acceptanceCriteria: [
      "You describe all three challenge systems with distinct goals and boundaries.",
      "You define one ownership or durability boundary for each system.",
      "You mention at least one batching, retry, or queue budget where the workload justifies it.",
      "You include at least one observability hook such as proof-failure rate, oldest queue age, or checkpoint publication lag.",
    ],
    hints: [
      "The three challenge tracks are deliberately different so you do not solve them all with one slogan.",
      "A strong answer keeps commitment policy, storage policy, and execution policy separate.",
    ],
  },
]

const challengeTracks = [
  {
    title: "Bronze · Content-addressed storage",
    points: 10,
    goals: [
      "Chunk data into deterministic leaves.",
      "Store blobs by hash and build one object root.",
      "Verify one fetched chunk with an inclusion proof.",
    ],
  },
  {
    title: "Silver · Tamper-evident game state",
    points: 15,
    goals: [
      "Commit one turn or tick per leaf.",
      "Publish checkpoint roots over time.",
      "Detect one tampered replay by root mismatch or failed proof.",
    ],
  },
  {
    title: "Gold · Distributed verification",
    points: 20,
    goals: [
      "Version the proof envelope.",
      "Add bounded parallel verification workers.",
      "Trace queue wait, proof failure, and replay-safe completion explicitly.",
    ],
  },
]

const reviewQuestions = [
  "Why is odd-leaf handling a protocol decision rather than a local helper detail?",
  "Why are flat levels usually calmer than pointer trees for Merkle workloads?",
  "What makes sibling orientation part of the proof itself?",
  "When is level-wise parallelism worth the overhead, and when should it stop?",
  "Why should a proof envelope carry more than only the sibling hashes?",
]

const workingLoop = [
  "Write the commitment policy before you write the tree builder.",
  "Keep the storage owner flat unless a richer navigation requirement becomes real.",
  "Treat proof verification as a contract check, not only as a hash loop.",
  "If you parallelize, parallelize the level and keep the cutoff explicit.",
  "If you distribute proofs, version the envelope and instrument failures.",
]

export function PageCh38MerkleTreeGamesAndChallengesExercises() {
  const { markPageComplete, setCurrentPage } = useBook()
  const pageIndex = getPageIndexById("ch38-merkle-tree-games-and-challenges-exercises")
  const mainPageIndex = getPageIndexById("ch38-merkle-tree-games-and-challenges")
  const page = PAGES[pageIndex]

  useEffect(() => {
    markPageComplete(pageIndex)
  }, [markPageComplete, pageIndex])

  return (
    <div className="h-full flex flex-col">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
          <Trophy className="h-4 w-4" />
          Chapter 38 · Page {pageIndex + 1} of {PAGES.length}
        </div>
        <h2 className="text-3xl font-bold text-foreground mb-2">{page.title}</h2>
        <p className="text-muted-foreground max-w-3xl mx-auto">
          Practice Merkle design the way it survives production review: explicit policy, flat ownership, replay-safe proof
          handling, and challenge tracks with visible scoring.
        </p>
      </div>

      <div data-book-scroll-area className="flex-1 space-y-6 overflow-y-auto pr-1">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4 flex-col md:flex-row">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">How to use this page</h3>
              <p className="text-sm text-muted-foreground leading-6">
                Treat each exercise as a commitment-system review. The strongest answer explains which bytes are committed,
                how proofs are reproduced, where the root becomes durable, and which queue or parallel boundary is really worth
                proof handling, and challenge tracks with visible scoring.
              </p>
            </div>
            <Button variant="outline" onClick={() => setCurrentPage(mainPageIndex)} className="gap-2 shrink-0">
              <ArrowLeft className="h-4 w-4" />
              Back to Chapter 38
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
          <h3 className="text-lg font-semibold text-foreground mb-3">Challenge tracks and scoring</h3>
          <div className="grid gap-4 lg:grid-cols-3">
            {challengeTracks.map((track) => (
              <div key={track.title} className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="font-medium text-foreground">{track.title}</div>
                  <span className="text-xs uppercase tracking-[0.2em] text-primary">{track.points} pts</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
                  {track.goals.map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
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
                  Merkle drill
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
          title="Runnable lab · Verify one inclusion proof"
          description={
            <>
              Repair the verifier so it recomputes the root with the correct sibling orientation. The checker expects the
              real proof to validate for the good leaf and fail for a tampered leaf.
            </>
          }
          filename="merkle_proof_verify_lab.rs"
          runKey="ch38_ex_merkle_proof_verify"
          expectedOutput={"verified good = true\nverified bad = false"}
          helperText={
            <>
              Tip: start from <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">hash_leaf(leaf)</code>,
              then fold upward through the proof. If the sibling is on the left, hash
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">sibling || acc</code>.
              Otherwise hash
              <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs mx-1">acc || sibling</code>.
            </>
          }
          initialCode={`type Hash = u32;

#[derive(Debug, Clone, Copy)]
struct ProofStep {
    sibling: Hash,
    sibling_is_left: bool,
}

fn hash_bytes(tag: u8, bytes: &[u8]) -> Hash {
    let mut hash = 2_166_136_261_u32 ^ tag as u32;

    for &byte in bytes {
        hash ^= byte as u32;
        hash = hash.wrapping_mul(16_777_619);
    }

    hash
}

fn hash_leaf(text: &str) -> Hash {
    hash_bytes(0, text.as_bytes())
}

fn hash_node(left: Hash, right: Hash) -> Hash {
    let mut bytes = [0_u8; 8];
    bytes[..4].copy_from_slice(&left.to_le_bytes());
    bytes[4..].copy_from_slice(&right.to_le_bytes());
    hash_bytes(1, &bytes)
}

fn verify_proof(_leaf: &str, _proof: &[ProofStep], _expected_root: Hash) -> bool {
    false
}

fn main() {
    let alpha = hash_leaf("alpha");
    let beta = hash_leaf("beta");
    let gamma = hash_leaf("gamma");
    let delta = hash_leaf("delta");

    let left = hash_node(alpha, beta);
    let right = hash_node(gamma, delta);
    let root = hash_node(left, right);

    let proof = vec![
        ProofStep {
            sibling: delta,
            sibling_is_left: false,
        },
        ProofStep {
            sibling: left,
            sibling_is_left: true,
        },
    ];

    println!("verified good = {}", verify_proof("gamma", &proof, root));
    println!("verified bad = {}", verify_proof("gxmxa", &proof, root));
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
            By the end of this page, you should be able to specify a Merkle policy precisely, implement or review a proof
            verifier without hand-waving, choose where parallel construction actually pays, and turn content-addressed,
            tamper-evident, and distributed verification ideas into designs another senior engineer can score and operate.
          </p>
        </section>
      </div>
    </div>
  )
}

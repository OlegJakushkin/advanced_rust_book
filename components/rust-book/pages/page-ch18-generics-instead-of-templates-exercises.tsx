"use client"

// Chapter 18 · exercise workbook page (ch18-generics-instead-of-templates-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh18GenericsInsteadOfTemplatesExercises

export {}

/*
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
    title: "State the two checks at two times",
    objective: "Explain precisely where and when a Rust generic is type-checked versus a C++ template.",
    starterPrompt: "The chapter's mental model is that a Rust generic is checked twice while a C++ template is checked once. Write a short paragraph that states both checks for the generic function first_key, referencing its where T: Keyed bound.",
    prompts: [
      "Name what the compiler verifies at the definition of first_key, before any caller exists.",
      "Name what is verified again, trivially, when a concrete type like Job is substituted.",
      "Contrast that with where a missing operation surfaces in a C++ template.",
      "Say which of the two checks reports a missing trait bound, and in whose code the error points.",
    ],
    acceptanceCriteria: [
      "The answer states that the body of first_key is checked once at definition against the declared bound T: Keyed.",
      "It states that the second check, at the call site, only confirms the concrete type satisfies the already-declared bound.",
      "It says a C++ template defers all checking to instantiation, so a missing operation surfaces deep inside the body at the caller.",
      "It identifies that passing a non-Keyed type fails with an error that names the missing bound at the call.",
    ],
    hints: [
      "The definition-time check is what lets the body legally call item.key().",
      "In Rust the contract is explicit and enforced up front; in C++ it is implicit and discovered late.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace which bound gates which method",
    objective: "Read a generic type and identify exactly which operations require a trait bound and which do not.",
    starterPrompt: "Using the Batch<T> listing from the chapter, walk through which items of the API work for any T and which require T: Keyed. Batch<T> itself declares no bound; only first_key adds where T: Keyed.",
    prompts: [
      "List the methods on Batch<T> (new and len) and explain why they compile for every type.",
      "Explain why first_key needs the where T: Keyed clause and what its body calls.",
      "Predict the exact compiler behavior if you call first_key on a Batch of a type that does not implement Keyed.",
      "State whether moving the bound onto impl<T> Batch<T> would change which methods are usable, and why.",
    ],
    acceptanceCriteria: [
      "The answer correctly identifies new and len as unbounded because they only touch storage, not item behavior.",
      "It explains first_key requires Keyed because its body calls item.key(), a trait method.",
      "It states that a non-Keyed item type produces a compile error naming the missing Keyed bound at the call site.",
      "It notes that putting the bound on the impl would gate all methods, including len, on T: Keyed, which is unnecessary.",
    ],
    hints: [
      "Storage of a value never needs a trait; calling a method on it does.",
      "Keep bounds as narrow as possible so unrelated methods stay usable for all types.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Turn a copied helper into one bounded generic",
    objective: "Lift a pattern that recurs across two concrete types into a single parameterized API with a trait bound.",
    starterPrompt: "You have two near-identical functions, max_key_job(&[Job]) and max_key_task(&[Task]), each returning the largest id-like key. Replace them with one generic fn max_key<T: Keyed>(items: &[T]) -> Option<u64>.",
    prompts: [
      "Define a Keyed trait with fn key(&self) -> u64 if you have not already, and implement it for both item types.",
      "Write max_key so it iterates the slice, calls key() on each item, and returns the maximum.",
      "Keep the parameter a borrowed slice &[T] so callers keep ownership of their storage.",
      "Confirm the function compiles once and serves both Job and Task without duplication.",
    ],
    acceptanceCriteria: [
      "The signature is fn max_key<T: Keyed>(items: &[T]) -> Option<u64> (or an equivalent where clause).",
      "The body calls item.key() through the bound and returns None for an empty slice.",
      "Both Job and Task are served by the single generic with no copied per-type function remaining.",
      "The function takes &[T] and does not require ownership of a Vec<T>.",
    ],
    hints: [
      "The chapter's rule is to generalize only after a second real case proves the abstraction.",
      "An iterator over the slice plus map(|i| i.key()).max() is one expression.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Replace a type parameter with an associated type",
    objective: "Move a trait's natural related type from a free parameter into an associated type so callers stop spelling it out.",
    starterPrompt: "Start from a trait Encoder<O> { fn encode(&self, input: &[u8]) -> O; } where every implementor really has exactly one output type. Rewrite it as the chapter's Encoder with type Output, and reimplement HexPair so its Output is [u8; 2].",
    prompts: [
      "Change the trait so the result type is type Output rather than a generic parameter O.",
      "Implement Encoder for HexPair with type Output = [u8; 2] and the two-nibble encode body.",
      "Show a call site and confirm the caller never writes the output type.",
      "Explain why an associated type is the right choice when each implementor has one natural result type.",
    ],
    acceptanceCriteria: [
      "The trait declares type Output and encode returns Self::Output.",
      "HexPair pins type Output = [u8; 2] and encodes one byte into two hex digits.",
      "The call site invokes encode without naming [u8; 2] anywhere.",
      "The answer explains that a free parameter would let one type implement Encoder many times, while an associated type fixes one output per implementor.",
    ],
    hints: [
      "type Output belongs in both the trait and each impl block.",
      "If a type should have exactly one related type, that is the signal for an associated type, not a parameter.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Fix the const-generic length error",
    objective: "Diagnose and repair a const-generic type whose length does not line up with its array, and keep the length in the type.",
    starterPrompt: "A teammate wrote FixedWindow<T, const N: usize> with items: [T; N] but their last() reads items[N] and their constructor passes a 4-element array while annotating the type as N = 3. The code does not compile. Identify both defects and fix them.",
    prompts: [
      "Explain why items[N] is wrong and what the correct last-element index is.",
      "Explain why constructing with four elements but a declared N of 3 is a type mismatch, not a runtime panic.",
      "Correct the index and make the construction consistent so N equals the real array length.",
      "State what runtime check this const-generic design removes compared to a Vec-based window.",
    ],
    acceptanceCriteria: [
      "The answer changes the index from items[N] to items[N - 1] for the last element.",
      "It explains the length mismatch is a compile error because N is part of the type, not a runtime bounds check.",
      "The corrected code constructs the window so N matches the array's element count.",
      "It states that making the length part of the type turns an out-of-range length into a compile error rather than a runtime check.",
    ],
    hints: [
      "An array of length N has valid indices 0 through N - 1.",
      "With const N, the length travels with the type, so the compiler catches the mismatch before main runs.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Decide whether to generify the core crate",
    objective: "Weigh monomorphization cost against reuse when proposing to lift a recurring batch type into a generic in a widely used crate.",
    starterPrompt: "Your team's core crate has a concrete JobBatch used by twelve downstream crates. A second item type now needs the same batching, and someone proposes a generic Batch<T> in the core crate. Write a short recommendation grounded in the chapter's cost model.",
    prompts: [
      "State the chapter's decision order: generalize only when a second real case proves the abstraction.",
      "Explain the runtime payoff of monomorphization and why it is free at runtime.",
      "Explain the build-time price: a widely instantiated generic in a core crate can dominate compile time and binary size.",
      "Give a concrete recommendation, including whether some instantiations should be confined or kept concrete.",
    ],
    acceptanceCriteria: [
      "The recommendation invokes the rule to generalize on the second real case, not as a reflex.",
      "It states monomorphization makes each instantiation as fast as hand-written code with no boxing or vtable.",
      "It identifies that a heavily instantiated generic in a core crate can inflate compile time and binary size.",
      "It gives a concrete decision, such as adding the generic but limiting which crates instantiate it, or keeping a concrete type where reuse is marginal.",
    ],
    hints: [
      "Generics are free at runtime, not free at build time.",
      "A generic is a contract you maintain plus a set of instantiations you pay to compile.",
    ],
  },
]

const reviewQuestions = [
  "At which two points is a Rust generic type-checked, and what does each check verify?",
  "Why does Batch<T> declare no trait bound while first_key requires where T: Keyed?",
  "What is monomorphization, and why does it make generic code as fast as hand-written code at runtime?",
  "When should you prefer an associated type over an extra generic type parameter on a trait?",
  "What does a const generic such as const N: usize put into the type, and what runtime check does it eliminate?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · Const-generic keyed batch"}
  filename="fixed_batch_lab.rs"
  runKey="ch18_ex_fixedbatch"
  expectedOutput={"len = 3\nkey sum = 40"}
  helperText={"Implement key_sum on a const-generic FixedBatch<T, N> whose items are bounded by the Keyed trait. The length N is part of the type, and the body must call key() through the bound."}
  initialCode={`trait Keyed {
    fn key(&self) -> u64;
}

#[derive(Debug)]
struct Job {
    id: u64,
}

impl Keyed for Job {
    fn key(&self) -> u64 {
        self.id
    }
}

struct FixedBatch<T, const N: usize> {
    items: [T; N],
}

impl<T: Keyed, const N: usize> FixedBatch<T, N> {
    fn len(&self) -> usize {
        N
    }

    fn key_sum(&self) -> u64 {
        // TODO: iterate over self.items and sum the result of item.key().
        // Replace the placeholder below with the real reduction.
        0
    }
}

fn main() {
    let batch = FixedBatch {
        items: [Job { id: 10 }, Job { id: 22 }, Job { id: 8 }],
    };
    println!("len = {}", batch.len());
    println!("key sum = {}", batch.key_sum());
}
`}
/>
*/

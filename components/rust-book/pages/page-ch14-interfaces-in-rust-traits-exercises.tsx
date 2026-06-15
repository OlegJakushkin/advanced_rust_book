"use client"

// Chapter 14 · exercise workbook page (ch14-interfaces-in-rust-traits-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh14InterfacesInRustTraitsExercises

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
    title: "Separate the trait, the impl, and the call site",
    objective: "Explain where capability is attached in Rust and why a struct can satisfy several unrelated traits.",
    starterPrompt: "Using the chapter's triangle (trait, concrete type, call site), describe how FixedLimit becomes a RetryPolicy and how a call site like evaluate names that trait.",
    prompts: [
      "Name the three corners of the triangle and which one the impl block links.",
      "State why the same struct can implement Display, Iterator, and RetryPolicy without any of them knowing about the others.",
      "Say where the dispatch decision is made: at the trait, at the impl, or at the call site.",
      "Explain what 'composition over inheritance' means concretely in this model.",
    ],
    acceptanceCriteria: [
      "The answer identifies the trait as the named method set, the concrete type as the data, and the call site as the place that names the trait as a bound or a dyn object.",
      "It states that the impl block is what links a type to a trait, separate from the type definition.",
      "It explains that capability is added in independent layers, so one struct can carry many unrelated impls.",
      "It locates the dispatch choice at the call site, not at the trait or impl.",
    ],
    hints: [
      "An impl is a third thing, not part of the struct and not part of the trait.",
      "Display and RetryPolicy never mention each other; only the type ties them together.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the RetryPolicy associated type and where-clause",
    objective: "Read the static-dispatch example and explain how the associated type and bound pin the output to bool.",
    starterPrompt: "Read the traits_bounds_associated_types listing: the RetryPolicy trait with type Decision, FixedLimit setting Decision = bool, and fn evaluate bounded by RetryPolicy<Decision = bool>.",
    prompts: [
      "State what value type Self::Decision resolves to for FixedLimit and where that is declared.",
      "Explain what the where-clause P: RetryPolicy<Decision = bool> lets evaluate assume about decide's return.",
      "Identify which method evaluate calls that FixedLimit overrides and which it inherits unchanged.",
      "Predict the two printed lines for FixedLimit { max: 3 } and evaluate(&policy, 2).",
      "Explain why Decision is an associated type rather than a generic parameter on the trait, and what would change at call sites if type Decision were replaced with a trait-level <D>.",
    ],
    acceptanceCriteria: [
      "The answer says Self::Decision is bool because the impl declares type Decision = bool.",
      "It explains the where-clause guarantees decide returns bool so format! can use it directly with no turbofish or conversion.",
      "It notes label is overridden by FixedLimit while should_log is inherited from the default method.",
      "It predicts the output lines 'fixed-limit => true' and 'log = true'.",
      "It explains Decision is an associated type because each policy has one natural output, and that a trait-level generic <D> would force callers to disambiguate the instantiation with turbofish or extra annotations.",
    ],
    hints: [
      "decide(2) for max 3 evaluates 2 < 3.",
      "Only label appears in the impl; should_log does not, so the default stands.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Add a second RetryPolicy with a default override",
    objective: "Implement a new RetryPolicy that still satisfies the Decision = bool bound while customizing a default method.",
    starterPrompt: "Add a unit struct AlwaysRetry (no fields, written without braces) that implements RetryPolicy with Decision = bool, returns true from decide regardless of attempts, labels itself 'always', and overrides should_log to return false.",
    prompts: [
      "Set type Decision = bool so AlwaysRetry can be passed to evaluate unchanged.",
      "Implement decide to ignore attempts and return true.",
      "Override label to return 'always' and should_log to return false.",
      "Call evaluate(&AlwaysRetry, 99) and should_log and confirm both reuse the existing function and trait.",
    ],
    acceptanceCriteria: [
      "AlwaysRetry sets type Decision = bool and compiles against fn evaluate without changing evaluate.",
      "decide returns true for any attempts value, ignoring the argument.",
      "label returns 'always' and should_log returns false, overriding the default.",
      "evaluate(&AlwaysRetry, 99) yields 'always => true' and AlwaysRetry.should_log() yields false (AlwaysRetry is a unit struct, so it is spelled without braces).",
    ],
    hints: [
      "Because Decision is bool, no change to evaluate's signature is needed.",
      "Overriding should_log just means writing the method in the impl block instead of inheriting it.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Make a Plugin trait usable both generically and behind dyn",
    objective: "Design an object-safe trait and write one generic call site and one trait-object call site over it.",
    starterPrompt: "Starting from the Plugin trait (name and run, both &self), write fn apply_one<P: Plugin>(p: &P, input: &str) -> String for static dispatch and confirm the same trait still works in Vec<Box<dyn Plugin>>.",
    prompts: [
      "Keep run(&self, input: &str) -> String with no generic method parameters so the trait stays object-safe.",
      "Write apply_one with a generic bound P: Plugin that formats name and run like run_all does.",
      "Build a Vec<Box<dyn Plugin>> with Uppercase and Prefix and confirm it compiles unchanged.",
      "Explain in one line why the same trait serves both call sites.",
    ],
    acceptanceCriteria: [
      "apply_one has signature fn apply_one<P: Plugin>(p: &P, input: &str) -> String and uses static dispatch.",
      "The trait keeps only &self methods with no generic parameters, so Box<dyn Plugin> still compiles.",
      "Both apply_one(&Uppercase, \"rust\") and a Vec<Box<dyn Plugin>> path produce matching 'name => output' strings.",
      "The explanation states the trait is object-safe, which is what permits both the generic and the dyn use.",
    ],
    hints: [
      "A generic bound monomorphizes; the dyn version goes through a vtable, but the trait definition is identical.",
      "Object safety here just means no generic methods and no by-value Self in the signature.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Repair a trait that cannot be boxed",
    objective: "Diagnose an object-safety violation and refactor the trait so Box<dyn Trait> compiles.",
    starterPrompt: "A teammate added fn run<T: Display>(&self, input: T) -> String to the Plugin trait and now Vec<Box<dyn Plugin>> fails to compile. Identify the cause and restore object safety.",
    prompts: [
      "Explain why a generic method prevents the compiler from laying out a single fixed vtable slot.",
      "State which object-safety rule the generic method violates.",
      "Refactor run back to a non-generic signature (for example &self, input: &str) -> String) that keeps the boxed pipeline working.",
      "Confirm run_all over Vec<Box<dyn Plugin>> compiles again after the change.",
    ],
    acceptanceCriteria: [
      "The diagnosis names the generic method run<T> as the object-safety violation.",
      "It explains a vtable needs one fixed slot per method, which a generic method cannot provide because each T would need its own entry.",
      "The refactor removes the generic parameter, giving a concrete &self method signature.",
      "After the change, Vec<Box<dyn Plugin>> and run_all compile.",
    ],
    hints: [
      "The compiler cannot pick one slot for infinitely many T at the indirect call.",
      "Trade the generic parameter for a concrete type such as &str.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Decide static versus dynamic dispatch for a processing stage API",
    objective: "Choose a dispatch strategy for a configurable pipeline and justify it against the chapter's tradeoffs.",
    starterPrompt: "The service from the opening scenario needs a processing stage that operators enable by configuration today and extend with validate, redact, and enrich stages later. Decide whether the stage list should be a generic bound or Vec<Box<dyn Stage>> and defend the choice.",
    prompts: [
      "State which property of the requirement (config-selected, heterogeneous, runtime-assembled) points toward trait objects.",
      "Name the cost you accept with dyn (vtable indirection, no monomorphization) and why it is acceptable here.",
      "Explain why you would still keep the Stage trait object-safe even if today's stages are few.",
      "Note the breaking-change risk of later adding a generic method or by-value Self return to the published trait.",
    ],
    acceptanceCriteria: [
      "The answer selects Vec<Box<dyn Stage>> and ties the choice to config-driven, heterogeneous, runtime-assembled stages.",
      "It acknowledges the vtable indirection cost and argues it is negligible relative to per-stage text work.",
      "It commits to keeping the trait object-safe from the start to avoid a future retrofit.",
      "It identifies that adding a generic method or a by-value Self return later would foreclose dyn and break the API.",
    ],
    hints: [
      "Configuration assembling a heterogeneous list at runtime is the canonical trait-object case.",
      "Object safety is cheap to preserve up front and a breaking change to add back later.",
    ],
  },
  {
    number: 7,
    kind: "code reading",
    title: "Use a newtype to satisfy the orphan rule",
    objective: "Explain why a bare foreign-trait-for-foreign-type impl is rejected and how a newtype wrapper makes it legal.",
    starterPrompt: "You want to give Vec<String> a custom Display that joins the items with commas. Writing impl Display for Vec<String> directly is rejected by the orphan rule because both Display and Vec are foreign to your crate. Wrap the value in a local newtype struct Lines(Vec<String>) and implement Display for that instead.",
    prompts: [
      "State the orphan rule: an impl is allowed only when the trait, the type, or both are local to your crate.",
      "Explain why impl Display for Vec<String> violates it, since neither Display nor Vec belongs to your crate.",
      "Define a local newtype struct Lines(Vec<String>) and write impl Display for Lines, since Lines is now local.",
      "Note that you reach the inner value through self.0 inside the impl.",
    ],
    acceptanceCriteria: [
      "The answer states the orphan rule: at least one of the trait or the type must be local to the crate.",
      "It explains the bare impl Display for Vec<String> is rejected because both Display and Vec are foreign.",
      "It introduces a local newtype struct Lines(Vec<String>) and implements Display for Lines, which is now allowed.",
      "The Display body reads the wrapped value through self.0.",
    ],
    hints: [
      "The newtype is local to your crate, so the impl now has a local type even though Display is foreign.",
      "A tuple struct's single field is reached with self.0.",
    ],
  },
]

const reviewQuestions = [
  "What links a concrete type to a trait in Rust, and why does that separation let one struct implement many unrelated traits?",
  "How does a generic bound's dispatch differ from a trait object's dispatch, and what runtime cost does each carry?",
  "When should a trait use an associated type instead of a generic type parameter, and what symptom appears at call sites if you choose wrong?",
  "What does object safety require of a trait's methods, and why does each rule exist for a single indirect call through a vtable?",
  "Why is deciding up front whether a trait must work behind dyn important, given that adding a generic method or a by-value Self return later is a breaking change?",
  "What does a supertrait such as trait Audit: Identify require of every implementer, and what does it let Audit's default methods assume?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · object-safe stage list with a default method"}
  filename="stage_pipeline_lab.rs"
  runKey="ch14_ex_stage"
  expectedOutput={"trim => hi\nwrap => [b]  hi  [/b]\nstages = 2"}
  helperText={"Two unrelated structs implement one object-safe Stage trait and live together in a Vec<Box<dyn Stage>>. Each stage receives the same raw input independently; the stages are not chained, so Wrap sees the untrimmed \"  hi  \", not Trim's output. The trait's default describe method drives every stage through the vtable; fill in the two run methods so the output prints correctly."}
  initialCode={`trait Stage {
    fn name(&self) -> &'static str;
    fn run(&self, input: &str) -> String;

    // Default method: reuse name() and run() so every stage prints the same way.
    fn describe(&self, input: &str) -> String {
        format!("{} => {}", self.name(), self.run(input))
    }
}

struct Trim;
struct Wrap {
    tag: &'static str,
}

impl Stage for Trim {
    fn name(&self) -> &'static str {
        "trim"
    }
    fn run(&self, input: &str) -> String {
        // TODO: return the input with leading and trailing whitespace removed.
        input.to_string()
    }
}

impl Stage for Wrap {
    fn name(&self) -> &'static str {
        "wrap"
    }
    fn run(&self, input: &str) -> String {
        // TODO: wrap input as [tag]input[/tag] using self.tag.
        input.to_string()
    }
}

// Each stage receives the same raw input independently; this is a fan-out,
// not a chain, so the output of one stage is never fed into the next.
fn run_stages(stages: &[Box<dyn Stage>], input: &str) -> Vec<String> {
    stages.iter().map(|s| s.describe(input)).collect()
}

fn main() {
    let stages: Vec<Box<dyn Stage>> = vec![
        Box::new(Trim),
        Box::new(Wrap { tag: "b" }),
    ];

    for line in run_stages(&stages, "  hi  ") {
        println!("{}", line);
    }
    println!("stages = {}", stages.len());
}
`}
/>
*/

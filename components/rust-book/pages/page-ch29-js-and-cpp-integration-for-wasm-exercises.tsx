"use client"

// Chapter 29 · exercise workbook page (ch29-js-and-cpp-integration-for-wasm-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh29JsAndCppIntegrationForWasmExercises

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
    title: "State the two-heaps model in your own words",
    objective: "Explain why every non-numeric value crossing the WebAssembly boundary is copied rather than shared.",
    starterPrompt: "The chapter says the shape worth memorizing is two separate heaps with one shared byte array between them. Write a short paragraph that explains what each side owns and what crosses the boundary for build_label and sum_bytes.",
    prompts: [
      "Name what the JavaScript host owns and what the module owns inside its single linear memory.",
      "Identify the only memory region both sides can touch directly.",
      "For build_label, say what is copied in and what is copied back out.",
      "Explain why a u32 result from sum_bytes needs no copy.",
    ],
    acceptanceCriteria: [
      "The answer states that JavaScript holds its own objects while the module holds its own stack and heap inside one linear memory.",
      "The answer identifies the shared linear memory as the only region both sides can touch.",
      "It explains that each &str argument to build_label is copied into linear memory and the returned String is copied back into the host.",
      "It explains that a u32 rides the native interface directly with no allocation and no copy.",
    ],
    hints: [
      "The boundary does not disappear under WebAssembly; it becomes an explicit copy you can see and measure.",
      "Numbers are the only values that travel without an encode-and-copy step.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the C ABI crossing in route_score",
    objective: "Read the C-ABI example and account for every invariant the unsafe block depends on.",
    starterPrompt: "Study the wasm_cpp_ffi_boundary listing where route_score forwards a &str to cpp_route_score as a pointer and length. Trace exactly what crosses the inner C-ABI seam and why the unsafe blocks are sound.",
    prompts: [
      "List what route_score passes to the shim and explain why a slice is not passed directly.",
      "State the three invariants the SAFETY comments name for the pointer, the length, and the borrow duration.",
      "Identify which functions are unsafe and which stay in safe Rust.",
      "Explain what cpp_route_score returns for the input \"/orders\" and why.",
    ],
    acceptanceCriteria: [
      "The answer notes that route.as_ptr() and route.len() cross because the C ABI has no slice type.",
      "It names the valid-pointer, correct-length, and read-only-for-the-call invariants from the SAFETY comments.",
      "It identifies that only the wrapper and the shim are unsafe while the rest stays safe Rust.",
      "It computes the returned score as bytes.len() as u32 times 10, giving 70 for the 7-byte \"/orders\".",
    ],
    hints: [
      "from_raw_parts reconstructs the slice inside the shim only for the duration of the call.",
      "Count the characters in \"/orders\" before multiplying.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Add a byte-returning boundary function",
    objective: "Implement an exported-style function that takes a borrowed byte slice and returns an owned buffer copied back to the host.",
    starterPrompt: "Following the sum_bytes pattern, write fn mask_bytes(bytes: &[u8], key: u8) -> Vec<u8> that returns each input byte XORed with key, so the host receives a freshly owned buffer copied out of linear memory.",
    prompts: [
      "Keep the parameter as &[u8] so the input is borrowed and not owned by the module.",
      "Return an owned Vec<u8> that the host will copy back and own separately.",
      "Use an iterator or an explicit loop; do not mutate the input slice.",
      "Note in a comment which direction each value is copied across the boundary.",
    ],
    acceptanceCriteria: [
      "The signature is exactly fn mask_bytes(bytes: &[u8], key: u8) -> Vec<u8>.",
      "Each output byte equals the corresponding input byte XORed with key.",
      "The input slice is read but never mutated, and no ownership of the caller's buffer is taken.",
      "For input [1, 2, 3, 4] with key 1 the function returns [0, 3, 2, 5].",
    ],
    hints: [
      "bytes.iter().map(...).collect() builds the owned Vec in one expression.",
      "The borrowed slice is the copy-in; the returned Vec is the copy-out.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Batch crossings instead of crossing per element",
    objective: "Replace a per-element boundary call with a single batched crossing and account for the copy savings.",
    starterPrompt: "A caller currently invokes route_score once per route in a list, paying one boundary crossing per element. Implement fn route_scores(routes: &[&str]) -> Vec<u32> that scores every route in a single call, reusing the route_score logic.",
    prompts: [
      "Accept the whole batch as &[&str] so one crossing covers all routes.",
      "Reuse the existing route_score logic for each element rather than reimplementing the shim call.",
      "Return a Vec<u32> aligned by index with the input routes.",
      "Explain how many boundary crossings this saves compared to calling once per route.",
    ],
    acceptanceCriteria: [
      "The signature is exactly fn route_scores(routes: &[&str]) -> Vec<u32>.",
      "The result length equals the input length and each entry matches route_score for that route.",
      "The implementation reuses route_score rather than duplicating the unsafe shim call.",
      "The answer states the batch makes one crossing instead of one per route.",
    ],
    hints: [
      "routes.iter().map(|r| route_score(r)).collect() keeps the batch in one expression.",
      "The cost you are removing is the per-call boundary overhead, not the arithmetic.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Fix an unsound boundary wrapper",
    objective: "Diagnose and repair an FFI wrapper whose pointer and length invariants do not hold.",
    starterPrompt: "A teammate wrote fn score_prefix(route: &str, n: usize) -> u32 { unsafe { cpp_route_score(route.as_ptr(), n) } } intending to score only the first n bytes, but it can read past the string. Identify the defect and correct the wrapper.",
    prompts: [
      "Explain why passing n unchecked can violate the correct-length invariant from the SAFETY comment.",
      "Decide how to clamp or validate n against route.len() before crossing the seam.",
      "Rewrite the wrapper so the pointer and length always describe a valid read-only region.",
      "State the SAFETY invariants your corrected version guarantees.",
    ],
    acceptanceCriteria: [
      "The answer identifies that n greater than route.len() lets the shim read beyond the borrowed bytes.",
      "The fix clamps the length to at most route.len() (for example n.min(route.len())) before the call.",
      "The corrected wrapper passes a pointer and a length that always describe a valid region for the call.",
      "A written SAFETY comment names the valid-pointer, correct-length, and read-only invariants.",
    ],
    hints: [
      "The C ABI trusts the length you hand it; the wrapper is the only place that can enforce a bound.",
      "n.min(route.len()) keeps the length inside the borrowed slice.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose boundary representations on the cost ladder",
    objective: "Apply the number / bytes / struct / resident-handle cost ladder to a concrete WebAssembly workload.",
    starterPrompt: "The product moves image processing, parsing, and a routing-score calculation into the module. For each of: a per-frame brightness scalar, a parsed config struct sent once at startup, a large image buffer processed every frame, and a parser the host calls thousands of times, choose a boundary representation and justify the cost.",
    prompts: [
      "Map each workload to one rung of the ladder: number, byte array, serialized struct, or resident handle.",
      "Justify each choice in terms of copies per crossing and encode/decode cost.",
      "Decide which workload should keep state resident behind a handle instead of copying per call.",
      "Name one case where reaching for the most convenient type (for example JSON) would make the module slower than the JavaScript it replaced.",
    ],
    acceptanceCriteria: [
      "The brightness scalar is sent as a number with no copy, and the image buffer crosses as a byte array with one copy per crossing.",
      "The parser called thousands of times is kept resident behind a handle to avoid per-call copies, accepting a managed lifetime.",
      "Each choice is justified using copies per crossing or encode-plus-decode cost from the ladder.",
      "The answer names a concrete case (such as a large struct as JSON) where the convenient encoding loses to a compact binary layout.",
    ],
    hints: [
      "A number is free, a byte array is one copy, a struct adds encode plus decode, and a handle trades a per-call copy for a lifetime you manage.",
      "The performance conversation is about the boundary, not the arithmetic inside the module.",
    ],
  },
]

const reviewQuestions = [
  "Why does every value richer than a number get copied when it crosses between the JavaScript host and the WebAssembly module?",
  "What role does wasm-bindgen play after a browser-facing crate is compiled as a cdylib?",
  "On the cost ladder of boundary representations, how do a number, a byte array, a serialized struct, and a resident handle differ in per-crossing cost?",
  "How do the outer Rust-to-JavaScript seam and the inner Rust-to-C-shim seam differ in how data and safety are managed?",
  "Why is the WebAssembly performance discussion almost always about the boundary rather than the arithmetic inside the module?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · Boundary crossings and the cost ladder"}
  filename="wasm_boundary_lab.rs"
  runKey="ch29_ex_boundary"
  expectedOutput={"label = billing::/ready\nsum = 10\nscore = 70\nbatch crossings = 1"}
  helperText={"Model the chapter's boundary contracts in plain std Rust: a string-in/string-out crossing, a byte-slice-in/number-out crossing, a pointer-plus-length C-ABI crossing, and a single batched call. Fill in the TODO in route_scores so the whole batch crosses in one call."}
  initialCode={`// Models the WebAssembly boundary contracts in plain std Rust.
// Two separate heaps with one shared byte array is simulated here by
// passing borrowed slices in and returning owned values out.

fn build_label(service: &str, route: &str) -> String {
    // &str copied in, owned String copied back out.
    format!("{}::{}", service, route)
}

fn sum_bytes(bytes: &[u8]) -> u32 {
    // borrowed slice copied in, u32 rides back with no copy.
    bytes.iter().map(|&value| value as u32).sum()
}

fn route_score(route: &str) -> u32 {
    // Pointer-plus-length C-ABI crossing, modeled: score is len * 10.
    (route.len() as u32) * 10
}

fn route_scores(routes: &[&str]) -> Vec<u32> {
    // TODO: score every route in a single batched crossing,
    // reusing route_score, and return one u32 per route.
    Vec::new()
}

fn main() {
    let label = build_label("billing", "/ready");
    let total = sum_bytes(&[1_u8, 2, 3, 4]);
    let score = route_score("/orders");
    let scores = route_scores(&["/a", "/bb", "/ccc"]);

    println!("label = {}", label);
    println!("sum = {}", total);
    println!("score = {}", score);
    println!("batch crossings = {}", if scores.is_empty() { 0 } else { 1 });
}`}
/>
*/

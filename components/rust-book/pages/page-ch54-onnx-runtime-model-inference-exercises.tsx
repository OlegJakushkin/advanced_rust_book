"use client"

// Chapter 54 · exercise workbook page (ch54-onnx-runtime-model-inference-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh54OnnxRuntimeModelInferenceExercises

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
    title: "Name what the session owns and what you own",
    objective: "Restate the three-stage inference pipeline and identify which stage the ONNX runtime is responsible for.",
    starterPrompt: "The chapter frames inference as a three-stage pipeline with the session in the middle: raw input becomes a tensor, the session turns that tensor into output tensors, and post-processing turns those into a domain decision. In your own words, describe each stage and assign ownership of correctness.",
    prompts: [
      "List the three stages in order and say what data crosses each boundary.",
      "State which single stage the runtime owns and which two stages are ordinary Rust code you write.",
      "Explain why the chapter says the runtime makes the math correct but does nothing to make shapes, dtypes, and label maps correct.",
      "Point to where forward and argmax from the chapter's listings fall in this pipeline.",
    ],
    acceptanceCriteria: [
      "The answer names pre-processing (build the input tensor), the session run (tensor to output tensors), and post-processing (output tensors to a domain decision) in that order.",
      "The answer states that the runtime owns only the middle box and that the two ends are caller-owned Rust code.",
      "The answer maps forward to the session's arithmetic and argmax to caller-owned post-processing.",
      "The answer explains that shape, dtype, and label-map errors are the caller's responsibility, not the runtime's.",
    ],
    hints: [
      "The session owns the math; you own the contract that feeds and reads it.",
      "Re-read the mental-model paragraph: the runtime owns the middle, the two ends are yours.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace one input through the dense layer and argmax",
    objective: "Read the chapter's forward and argmax listing closely enough to predict its exact output by hand.",
    starterPrompt: "Using the chapter's WEIGHTS, BIAS, and the fixed input_tensor [0.5, -1.0, 2.0, 0.25], compute the three logits by hand and determine which class argmax selects, without running the program.",
    prompts: [
      "Write out logits[o] = bias[o] + sum_c weights[o][c] * input[c] for each of the three output classes.",
      "Compute all three logit values to four decimal places.",
      "Apply argmax: which index holds the largest logit, and what score does it print?",
      "Confirm that this is exactly what a one-layer ONNX Gemm operator plus your argmax would produce.",
    ],
    acceptanceCriteria: [
      "The three logits are computed as approximately [-1.5750, 1.0500, 0.9750].",
      "argmax selects class 1 because logit[1] is the largest.",
      "The reported score equals the value of logit[1], approximately 1.0500.",
      "The answer identifies the matmul-plus-bias as the Gemm the runtime would run and argmax as caller-owned post-processing.",
    ],
    hints: [
      "Each logit is one dot product of an input vector with one weight row, plus that row's bias.",
      "argmax never normalizes; it only compares raw logits, so the largest raw value wins.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Add a softmax post-processing stage",
    objective: "Implement a numerically stable softmax as caller-owned post-processing that turns logits into a probability distribution.",
    starterPrompt: "Extend the chapter's one-layer model with fn softmax(logits: &[f32; OUT]) -> [f32; OUT] so the three logits become probabilities that sum to 1.0, then print the confidence of the predicted class.",
    prompts: [
      "Keep the signature fn softmax(logits: &[f32; OUT]) -> [f32; OUT].",
      "Subtract the maximum logit before calling exp so large values do not overflow.",
      "Divide each exponentiated value by the total so the output sums to 1.0.",
      "Print the probability vector and the confidence of the argmax class.",
    ],
    acceptanceCriteria: [
      "softmax borrows the logits and returns a new [f32; OUT] without mutating its input.",
      "The implementation subtracts the maximum logit before exponentiating for numerical stability.",
      "The returned probabilities sum to 1.0 within floating-point rounding.",
      "For the chapter's fixed input the confidence printed for class 1 is approximately 0.5000.",
    ],
    hints: [
      "softmax is post-processing you own, just like argmax; the runtime does not do it for you.",
      "exp() lives on f32 in std, so no external crate is needed.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Extend the batch and verify per-row argmax",
    objective: "Work with a row-major flat tensor by adding a third row and recovering each row by stride without copying the buffer.",
    starterPrompt: "Starting from the chapter's batched listing, add a third input row to the flat Vec<f32> and confirm that the per-row loop slicing with r * IN..(r + 1) * IN still recovers each row correctly and prints the right argmax per row.",
    prompts: [
      "Append a third feature row to build_batch so the flat buffer holds three rows of IN values.",
      "Confirm rows is computed as batch.len() / IN and now equals 3.",
      "Verify the slice &batch[r * IN..(r + 1) * IN] borrows each row without allocating.",
      "Run forward_row and argmax on the new row and state its predicted class and score.",
    ],
    acceptanceCriteria: [
      "The flat Vec<f32> length is a multiple of IN and rows evaluates to 3.",
      "Each row is obtained by slicing the existing buffer, with no per-row allocation or copy.",
      "The loop prints one argmax and score line per row, including the new third row.",
      "The answer explains that one session run over N rows amortizes session overhead better than N single-row runs.",
    ],
    hints: [
      "The batch is one contiguous buffer laid out row-major, exactly how a runtime stores a [rows, features] tensor.",
      "Slicing returns a borrowed &[f32]; the underlying Vec keeps owning the bytes.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Diagnose a shape and dtype mismatch",
    objective: "Reason about why a tensor whose shape or dtype disagrees with the graph either errors or silently returns wrong answers.",
    starterPrompt: "A colleague's session run sometimes errors and sometimes returns confident nonsense after they changed the input builder. The graph declares a named input of shape [4] with dtype f32, but their code now passes a length-3 vector in one path and an i64 buffer in another. Explain each failure and fix the contract.",
    prompts: [
      "Explain what happens when the input length is 3 but the graph fixed the input dimension at 4.",
      "Explain why passing an i64 buffer where the graph expects f32 is a different class of bug.",
      "Identify which of these the runtime can catch at run time and which can run and return wrong logits.",
      "Describe the smallest fix that restores the declared shape and dtype contract.",
    ],
    acceptanceCriteria: [
      "The answer identifies a length-3 input against a fixed [4] input as a shape mismatch that the runtime should reject.",
      "The answer identifies the f32-versus-i64 dtype mismatch as a separate failure that can run and produce confident nonsense.",
      "The answer states that the most common inference bug is a shape or dtype mismatch, not a wrong model.",
      "The fix restores the input to a length-4 f32 tensor matching the named graph input.",
    ],
    hints: [
      "The graph names each input and fixes its shape and dtype; your tensor must match exactly.",
      "A wrong dtype can be reinterpreted byte-for-byte and still produce numbers, which is why it is dangerous.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Choose ort or tract and a session lifecycle",
    objective: "Make and justify a runtime and execution-provider decision under a stated deployment constraint, and place session construction correctly.",
    starterPrompt: "Your team must serve the exported classifier inside an existing Rust service. Constraint A: the service ships as a single binary that cross-compiles cleanly to several targets, no GPU, no native dependencies. Constraint B: the service runs on a CUDA host and latency at the 99th percentile matters. Decide ort versus tract for each, and place session construction in the request lifecycle.",
    prompts: [
      "For Constraint A, choose between the native ort runtime and the pure-Rust tract path and justify it from build and deploy concerns.",
      "For Constraint B, choose a runtime and describe registering execution providers in priority order with CPU fallback.",
      "State where in the service lifecycle the session should be built, and why it must not be rebuilt per request.",
      "Name one tradeoff your chosen execution-provider ordering introduces beyond raw speed.",
    ],
    acceptanceCriteria: [
      "Constraint A selects tract or a pure-Rust path and justifies it by clean cross-compilation and no native or GPU dependency.",
      "Constraint B selects ort and describes registering providers such as CUDA or TensorRT in priority order with CPU fallback.",
      "The answer places session construction once at startup and reuses it across requests, because building a session is the expensive step.",
      "The answer names a concrete provider tradeoff, such as per-operator placement, fallback to CPU, or added native dependency and image size.",
    ],
    hints: [
      "The decision is rarely about raw speed on one model; it is about what your build and deploy story can accept.",
      "Build the session once and run it many times; loading parses, optimizes, and allocates, while running is comparatively cheap.",
    ],
  },
]

const reviewQuestions = [
  "Why is ONNX described as a contract, and what does standardizing operators and tensor declarations let a producer and consumer do independently?",
  "Why is building a session the expensive step, and what operational habit does that justify in a request-serving service?",
  "What role does ndarray play for ONNX inference in Rust, and what does a tensor consist of beyond its raw buffer?",
  "What does an execution provider decide, and why is registering providers in priority order a deployment and latency tradeoff rather than a free speedup?",
  "When a tensor borrows a Vec for a session run, what does the borrow checker enforce, and what is the calm pattern for owning inputs and outputs around the run?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · softmax over a one-layer model"}
  filename="softmax_post_processing_lab.rs"
  runKey="ch54_ex_softmax"
  expectedOutput={"logits = [-1.5750, 1.0500, 0.9750]\nprobs = [0.0362, 0.5000, 0.4638]\nprobs sum = 1.0000\npredicted class = 1\nconfidence = 0.5000"}
  helperText={"Complete the softmax function so the one-layer model reports calibrated probabilities. The forward pass and argmax mirror the chapter's dense layer; softmax is post-processing you own, exactly like argmax."}
  initialCode={`// Companion lab: add a softmax stage so the one-layer model reports
// calibrated probabilities, not just raw logits. The forward pass and
// argmax mirror the chapter's dense layer; softmax is post-processing
// that you own, exactly like argmax.

const IN: usize = 4;
const OUT: usize = 3;

// Weights stored row-major: one row of IN values per output class.
const WEIGHTS: [[f32; IN]; OUT] = [
    [0.2, 0.8, -0.5, 0.1],
    [-0.3, 0.5, 0.9, 0.4],
    [0.6, -0.2, 0.3, -0.7],
];
const BIAS: [f32; OUT] = [0.1, -0.2, 0.05];

// One fixed input "tensor" of shape [IN].
fn input_tensor() -> [f32; IN] {
    [0.5, -1.0, 2.0, 0.25]
}

// Dense layer: logits[o] = bias[o] + sum_c weights[o][c] * input[c].
fn forward(input: &[f32; IN]) -> [f32; OUT] {
    let mut logits = [0.0f32; OUT];
    for o in 0..OUT {
        let mut sum = BIAS[o];
        for c in 0..IN {
            sum += WEIGHTS[o][c] * input[c];
        }
        logits[o] = sum;
    }
    logits
}

// Post-processing you own: largest logit wins.
fn argmax(logits: &[f32; OUT]) -> usize {
    let mut best = 0;
    for i in 1..OUT {
        if logits[i] > logits[best] {
            best = i;
        }
    }
    best
}

// Numerically stable softmax: subtract the max logit before exponentiating.
fn softmax(logits: &[f32; OUT]) -> [f32; OUT] {
    // TODO: replace this uniform placeholder with a real softmax.
    // 1. Find the maximum logit.
    // 2. Set probs[i] = (logits[i] - max).exp().
    // 3. Divide every entry by the sum so the vector sums to 1.0.
    let _ = logits;
    [1.0 / OUT as f32; OUT]
}

fn main() {
    let input = input_tensor();
    let logits = forward(&input);
    let probs = softmax(&logits);
    let class = argmax(&logits);

    println!("logits = [{:.4}, {:.4}, {:.4}]", logits[0], logits[1], logits[2]);
    println!("probs = [{:.4}, {:.4}, {:.4}]", probs[0], probs[1], probs[2]);
    println!("probs sum = {:.4}", probs[0] + probs[1] + probs[2]);
    println!("predicted class = {}", class);
    println!("confidence = {:.4}", probs[class]);
}`}
/>
*/

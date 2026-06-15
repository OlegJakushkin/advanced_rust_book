"use client"

// Chapter 40 · exercise workbook page (ch40-matrix-optimization-games-exercises).
// Exercise data consumed by the workbook PDF builder
// (exports/extract_chapter_prose.py reads the const blocks and the
// RustPracticeCard below). Not yet wired into app navigation; wiring
// requires lockstep edits to types.ts / index.ts / index.tsx.
// Intended component name: PageCh40MatrixOptimizationGamesExercises

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
    title: "State the optimization order and why it holds",
    objective: "Recall the chapter's decision pipeline and explain why each stage assumes the earlier one is settled.",
    starterPrompt: "The chapter argues that matrix optimization has a fixed decision order and that the common mistake is reaching for the most exciting lever first. Reconstruct that order and defend it in your own words.",
    prompts: [
      "List the stages of the optimization pipeline from cheapest-to-get-right to most expensive, ending at GPU offload.",
      "Explain why a clever SIMD kernel or thread pool cannot rescue a bad storage layout or loop order.",
      "Give one sentence on why the GPU stage is reached last and least often.",
    ],
    acceptanceCriteria: [
      "The stated order begins with storage layout and loop order before SIMD, tiling, parallelism, and GPU offload.",
      "The answer explains that later stages assume the earlier ones are already honest, so layout and loop order come first.",
      "The answer notes that GPU offload is rarely needed and should be entered only after the layout question is answered.",
    ],
    hints: [
      "The chapter frames this as a left-to-right pipeline where each later stage assumes the earlier ones.",
      "The repeated mistake is jumping to the accelerator review before the layout review.",
    ],
  },
  {
    number: 2,
    kind: "code reading",
    title: "Trace the CSR frontier step",
    objective: "Read the CSR data model and hand-execute one sparse matrix-vector frontier expansion.",
    starterPrompt: "Using the chapter's CsrMatrix with indptr = [0, 2, 3, 5, 6, 6], indices = [1, 2, 3, 3, 4, 4], and data all 1.0, hand-trace advance_frontier for the input frontier [1.0, 0.0, 1.0, 0.0, 0.0].",
    prompts: [
      "For each active row, compute the slice indptr[row]..indptr[row + 1] and name the columns it reaches.",
      "Mark which entries of the output next vector become 1, and explain why inactive rows are skipped entirely.",
      "State what graph.nnz() and graph.dense_bytes() report and what that contrast is meant to show.",
    ],
    acceptanceCriteria: [
      "Row 0 expands over indptr[0]..indptr[1] (= 0..2) reaching columns 1 and 2; row 2 expands over indptr[2]..indptr[3] (= 3..5) reaching columns 3 and 4.",
      "The resulting next frontier is 0,1,1,1,1 and rows 1, 3, 4 are skipped because their frontier value is 0.0.",
      "nnz is 6 (the length of data) and dense_bytes is rows * cols * 4 = 100, illustrating the metadata-versus-density tradeoff.",
    ],
    hints: [
      "Only rows whose frontier value is nonzero contribute; the rest hit the continue.",
      "indptr[row]..indptr[row + 1] is the half-open range of edge slots for that row.",
    ],
  },
  {
    number: 3,
    kind: "implementation",
    title: "Reorder the multiply loops from i-j-k to i-k-j",
    objective: "Rewrite the inner loop so the innermost index walks a contiguous row of a row-major right-hand matrix.",
    starterPrompt: "Starting from the chapter's matmul_naive triple loop (i, then j, then k), implement matmul_ikj that produces an identical result but nests the loops as i, then k, then j.",
    prompts: [
      "Hoist a.get(i, k) out of the innermost loop into a local before the j loop runs.",
      "Make the innermost loop iterate j and accumulate into out[i, j] using b.get(k, j).",
      "Confirm the result equals matmul_naive on the chapter's 3x3 inputs using approx_eq.",
    ],
    acceptanceCriteria: [
      "The loop nest is ordered i, k, j with j innermost, and a.get(i, k) is read once per (i, k) rather than once per (i, j, k).",
      "The innermost loop indexes b.get(k, j), so it reads consecutive memory addresses along a row of B rather than jumping across rows.",
      "matmul_ikj returns a matrix that approx_eq reports equal to matmul_naive for the same operands.",
    ],
    hints: [
      "Same arithmetic, different memory walk: only the loop order and the hoist change.",
      "With i-k-j the inner loop touches consecutive offsets in row-major storage.",
    ],
  },
  {
    number: 4,
    kind: "implementation",
    title: "Build a CSR matrix from a dense grid",
    objective: "Construct the indptr, indices, and data arrays of a CsrMatrix by scanning a dense row-major buffer.",
    starterPrompt: "Write fn dense_to_csr(rows: usize, cols: usize, dense: &[f32]) -> CsrMatrix that records only the nonzero cells, producing indptr, indices, and data consistent with the chapter's CSR layout.",
    prompts: [
      "Walk the dense buffer row by row using the offset = row * cols + col formula.",
      "Push each nonzero column index and value, and push a running edge count into indptr after each row.",
      "Verify that indptr has rows + 1 entries and that the last entry equals data.len().",
    ],
    acceptanceCriteria: [
      "indptr starts with 0, has exactly rows + 1 entries, and its final entry equals indices.len() and data.len().",
      "indices and data contain exactly the nonzero columns and values in row-major scan order.",
      "Feeding the result into advance_frontier reproduces the same reachable columns as scanning the dense grid directly.",
    ],
    hints: [
      "indptr[row + 1] is just indptr[row] plus the number of nonzeros found in that row.",
      "A cell is stored only when dense[row * cols + col] != 0.0.",
    ],
  },
  {
    number: 5,
    kind: "debugging or refactoring",
    title: "Fix a tiled multiply that overwrites partial sums",
    objective: "Diagnose and correct a blocking bug where a tile loop assigns instead of accumulating into the output cell.",
    starterPrompt: "A colleague's matmul_tiled mirrors the chapter's ii / kk / jj structure but the inner statement reads out.set(i, j, a_ik * b.get(k, j)) instead of adding to the current value. The result disagrees with matmul_naive whenever a.cols exceeds the tile size.",
    prompts: [
      "Explain why the bug only appears when the k dimension spans more than one tile.",
      "Restore the accumulation by reading out.get(i, j) and adding a_ik * b.get(k, j) before storing.",
      "Describe a check that would have caught this regression early.",
    ],
    acceptanceCriteria: [
      "The diagnosis names that successive kk tiles overwrite earlier partial sums because set replaces rather than adds.",
      "The corrected inner statement is out.set(i, j, out.get(i, j) + a_ik * b.get(k, j)).",
      "The answer proposes comparing against matmul_naive via approx_eq or a checksum on inputs whose k dimension exceeds the tile.",
    ],
    hints: [
      "Each kk tile contributes only part of the dot product for out[i, j].",
      "The output must start at zero and be added to across all kk tiles, never reset.",
    ],
  },
  {
    number: 6,
    kind: "design or production scenario",
    title: "Decide the GPU break-even for a scoring service",
    objective: "Apply the chapter's offload cost model to justify a layout-and-placement decision with service evidence.",
    starterPrompt: "A batch scoring service's hot path is a dense matrix multiply. A research spike proposes moving it to a GPU where the kernel measures 2 ms, but the offload wrapper adds device wait, host-to-device copy, launch, and device-to-host copy. Recommend an order of work and a break-even argument.",
    prompts: [
      "List the end-to-end cost components of a GPU offload and which ones the 2 ms kernel figure ignores.",
      "State which optimizations you would settle on the host first and why, in the chapter's order.",
      "Explain why the break-even size is a service fact rather than a whiteboard fact.",
    ],
    acceptanceCriteria: [
      "The end-to-end cost is given as device wait plus input copy plus launch plus kernel plus result copy, not just the 2 ms kernel.",
      "The plan fixes storage layout and loop order, then tiling and CPU parallelism, before considering offload.",
      "The recommendation ties the break-even to measured queueing, admission, and transfer costs for this specific service rather than a theoretical threshold.",
    ],
    hints: [
      "A 2 ms kernel wrapped in copy and queue time can be slower than a tuned host multiply.",
      "Offload paths can be admission-bound or transfer-bound regardless of kernel speed.",
    ],
  },
]

const reviewQuestions = [
  "In row-major storage, what does the offset = row * cols + col formula encode, and which traversal does it make contiguous?",
  "Why does reordering the multiply loops from i-j-k to i-k-j change cache behavior without changing the arithmetic or the result?",
  "What does a CSR matrix store beyond the nonzero values, and what does that metadata buy you over a dense layout?",
  "What does blocking or tiling improve in a matrix multiply, and what costs does it add?",
  "What are the components of the end-to-end cost of a GPU offload, and why can a fast kernel still lose the placement decision?",
]

const workingLoop = [
  "Restate the exercise goal in terms of ownership, types, and the chapter's core idea.",
  "Write the smallest version that compiles, then make it correct.",
  "Check each acceptance criterion explicitly before moving on.",
  "Name one tradeoff or failure mode your solution accepts.",
]

<RustPracticeCard
  title={"Runnable lab · i-k-j matrix multiply over flat row-major storage"}
  filename="ikj_matmul_lab.rs"
  runKey="ch40_ex_ikj"
  expectedOutput={"c[0,0] = 19.0\nc[1,1] = 50.0\nchecksum = 134.0"}
  helperText={"Complete the innermost loop of matmul_ikj so it accumulates a_ik * b[k, j] into out[i, j]. The loop nest is already i, k, j, so the inner loop walks a contiguous row of B in row-major storage."}
  initialCode={`struct Matrix {
    rows: usize,
    cols: usize,
    data: Vec<f32>,
}

impl Matrix {
    fn zeros(rows: usize, cols: usize) -> Self {
        Self { rows, cols, data: vec![0.0; rows * cols] }
    }
    fn offset(&self, row: usize, col: usize) -> usize {
        row * self.cols + col
    }
    fn get(&self, row: usize, col: usize) -> f32 {
        self.data[self.offset(row, col)]
    }
    fn set(&mut self, row: usize, col: usize, value: f32) {
        let index = self.offset(row, col);
        self.data[index] = value;
    }
}

// i-k-j order: the inner loop walks a row of B, not a column.
fn matmul_ikj(a: &Matrix, b: &Matrix) -> Matrix {
    let mut out = Matrix::zeros(a.rows, b.cols);
    for i in 0..a.rows {
        for k in 0..a.cols {
            let a_ik = a.get(i, k);
            for j in 0..b.cols {
                // TODO: accumulate a_ik * b[k, j] into out[i, j].
                // Read out.get(i, j), add a_ik * b.get(k, j), then out.set it back.
                let _ = (a_ik, j);
            }
        }
    }
    out
}

fn checksum(m: &Matrix) -> f32 {
    m.data.iter().copied().sum()
}

fn main() {
    let a = Matrix { rows: 2, cols: 2, data: vec![1.0, 2.0, 3.0, 4.0] };
    let b = Matrix { rows: 2, cols: 2, data: vec![5.0, 6.0, 7.0, 8.0] };
    let c = matmul_ikj(&a, &b);
    println!("c[0,0] = {:.1}", c.get(0, 0));
    println!("c[1,1] = {:.1}", c.get(1, 1));
    println!("checksum = {:.1}", checksum(&c));
}`}
/>
*/

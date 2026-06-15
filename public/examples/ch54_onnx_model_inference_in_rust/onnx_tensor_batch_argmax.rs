// Batched inference: the same one-layer model run over more than one row at
// once. A real session takes an input tensor of shape [rows, features] and
// returns logits of shape [rows, classes]; here we keep the batch as a single
// row-major flat Vec and slice one row at a time, with no external crates.

const IN: usize = 4;
const OUT: usize = 3;

const WEIGHTS: [[f32; IN]; OUT] = [
    [0.2, 0.8, -0.5, 0.1],
    [-0.3, 0.5, 0.9, 0.4],
    [0.6, -0.2, 0.3, -0.7],
];
const BIAS: [f32; OUT] = [0.1, -0.2, 0.05];

// Two input rows packed row-major into one flat buffer: [row0.. , row1..].
fn build_batch() -> Vec<f32> {
    vec![
        0.5, -1.0, 2.0, 0.25, // row 0
        1.5, 0.5, -0.5, 1.0, // row 1
    ]
}

// Run the dense layer over one feature row and return its logits.
fn forward_row(row: &[f32]) -> [f32; OUT] {
    let mut logits = [0.0f32; OUT];
    for o in 0..OUT {
        let mut sum = BIAS[o];
        for c in 0..IN {
            sum += WEIGHTS[o][c] * row[c];
        }
        logits[o] = sum;
    }
    logits
}

fn argmax(logits: &[f32; OUT]) -> usize {
    let mut best = 0;
    for i in 1..OUT {
        if logits[i] > logits[best] {
            best = i;
        }
    }
    best
}

fn main() {
    let batch = build_batch();
    let rows = batch.len() / IN;

    println!("batch rows = {}", rows);
    println!("features per row = {}", IN);

    for r in 0..rows {
        let row = &batch[r * IN..(r + 1) * IN];
        let logits = forward_row(row);
        let class = argmax(&logits);
        println!("row {} argmax = {} score = {:.4}", r, class, logits[class]);
    }
}

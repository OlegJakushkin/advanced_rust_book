// Companion lab: add a softmax stage so the one-layer model reports
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
}

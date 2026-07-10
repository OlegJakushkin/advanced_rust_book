type Hash = u32;

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

// Fold from the leaf up to the root, combining with each sibling in the
// orientation the proof records. The order is load-bearing because hashing
// is not commutative: a left sibling hashes as (sibling || acc), a right
// sibling as (acc || sibling).
fn verify_proof(leaf: &str, proof: &[ProofStep], expected_root: Hash) -> bool {
    let mut acc = hash_leaf(leaf);

    for step in proof {
        acc = if step.sibling_is_left {
            hash_node(step.sibling, acc)
        } else {
            hash_node(acc, step.sibling)
        };
    }

    acc == expected_root
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
}

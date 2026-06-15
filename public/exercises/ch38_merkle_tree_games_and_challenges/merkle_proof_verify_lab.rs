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
}

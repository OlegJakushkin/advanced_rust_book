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

#[derive(Debug)]
struct MerkleTree {
    levels: Vec<Vec<Hash>>,
}

impl MerkleTree {
    fn from_leaves(leaves: &[&str]) -> Self {
        assert!(!leaves.is_empty(), "a Merkle tree needs at least one leaf");

        let mut levels = vec![leaves.iter().map(|leaf| hash_leaf(leaf)).collect::<Vec<_>>()];

        while levels.last().unwrap().len() > 1 {
            let current = levels.last().unwrap();
            let mut next = Vec::with_capacity((current.len() + 1) / 2);

            for pair in current.chunks(2) {
                let left = pair[0];
                let right = if pair.len() == 2 { pair[1] } else { pair[0] };
                next.push(hash_node(left, right));
            }

            levels.push(next);
        }

        Self { levels }
    }

    fn root(&self) -> Hash {
        self.levels.last().unwrap()[0]
    }

    fn proof(&self, mut index: usize) -> Vec<ProofStep> {
        let mut proof = Vec::new();

        for level in &self.levels[..self.levels.len() - 1] {
            let sibling_index = if index % 2 == 0 {
                (index + 1).min(level.len() - 1)
            } else {
                index - 1
            };

            proof.push(ProofStep {
                sibling: level[sibling_index],
                sibling_is_left: sibling_index < index,
            });

            index /= 2;
        }

        proof
    }
}

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
    let leaves = ["alpha", "beta", "gamma", "delta"];
    let tree = MerkleTree::from_leaves(&leaves);
    let proof = tree.proof(2);

    println!("leaf count = {}", tree.levels[0].len());
    println!("proof len = {}", proof.len());
    println!("verified = {}", verify_proof("gamma", &proof, tree.root()));
}

type Hash = u32;

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

fn next_level(level: &[Hash]) -> Vec<Hash> {
    let mut next = Vec::with_capacity((level.len() + 1) / 2);

    for pair in level.chunks(2) {
        let left = pair[0];
        let right = if pair.len() == 2 { pair[1] } else { pair[0] };
        next.push(hash_node(left, right));
    }

    next
}

fn next_level_parallel(level: &[Hash]) -> Vec<Hash> {
    if level.len() <= 2 {
        return next_level(level);
    }

    let pair_count = (level.len() + 1) / 2;
    let left_pairs = pair_count / 2;
    let split = (left_pairs * 2).max(2).min(level.len());

    std::thread::scope(|scope| {
        let left = &level[..split];
        let right = &level[split..];

        let left_handle = scope.spawn(move || next_level(left));
        let right_handle = scope.spawn(move || next_level(right));

        let mut out = left_handle.join().unwrap();
        out.extend(right_handle.join().unwrap());
        out
    })
}

fn build_root(leaves: &[&str], reducer: fn(&[Hash]) -> Vec<Hash>) -> (Hash, usize) {
    let mut level: Vec<Hash> = leaves.iter().map(|leaf| hash_leaf(leaf)).collect();
    let mut levels = 1;

    while level.len() > 1 {
        level = reducer(&level);
        levels += 1;
    }

    (level[0], levels)
}

fn main() {
    let leaves = ["a", "b", "c", "d", "e", "f", "g", "h"];

    let (serial_root, levels) = build_root(&leaves, next_level);
    let (parallel_root, _) = build_root(&leaves, next_level_parallel);

    println!("leaves = {}", leaves.len());
    println!("levels = {}", levels);
    println!("roots match = {}", serial_root == parallel_root);
}

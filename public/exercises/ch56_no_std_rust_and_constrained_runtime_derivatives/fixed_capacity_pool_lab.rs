struct FramePool {
    used: Vec<bool>,
    frames: Vec<Vec<u8>>,
    capacity: usize,
}

impl FramePool {
    fn new(slots: usize, capacity: usize) -> Self {
        FramePool {
            used: vec![false; slots],
            frames: vec![Vec::new(); slots],
            capacity,
        }
    }

    // TODO: Reject inputs longer than `self.capacity` by returning None.
    // Otherwise find the first free slot, mark it used, copy the bytes into
    // it, and return Some(index). Return None if every slot is already used.
    fn alloc_copy(&mut self, bytes: &[u8]) -> Option<usize> {
        let _ = bytes;
        None
    }

    fn release(&mut self, id: usize) {
        self.used[id] = false;
        self.frames[id].clear();
    }

    fn in_use(&self) -> usize {
        self.used.iter().filter(|&&u| u).count()
    }
}

fn checksum(bytes: &[u8]) -> u32 {
    bytes.iter().map(|&b| b as u32).sum()
}

fn main() {
    let mut pool = FramePool::new(2, 8);

    let first = pool.alloc_copy(b"abc").unwrap_or(0);
    let _second = pool.alloc_copy(b"rust");
    let overflow = pool.alloc_copy(b"overflowing").is_none();
    let first_sum = checksum(pool.frames[first].as_slice());

    pool.release(first);

    println!("checksum = {}", first_sum);
    println!("overflow = {}", overflow);
    println!("in_use = {}", pool.in_use());
}

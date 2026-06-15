#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct SlotId(usize);

struct Pool<const SLOTS: usize, const BYTES: usize> {
    used: [bool; SLOTS],
    lens: [usize; SLOTS],
    data: [[u8; BYTES]; SLOTS],
}

impl<const SLOTS: usize, const BYTES: usize> Pool<SLOTS, BYTES> {
    const fn new() -> Self {
        Self {
            used: [false; SLOTS],
            lens: [0; SLOTS],
            data: [[0; BYTES]; SLOTS],
        }
    }

    fn alloc_copy(&mut self, bytes: &[u8]) -> Option<SlotId> {
        if bytes.len() > BYTES {
            return None;
        }

        let mut index = 0;
        while index < SLOTS {
            if !self.used[index] {
                self.used[index] = true;
                self.lens[index] = bytes.len();
                self.data[index][..bytes.len()].copy_from_slice(bytes);
                return Some(SlotId(index));
            }
            index += 1;
        }

        None
    }

    fn as_slice(&self, id: SlotId) -> &[u8] {
        &self.data[id.0][..self.lens[id.0]]
    }

    fn release(&mut self, id: SlotId) {
        self.used[id.0] = false;
        self.lens[id.0] = 0;
    }

    fn in_use(&self) -> usize {
        self.used.iter().filter(|&&used| used).count()
    }
}

fn main() {
    let mut pool = Pool::<2, 8>::new();

    let first = pool.alloc_copy(b"abc").unwrap();
    let _second = pool.alloc_copy(b"rust").unwrap();
    let overflow = pool.alloc_copy(b"more").is_none();
    let sent_bytes = pool.as_slice(first).len();

    pool.release(first);

    println!("in_use = {}", pool.in_use());
    println!("overflow = {}", overflow);
    println!("sent bytes = {}", sent_bytes);
}

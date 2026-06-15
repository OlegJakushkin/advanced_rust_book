struct Bump<const N: usize> {
    buf: [u8; N],
    used: usize,
}

impl<const N: usize> Bump<N> {
    fn new() -> Self {
        Self {
            buf: [0; N],
            used: 0,
        }
    }

    fn alloc_bytes(&mut self, bytes: &[u8]) -> Option<(usize, usize)> {
        let end = self.used.checked_add(bytes.len())?;
        if end > N {
            return None;
        }

        let start = self.used;
        self.buf[start..end].copy_from_slice(bytes);
        self.used = end;
        Some((start, end))
    }

    fn slice(&self, range: (usize, usize)) -> &[u8] {
        &self.buf[range.0..range.1]
    }

    fn used(&self) -> usize {
        self.used
    }

    fn reset(&mut self) {
        self.used = 0;
    }
}

fn main() {
    let mut arena = Bump::<32>::new();
    let first = arena.alloc_bytes(b"arena123").unwrap();
    let _second = arena.alloc_bytes(b"logs").unwrap();

    println!("used = {}", arena.used());
    println!("first = {}", std::str::from_utf8(arena.slice(first)).unwrap());

    arena.reset();
    println!("after reset = {}", arena.used());
}

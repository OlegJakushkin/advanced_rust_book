struct Bump<const N: usize> {
    buf: [u8; N],
    used: usize,
}

impl<const N: usize> Bump<N> {
    fn new() -> Self {
        Self { buf: [0; N], used: 0 }
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
    let mut arena = Bump::<16>::new();

    let a = arena.alloc_bytes(b"query").unwrap();
    let b = arena.alloc_bytes(b"plan").unwrap();
    println!("used = {}", arena.used());
    println!("a = {}", std::str::from_utf8(arena.slice(a)).unwrap());
    println!("b = {}", std::str::from_utf8(arena.slice(b)).unwrap());

    let overflow = arena.alloc_bytes(b"too-many-bytes");
    println!("overflow = {}", overflow.is_none());

    arena.reset();
    println!("after reset = {}", arena.used());

    let c = arena.alloc_bytes(b"next").unwrap();
    println!("c = {}", std::str::from_utf8(arena.slice(c)).unwrap());
}

struct Bump<const N: usize> {
    buf: [u8; N],
    used: usize,
}

impl<const N: usize> Bump<N> {
    fn new() -> Self {
        Self { buf: [0; N], used: 0 }
    }

    // TODO: implement append-only allocation.
    // Reject the request if it would overflow the region; otherwise copy the
    // bytes in, advance the cursor (self.used), and return the (start, end) range.
    fn alloc_bytes(&mut self, bytes: &[u8]) -> Option<(usize, usize)> {
        let _ = bytes;
        Some((0, 0)) // placeholder: allocates nothing yet
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

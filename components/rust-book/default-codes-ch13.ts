export const DEFAULT_CODES_CH13: Record<string, string> = {
  arena_allocation_bump_scratch: `struct Bump<const N: usize> {
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
}`,
  arena_allocation_index_ast: `#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ExprId(usize);

#[derive(Debug)]
enum Expr {
    Number(i64),
    Add(ExprId, ExprId),
    Mul(ExprId, ExprId),
}

#[derive(Default)]
struct ExprArena {
    nodes: Vec<Expr>,
}

impl ExprArena {
    fn alloc(&mut self, expr: Expr) -> ExprId {
        let id = ExprId(self.nodes.len());
        self.nodes.push(expr);
        id
    }

    fn get(&self, id: ExprId) -> &Expr {
        &self.nodes[id.0]
    }

    fn eval(&self, id: ExprId) -> i64 {
        match self.get(id) {
            Expr::Number(value) => *value,
            Expr::Add(left, right) => self.eval(*left) + self.eval(*right),
            Expr::Mul(left, right) => self.eval(*left) * self.eval(*right),
        }
    }

    fn len(&self) -> usize {
        self.nodes.len()
    }
}

fn main() {
    let mut arena = ExprArena::default();

    let two = arena.alloc(Expr::Number(2));
    let three = arena.alloc(Expr::Number(3));
    let four = arena.alloc(Expr::Number(4));
    let sum = arena.alloc(Expr::Add(two, three));
    let root = arena.alloc(Expr::Mul(sum, four));

    println!("value = {}", arena.eval(root));
    println!("nodes = {}", arena.len());
}`,
}

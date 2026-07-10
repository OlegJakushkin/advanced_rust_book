#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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
}

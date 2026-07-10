trait Keyed {
    fn key(&self) -> u64;
}

#[derive(Debug)]
struct Job {
    id: u64,
}

impl Keyed for Job {
    fn key(&self) -> u64 {
        self.id
    }
}

struct FixedBatch<T, const N: usize> {
    items: [T; N],
}

impl<T: Keyed, const N: usize> FixedBatch<T, N> {
    fn len(&self) -> usize {
        N
    }

    fn key_sum(&self) -> u64 {
        // Iterate the fixed-size array by shared reference and sum each
        // item's key. The Keyed bound on the impl makes item.key() legal,
        // and N being part of the type means the array stays on the stack.
        self.items.iter().map(|item| item.key()).sum()
    }
}

fn main() {
    let batch = FixedBatch {
        items: [Job { id: 10 }, Job { id: 22 }, Job { id: 8 }],
    };
    println!("len = {}", batch.len());
    println!("key sum = {}", batch.key_sum());
}

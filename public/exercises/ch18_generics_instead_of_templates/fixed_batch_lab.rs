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
        // TODO: iterate over self.items and sum the result of item.key().
        // Replace the placeholder below with the real reduction.
        0
    }
}

fn main() {
    let batch = FixedBatch {
        items: [Job { id: 10 }, Job { id: 22 }, Job { id: 8 }],
    };
    println!("len = {}", batch.len());
    println!("key sum = {}", batch.key_sum());
}

trait Keyed {
    fn key(&self) -> u64;
}

#[derive(Debug)]
struct Job {
    id: u64,
    name: String,
}

impl Keyed for Job {
    fn key(&self) -> u64 {
        self.id
    }
}

#[derive(Debug)]
struct Batch<T> {
    items: Vec<T>,
}

impl<T> Batch<T> {
    fn new(items: Vec<T>) -> Self {
        Self { items }
    }

    fn len(&self) -> usize {
        self.items.len()
    }
}

fn first_key<T>(batch: &Batch<T>) -> Option<u64>
where
    T: Keyed,
{
    batch.items.first().map(|item| item.key())
}

fn main() {
    let batch = Batch::new(vec![
        Job {
            id: 10,
            name: String::from("parse"),
        },
        Job {
            id: 22,
            name: String::from("persist"),
        },
    ]);

    println!("len = {}", batch.len());
    println!("first key = {}", first_key(&batch).unwrap());
}

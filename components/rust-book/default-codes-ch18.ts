export const DEFAULT_CODES_CH18: Record<string, string> = {
  generics_batch_bounds: `trait Keyed {
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
}`,
  generics_associated_types_const: `fn hex_digit(nibble: u8) -> u8 {
    match nibble {
        0..=9 => b'0' + nibble,
        10..=15 => b'A' + (nibble - 10),
        _ => b'?',
    }
}

trait Encoder {
    type Output;

    fn encode(&self, input: &[u8]) -> Self::Output;
}

struct HexPair;

impl Encoder for HexPair {
    type Output = [u8; 2];

    fn encode(&self, input: &[u8]) -> Self::Output {
        let byte = input[0];
        [hex_digit(byte >> 4), hex_digit(byte & 0x0F)]
    }
}

#[derive(Debug)]
struct FixedWindow<T, const N: usize> {
    items: [T; N],
}

impl<const N: usize> FixedWindow<u32, N> {
    fn sum(&self) -> u32 {
        self.items.iter().copied().sum()
    }

    fn last(&self) -> u32 {
        self.items[N - 1]
    }
}

fn main() {
    let encoder = HexPair;
    let encoded = encoder.encode(&[31_u8]);
    let window = FixedWindow {
        items: [3_u32, 5, 8, 13],
    };

    println!("hex = {}", std::str::from_utf8(&encoded).unwrap());
    println!("sum = {}", window.sum());
    println!("last = {}", window.last());
}`,
}

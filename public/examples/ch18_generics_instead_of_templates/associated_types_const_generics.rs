fn hex_digit(nibble: u8) -> u8 {
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
}

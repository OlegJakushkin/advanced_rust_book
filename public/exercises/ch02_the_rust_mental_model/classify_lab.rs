fn classify(depth: usize) -> (&'static str, usize) {
    let mut scaled = 0;

    if depth > 1000 {
        scaled = depth / 2;
        return ("hot", scaled);
    }

    scaled = depth + 50;
    ("steady", scaled)
}

fn main() {
    let (status_a, value_a) = classify(120);
    let (status_b, value_b) = classify(1200);
    println!("{} {}", status_a, value_a);
    println!("{} {}", status_b, value_b);
}

fn classify(depth: usize) -> (&'static str, usize) {
    if depth > 1000 {
        ("hot", depth / 2)
    } else {
        ("steady", depth + 50)
    }
}

fn main() {
    let (status_a, value_a) = classify(120);
    let (status_b, value_b) = classify(1200);
    println!("{} {}", status_a, value_a);
    println!("{} {}", status_b, value_b);
}

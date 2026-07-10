fn window_sum(values: &[u32]) -> u32 {
    values.iter().copied().sum()
}

fn main() {
    let fixed = [4_u32, 8, 15, 16, 23, 42];
    let dynamic = vec![3_u32, 6, 9, 12];

    println!("fixed = {}", window_sum(&fixed[2..5]));
    println!("dynamic = {}", window_sum(&dynamic[..3]));
}

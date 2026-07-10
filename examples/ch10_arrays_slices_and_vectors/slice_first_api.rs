fn tail_sum(values: &[u64], take: usize) -> u64 {
    let start = values.len().saturating_sub(take);
    values[start..].iter().copied().sum()
}

fn main() {
    let fixed = [3_u64, 5, 8, 13];
    let dynamic = vec![1_u64, 2, 3, 4, 5, 6];

    println!("fixed tail = {}", tail_sum(&fixed, 2));
    println!("dynamic tail = {}", tail_sum(&dynamic, 3));
}

fn collect_even_scaled(ids: &[u32]) -> Vec<u32> {
    let mut out = Vec::with_capacity(ids.len());

    for &id in ids {
        if id % 2 == 0 {
            out.push(id * 10);
        }
    }

    out
}

fn main() {
    let ids = [10_u32, 11, 12, 13, 14];
    let mut out = collect_even_scaled(&ids);

    println!("len = {}", out.len());
    println!("can fit two more = {}", out.len() + 2 <= out.capacity());

    out.extend([200, 220]);
    println!("last = {}", out.last().copied().unwrap());
}

use std::collections::HashMap;

fn record_hit(counts: &mut HashMap<String, usize>, route: String) {
    let slot = counts.entry(route).or_insert(0);
    *slot += 1;
}

fn main() {
    let mut counts = HashMap::with_capacity(4);

    record_hit(&mut counts, String::from("api"));
    record_hit(&mut counts, String::from("api"));
    record_hit(&mut counts, String::from("billing"));

    println!("api = {}", counts.get("api").copied().unwrap_or(0));
    println!("billing = {}", counts.get("billing").copied().unwrap_or(0));
    println!("routes = {}", counts.len());
}

export const DEFAULT_CODES_CH11: Record<string, string> = {
  hash_maps_sets_entry_api: `use std::collections::HashMap;

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
}`,
  hash_maps_sets_borrowed_lookup_ordered: `use std::collections::{BTreeMap, HashMap, HashSet};

fn main() {
    let mut active = HashSet::new();
    active.insert(String::from("api"));
    active.insert(String::from("worker"));

    let mut counts = HashMap::new();
    counts.insert(String::from("worker"), 3);
    counts.insert(String::from("api"), 2);
    counts.insert(String::from("billing"), 1);

    let api_count = counts.get("api").copied().unwrap_or(0);
    let has_worker = active.contains("worker");

    let ordered: BTreeMap<_, _> = counts.into_iter().collect();
    let ordered_text = ordered
        .iter()
        .map(|(name, count)| format!("{}={}", name, count))
        .collect::<Vec<_>>()
        .join(",");

    println!("api count = {}", api_count);
    println!("has worker = {}", has_worker);
    println!("ordered = {}", ordered_text);
}`,
}

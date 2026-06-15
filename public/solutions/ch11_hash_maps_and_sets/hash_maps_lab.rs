use std::collections::{BTreeMap, HashMap};

// Owned key handoff plus a single Entry update path: one probe, mutate in place.
fn record_owned(counts: &mut HashMap<String, usize>, route: String) {
    let slot = counts.entry(route).or_insert(0);
    *slot += 1;
}

// Borrowed read: query the owned String keys with &str, no allocation.
fn lookup(counts: &HashMap<String, usize>, route: &str) -> Option<usize> {
    counts.get(route).copied()
}

// Deterministic render: project into a BTreeMap so output is always sorted.
fn render_sorted(counts: &HashMap<String, usize>) -> String {
    let ordered: BTreeMap<&String, &usize> = counts.iter().collect();
    ordered
        .iter()
        .map(|(route, count)| format!("{}={}", route, count))
        .collect::<Vec<_>>()
        .join(",")
}

fn main() {
    let mut counts = HashMap::new();
    record_owned(&mut counts, String::from("api"));
    record_owned(&mut counts, String::from("billing"));
    record_owned(&mut counts, String::from("api"));

    println!("api = {:?}", lookup(&counts, "api"));
    println!("sorted = {}", render_sorted(&counts));
}

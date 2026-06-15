use std::collections::{BTreeMap, HashMap};

fn record_owned(counts: &mut HashMap<String, usize>, route: String) {
    if counts.contains_key(&route) {
        let next = counts[&route] + 1;
        counts.insert(route, next);
    } else {
        counts.insert(route, 1);
    }
}

fn lookup(counts: &HashMap<String, usize>, route: &str) -> Option<usize> {
    counts.get(&route.to_string()).copied()
}

fn render_sorted(counts: &HashMap<String, usize>) -> String {
    counts
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

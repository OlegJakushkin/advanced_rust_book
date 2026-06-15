use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counts = Arc::new(Mutex::new(HashMap::<&'static str, usize>::new()));
    let mut handles = Vec::new();

    for route in ["api", "api", "billing", "api"] {
        let counts = Arc::clone(&counts);
        handles.push(thread::spawn(move || {
            let mut map = counts.lock().unwrap();
            *map.entry(route).or_insert(0) += 1;
        }));
    }

    for handle in handles {
        handle.join().unwrap();
    }

    let map = counts.lock().unwrap();
    println!("api = {}", map.get("api").copied().unwrap_or(0));
    println!("billing = {}", map.get("billing").copied().unwrap_or(0));
    println!("routes = {}", map.len());
}

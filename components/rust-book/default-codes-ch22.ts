export const DEFAULT_CODES_CH22: Record<string, string> = {
  multithreading_owned_jobs_channel: `use std::collections::HashMap;
use std::sync::mpsc;
use std::thread;

#[derive(Debug)]
struct Job {
    name: &'static str,
    cost: u32,
}

fn spawn_worker(
    tx: mpsc::Sender<(&'static str, u32)>,
    worker: &'static str,
    jobs: Vec<Job>,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let total: u32 = jobs.iter().map(|job| job.cost).sum();
        tx.send((worker, total)).unwrap();
    })
}

fn main() {
    let (tx, rx) = mpsc::channel();

    let ingest_jobs = vec![
        Job { name: "parse", cost: 3 },
        Job { name: "validate", cost: 2 },
    ];
    let index_jobs = vec![
        Job { name: "index", cost: 4 },
        Job { name: "flush", cost: 1 },
    ];

    let ingest = spawn_worker(tx.clone(), "ingest", ingest_jobs);
    let index = spawn_worker(tx, "index", index_jobs);

    ingest.join().unwrap();
    index.join().unwrap();

    let mut totals = HashMap::new();
    for (worker, total) in rx {
        totals.insert(worker, total);
    }

    let grand: u32 = totals.values().copied().sum();

    println!("ingest total = {}", totals.get("ingest").copied().unwrap_or(0));
    println!("index total = {}", totals.get("index").copied().unwrap_or(0));
    println!("grand total = {}", grand);
}`,
  multithreading_shared_state_metrics: `use std::collections::HashMap;
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
}`,
  multithreading_scoped_threads_sum: `use std::thread;

fn main() {
    let values = [2_u32, 4, 6, 8, 10, 12];
    let split_at = 3;

    thread::scope(|scope| {
        let (left, right) = values.split_at(split_at);

        let left_handle = scope.spawn(move || left.iter().copied().sum::<u32>());
        let right_handle = scope.spawn(move || right.iter().copied().sum::<u32>());

        let left_total = left_handle.join().unwrap();
        let right_total = right_handle.join().unwrap();

        println!("left = {}", left_total);
        println!("right = {}", right_total);
        println!("total = {}", left_total + right_total);
    });
}`,
}

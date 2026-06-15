use std::collections::HashMap;
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
}

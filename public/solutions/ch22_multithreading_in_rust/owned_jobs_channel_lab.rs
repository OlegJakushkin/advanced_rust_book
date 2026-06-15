use std::sync::mpsc;
use std::thread;

#[derive(Debug)]
struct Job {
    cost: u32,
}

fn spawn_worker(
    tx: mpsc::Sender<(&'static str, u32)>,
    worker: &'static str,
    jobs: Vec<Job>,
) -> thread::JoinHandle<()> {
    // `move` transfers ownership of `jobs` and the cloned `tx` into the child.
    thread::spawn(move || {
        let total: u32 = jobs.iter().map(|job| job.cost).sum();
        tx.send((worker, total)).unwrap();
    })
}

fn main() {
    let (tx, rx) = mpsc::channel();

    let ingest_jobs = vec![Job { cost: 2 }, Job { cost: 3 }];
    let index_jobs = vec![Job { cost: 4 }];

    let ingest = spawn_worker(tx.clone(), "ingest", ingest_jobs);
    let index = spawn_worker(tx, "index", index_jobs);

    ingest.join().unwrap();
    index.join().unwrap();

    let mut ingest_total = 0;
    let mut index_total = 0;
    let mut grand = 0;

    for (worker, total) in rx {
        grand += total;
        if worker == "ingest" {
            ingest_total = total;
        } else if worker == "index" {
            index_total = total;
        }
    }

    println!("ingest = {}", ingest_total);
    println!("index = {}", index_total);
    println!("grand = {}", grand);
}

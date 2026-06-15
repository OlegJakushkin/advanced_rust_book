use std::sync::{Arc, Barrier, RwLock};
use std::thread;

#[derive(Debug)]
struct Config {
    version: usize,
    mode: &'static str,
}

fn main() {
    let config = Arc::new(RwLock::new(Config {
        version: 1,
        mode: "steady",
    }));
    let start = Arc::new(Barrier::new(3));
    let mut handles = Vec::new();

    for _ in 0..2 {
        let config = Arc::clone(&config);
        let start = Arc::clone(&start);
        handles.push(thread::spawn(move || {
            start.wait();
            let snapshot = config.read().unwrap();
            snapshot.version
        }));
    }

    {
        let mut guard = config.write().unwrap();
        guard.version = 2;
        guard.mode = "burst";
    }

    start.wait();

    let reader_version_sum: usize = handles
        .into_iter()
        .map(|handle| handle.join().unwrap())
        .sum();
    let mode = config.read().unwrap().mode;

    println!("reader version sum = {}", reader_version_sum);
    println!("mode = {}", mode);
}

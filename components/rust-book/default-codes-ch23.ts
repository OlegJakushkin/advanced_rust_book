export const DEFAULT_CODES_CH23: Record<string, string> = {
  synchronization_mutex_condvar_queue: `use std::collections::VecDeque;
use std::sync::{Arc, Condvar, Mutex};
use std::thread;

#[derive(Debug, Default)]
struct QueueState {
    jobs: VecDeque<&'static str>,
    closed: bool,
}

#[derive(Debug)]
struct SharedQueue {
    state: Mutex<QueueState>,
    ready: Condvar,
}

fn main() {
    let shared = Arc::new(SharedQueue {
        state: Mutex::new(QueueState::default()),
        ready: Condvar::new(),
    });

    let worker = {
        let shared = Arc::clone(&shared);
        thread::spawn(move || {
            let mut processed = 0;

            loop {
                let mut state = shared.state.lock().unwrap();

                while state.jobs.is_empty() && !state.closed {
                    state = shared.ready.wait(state).unwrap();
                }

                if state.jobs.is_empty() && state.closed {
                    break;
                }

                let _job = state.jobs.pop_front().unwrap();
                processed += 1;
            }

            processed
        })
    };

    {
        let mut state = shared.state.lock().unwrap();
        state.jobs.push_back("parse");
        state.jobs.push_back("flush");
        state.closed = true;
        shared.ready.notify_all();
    }

    let processed = worker.join().unwrap();
    let remaining = shared.state.lock().unwrap().jobs.len();

    println!("processed = {}", processed);
    println!("remaining = {}", remaining);
}`,
  synchronization_rwlock_barrier: `use std::sync::{Arc, Barrier, RwLock};
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
}`,
  synchronization_atomics_ordering: `use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::thread;

fn main() {
    let value = AtomicUsize::new(0);
    let ready = AtomicBool::new(false);

    thread::scope(|scope| {
        scope.spawn(|| {
            value.store(42, Ordering::Relaxed);
            ready.store(true, Ordering::Release);
        });

        scope.spawn(|| {
            while !ready.load(Ordering::Acquire) {
                thread::yield_now();
            }

            println!("ready = {}", true);
            println!("value = {}", value.load(Ordering::Relaxed));
        });
    });
}`,
}

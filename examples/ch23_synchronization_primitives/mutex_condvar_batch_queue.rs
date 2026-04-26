use std::collections::VecDeque;
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
}

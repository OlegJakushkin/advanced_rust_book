use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

fn publish(value: &AtomicUsize, ready: &AtomicBool, next: usize) {
    value.store(next, Ordering::Relaxed);
    ready.store(true, Ordering::Relaxed);
}

fn try_consume(value: &AtomicUsize, ready: &AtomicBool) -> Option<usize> {
    if ready.load(Ordering::Relaxed) {
        Some(value.load(Ordering::Relaxed))
    } else {
        None
    }
}

fn main() {
    let value = AtomicUsize::new(0);
    let ready = AtomicBool::new(false);

    publish(&value, &ready, 42);

    println!("ready = {}", ready.load(Ordering::Relaxed));
    println!("value = {}", try_consume(&value, &ready).unwrap_or(0));
}

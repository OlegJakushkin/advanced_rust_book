use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

fn publish(value: &AtomicUsize, ready: &AtomicBool, next: usize) {
    // The payload write stays relaxed: it carries no ordering of its own.
    value.store(next, Ordering::Relaxed);
    // The flag store is the release edge that publishes the payload write.
    ready.store(true, Ordering::Release);
}

fn try_consume(value: &AtomicUsize, ready: &AtomicBool) -> Option<usize> {
    // The acquire load is what lets us trust the relaxed payload below it.
    if ready.load(Ordering::Acquire) {
        Some(value.load(Ordering::Relaxed))
    } else {
        None
    }
}

fn main() {
    let value = AtomicUsize::new(0);
    let ready = AtomicBool::new(false);

    publish(&value, &ready, 42);

    println!("ready = {}", ready.load(Ordering::Acquire));
    println!("value = {}", try_consume(&value, &ready).unwrap_or(0));
}

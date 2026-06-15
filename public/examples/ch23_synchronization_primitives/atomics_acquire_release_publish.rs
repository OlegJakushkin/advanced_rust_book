use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
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
}

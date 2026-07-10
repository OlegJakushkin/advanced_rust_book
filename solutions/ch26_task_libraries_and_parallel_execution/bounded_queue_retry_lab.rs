fn main() {
    let capacity = 2;
    let (tx, rx) = crossbeam::channel::bounded::<&'static str>(capacity);

    let worker = std::thread::spawn(move || {
        let mut accepted = 0;
        let mut retried = 0;
        let mut cancelled = false;

        // recv() returns Err once every sender is dropped: that closing of the
        // queue is the explicit stop condition the worker reacts to.
        while let Ok(job) = rx.recv() {
            if job == "retry" {
                retried += 1; // retryable work counted separately from accepted
            } else {
                accepted += 1; // normal accepted work
            }
        }

        // The queue is closed and drained: the worker observed shutdown.
        cancelled = true;

        (accepted, retried, cancelled)
    });

    // Owned items move across the bounded boundary; the capacity is the budget.
    tx.send("parse").unwrap();
    tx.send("retry").unwrap();
    tx.send("flush").unwrap();
    drop(tx); // close the queue to signal shutdown

    let (accepted, retried, cancelled) = worker.join().unwrap();

    println!("capacity = {}", capacity);
    println!("accepted = {}", accepted);
    println!("retried = {}", retried);
    println!("cancelled = {}", cancelled);
}

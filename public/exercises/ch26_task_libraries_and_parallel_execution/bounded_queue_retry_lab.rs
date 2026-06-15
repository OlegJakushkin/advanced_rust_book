fn main() {
    let (tx, rx) = crossbeam::channel::bounded::<&'static str>(2);

    let worker = std::thread::spawn(move || {
        let mut accepted = 0;
        let mut retried = 0;
        let mut cancelled = false;

        while let Ok(job) = rx.recv() {
            if job == "retry" {
                retried += 0;
            } else {
                accepted += 1;
            }
        }

        (accepted, retried, cancelled)
    });

    tx.send("parse").unwrap();
    tx.send("retry").unwrap();
    tx.send("flush").unwrap();
    drop(tx);

    let (accepted, retried, cancelled) = worker.join().unwrap();

    println!("capacity = {}", 2);
    println!("accepted = {}", accepted);
    println!("retried = {}", retried);
    println!("cancelled = {}", cancelled);
}

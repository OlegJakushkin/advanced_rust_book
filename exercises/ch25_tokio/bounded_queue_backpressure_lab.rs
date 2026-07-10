use std::sync::mpsc::sync_channel;
use std::thread;

fn cpu_subtotal(batch: Vec<u32>) -> u32 {
    // TODO: sum the batch and return the subtotal.
    // This stands in for the chapter's spawn_blocking CPU step,
    // which must not run on an async worker.
    let _ = batch;
    0
}

fn main() {
    // A capacity of one couples producer and consumer: the second
    // send cannot complete until the consumer has taken the first batch.
    let capacity = 1;
    let (tx, rx) = sync_channel::<Vec<u32>>(capacity);

    let producer = thread::spawn(move || {
        tx.send(vec![1_u32, 2, 3]).unwrap();
        tx.send(vec![4_u32, 5]).unwrap();
    });

    let consumer = thread::spawn(move || {
        let mut batches = 0_u32;
        let mut total = 0_u32;
        while let Ok(batch) = rx.recv() {
            let subtotal = cpu_subtotal(batch);
            total += subtotal;
            batches += 1;
        }
        (batches, total)
    });

    producer.join().unwrap();
    let (batches, total) = consumer.join().unwrap();

    println!("buffer = {}", capacity);
    println!("batches = {}", batches);
    println!("total = {}", total);
}

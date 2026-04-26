use std::sync::Arc;

use tokio::sync::{mpsc, Semaphore};

#[tokio::main]
async fn main() {
    let capacity = 2_usize;
    let (tx, mut rx) = mpsc::channel::<Vec<u8>>(capacity);
    let permits = Arc::new(Semaphore::new(2));

    let producer = {
        let permits = Arc::clone(&permits);
        tokio::spawn(async move {
            for size in [64_usize, 64, 64, 64] {
                let permit = permits.clone().acquire_owned().await.unwrap();
                tx.send(vec![0_u8; size]).await.unwrap();
                drop(permit);
            }
        })
    };

    producer.await.unwrap();

    let mut messages = 0_usize;
    let mut bytes = 0_usize;

    while let Some(buf) = rx.recv().await {
        messages += 1;
        bytes += buf.len();
    }

    println!("capacity = {}", capacity);
    println!("messages = {}", messages);
    println!("bytes = {}", bytes);
}

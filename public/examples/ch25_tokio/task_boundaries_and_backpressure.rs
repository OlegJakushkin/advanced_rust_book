use tokio::sync::mpsc;
use tokio::time::{self, Duration};

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel::<Vec<u32>>(1);

    let producer = tokio::spawn(async move {
        tx.send(vec![1_u32, 2, 3]).await.unwrap();
        tx.send(vec![4_u32, 5]).await.unwrap();
    });

    let consumer = tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_millis(10));
        let mut batches = 0_u32;
        let mut total = 0_u32;

        while let Some(batch) = rx.recv().await {
            interval.tick().await;

            let subtotal = tokio::task::spawn_blocking(move || batch.into_iter().sum::<u32>())
                .await
                .unwrap();

            total += subtotal;
            batches += 1;
        }

        (batches, total)
    });

    producer.await.unwrap();
    let (batches, total) = consumer.await.unwrap();

    println!("buffer = 1");
    println!("batches = {}", batches);
    println!("total = {}", total);
}

use tokio::sync::{mpsc, watch};
use tokio::task::JoinSet;

#[derive(Debug, Clone, Copy)]
struct Job {
    id: u32,
    needs_retry: bool,
}

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel::<Job>(2);
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);

    let producer = tokio::spawn(async move {
        tx.send(Job { id: 1, needs_retry: false }).await.unwrap();
        tx.send(Job { id: 2, needs_retry: true }).await.unwrap();
        tx.send(Job { id: 3, needs_retry: false }).await.unwrap();
    });

    let worker = tokio::spawn(async move {
        let mut set = JoinSet::new();
        let mut completed = 0_u32;
        let mut retries = 0_u32;

        while let Some(job) = rx.recv().await {
            set.spawn(async move {
                if job.needs_retry {
                    Err(job.id)
                } else {
                    Ok(job.id)
                }
            });
        }

        while let Some(result) = set.join_next().await {
            match result.unwrap() {
                Ok(_id) => completed += 1,
                Err(id) => {
                    retries += 1;
                    set.spawn(async move { Ok::<u32, u32>(id) });
                }
            }
        }

        shutdown_rx.changed().await.unwrap();
        (completed, retries, *shutdown_rx.borrow())
    });

    producer.await.unwrap();
    shutdown_tx.send(true).unwrap();
    let (completed, retries, cancelled) = worker.await.unwrap();

    println!("buffer = 2");
    println!("completed = {}", completed);
    println!("retries = {}", retries);
    println!("cancelled = {}", cancelled);
}

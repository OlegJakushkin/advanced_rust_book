export const DEFAULT_CODES_CH26: Record<string, string> = {
  task_libraries_tokio_orchestration: `use tokio::sync::{mpsc, watch};
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
}`,
  task_libraries_rayon_crossbeam: `use rayon::prelude::*;

fn main() {
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(2)
        .build()
        .unwrap();

    let (tx, rx) = crossbeam::channel::bounded::<Vec<u64>>(2);

    let (batches, total) = std::thread::scope(|scope| {
        scope.spawn(move || {
            tx.send(vec![1_u64, 2, 3, 4]).unwrap();
            tx.send(vec![5_u64, 6, 7, 8]).unwrap();
            tx.send(vec![9_u64, 10]).unwrap();
        });

        // The blocking recv stays on this drain thread, not on a pool worker.
        // Only the per-batch par_iter is dispatched into the Rayon pool, so no
        // CPU thread ever sits idle waiting on the channel.
        let mut batches = 0_u64;
        let mut total = 0_u64;

        while let Ok(batch) = rx.recv() {
            let subtotal: u64 = pool.install(|| {
                batch
                    .par_iter()
                    .copied()
                    .map(|value| value * 2)
                    .sum()
            });

            total += subtotal;
            batches += 1;
        }

        (batches, total)
    });

    println!("batches = {}", batches);
    println!("scaled total = {}", total);
    println!("pool threads = {}", pool.current_num_threads());
}`,
}

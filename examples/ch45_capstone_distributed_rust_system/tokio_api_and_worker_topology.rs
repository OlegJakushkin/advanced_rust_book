use std::sync::Arc;

use tokio::sync::{mpsc, watch, Semaphore};

#[derive(Debug, Clone)]
struct AcceptedTask {
    task_id: &'static str,
    route: &'static str,
}

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel::<AcceptedTask>(2);
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);
    let permits = Arc::new(Semaphore::new(2));

    let producer = tokio::spawn(async move {
        tx.send(AcceptedTask {
            task_id: "graph-1",
            route: "tasks.graph",
        })
        .await
        .unwrap();

        tx.send(AcceptedTask {
            task_id: "matrix-1",
            route: "tasks.matrix",
        })
        .await
        .unwrap();
    });

    let worker = {
        let permits = Arc::clone(&permits);

        tokio::spawn(async move {
            let mut processed = 0_usize;

            loop {
                tokio::select! {
                    _ = shutdown_rx.changed() => {
                        if *shutdown_rx.borrow() {
                            break processed;
                        }
                    }
                    maybe_task = rx.recv() => {
                        let Some(task) = maybe_task else {
                            break processed;
                        };

                        let permit = permits.clone().acquire_owned().await.unwrap();
                        println!("claimed = {} via {}", task.task_id, task.route);
                        processed += 1;
                        drop(permit);
                    }
                }
            }
        })
    };

    producer.await.unwrap();
    shutdown_tx.send(true).unwrap();
    let processed = worker.await.unwrap();

    println!("processed = {}", processed);
    println!("shutdown = {}", true);
}

export const DEFAULT_CODES_CH25: Record<string, string> = {
  tokio_tasks_backpressure_spawn_blocking: `use tokio::sync::mpsc;
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
}`,
  tokio_tcp_graceful_shutdown: `use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::sync::watch;

async fn handle(mut stream: tokio::net::TcpStream) -> std::io::Result<()> {
    stream.write_all(b"pong\\n").await?;
    Ok(())
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let addr = listener.local_addr()?;
    let (shutdown_tx, mut shutdown_rx) = watch::channel(false);

    let server = tokio::spawn(async move {
        let mut accepted = 0_usize;

        loop {
            tokio::select! {
                changed = shutdown_rx.changed() => {
                    if changed.is_err() || *shutdown_rx.borrow() {
                        break accepted;
                    }
                }
                result = listener.accept() => {
                    match result {
                        Ok((stream, _peer)) => {
                            accepted += 1;
                            tokio::spawn(handle(stream));
                        }
                        Err(_e) => {
                            break accepted;
                        }
                    }
                }
            }
        }
    });

    let client_a = tokio::spawn(async move {
        let mut stream = tokio::net::TcpStream::connect(addr).await.unwrap();
        let mut buf = [0_u8; 5];
        stream.read_exact(&mut buf).await.unwrap();
        String::from_utf8_lossy(&buf).trim().to_string()
    });

    let client_b = tokio::spawn(async move {
        let mut stream = tokio::net::TcpStream::connect(addr).await.unwrap();
        let mut buf = [0_u8; 5];
        stream.read_exact(&mut buf).await.unwrap();
        String::from_utf8_lossy(&buf).trim().to_string()
    });

    let a = client_a.await.unwrap();
    let b = client_b.await.unwrap();

    shutdown_tx.send(true).unwrap();
    let accepted = server.await.unwrap();

    println!("accepted = {}", accepted);
    println!("client_a = {}", a);
    println!("client_b = {}", b);
    Ok(())
}`,
}

use tokio::sync::mpsc;
use tracing::{info_span, instrument, Instrument};

#[derive(Debug, Clone)]
struct Request {
    trace_id: &'static str,
    route: &'static str,
    bytes: usize,
}

async fn handle(request: Request) -> Result<usize, &'static str> {
    if request.bytes == 0 {
        return Err("empty payload");
    }

    Ok(request.bytes / 10)
}

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel::<Request>(4);

    tx.send(Request {
        trace_id: "req-11",
        route: "/score",
        bytes: 200,
    })
    .await
    .unwrap();

    tx.send(Request {
        trace_id: "req-12",
        route: "/health",
        bytes: 100,
    })
    .await
    .unwrap();

    drop(tx);

    let mut processed = 0_usize;
    let mut last_trace = "none";

    while let Some(request) = rx.recv().await {
        last_trace = request.trace_id;

        match handle(request).await {
            Ok(_) => processed += 1,
            Err(_) => {}
        }
    }

    println!("processed = {}", processed);
    println!("last trace = {}", last_trace);
}

use tokio::sync::mpsc;
use tracing::{error, info, info_span, instrument, Instrument};

#[derive(Debug, Clone)]
struct Request {
    trace_id: &'static str,
    route: &'static str,
    bytes: usize,
}

#[instrument(
    name = "handle_request",
    skip(request),
    fields(trace_id = %request.trace_id, route = request.route, bytes = request.bytes)
)]
async fn handle_request(request: Request) -> Result<usize, &'static str> {
    if request.bytes == 0 {
        error!(status = "reject", "empty payload");
        return Err("empty payload");
    }

    info!(status = "ok", "request handled");
    Ok(request.bytes / 10)
}

#[tokio::main]
async fn main() {
    let (tx, mut rx) = mpsc::channel::<Request>(4);

    tx.send(Request {
        trace_id: "req-7",
        route: "/score",
        bytes: 640,
    })
    .await
    .unwrap();

    tx.send(Request {
        trace_id: "req-8",
        route: "/score",
        bytes: 0,
    })
    .await
    .unwrap();

    tx.send(Request {
        trace_id: "req-9",
        route: "/health",
        bytes: 120,
    })
    .await
    .unwrap();

    drop(tx);

    let worker = info_span!("worker", worker = "ingest-a");
    let mut processed = 0_usize;
    let mut failures = 0_usize;
    let mut last_trace = "none";

    while let Some(request) = rx.recv().await {
        last_trace = request.trace_id;

        match handle_request(request).instrument(worker.clone()).await {
            Ok(_units) => processed += 1,
            Err(_error) => failures += 1,
        }
    }

    println!("instrumented = {}", true);
    println!("processed = {}", processed);
    println!("failures = {}", failures);
    println!("last trace = {}", last_trace);
}

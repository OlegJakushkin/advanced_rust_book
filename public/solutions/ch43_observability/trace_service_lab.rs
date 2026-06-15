use tokio::sync::mpsc;
use tracing::{error, info, info_span, instrument, Instrument};

#[derive(Debug, Clone)]
struct Request {
    trace_id: &'static str,
    route: &'static str,
    bytes: usize,
}

// Structured fields are attached to the span instead of being interpolated
// into a message, so trace_id and route can be filtered later. The empty
// payload becomes one structured reject rather than a silent count drop.
#[instrument(
    name = "handle",
    skip(request),
    fields(trace_id = %request.trace_id, route = request.route, bytes = request.bytes)
)]
async fn handle(request: Request) -> Result<usize, &'static str> {
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

    // One explicit worker span owns the runtime boundary. Each handler future
    // is attached to it with .instrument(...) so the handler span nests under
    // the worker instead of running detached after being polled.
    let worker = info_span!("worker", worker = "ingest-a");
    let mut processed = 0_usize;
    let mut last_trace = "none";

    while let Some(request) = rx.recv().await {
        last_trace = request.trace_id;

        match handle(request).instrument(worker.clone()).await {
            Ok(_) => processed += 1,
            Err(_) => {}
        }
    }

    println!("instrumented = {}", true);
    println!("processed = {}", processed);
    println!("last trace = {}", last_trace);
}

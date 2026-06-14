export const DEFAULT_CODES_CH43: Record<string, string> = {
  observability_tracing_tokio_spans: `use tokio::sync::mpsc;
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
}`,
  observability_metrics_slo_window: `#[derive(Debug, Clone, Copy)]
struct WindowStats {
    requests: u64,
    errors: u64,
    queue_p95_ms: u64,
    handler_p95_ms: u64,
    busy_workers: u32,
    total_workers: u32,
}

fn success_rate(stats: &WindowStats) -> f64 {
    1.0 - stats.errors as f64 / stats.requests as f64
}

fn latency_budget_ms(stats: &WindowStats) -> u64 {
    stats.queue_p95_ms + stats.handler_p95_ms
}

fn saturation(stats: &WindowStats) -> f64 {
    stats.busy_workers as f64 / stats.total_workers as f64
}

fn burn_alert(stats: &WindowStats) -> bool {
    latency_budget_ms(stats) > 350 || success_rate(stats) < 0.995 || saturation(stats) > 0.90
}

fn main() {
    let stats = WindowStats {
        requests: 5_000,
        errors: 40,
        queue_p95_ms: 180,
        handler_p95_ms: 210,
        busy_workers: 19,
        total_workers: 20,
    };

    println!("latency budget = {}", latency_budget_ms(&stats));
    println!("success rate = {:.4}", success_rate(&stats));
    println!("alert = {}", burn_alert(&stats));
}`,
}

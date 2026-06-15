export const DEFAULT_CODES_CH36: Record<string, string> = {
  distributed_profiling_latency_window: `#[derive(Debug, Clone, Copy)]
struct WindowStats {
    claimed: u32,
    completed: u32,
    retried: u32,
    queue_p95_ms: u64,
    run_p95_ms: u64,
    busy_workers: u32,
    total_workers: u32,
}

fn end_to_end_p95_ms(stats: &WindowStats) -> u64 {
    // approximation: sums two p95 values; accurate only when queue and run times are co-monotone
    stats.queue_p95_ms + stats.run_p95_ms
}

fn worker_saturation(stats: &WindowStats) -> f64 {
    stats.busy_workers as f64 / stats.total_workers as f64
}

fn retry_rate(stats: &WindowStats) -> f64 {
    stats.retried as f64 / stats.claimed as f64
}

fn main() {
    let stats = WindowStats {
        claimed: 120,
        completed: 110,
        retried: 18,
        queue_p95_ms: 140,
        run_p95_ms: 320,
        busy_workers: 17,
        total_workers: 20,
    };

    println!("e2e p95 = {}", end_to_end_p95_ms(&stats));
    println!("queue p95 = {}", stats.queue_p95_ms);
    println!("worker saturation = {:.2}", worker_saturation(&stats));
    println!("retry rate = {:.2}", retry_rate(&stats));
}`,
  distributed_profiling_task_graph: `type StageId = usize;

#[derive(Debug)]
struct Stage {
    name: &'static str,
    deps: Vec<StageId>,
    queue_ms: u64,
    run_ms: u64,
}

fn critical_path(stages: &[Stage]) -> (u64, &'static str) {
    let mut totals = vec![0_u64; stages.len()];
    let mut best = 0_u64;
    let mut tail = "none";

    for (id, stage) in stages.iter().enumerate() {
        let upstream = stage
            .deps
            .iter()
            .map(|&dep| totals[dep])
            .max()
            .unwrap_or(0);

        totals[id] = upstream + stage.queue_ms + stage.run_ms;

        // ties: last-processed stage wins; deterministic but arbitrary
        if totals[id] >= best {
            best = totals[id];
            tail = stage.name;
        }
    }

    (best, tail)
}

fn main() {
    let stages = vec![
        Stage {
            name: "fetch",
            deps: vec![],
            queue_ms: 20,
            run_ms: 70,
        },
        Stage {
            name: "parse",
            deps: vec![0],
            queue_ms: 30,
            run_ms: 90,
        },
        Stage {
            name: "enrich",
            deps: vec![1],
            queue_ms: 40,
            run_ms: 120,
        },
        Stage {
            name: "store",
            deps: vec![1],
            queue_ms: 10,
            run_ms: 60,
        },
        Stage {
            name: "notify",
            deps: vec![2, 3],
            queue_ms: 15,
            run_ms: 30,
        },
    ];

    let (critical_path_ms, tail_stage) = critical_path(&stages);
    let total_queued: u64 = stages.iter().map(|stage| stage.queue_ms).sum();

    println!("critical path ms = {}", critical_path_ms);
    println!("tail stage = {}", tail_stage);
    println!("queued ms = {}", total_queued);
}`,
}

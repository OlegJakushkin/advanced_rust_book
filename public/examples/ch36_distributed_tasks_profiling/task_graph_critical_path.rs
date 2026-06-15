type StageId = usize;

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
}

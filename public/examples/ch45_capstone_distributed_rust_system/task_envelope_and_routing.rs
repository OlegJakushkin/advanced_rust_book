#[derive(Debug, Clone)]
enum Workload {
    GraphSearch { start: u32, goal: u32 },
    MatrixTile { rows: usize, cols: usize, tile: usize },
}

#[derive(Debug, Clone)]
struct TaskEnvelope {
    task_id: &'static str,
    tenant: &'static str,
    attempt: u32,
    verification_root: u32,
    workload: Workload,
}

fn routing_key(workload: &Workload) -> &'static str {
    match workload {
        Workload::GraphSearch { .. } => "tasks.graph",
        Workload::MatrixTile { .. } => "tasks.matrix",
    }
}

fn main() {
    let task = TaskEnvelope {
        task_id: "task-7",
        tenant: "acme",
        attempt: 1,
        verification_root: 4242,
        workload: Workload::GraphSearch { start: 4, goal: 19 },
    };

    println!("task = {}", task.task_id);
    println!("route = {}", routing_key(&task.workload));
    println!("root = {}", task.verification_root);
    println!("tenant = {}", task.tenant);
}

export const DEFAULT_CODES_CH45: Record<string, string> = {
  capstone_task_envelope_routing: `#[derive(Debug, Clone)]
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
}`,
  capstone_worker_pool_workloads: `use std::collections::VecDeque;

#[derive(Debug, Clone)]
enum Workload {
    GraphSearch { frontier: Vec<u32> },
    MatrixTile { left: [f32; 4], right: [f32; 4] },
}

#[derive(Debug, Clone)]
struct Job {
    id: &'static str,
    workload: Workload,
}

fn graph_units(frontier: &[u32]) -> u32 {
    frontier.iter().copied().sum()
}

fn matrix_checksum(left: [f32; 4], right: [f32; 4]) -> f32 {
    left.iter().zip(right).map(|(l, r)| *l * r).sum()
}

fn main() {
    let mut queue = VecDeque::from([
        Job {
            id: "graph-1",
            workload: Workload::GraphSearch {
                frontier: vec![2_u32, 3, 5],
            },
        },
        Job {
            id: "matrix-1",
            workload: Workload::MatrixTile {
                left: [1.0_f32, 2.0, 3.0, 4.0],
                right: [2.0_f32, 3.0, 4.0, 5.0],
            },
        },
    ]);

    let mut completed = 0_u32;
    let mut graph_total = 0_u32;
    let mut matrix_total = 0.0_f32;

    while let Some(job) = queue.pop_front() {
        match job.workload {
            Workload::GraphSearch { frontier } => {
                graph_total += graph_units(&frontier);
            }
            Workload::MatrixTile { left, right } => {
                matrix_total += matrix_checksum(left, right);
            }
        }
        completed += 1;
    }

    println!("completed = {}", completed);
    println!("graph units = {}", graph_total);
    println!("matrix checksum = {:.1}", matrix_total);
}`,
}

use std::collections::VecDeque;

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
}

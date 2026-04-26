use mpi::collective::SystemOperation;
use mpi::traits::*;

fn block_range(rows: usize, size: usize, rank: usize) -> (usize, usize) {
    let base = rows / size;
    let remainder = rows % size;
    let start = rank * base + rank.min(remainder);
    let len = base + usize::from(rank < remainder);
    (start, start + len)
}

fn main() {
    let universe = mpi::initialize().unwrap();
    let world = universe.world();

    let rows = 8_usize;
    let cols = 3_usize;
    let rank = world.rank() as usize;
    let size = world.size() as usize;

    let (start, end) = block_range(rows, size, rank);
    let local_rows = end - start;

    let local_values: Vec<f64> = (0..local_rows * cols)
        .map(|offset| (start * cols + offset + 1) as f64)
        .collect();

    let local_sum: f64 = local_values.iter().copied().sum();
    let mut global_sum = 0.0_f64;

    world.all_reduce_into(&local_sum, &mut global_sum, SystemOperation::sum());

    println!("rank = {}", rank);
    println!("rows = {}..{}", start, end);

    if rank == 0 {
        println!("global = {:.1}", global_sum);
    }
}

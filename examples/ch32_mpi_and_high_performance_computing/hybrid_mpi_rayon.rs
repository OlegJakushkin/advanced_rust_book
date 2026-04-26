use mpi::collective::SystemOperation;
use mpi::traits::*;
use rayon::prelude::*;

fn main() {
    let universe = mpi::initialize().unwrap();
    let world = universe.world();

    let rank = world.rank() as usize;
    let local: Vec<u64> = vec![rank as u64 + 1, rank as u64 + 2, rank as u64 + 3];

    let threaded_sum: u64 = local.par_iter().copied().sum();
    let mut cluster_sum = 0_u64;

    world.all_reduce_into(&threaded_sum, &mut cluster_sum, SystemOperation::sum());

    println!("rank = {}", rank);
    println!("threaded sum = {}", threaded_sum);

    if rank == 0 {
        println!("cluster sum = {}", cluster_sum);
    }
}

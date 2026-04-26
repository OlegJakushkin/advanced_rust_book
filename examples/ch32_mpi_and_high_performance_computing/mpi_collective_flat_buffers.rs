use mpi::traits::*;

fn row_counts(rows: usize, ranks: usize) -> Vec<i32> {
    let base = rows / ranks;
    let remainder = rows % ranks;

    (0..ranks)
        .map(|rank| (base + usize::from(rank < remainder)) as i32)
        .collect()
}

fn displacements_in_cells(counts: &[i32], cols: usize) -> Vec<i32> {
    let mut out = Vec::with_capacity(counts.len());
    let mut offset = 0_i32;

    for &rows_for_rank in counts {
        out.push(offset);
        offset += rows_for_rank * cols as i32;
    }

    out
}

fn main() {
    let universe = mpi::initialize().unwrap();
    let world = universe.world();

    let rows = 10_usize;
    let cols = 4_usize;
    let size = world.size() as usize;
    let rank = world.rank() as usize;

    let counts = row_counts(rows, size);
    let displs = displacements_in_cells(&counts, cols);

    if rank == 0 {
        println!("counts = {:?}", counts);
        println!("displs = {:?}", displs);
    }

    println!("rank {} cells = {}", rank, counts[rank] as usize * cols);
}

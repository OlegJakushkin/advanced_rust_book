fn row_counts(rows: usize, ranks: usize) -> Vec<usize> {
    let base = rows / ranks;
    let remainder = rows % ranks;

    (0..ranks)
        .map(|rank| base + usize::from(rank < remainder))
        .collect()
}

fn displacements_in_cells(counts: &[usize], cols: usize) -> Vec<usize> {
    let mut out = Vec::with_capacity(counts.len());
    let mut offset = 0_usize;

    for &rows_for_rank in counts {
        out.push(offset);
        offset += rows_for_rank * cols;
    }

    out
}

fn main() {
    let rows = 10_usize;
    let cols = 4_usize;
    let ranks = 3_usize;
    let rank = 1_usize;

    let counts = row_counts(rows, ranks);
    let displs = displacements_in_cells(&counts, cols);
    let local_norms = [7_u64, 9, 5];
    let allreduce_sum: u64 = local_norms.iter().copied().sum();

    println!("counts = {:?}", counts);
    println!("displs = {:?}", displs);
    println!("send cells = {}", counts[rank] * cols);
    println!("allreduce = {}", allreduce_sum);
}

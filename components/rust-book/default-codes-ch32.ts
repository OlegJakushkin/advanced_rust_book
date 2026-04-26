export const DEFAULT_CODES_CH32: Record<string, string> = {
  mpi_partition_dense_rows: `#[derive(Debug, Clone, Copy)]
struct Partition {
    start_row: usize,
    end_row: usize,
}

fn block_range(rows: usize, ranks: usize, rank: usize) -> Partition {
    let base = rows / ranks;
    let remainder = rows % ranks;
    let start = rank * base + rank.min(remainder);
    let len = base + usize::from(rank < remainder);

    Partition {
        start_row: start,
        end_row: start + len,
    }
}

fn local_sum(matrix: &[f64], cols: usize, part: Partition) -> f64 {
    let start = part.start_row * cols;
    let end = part.end_row * cols;
    matrix[start..end].iter().copied().sum()
}

fn main() {
    let rows = 8_usize;
    let cols = 3_usize;
    let ranks = 3_usize;
    let rank = 1_usize;

    let matrix: Vec<f64> = (1..=(rows * cols)).map(|value| value as f64).collect();
    let part = block_range(rows, ranks, rank);
    let subtotal = local_sum(&matrix, cols, part);

    println!("rank = {}", rank);
    println!("rows = {}..{}", part.start_row, part.end_row);
    println!("local rows = {}", part.end_row - part.start_row);
    println!("subtotal = {:.1}", subtotal);
}`,
  mpi_collective_counts_and_allreduce: `fn row_counts(rows: usize, ranks: usize) -> Vec<usize> {
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
}`,
}

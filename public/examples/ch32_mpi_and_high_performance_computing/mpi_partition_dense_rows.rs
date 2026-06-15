#[derive(Debug, Clone, Copy)]
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
}

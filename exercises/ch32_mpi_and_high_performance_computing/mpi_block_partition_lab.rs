#[derive(Debug, Clone, Copy)]
struct Partition {
    start_row: usize,
    end_row: usize,
}

fn block_range(rows: usize, ranks: usize, rank: usize) -> Partition {
    let rows_per_rank = rows / ranks;
    let start = rank * rows_per_rank;
    let end = start + rows_per_rank;

    Partition {
        start_row: start,
        end_row: end,
    }
}

fn main() {
    let rows = 11_usize;
    let ranks = 4_usize;
    let cols = 5_usize;

    for rank in 0..ranks {
        let part = block_range(rows, ranks, rank);
        println!("rank {} = {}..{}", rank, part.start_row, part.end_row);
    }

    let part = block_range(rows, ranks, 2);
    println!("cells rank2 = {}", (part.end_row - part.start_row) * cols);
}

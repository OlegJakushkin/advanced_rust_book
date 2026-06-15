#[derive(Debug, Clone, Copy)]
struct Partition {
    start_row: usize,
    end_row: usize,
}

// Balanced block distribution. Every rank gets `rows / ranks` rows; the
// first `rows % ranks` ranks each absorb one extra remainder row. The same
// closed-form expression serves every rank, so adjacent ranges meet exactly
// and the union is precisely 0..rows with no gaps or overlaps.
fn block_range(rows: usize, ranks: usize, rank: usize) -> Partition {
    let base = rows / ranks;
    let remainder = rows % ranks;
    // Earlier ranks that took an extra row push this start forward; capped at
    // `remainder` because once the remainder is spent there are no more extras.
    let start = rank * base + rank.min(remainder);
    // Branch-free "+1 if this rank is one of the first `remainder` ranks".
    let len = base + usize::from(rank < remainder);

    Partition {
        start_row: start,
        end_row: start + len, // half-open: end is exclusive
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

    // Rank 2 owns rows 6..9 (3 rows); 3 * 5 cols = 15 cells.
    let part = block_range(rows, ranks, 2);
    println!("cells rank2 = {}", (part.end_row - part.start_row) * cols);
}

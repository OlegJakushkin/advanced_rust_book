#[derive(Debug)]
struct Grid {
    rows: usize,
    cols: usize,
    data: Vec<u32>,
}

impl Grid {
    fn row_sums(&self) -> Vec<u32> {
        debug_assert_eq!(self.data.len(), self.rows * self.cols);
        self.data
            .chunks(self.cols)
            .map(|row| row.iter().copied().sum())
            .collect()
    }

    fn total(&self) -> u32 {
        self.data.iter().copied().sum()
    }
}

fn main() {
    let grid = Grid {
        rows: 2,
        cols: 4,
        data: vec![1_u32, 2, 3, 4, 5, 6, 7, 8],
    };

    let sums = grid.row_sums();

    println!("row0 = {}", sums[0]);
    println!("row1 = {}", sums[1]);
    println!("total = {}", grid.total());
}

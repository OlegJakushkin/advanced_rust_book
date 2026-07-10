#[derive(Debug)]
struct Matrix<T> {
    rows: usize,
    cols: usize,
    data: Vec<T>,
}

impl<T: Clone> Matrix<T> {
    fn from_elem(rows: usize, cols: usize, value: T) -> Self {
        Self {
            rows,
            cols,
            data: vec![value; rows * cols],
        }
    }
}

impl<T> Matrix<T> {
    // Row-major: skip `row` full rows of width `cols`, then step in by `col`.
    fn offset(&self, row: usize, col: usize) -> usize {
        row * self.cols + col
    }

    fn get(&self, row: usize, col: usize) -> Option<&T> {
        if row < self.rows && col < self.cols {
            Some(&self.data[self.offset(row, col)])
        } else {
            None
        }
    }

    fn set(&mut self, row: usize, col: usize, value: T) {
        let index = self.offset(row, col);
        self.data[index] = value;
    }

    // A full row is already contiguous in row-major storage: borrow it.
    fn row(&self, row: usize) -> Option<&[T]> {
        if row < self.rows {
            let start = row * self.cols;
            Some(&self.data[start..start + self.cols])
        } else {
            None
        }
    }
}

fn main() {
    let mut m = Matrix::from_elem(2, 2, 0_i32);
    m.set(0, 0, 5);
    m.set(0, 1, 7);
    m.set(1, 0, 3);
    m.set(1, 1, 8);

    let row1_sum: i32 = m.row(1).unwrap().iter().copied().sum();

    println!("a01 = {}", m.get(0, 1).copied().unwrap());
    println!("row1 sum = {}", row1_sum);
    println!("cells = {}", m.data.len());
}

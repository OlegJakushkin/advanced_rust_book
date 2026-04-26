export const DEFAULT_CODES_CH12: Record<string, string> = {
  matrices_row_major_dense: `#[derive(Debug)]
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
    let mut m = Matrix::from_elem(2, 3, 0_i32);
    m.set(0, 0, 10);
    m.set(0, 1, 20);
    m.set(0, 2, 30);
    m.set(1, 0, 4);
    m.set(1, 1, 5);
    m.set(1, 2, 6);

    let row1_sum: i32 = m.row(1).unwrap().iter().copied().sum();

    println!("last in row0 = {}", m.get(0, 2).copied().unwrap());
    println!("row1 sum = {}", row1_sum);
}`,
  matrices_views_const_generics: `struct MatrixView<'a, T> {
    data: &'a [T],
    rows: usize,
    cols: usize,
    stride: usize,
    offset: usize,
}

impl<'a, T> MatrixView<'a, T> {
    fn get(&self, row: usize, col: usize) -> Option<&T> {
        if row < self.rows && col < self.cols {
            let index = self.offset + row * self.stride + col;
            self.data.get(index)
        } else {
            None
        }
    }
}

fn trace<const N: usize>(matrix: [[i32; N]; N]) -> i32 {
    let mut sum = 0;
    let mut i = 0;

    while i < N {
        sum += matrix[i][i];
        i += 1;
    }

    sum
}

fn main() {
    let backing = vec![
        1_i32, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
    ];

    let view = MatrixView {
        data: &backing,
        rows: 2,
        cols: 2,
        stride: 4,
        offset: 5,
    };

    let fixed = [[3_i32, 1], [2, 4]];

    println!("view corner = {}", view.get(1, 1).copied().unwrap());
    println!("fixed trace = {}", trace(fixed));
}`,
}

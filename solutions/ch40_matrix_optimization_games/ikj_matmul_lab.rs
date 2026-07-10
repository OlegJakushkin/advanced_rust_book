struct Matrix {
    rows: usize,
    cols: usize,
    data: Vec<f32>,
}

impl Matrix {
    fn zeros(rows: usize, cols: usize) -> Self {
        Self { rows, cols, data: vec![0.0; rows * cols] }
    }
    fn offset(&self, row: usize, col: usize) -> usize {
        row * self.cols + col
    }
    fn get(&self, row: usize, col: usize) -> f32 {
        self.data[self.offset(row, col)]
    }
    fn set(&mut self, row: usize, col: usize, value: f32) {
        let index = self.offset(row, col);
        self.data[index] = value;
    }
}

// i-k-j order: the inner loop walks a row of B, not a column.
fn matmul_ikj(a: &Matrix, b: &Matrix) -> Matrix {
    let mut out = Matrix::zeros(a.rows, b.cols);
    for i in 0..a.rows {
        for k in 0..a.cols {
            let a_ik = a.get(i, k);
            for j in 0..b.cols {
                let current = out.get(i, j);
                out.set(i, j, current + a_ik * b.get(k, j));
            }
        }
    }
    out
}

fn checksum(m: &Matrix) -> f32 {
    m.data.iter().copied().sum()
}

fn main() {
    let a = Matrix { rows: 2, cols: 2, data: vec![1.0, 2.0, 3.0, 4.0] };
    let b = Matrix { rows: 2, cols: 2, data: vec![5.0, 6.0, 7.0, 8.0] };
    let c = matmul_ikj(&a, &b);
    println!("c[0,0] = {:.1}", c.get(0, 0));
    println!("c[1,1] = {:.1}", c.get(1, 1));
    println!("checksum = {:.1}", checksum(&c));
}

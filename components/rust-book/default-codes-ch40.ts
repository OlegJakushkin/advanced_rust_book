export const DEFAULT_CODES_CH40: Record<string, string> = {
  matrix_games_tiled_matmul: `#[derive(Debug, Clone, PartialEq)]
struct Matrix {
    rows: usize,
    cols: usize,
    data: Vec<f32>,
}

impl Matrix {
    fn from_vec(rows: usize, cols: usize, data: Vec<f32>) -> Self {
        assert_eq!(data.len(), rows * cols);
        Self { rows, cols, data }
    }

    fn zeros(rows: usize, cols: usize) -> Self {
        Self {
            rows,
            cols,
            data: vec![0.0; rows * cols],
        }
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

fn matmul_naive(a: &Matrix, b: &Matrix) -> Matrix {
    assert_eq!(a.cols, b.rows);
    let mut out = Matrix::zeros(a.rows, b.cols);

    for i in 0..a.rows {
        for j in 0..b.cols {
            let mut acc = 0.0_f32;
            for k in 0..a.cols {
                acc += a.get(i, k) * b.get(k, j);
            }
            out.set(i, j, acc);
        }
    }

    out
}

fn matmul_tiled(a: &Matrix, b: &Matrix, tile: usize) -> Matrix {
    assert_eq!(a.cols, b.rows);
    let mut out = Matrix::zeros(a.rows, b.cols);
    let tile = tile.max(1);

    let mut ii = 0;
    while ii < a.rows {
        let mut kk = 0;
        while kk < a.cols {
            let mut jj = 0;
            while jj < b.cols {
                let i_end = (ii + tile).min(a.rows);
                let k_end = (kk + tile).min(a.cols);
                let j_end = (jj + tile).min(b.cols);

                for i in ii..i_end {
                    for k in kk..k_end {
                        let a_ik = a.get(i, k);
                        for j in jj..j_end {
                            let current = out.get(i, j);
                            out.set(i, j, current + a_ik * b.get(k, j));
                        }
                    }
                }

                jj += tile;
            }
            kk += tile;
        }
        ii += tile;
    }

    out
}

fn approx_eq(left: &Matrix, right: &Matrix) -> bool {
    left.rows == right.rows
        && left.cols == right.cols
        && left
            .data
            .iter()
            .zip(&right.data)
            .all(|(l, r)| (l - r).abs() < 0.001)
}

fn checksum(matrix: &Matrix) -> f32 {
    matrix.data.iter().copied().sum()
}

fn main() {
    let a = Matrix::from_vec(
        3,
        3,
        vec![
            1.0, 2.0, 0.0,
            0.0, 1.0, 3.0,
            2.0, 0.0, 1.0,
        ],
    );

    let b = Matrix::from_vec(
        3,
        3,
        vec![
            3.0, 1.0, 2.0,
            2.0, 1.0, 0.0,
            1.0, 4.0, 2.0,
        ],
    );

    let naive = matmul_naive(&a, &b);
    let tiled = matmul_tiled(&a, &b, 2);

    println!("naive == tiled = {}", approx_eq(&naive, &tiled));
    println!("c[1,2] = {:.2}", tiled.get(1, 2));
    println!("checksum = {:.2}", checksum(&tiled));
}`,
  matrix_games_sparse_frontier: `#[derive(Debug)]
struct CsrMatrix {
    rows: usize,
    cols: usize,
    indptr: Vec<usize>,
    indices: Vec<usize>,
    data: Vec<f32>,
}

impl CsrMatrix {
    fn nnz(&self) -> usize {
        self.data.len()
    }

    fn dense_bytes(&self) -> usize {
        self.rows * self.cols * std::mem::size_of::<f32>()
    }
}

fn advance_frontier(csr: &CsrMatrix, frontier: &[f32]) -> Vec<u8> {
    assert_eq!(frontier.len(), csr.rows);

    let mut next = vec![0_u8; csr.cols];

    for row in 0..csr.rows {
        if frontier[row] == 0.0 {
            continue;
        }

        let start = csr.indptr[row];
        let end = csr.indptr[row + 1];

        for edge in start..end {
            let col = csr.indices[edge];
            if csr.data[edge] != 0.0 {
                next[col] = 1;
            }
        }
    }

    next
}

fn render(bits: &[u8]) -> String {
    bits.iter()
        .map(|bit| bit.to_string())
        .collect::<Vec<_>>()
        .join(",")
}

fn main() {
    let graph = CsrMatrix {
        rows: 5,
        cols: 5,
        indptr: vec![0, 2, 3, 5, 6, 6],
        indices: vec![1, 2, 3, 3, 4, 4],
        data: vec![1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    };

    let frontier = vec![1.0, 0.0, 1.0, 0.0, 0.0];
    let next = advance_frontier(&graph, &frontier);

    println!("nnz = {}", graph.nnz());
    println!("next frontier = {}", render(&next));
    println!("dense bytes = {}", graph.dense_bytes());
}`,
}

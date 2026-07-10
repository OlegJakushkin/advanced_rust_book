#[derive(Debug)]
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
}

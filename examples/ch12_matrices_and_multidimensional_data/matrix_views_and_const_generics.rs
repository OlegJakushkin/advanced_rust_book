struct MatrixView<'a, T> {
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
}

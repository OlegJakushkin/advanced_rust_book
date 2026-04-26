use std::collections::VecDeque;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
struct Point {
    row: usize,
    col: usize,
}

fn find_cell(grid: &[&str], needle: u8) -> Option<Point> {
    for (row, line) in grid.iter().enumerate() {
        for (col, byte) in line.as_bytes().iter().copied().enumerate() {
            if byte == needle {
                return Some(Point { row, col });
            }
        }
    }

    None
}

fn is_open(grid: &[&str], point: Point) -> bool {
    !matches!(grid[point.row].as_bytes()[point.col], b'#')
}

fn neighbors(grid: &[&str], point: Point) -> impl Iterator<Item = Point> {
    let rows = grid.len() as isize;
    let cols = grid[0].len() as isize;
    let row = point.row as isize;
    let col = point.col as isize;

    [(-1, 0), (1, 0), (0, -1), (0, 1)]
        .into_iter()
        .filter_map(move |(dr, dc)| {
            let next_row = row + dr;
            let next_col = col + dc;

            if next_row < 0 || next_col < 0 || next_row >= rows || next_col >= cols {
                return None;
            }

            Some(Point {
                row: next_row as usize,
                col: next_col as usize,
            })
        })
}

fn shortest_steps(grid: &[&str], start: Point, goal: Point) -> Option<(usize, usize)> {
    let cols = grid[0].len();
    let mut dist = vec![usize::MAX; grid.len() * cols];
    let mut queue = VecDeque::new();
    let mut explored = 0usize;

    let index = |point: Point| point.row * cols + point.col;

    dist[index(start)] = 0;
    queue.push_back(start);

    while let Some(point) = queue.pop_front() {
        explored += 1;

        if point == goal {
            return Some((dist[index(goal)], explored));
        }

        for next in neighbors(grid, point) {
            if !is_open(grid, next) {
                continue;
            }

            let next_index = index(next);
            if dist[next_index] != usize::MAX {
                continue;
            }

            dist[next_index] = dist[index(point)] + 1;
            queue.push_back(next);
        }
    }

    None
}

fn main() {
    let grid = [
        "########",
        "#S#...G#",
        "#.#.##.#",
        "#......#",
        "########",
    ];

    let start = find_cell(&grid, b'S').unwrap();
    let goal = find_cell(&grid, b'G').unwrap();
    let (steps, explored) = shortest_steps(&grid, start, goal).unwrap();

    println!("steps = {}", steps);
    println!("explored = {}", explored);
}

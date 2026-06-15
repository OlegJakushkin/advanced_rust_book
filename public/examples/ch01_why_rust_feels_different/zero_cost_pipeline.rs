fn critical_count(readings: &[i32], threshold: i32) -> usize {
    readings
        .iter()
        .copied()
        .filter(|reading| *reading >= threshold)
        .count()
}

fn main() {
    let readings = vec![42, 87, 91, 63, 99];
    let count = critical_count(&readings, 80);
    println!("critical count = {}", count);
}

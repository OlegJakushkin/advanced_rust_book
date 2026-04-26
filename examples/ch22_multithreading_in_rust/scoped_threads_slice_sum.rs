use std::thread;

fn main() {
    let values = [2_u32, 4, 6, 8, 10, 12];
    let split_at = 3;

    thread::scope(|scope| {
        let (left, right) = values.split_at(split_at);

        let left_handle = scope.spawn(move || left.iter().copied().sum::<u32>());
        let right_handle = scope.spawn(move || right.iter().copied().sum::<u32>());

        let left_total = left_handle.join().unwrap();
        let right_total = right_handle.join().unwrap();

        println!("left = {}", left_total);
        println!("right = {}", right_total);
        println!("total = {}", left_total + right_total);
    });
}

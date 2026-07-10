use std::thread;

fn main() {
    let job = String::from("rebuild-search-index");

    let handle = thread::spawn(move || {
        println!("worker started: {}", job);
    });

    handle.join().unwrap();
}

fn main() {
    let queue_depth = 2048;

    let status = if queue_depth > 1024 { "hot" } else { "steady" };

    let labels = {
        let mut labels = Vec::with_capacity(8);
        labels.push(String::from("ingest"));
        labels.push(String::from("priority"));
        labels
    };

    let capacity = {
        let heap_slots = labels.capacity();
        heap_slots
    };

    println!("status = {}", status);
    println!("capacity = {}", capacity);
}

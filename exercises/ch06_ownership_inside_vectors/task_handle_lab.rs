#[derive(Debug)]
struct Task {
    name: String,
}

fn enqueue(tasks: &mut Vec<Task>, name: &str) -> usize {
    tasks.push(Task {
        name: name.to_string(),
    });
    tasks.len()
}

fn main() {
    let mut tasks = Vec::with_capacity(1);
    let first = enqueue(&mut tasks, "billing");
    enqueue(&mut tasks, "search");
    enqueue(&mut tasks, "indexer");

    println!("first = {}", tasks[first].name);
    println!("total = {}", tasks.len());
}

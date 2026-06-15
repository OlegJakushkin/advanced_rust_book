#[derive(Debug)]
struct Task {
    name: String,
}

fn enqueue(tasks: &mut Vec<Task>, name: &str) -> usize {
    // The new task lands at the current length; capture it before the push
    // so the returned handle points at the inserted task, not the next slot.
    let index = tasks.len();
    tasks.push(Task {
        name: name.to_string(),
    });
    index
}

fn main() {
    let mut tasks = Vec::with_capacity(1);
    let first = enqueue(&mut tasks, "billing");
    enqueue(&mut tasks, "search");
    enqueue(&mut tasks, "indexer");

    println!("first = {}", tasks[first].name);
    println!("total = {}", tasks.len());
}

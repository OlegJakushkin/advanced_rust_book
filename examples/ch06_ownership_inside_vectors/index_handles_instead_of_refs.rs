#[derive(Debug)]
struct Task {
    name: String,
    ready: bool,
}

fn push_task(tasks: &mut Vec<Task>, name: &str) -> usize {
    let index = tasks.len();
    tasks.push(Task {
        name: name.to_string(),
        ready: true,
    });
    index
}

fn mark_not_ready(tasks: &mut [Task], index: usize) {
    tasks[index].ready = false;
}

fn main() {
    let mut tasks = Vec::with_capacity(1);

    let billing = push_task(&mut tasks, "billing");
    push_task(&mut tasks, "search");
    push_task(&mut tasks, "indexer");
    mark_not_ready(&mut tasks, billing);

    println!("task = {}", tasks[billing].name);
    println!("ready = {}", tasks[billing].ready);
    println!("total = {}", tasks.len());
}

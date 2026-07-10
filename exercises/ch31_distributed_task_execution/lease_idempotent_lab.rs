use std::collections::{HashSet, VecDeque};

#[derive(Debug, Clone)]
struct Task {
    id: &'static str,
}

struct Queue {
    visible: VecDeque<Task>,
    completed: HashSet<&'static str>,
    now: u64,
}

impl Queue {
    fn claim(&mut self) -> Option<Task> {
        self.visible.pop_front()
    }

    fn requeue_if_timed_out(&mut self, task: Task, deadline: u64) {
        if self.now < deadline {
            self.visible.push_back(task);
        }
    }

    fn finish_once(&mut self, task: &Task) -> bool {
        false
    }
}

fn main() {
    let mut queue = Queue {
        visible: VecDeque::new(),
        completed: HashSet::new(),
        now: 0,
    };

    queue.visible.push_back(Task { id: "task-1" });

    let first = queue.claim().unwrap();
    queue.now = 6;
    queue.requeue_if_timed_out(first.clone(), 5);

    let redelivery = queue.claim().unwrap();
    let _first_apply = queue.finish_once(&redelivery);
    let duplicate_apply = queue.finish_once(&redelivery);

    println!("redelivered = {}", redelivery.id);
    println!("completed = {}", queue.completed.len());
    println!("duplicate = {}", !duplicate_apply);
}

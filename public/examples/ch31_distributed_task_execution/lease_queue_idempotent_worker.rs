use std::collections::{HashMap, HashSet, VecDeque};

#[derive(Debug, Clone)]
struct Task {
    id: &'static str,
    payload: &'static str,
}

#[derive(Debug)]
struct Lease {
    task: Task,
    deadline: u64,
}

struct LeaseQueue {
    visible: VecDeque<Task>,
    leased: HashMap<&'static str, Lease>,
    completed: HashSet<&'static str>,
    visibility_timeout: u64,
    now: u64,
}

impl LeaseQueue {
    fn new(visibility_timeout: u64) -> Self {
        Self {
            visible: VecDeque::new(),
            leased: HashMap::new(),
            completed: HashSet::new(),
            visibility_timeout,
            now: 0,
        }
    }

    fn push(&mut self, id: &'static str, payload: &'static str) {
        self.visible.push_back(Task { id, payload });
    }

    fn claim(&mut self, worker: &'static str) -> Option<(&'static str, &'static str, &'static str)> {
        let task = self.visible.pop_front()?;
        let deadline = self.now + self.visibility_timeout;
        let task_id = task.id;
        let payload = task.payload;
        self.leased.insert(task_id, Lease { task, deadline });
        Some((worker, task_id, payload))
    }

    fn advance_time(&mut self, delta: u64) {
        self.now += delta;
    }

    fn requeue_expired(&mut self) {
        let expired: Vec<&'static str> = self
            .leased
            .iter()
            .filter(|(_, lease)| lease.deadline <= self.now)
            .map(|(&task_id, _)| task_id)
            .collect();

        for task_id in expired {
            let lease = self.leased.remove(task_id).unwrap();
            self.visible.push_back(lease.task);
        }
    }

    fn finish_once(&mut self, task_id: &'static str) -> bool {
        if !self.completed.insert(task_id) {
            return false;
        }

        self.leased.remove(task_id);
        true
    }
}

fn main() {
    let mut queue = LeaseQueue::new(5);
    queue.push("task-1", "rebuild-index");

    let first = queue.claim("worker-a").unwrap();
    queue.advance_time(6);
    queue.requeue_expired();

    let redelivery = queue.claim("worker-b").unwrap();
    let _applied = queue.finish_once(redelivery.1);
    let duplicate = !queue.finish_once(redelivery.1);

    println!("claimed = {}", first.1);
    println!("redelivered = {}", redelivery.1);
    println!("completed = {}", queue.completed.len());
    println!("duplicates ignored = {}", duplicate);
}

export const DEFAULT_CODES_CH31: Record<string, string> = {
  distributed_tasks_lease_idempotent: `use std::collections::{HashMap, HashSet, VecDeque};

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
}`,
  distributed_tasks_graph_trace: `use std::collections::BTreeSet;

type TaskId = usize;

#[derive(Debug)]
struct TaskSpec {
    name: &'static str,
    deps: Vec<TaskId>,
    output: u32,
}

#[derive(Default)]
struct TaskGraph {
    nodes: Vec<TaskSpec>,
}

impl TaskGraph {
    fn add(&mut self, name: &'static str, deps: Vec<TaskId>, output: u32) -> TaskId {
        let id = self.nodes.len();
        self.nodes.push(TaskSpec { name, deps, output });
        id
    }

    fn ready(&self, done: &BTreeSet<TaskId>) -> Vec<TaskId> {
        self.nodes
            .iter()
            .enumerate()
            .filter(|(id, node)| !done.contains(id) && node.deps.iter().all(|dep| done.contains(dep)))
            .map(|(id, _)| id)
            .collect()
    }
}

fn main() {
    let mut graph = TaskGraph::default();
    let fetch = graph.add("fetch", vec![], 5);
    let parse = graph.add("parse", vec![fetch], 8);
    let enrich = graph.add("enrich", vec![parse], 13);
    let store = graph.add("store", vec![parse], 3);
    let _notify = graph.add("notify", vec![enrich, store], 2);

    let trace_id = "trace-7";
    let mut done = BTreeSet::new();
    let mut order = Vec::new();
    let mut aggregate = 0_u32;

    while done.len() < graph.nodes.len() {
        let ready = graph.ready(&done);

        for id in ready {
            let node = &graph.nodes[id];
            aggregate += node.output;
            order.push(node.name);
            done.insert(id);
        }
    }

    println!("completed = {}", order.len());
    println!("aggregate = {}", aggregate);
    println!("final = {}", order.last().copied().unwrap_or("none"));
    println!("trace = {}", trace_id);
}`,
}

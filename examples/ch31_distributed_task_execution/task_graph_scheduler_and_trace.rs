use std::collections::BTreeSet;

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
}

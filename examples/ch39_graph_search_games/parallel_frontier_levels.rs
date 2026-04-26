use std::thread;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
struct NodeId(usize);

#[derive(Debug)]
struct Node {
    name: &'static str,
    edges: Vec<NodeId>,
}

#[derive(Default, Debug)]
struct Graph {
    nodes: Vec<Node>,
}

impl Graph {
    fn add_node(&mut self, name: &'static str) -> NodeId {
        let id = NodeId(self.nodes.len());
        self.nodes.push(Node {
            name,
            edges: Vec::new(),
        });
        id
    }

    fn add_edge(&mut self, from: NodeId, to: NodeId) {
        self.nodes[from.0].edges.push(to);
    }

    fn name(&self, id: NodeId) -> &'static str {
        self.nodes[id.0].name
    }
}

fn collect_neighbors(graph: &Graph, frontier: &[NodeId]) -> Vec<NodeId> {
    frontier
        .iter()
        .flat_map(|&id| graph.nodes[id.0].edges.iter().copied())
        .collect()
}

fn bfs_layers_parallel(graph: &Graph, start: NodeId) -> Vec<Vec<NodeId>> {
    let mut visited = vec![false; graph.nodes.len()];
    let mut frontier = vec![start];
    let mut layers = Vec::new();

    visited[start.0] = true;

    while !frontier.is_empty() {
        layers.push(frontier.clone());

        let candidates = if frontier.len() < 2 {
            collect_neighbors(graph, &frontier)
        } else {
            let split = frontier.len() / 2;
            let (left, right) = frontier.split_at(split);

            thread::scope(|scope| {
                let left_handle = scope.spawn(move || collect_neighbors(graph, left));
                let right_handle = scope.spawn(move || collect_neighbors(graph, right));

                let mut out = left_handle.join().unwrap();
                out.extend(right_handle.join().unwrap());
                out
            })
        };

        let mut next = Vec::new();
        for id in candidates {
            if !visited[id.0] {
                visited[id.0] = true;
                next.push(id);
            }
        }

        frontier = next;
    }

    layers
}

fn main() {
    let mut graph = Graph::default();

    let api = graph.add_node("api");
    let auth = graph.add_node("auth");
    let billing = graph.add_node("billing");
    let cache = graph.add_node("cache");
    let search = graph.add_node("search");
    let ledger = graph.add_node("ledger");
    let goal = graph.add_node("goal");
    let archive = graph.add_node("archive");

    graph.add_edge(api, auth);
    graph.add_edge(api, billing);
    graph.add_edge(auth, cache);
    graph.add_edge(auth, search);
    graph.add_edge(billing, ledger);
    graph.add_edge(billing, search);
    graph.add_edge(cache, goal);
    graph.add_edge(search, goal);
    graph.add_edge(ledger, archive);
    graph.add_edge(goal, archive);

    let layers = bfs_layers_parallel(&graph, api);
    let visited = layers.iter().map(|layer| layer.len()).sum::<usize>();
    let last_layer = layers
        .last()
        .unwrap()
        .iter()
        .map(|&id| graph.name(id))
        .collect::<Vec<_>>()
        .join(",");

    println!("layers = {}", layers.len());
    println!("visited = {}", visited);
    println!("last = {}", last_layer);
}

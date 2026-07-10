use std::collections::VecDeque;

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

    fn names(&self, ids: &[NodeId]) -> Vec<&'static str> {
        ids.iter().map(|&id| self.name(id)).collect()
    }

    fn bfs_order(&self, start: NodeId) -> Vec<NodeId> {
        let mut visited = vec![false; self.nodes.len()];
        let mut queue = VecDeque::new();
        let mut order = Vec::new();

        visited[start.0] = true;
        queue.push_back(start);

        while let Some(id) = queue.pop_front() {
            order.push(id);

            for &next in &self.nodes[id.0].edges {
                if !visited[next.0] {
                    visited[next.0] = true;
                    queue.push_back(next);
                }
            }
        }

        order
    }

    fn shortest_hops(&self, start: NodeId, goal: NodeId) -> Option<usize> {
        let mut dist = vec![usize::MAX; self.nodes.len()];
        let mut queue = VecDeque::new();

        dist[start.0] = 0;
        queue.push_back(start);

        while let Some(id) = queue.pop_front() {
            if id == goal {
                return Some(dist[id.0]);
            }

            for &next in &self.nodes[id.0].edges {
                if dist[next.0] == usize::MAX {
                    dist[next.0] = dist[id.0] + 1;
                    queue.push_back(next);
                }
            }
        }

        None
    }
}

fn main() {
    let mut graph = Graph::default();

    let api = graph.add_node("api");
    let auth = graph.add_node("auth");
    let billing = graph.add_node("billing");
    let search = graph.add_node("search");

    graph.add_edge(api, auth);
    graph.add_edge(api, billing);
    graph.add_edge(auth, search);
    graph.add_edge(billing, search);

    let order = graph.bfs_order(api);
    let hops = graph.shortest_hops(api, search).unwrap_or(0);

    println!("bfs = {}", graph.names(&order).join(","));
    println!("path hops = {}", hops);
}

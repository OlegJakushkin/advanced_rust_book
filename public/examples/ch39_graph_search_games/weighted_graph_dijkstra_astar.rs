use std::cmp::Ordering;
use std::collections::BinaryHeap;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
struct NodeId(usize);

#[derive(Clone, Copy, Debug)]
struct Edge {
    to: NodeId,
    cost: u32,
}

#[derive(Debug)]
struct Node {
    name: &'static str,
    x: i32,
    y: i32,
    edges: Vec<Edge>,
}

#[derive(Default)]
struct WeightedGraph {
    nodes: Vec<Node>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct State {
    cost: u32,
    node: NodeId,
    estimate: u32,
}

impl Ord for State {
    fn cmp(&self, other: &Self) -> Ordering {
        other
            .estimate
            .cmp(&self.estimate)
            .then_with(|| other.cost.cmp(&self.cost))
            .then_with(|| other.node.cmp(&self.node))
    }
}

impl PartialOrd for State {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl WeightedGraph {
    fn add_node(&mut self, name: &'static str, x: i32, y: i32) -> NodeId {
        let id = NodeId(self.nodes.len());
        self.nodes.push(Node {
            name,
            x,
            y,
            edges: Vec::new(),
        });
        id
    }

    fn add_edge(&mut self, from: NodeId, to: NodeId, cost: u32) {
        self.nodes[from.0].edges.push(Edge { to, cost });
    }

    fn heuristic(&self, left: NodeId, right: NodeId) -> u32 {
        self.nodes[left.0].x.abs_diff(self.nodes[right.0].x)
            + self.nodes[left.0].y.abs_diff(self.nodes[right.0].y)
    }

    fn dijkstra_cost(&self, start: NodeId, goal: NodeId) -> Option<u32> {
        let mut dist = vec![u32::MAX; self.nodes.len()];
        let mut heap = BinaryHeap::new();

        dist[start.0] = 0;
        heap.push(State {
            cost: 0,
            node: start,
            estimate: 0,
        });

        while let Some(State { cost, node, .. }) = heap.pop() {
            if node == goal {
                return Some(cost);
            }

            if cost > dist[node.0] {
                continue;
            }

            for edge in &self.nodes[node.0].edges {
                let next_cost = cost + edge.cost;
                if next_cost < dist[edge.to.0] {
                    dist[edge.to.0] = next_cost;
                    heap.push(State {
                        cost: next_cost,
                        node: edge.to,
                        estimate: next_cost,
                    });
                }
            }
        }

        None
    }

    fn a_star_cost(&self, start: NodeId, goal: NodeId) -> Option<u32> {
        let mut best = vec![u32::MAX; self.nodes.len()];
        let mut heap = BinaryHeap::new();

        best[start.0] = 0;
        heap.push(State {
            cost: 0,
            node: start,
            estimate: self.heuristic(start, goal),
        });

        while let Some(State { cost, node, .. }) = heap.pop() {
            if node == goal {
                return Some(cost);
            }

            if cost > best[node.0] {
                continue;
            }

            for edge in &self.nodes[node.0].edges {
                let next_cost = cost + edge.cost;
                if next_cost < best[edge.to.0] {
                    best[edge.to.0] = next_cost;
                    heap.push(State {
                        cost: next_cost,
                        node: edge.to,
                        estimate: next_cost + self.heuristic(edge.to, goal),
                    });
                }
            }
        }

        None
    }
}

fn main() {
    let mut graph = WeightedGraph::default();

    let a = graph.add_node("A", 0, 0);
    let b = graph.add_node("B", 1, 0);
    let c = graph.add_node("C", 0, 1);
    let d = graph.add_node("D", 1, 1);
    let goal = graph.add_node("Goal", 2, 1);

    graph.add_edge(a, b, 2);
    graph.add_edge(a, c, 5);
    graph.add_edge(b, d, 2);
    graph.add_edge(c, d, 1);
    graph.add_edge(d, goal, 3);
    graph.add_edge(b, goal, 9);

    let dijkstra = graph.dijkstra_cost(a, goal).unwrap_or(0);
    let a_star = graph.a_star_cost(a, goal).unwrap_or(0);

    println!("dijkstra cost = {}", dijkstra);
    println!("a_star cost = {}", a_star);
}

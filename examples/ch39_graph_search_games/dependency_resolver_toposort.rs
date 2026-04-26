use std::collections::VecDeque;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
struct NodeId(usize);

#[derive(Debug)]
struct Node {
    name: &'static str,
    deps: Vec<NodeId>,
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
            deps: Vec::new(),
        });
        id
    }

    fn add_dependency(&mut self, node: NodeId, depends_on: NodeId) {
        self.nodes[node.0].deps.push(depends_on);
    }

    fn name(&self, id: NodeId) -> &'static str {
        self.nodes[id.0].name
    }

    fn names(&self, ids: &[NodeId]) -> Vec<&'static str> {
        ids.iter().map(|&id| self.name(id)).collect()
    }

    fn resolve_order(&self) -> Result<Vec<NodeId>, Vec<NodeId>> {
        let mut indegree: Vec<usize> = self.nodes.iter().map(|node| node.deps.len()).collect();
        let mut dependents = vec![Vec::<NodeId>::new(); self.nodes.len()];

        for (node_index, node) in self.nodes.iter().enumerate() {
            for &dep in &node.deps {
                dependents[dep.0].push(NodeId(node_index));
            }
        }

        let mut ready = VecDeque::new();
        for (node_index, &count) in indegree.iter().enumerate() {
            if count == 0 {
                ready.push_back(NodeId(node_index));
            }
        }

        let mut order = Vec::with_capacity(self.nodes.len());

        while let Some(id) = ready.pop_front() {
            order.push(id);

            for &dependent in &dependents[id.0] {
                indegree[dependent.0] -= 1;
                if indegree[dependent.0] == 0 {
                    ready.push_back(dependent);
                }
            }
        }

        if order.len() == self.nodes.len() {
            Ok(order)
        } else {
            Err(self.cycle_witness().unwrap_or_default())
        }
    }

    fn cycle_witness(&self) -> Option<Vec<NodeId>> {
        let mut state = vec![0_u8; self.nodes.len()];
        let mut stack = Vec::new();

        for node_index in 0..self.nodes.len() {
            if state[node_index] == 0 {
                if let Some(cycle) = self.dfs_cycle(NodeId(node_index), &mut state, &mut stack) {
                    return Some(cycle);
                }
            }
        }

        None
    }

    fn dfs_cycle(
        &self,
        id: NodeId,
        state: &mut [u8],
        stack: &mut Vec<NodeId>,
    ) -> Option<Vec<NodeId>> {
        state[id.0] = 1;
        stack.push(id);

        for &dep in &self.nodes[id.0].deps {
            match state[dep.0] {
                0 => {
                    if let Some(cycle) = self.dfs_cycle(dep, state, stack) {
                        return Some(cycle);
                    }
                }
                1 => {
                    let start = stack.iter().position(|&node| node == dep).unwrap();
                    let mut cycle = stack[start..].to_vec();
                    cycle.push(dep);
                    return Some(cycle);
                }
                _ => {}
            }
        }

        stack.pop();
        state[id.0] = 2;
        None
    }
}

fn main() {
    let mut dag = Graph::default();

    let fetch = dag.add_node("fetch");
    let parse = dag.add_node("parse");
    let store = dag.add_node("store");
    let notify = dag.add_node("notify");

    dag.add_dependency(parse, fetch);
    dag.add_dependency(store, parse);
    dag.add_dependency(notify, store);

    let order = dag.resolve_order().unwrap();
    println!("order = {}", dag.names(&order).join(","));

    let mut cyclic = Graph::default();

    let a = cyclic.add_node("a");
    let b = cyclic.add_node("b");
    let c = cyclic.add_node("c");

    cyclic.add_dependency(a, b);
    cyclic.add_dependency(b, c);
    cyclic.add_dependency(c, a);

    let cycle = cyclic.resolve_order().unwrap_err();
    println!("cycle = {}", cyclic.names(&cycle).join("->"));
}

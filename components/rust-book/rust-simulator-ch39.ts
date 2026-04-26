type SimpleNode = {
  name: string
  x?: number
  y?: number
}

type WeightedEdge = {
  to: number
  cost: number
}

function parseSimpleGraph(code: string): {
  nodes: SimpleNode[]
  varToId: Map<string, number>
  edges: number[][]
} {
  const nodes: SimpleNode[] = []
  const varToId = new Map<string, number>()

  for (const match of code.matchAll(/let\s+([a-zA-Z_]\w*)\s*=\s*graph\.add_node\(\s*"([^"]+)"\s*\)/g)) {
    const id = nodes.length
    nodes.push({ name: match[2] })
    varToId.set(match[1], id)
  }

  const edges = Array.from({ length: nodes.length }, () => [] as number[])

  for (const match of code.matchAll(/graph\.add_edge\(\s*([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*\)/g)) {
    const from = varToId.get(match[1])
    const to = varToId.get(match[2])
    if (from !== undefined && to !== undefined) {
      edges[from].push(to)
    }
  }

  return { nodes, varToId, edges }
}

function parseWeightedGraph(code: string): {
  nodes: SimpleNode[]
  varToId: Map<string, number>
  edges: WeightedEdge[][]
} {
  const nodes: SimpleNode[] = []
  const varToId = new Map<string, number>()

  for (const match of code.matchAll(
    /let\s+([a-zA-Z_]\w*)\s*=\s*graph\.add_node\(\s*"([^"]+)"\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/g
  )) {
    const id = nodes.length
    nodes.push({
      name: match[2],
      x: Number(match[3]),
      y: Number(match[4]),
    })
    varToId.set(match[1], id)
  }

  const edges = Array.from({ length: nodes.length }, () => [] as WeightedEdge[])

  for (const match of code.matchAll(
    /graph\.add_edge\(\s*([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*,\s*(\d+)\s*\)/g
  )) {
    const from = varToId.get(match[1])
    const to = varToId.get(match[2])
    const cost = Number(match[3])
    if (from !== undefined && to !== undefined) {
      edges[from].push({ to, cost })
    }
  }

  return { nodes, varToId, edges }
}

function bfsOrder(edges: number[][], start: number): number[] {
  const visited = Array.from({ length: edges.length }, () => false)
  const queue: number[] = []
  const order: number[] = []

  visited[start] = true
  queue.push(start)

  while (queue.length > 0) {
    const id = queue.shift()
    if (id === undefined) break
    order.push(id)

    for (const next of edges[id]) {
      if (!visited[next]) {
        visited[next] = true
        queue.push(next)
      }
    }
  }

  return order
}

function shortestHops(edges: number[][], start: number, goal: number): number {
  const dist = Array.from({ length: edges.length }, () => Number.POSITIVE_INFINITY)
  const queue: number[] = []

  dist[start] = 0
  queue.push(start)

  while (queue.length > 0) {
    const id = queue.shift()
    if (id === undefined) break
    if (id === goal) return dist[id]

    for (const next of edges[id]) {
      if (!Number.isFinite(dist[next])) {
        dist[next] = dist[id] + 1
        queue.push(next)
      }
    }
  }

  return 0
}

function heuristic(nodes: SimpleNode[], left: number, right: number): number {
  const a = nodes[left]
  const b = nodes[right]
  if (a.x === undefined || a.y === undefined || b.x === undefined || b.y === undefined) return 0
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function dijkstra(edges: WeightedEdge[][], start: number, goal: number): number {
  const dist = Array.from({ length: edges.length }, () => Number.POSITIVE_INFINITY)
  const pending: Array<{ node: number; cost: number }> = [{ node: start, cost: 0 }]
  dist[start] = 0

  while (pending.length > 0) {
    pending.sort((left, right) => left.cost - right.cost)
    const current = pending.shift()
    if (!current) break

    if (current.node === goal) {
      return current.cost
    }

    if (current.cost > dist[current.node]) {
      continue
    }

    for (const edge of edges[current.node]) {
      const nextCost = current.cost + edge.cost
      if (nextCost < dist[edge.to]) {
        dist[edge.to] = nextCost
        pending.push({ node: edge.to, cost: nextCost })
      }
    }
  }

  return 0
}

function aStar(nodes: SimpleNode[], edges: WeightedEdge[][], start: number, goal: number): number {
  const best = Array.from({ length: edges.length }, () => Number.POSITIVE_INFINITY)
  const pending: Array<{ node: number; cost: number; estimate: number }> = [
    { node: start, cost: 0, estimate: heuristic(nodes, start, goal) },
  ]
  best[start] = 0

  while (pending.length > 0) {
    pending.sort((left, right) => left.estimate - right.estimate)
    const current = pending.shift()
    if (!current) break

    if (current.node === goal) {
      return current.cost
    }

    if (current.cost > best[current.node]) {
      continue
    }

    for (const edge of edges[current.node]) {
      const nextCost = current.cost + edge.cost
      if (nextCost < best[edge.to]) {
        best[edge.to] = nextCost
        pending.push({
          node: edge.to,
          cost: nextCost,
          estimate: nextCost + heuristic(nodes, edge.to, goal),
        })
      }
    }
  }

  return 0
}

function hasBfsOrderLogic(code: string): boolean {
  return (
    /VecDeque/.test(code) &&
    /push_back\(\s*start\s*\)/.test(code) &&
    /pop_front\(\)/.test(code) &&
    /visited\[\s*start\.0\s*\]\s*=\s*true/.test(code) &&
    /order\.push\(\s*id\s*\)/.test(code)
  )
}

function hasShortestHopLogic(code: string): boolean {
  return (
    /VecDeque/.test(code) &&
    /dist\[\s*start\.0\s*\]\s*=\s*0/.test(code) &&
    /queue\.push_back\(\s*start\s*\)/.test(code) &&
    /dist\[\s*next\.0\s*\]\s*=\s*dist\[\s*id\.0\s*\]\s*\+\s*1/.test(code)
  )
}

function hasDijkstraLogic(code: string): boolean {
  return (
    /BinaryHeap/.test(code) &&
    /dist\[\s*start\.0\s*\]\s*=\s*0/.test(code) &&
    /cost\s*\+\s*edge\.cost/.test(code) &&
    /estimate:\s*next_cost/.test(code)
  )
}

function hasAStarLogic(code: string): boolean {
  return /BinaryHeap/.test(code) && /heuristic/.test(code) && /estimate:\s*next_cost\s*\+\s*self\.heuristic/.test(code)
}

export function simulateCh39Output(code: string, key?: string): string | null {
  if (key === "graph_search_bfs_handles" || key === "ch39_ex_bfs_adj_list") {
    const { nodes, varToId, edges } = parseSimpleGraph(code)
    const startVar =
      code.match(/bfs_order\(\s*([a-zA-Z_]\w*)\s*\)/)?.[1] ??
      code.match(/shortest_hops\(\s*([a-zA-Z_]\w*)\s*,/)?.[1] ??
      "api"
    const goalVar = code.match(/shortest_hops\(\s*[a-zA-Z_]\w*\s*,\s*([a-zA-Z_]\w*)\s*\)/)?.[1] ?? "search"

    const start = varToId.get(startVar) ?? 0
    const goal = varToId.get(goalVar) ?? Math.max(nodes.length - 1, 0)

    const order = hasBfsOrderLogic(code) ? bfsOrder(edges, start) : []
    const hops = hasShortestHopLogic(code) ? shortestHops(edges, start, goal) : 0
    const orderNames = order.map((id) => nodes[id]?.name ?? "unknown").join(",")

    if (key === "graph_search_bfs_handles") {
      return `bfs = ${orderNames}\npath hops = ${hops}`
    }

    return `visited = ${orderNames}\nhops = ${hops}`
  }

  if (key === "graph_search_dijkstra_astar") {
    const { nodes, varToId, edges } = parseWeightedGraph(code)
    const startVar = code.match(/dijkstra_cost\(\s*([a-zA-Z_]\w*)\s*,/)?.[1] ?? "a"
    const goalVar =
      code.match(/dijkstra_cost\(\s*[a-zA-Z_]\w*\s*,\s*([a-zA-Z_]\w*)\s*\)/)?.[1] ??
      code.match(/a_star_cost\(\s*[a-zA-Z_]\w*\s*,\s*([a-zA-Z_]\w*)\s*\)/)?.[1] ??
      "goal"

    const start = varToId.get(startVar) ?? 0
    const goal = varToId.get(goalVar) ?? Math.max(nodes.length - 1, 0)

    const dijkstraCost = hasDijkstraLogic(code) ? dijkstra(nodes.length ? edges : [], start, goal) : 0
    const aStarCost = hasAStarLogic(code) ? aStar(nodes, edges, start, goal) : 0

    return `dijkstra cost = ${dijkstraCost}\na_star cost = ${aStarCost}`
  }

  return null
}

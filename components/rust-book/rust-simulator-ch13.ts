type ExprNode =
  | { kind: "number"; value: number }
  | { kind: "add"; left: string; right: string }
  | { kind: "mul"; left: string; right: string }

function parseArenaExprNodes(code: string): {
  nodes: Map<string, ExprNode>
  root: string | null
  count: number
} {
  const nodes = new Map<string, ExprNode>()

  for (const match of code.matchAll(
    /let\s+([a-zA-Z_]\w*)\s*=\s*arena\.alloc\(\s*Expr::Number\(\s*(-?\d+)\s*\)\s*\)\s*;/g
  )) {
    nodes.set(match[1], { kind: "number", value: Number(match[2]) })
  }

  for (const match of code.matchAll(
    /let\s+([a-zA-Z_]\w*)\s*=\s*arena\.alloc\(\s*Expr::Add\(\s*([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*\)\s*\)\s*;/g
  )) {
    nodes.set(match[1], { kind: "add", left: match[2], right: match[3] })
  }

  for (const match of code.matchAll(
    /let\s+([a-zA-Z_]\w*)\s*=\s*arena\.alloc\(\s*Expr::Mul\(\s*([a-zA-Z_]\w*)\s*,\s*([a-zA-Z_]\w*)\s*\)\s*\)\s*;/g
  )) {
    nodes.set(match[1], { kind: "mul", left: match[2], right: match[3] })
  }

  const root = code.match(/arena\.eval\(\s*([a-zA-Z_]\w*)\s*\)/)?.[1] ?? null
  return { nodes, root, count: nodes.size }
}

function evalArenaNode(name: string, nodes: Map<string, ExprNode>): number {
  const node = nodes.get(name)
  if (!node) return 0

  switch (node.kind) {
    case "number":
      return node.value
    case "add":
      return evalArenaNode(node.left, nodes) + evalArenaNode(node.right, nodes)
    case "mul":
      return evalArenaNode(node.left, nodes) * evalArenaNode(node.right, nodes)
  }
}

export function simulateCh13Output(code: string, key?: string): string | null {
  if (key === "arena_allocation_bump_scratch") {
    const allocations = Array.from(code.matchAll(/alloc_bytes\(\s*b"([^"]*)"\s*\)/g), (match) => match[1])
    const used = allocations.reduce((total, value) => total + value.length, 0)
    const first = allocations[0] ?? "arena123"
    const afterReset = /\.reset\(\)/.test(code) ? 0 : used

    return `used = ${used}\nfirst = ${first}\nafter reset = ${afterReset}`
  }

  if (key === "arena_allocation_index_ast") {
    const { nodes, root, count } = parseArenaExprNodes(code)
    const value = root ? evalArenaNode(root, nodes) : 0
    return `value = ${value}\nnodes = ${count}`
  }

  if (key === "ch13_ex_arena_ast") {
    const { nodes, root, count } = parseArenaExprNodes(code)
    const hasAddEval =
      /Expr::Add\(\s*left\s*,\s*right\s*\)\s*=>\s*self\.eval\(\s*\*left\s*\)\s*\+\s*self\.eval\(\s*\*right\s*\)/.test(
        code
      ) ||
      /Expr::Add\(\s*left\s*,\s*right\s*\)\s*=>\s*\{\s*self\.eval\(\s*\*left\s*\)\s*\+\s*self\.eval\(\s*\*right\s*\)\s*\}/.test(
        code
      )

    if (!hasAddEval) {
      return `value = 0\nnodes = ${count}`
    }

    const value = root ? evalArenaNode(root, nodes) : 0
    return `value = ${value}\nnodes = ${count}`
  }

  return null
}

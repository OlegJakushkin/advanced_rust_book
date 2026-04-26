function parseNumberList(source?: string): number[] {
  if (!source) return []

  return source
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/_/g, "")
        .replace(/(?:f32|f64|i8|i16|i32|i64|i128|isize|u8|u16|u32|u64|u128|usize)$/i, "")
    )
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((value) => !Number.isNaN(value))
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

type DispatchTask = {
  verified: boolean
  workload: "Graph" | "Matrix"
}

function parseDispatchTasks(code: string): DispatchTask[] {
  return Array.from(
    code.matchAll(
      /TaskEnvelope\s*{\s*task_id:\s*"[^"]+"\s*,\s*verified:\s*(true|false)\s*,\s*workload:\s*Workload::(Graph|Matrix)\s*,?\s*}/g
    ),
    (match) => ({
      verified: match[1] === "true",
      workload: match[2] as "Graph" | "Matrix",
    })
  )
}

export function simulateCh45Output(code: string, key?: string): string | null {
  if (key === "capstone_task_envelope_routing") {
    const taskId = code.match(/task_id:\s*"([^"]+)"/)?.[1] ?? "task-7"
    const tenant = code.match(/tenant:\s*"([^"]+)"/)?.[1] ?? "acme"
    const root = Number(code.match(/verification_root:\s*(\d+)/)?.[1] ?? "0")

    const graphRoute = /Workload::GraphSearch\s*\{[^}]*\}\s*=>\s*"tasks\.graph"/s.test(code)
    const matrixRoute = /Workload::MatrixTile\s*\{[^}]*\}\s*=>\s*"tasks\.matrix"/s.test(code)
    const isGraphTask = /workload:\s*Workload::GraphSearch/.test(code)
    const isMatrixTask = /workload:\s*Workload::MatrixTile/.test(code)

    const route = isGraphTask && graphRoute ? "tasks.graph" : isMatrixTask && matrixRoute ? "tasks.matrix" : "tasks.unknown"

    return `task = ${taskId}\nroute = ${route}\nroot = ${root}\ntenant = ${tenant}`
  }

  if (key === "capstone_worker_pool_workloads") {
    const jobCount = (code.match(/Job\s*{/g) ?? []).length
    const frontier = parseNumberList(code.match(/frontier:\s*vec!\[([^\]]+)\]/)?.[1])
    const left = parseNumberList(code.match(/left:\s*\[([^\]]+)\]/)?.[1])
    const right = parseNumberList(code.match(/right:\s*\[([^\]]+)\]/)?.[1])

    const hasLoop = /while\s+let\s+Some\(job\)\s*=\s*queue\.pop_front\(\)/.test(code)
    const hasGraphPath = /graph_total\s*\+=\s*graph_units\(&frontier\)/.test(code)
    const hasMatrixPath = /matrix_total\s*\+=\s*matrix_checksum\(\s*left\s*,\s*right\s*\)/.test(code)

    const matrixChecksum = left.reduce((total, value, index) => total + value * (right[index] ?? 0), 0)

    return `completed = ${hasLoop ? jobCount : 0}\ngraph units = ${
      hasGraphPath ? sum(frontier) : 0
    }\nmatrix checksum = ${(hasMatrixPath ? matrixChecksum : 0).toFixed(1)}`
  }

  if (key === "ch45_ex_capstone_dispatcher") {
    const tasks = parseDispatchTasks(code)
    const routeGraph = /Workload::Graph\s*=>\s*"tasks\.graph"/.test(code)
    const routeMatrix = /Workload::Matrix\s*=>\s*"tasks\.matrix"/.test(code)
    const verifiedGate = /task\.verified/.test(code) || /_task\.verified/.test(code)

    if (!(routeGraph && routeMatrix && verifiedGate)) {
      return "accepted = 0\nrejected = 3\nlast route = none"
    }

    const accepted = tasks.filter((task) => task.verified)
    const rejected = tasks.length - accepted.length
    const last = accepted[accepted.length - 1]
    const lastRoute =
      last?.workload === "Graph" ? "tasks.graph" : last?.workload === "Matrix" ? "tasks.matrix" : "none"

    return `accepted = ${accepted.length}\nrejected = ${rejected}\nlast route = ${lastRoute}`
  }

  return null
}

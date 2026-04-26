function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function parseLeaseTaskId(code: string): string {
  return (
    code.match(/queue\.push\(\s*"([^"]+)"/)?.[1] ??
    code.match(/visible\.push_back\(Task\s*{\s*id:\s*"([^"]+)"/)?.[1] ??
    "task-1"
  )
}

export function simulateCh31Output(code: string, key?: string): string | null {
  if (key === "distributed_tasks_lease_idempotent") {
    const taskId = parseLeaseTaskId(code)

    const hasRequeueCheck =
      /lease\.deadline\s*<=\s*self\.now/.test(code) || /self\.now\s*>=\s*deadline/.test(code)
    const pushesExpiredBack =
      /self\.visible\.push_back\(\s*lease\.task\s*\)/.test(code) ||
      /self\.visible\.push_back\(\s*task\s*\)/.test(code)

    const hasIdempotentFinish =
      (/self\.completed\.insert\(\s*task_id\s*\)/.test(code) ||
        /self\.completed\.insert\(\s*task\.id\s*\)/.test(code)) &&
      /return false/.test(code)

    return `claimed = ${taskId}\nredelivered = ${
      hasRequeueCheck && pushesExpiredBack ? taskId : "none"
    }\ncompleted = ${hasIdempotentFinish ? 1 : 0}\nduplicates ignored = ${hasIdempotentFinish}`
  }

  if (key === "distributed_tasks_graph_trace") {
    const nodes = Array.from(
      code.matchAll(/graph\.add\(\s*"([^"]+)"\s*,\s*vec!\[[^\]]*\]\s*,\s*(\d+)/g),
      (match) => ({
        name: match[1],
        output: Number(match[2]),
      })
    )

    const traceId = code.match(/let\s+trace_id\s*=\s*"([^"]+)"/)?.[1] ?? "trace-7"
    const hasAggregation = /aggregate\s*\+=\s*node\.output/.test(code)
    const hasScheduling = /done\.insert\(\s*id\s*\)/.test(code) && /graph\.ready\(&done\)/.test(code)

    return `completed = ${hasScheduling ? nodes.length : 0}\naggregate = ${
      hasAggregation ? sum(nodes.map((node) => node.output)) : 0
    }\nfinal = ${hasScheduling && nodes.length > 0 ? nodes[nodes.length - 1].name : "none"}\ntrace = ${traceId}`
  }

  if (key === "ch31_ex_lease_idempotent") {
    const taskId = parseLeaseTaskId(code)

    const requeuesExpired =
      /if\s+self\.now\s*>=\s*deadline[\s\S]*push_back\(\s*task\s*\)/.test(code) ||
      /if\s+deadline\s*<=\s*self\.now[\s\S]*push_back\(\s*task\s*\)/.test(code)

    const finishOnce =
      /self\.completed\.insert\(\s*task\.id\s*\)/.test(code) ||
      /self\.completed\.insert\(\s*task_id\s*\)/.test(code)

    return `redelivered = ${requeuesExpired ? taskId : "none"}\ncompleted = ${finishOnce ? 1 : 0}\nduplicate = ${finishOnce}`
  }

  return null
}

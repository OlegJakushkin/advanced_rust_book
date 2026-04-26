function parseNumericList(source?: string): number[] {
  if (!source) return []

  return source
    .split(",")
    .map((part) =>
      part
        .trim()
        .replace(/_/g, "")
        .replace(/(?:i|u)(?:8|16|32|64|128|size)$/i, "")
    )
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((value) => !Number.isNaN(value))
}

function parseQuotedList(source?: string): string[] {
  if (!source) return []
  return Array.from(source.matchAll(/"([^"]+)"/g), (match) => match[1])
}

function parseWorkerJobSums(code: string): Record<string, number> {
  const vectorSums: Record<string, number> = {}

  for (const match of code.matchAll(/let\s+([a-zA-Z_]\w*)\s*=\s*vec!\[([\s\S]*?)\]\s*;/g)) {
    const name = match[1]
    const body = match[2]
    const costs = Array.from(body.matchAll(/cost:\s*(\d+)/g), (costMatch) => Number(costMatch[1]))
    vectorSums[name] = costs.reduce((sum, value) => sum + value, 0)
  }

  const workerSums: Record<string, number> = {}
  for (const match of code.matchAll(
    /spawn_worker\(\s*tx(?:\.clone\(\))?\s*,\s*"([^"]+)"\s*,\s*([a-zA-Z_]\w*)\s*\)/g
  )) {
    const worker = match[1]
    const vectorName = match[2]
    workerSums[worker] = vectorSums[vectorName] ?? 0
  }

  return workerSums
}

export function simulateCh22Output(code: string, key?: string): string | null {
  if (key === "multithreading_owned_jobs_channel") {
    const totals = parseWorkerJobSums(code)
    const grand = Object.values(totals).reduce((sum, value) => sum + value, 0)

    return `ingest total = ${totals["ingest"] ?? 0}\nindex total = ${totals["index"] ?? 0}\ngrand total = ${grand}`
  }

  if (key === "multithreading_shared_state_metrics") {
    const routeSource = code.match(/for\s+route\s+in\s*\[([\s\S]*?)\]/)?.[1]
    const routes = parseQuotedList(routeSource)
    const usesArcMutex = /Arc::new\(\s*Mutex::new/.test(code) && /lock\(\)\.unwrap\(\)/.test(code)

    const counts: Record<string, number> = {}
    if (usesArcMutex) {
      for (const route of routes) {
        counts[route] = (counts[route] ?? 0) + 1
      }
    }

    return `api = ${counts["api"] ?? 0}\nbilling = ${counts["billing"] ?? 0}\nroutes = ${Object.keys(counts).length}`
  }

  if (key === "multithreading_scoped_threads_sum") {
    const values = parseNumericList(code.match(/let\s+values\s*=\s*\[([^\]]+)\]/)?.[1])
    const splitAt = Number(code.match(/let\s+split_at\s*=\s*(\d+)/)?.[1] ?? "0")
    const hasScope = /thread::scope\(/.test(code) && /scope\.spawn\(/.test(code)

    if (!hasScope) {
      return "left = 0\nright = 0\ntotal = 0"
    }

    const left = values.slice(0, splitAt).reduce((sum, value) => sum + value, 0)
    const right = values.slice(splitAt).reduce((sum, value) => sum + value, 0)

    return `left = ${left}\nright = ${right}\ntotal = ${left + right}`
  }

  if (key === "ch22_ex_owned_jobs_channel") {
    const totals = parseWorkerJobSums(code)
    const hasMoveSpawn = /thread::spawn\(\s*move\s*\|\|/.test(code)
    const sendsResult = /tx\.send\(\s*\(\s*worker\s*,\s*total\s*\)\s*\)/.test(code)
    const sumsCosts =
      /job\.cost/.test(code) &&
      (/\.sum::<u32>\(\)/.test(code) || /\.sum\(\)/.test(code) || /for\s+job\s+in\s+jobs/.test(code))
    const joins = (code.match(/join\(\)\.unwrap\(\)/g) ?? []).length >= 2

    if (hasMoveSpawn && sendsResult && sumsCosts && joins) {
      const grand = Object.values(totals).reduce((sum, value) => sum + value, 0)
      return `ingest = ${totals["ingest"] ?? 0}\nindex = ${totals["index"] ?? 0}\ngrand = ${grand}`
    }

    return "ingest = 0\nindex = 0\ngrand = 0"
  }

  return null
}

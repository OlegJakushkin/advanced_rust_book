type StageSample = {
  name: string
  deps: number[]
  queueMs: number
  runMs: number
}

function parseNumber(code: string, pattern: RegExp, fallback: number): number {
  return Number(code.match(pattern)?.[1] ?? String(fallback))
}

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

function formatRate(value: number): string {
  return value.toFixed(2)
}

function parseStages(code: string): StageSample[] {
  return Array.from(
    code.matchAll(
      /Stage\s*{\s*name:\s*"([^"]+)"\s*,\s*deps:\s*vec!\[([^\]]*)\]\s*,\s*queue_ms:\s*(\d+)\s*,\s*run_ms:\s*(\d+)\s*,?\s*}/g
    ),
    (match) => ({
      name: match[1],
      deps: parseNumericList(match[2]),
      queueMs: Number(match[3]),
      runMs: Number(match[4]),
    })
  )
}

function criticalPath(stages: StageSample[]): { total: number; tail: string; queued: number } {
  const totals = Array.from({ length: stages.length }, () => 0)
  let best = 0
  let tail = "none"

  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index]
    const upstream = stage.deps.reduce((max, dep) => Math.max(max, totals[dep] ?? 0), 0)
    totals[index] = upstream + stage.queueMs + stage.runMs

    if (totals[index] >= best) {
      best = totals[index]
      tail = stage.name
    }
  }

  return {
    total: best,
    tail,
    queued: stages.reduce((sum, stage) => sum + stage.queueMs, 0),
  }
}

function hasSaturationFormula(code: string): boolean {
  return (
    /stats\.busy_workers\s+as\s+f64\s*\/\s*stats\.total_workers\s+as\s+f64/.test(code) ||
    /stats\.busy_workers\s+as\s+f64\s*\/\s*\(\s*stats\.total_workers\s+as\s+f64\s*\)/.test(code) ||
    /\(\s*stats\.busy_workers\s+as\s+f64\s*\)\s*\/\s*\(\s*stats\.total_workers\s+as\s+f64\s*\)/.test(code)
  )
}

function hasRetryRateFormula(code: string): boolean {
  return (
    /stats\.retried\s+as\s+f64\s*\/\s*stats\.claimed\s+as\s+f64/.test(code) ||
    /stats\.retried\s+as\s+f64\s*\/\s*\(\s*stats\.claimed\s+as\s+f64\s*\)/.test(code) ||
    /\(\s*stats\.retried\s+as\s+f64\s*\)\s*\/\s*\(\s*stats\.claimed\s+as\s+f64\s*\)/.test(code)
  )
}

export function simulateCh36Output(code: string, key?: string): string | null {
  if (key === "distributed_profiling_latency_window") {
    const claimed = parseNumber(code, /claimed:\s*(\d+)/, 120)
    const retried = parseNumber(code, /retried:\s*(\d+)/, 18)
    const queueP95 = parseNumber(code, /queue_p95_ms:\s*(\d+)/, 140)
    const runP95 = parseNumber(code, /run_p95_ms:\s*(\d+)/, 320)
    const busyWorkers = parseNumber(code, /busy_workers:\s*(\d+)/, 17)
    const totalWorkers = parseNumber(code, /total_workers:\s*(\d+)/, 20)

    const saturation = totalWorkers === 0 ? 0 : busyWorkers / totalWorkers
    const retryRate = claimed === 0 ? 0 : retried / claimed

    return `e2e p95 = ${queueP95 + runP95}\nqueue p95 = ${queueP95}\nworker saturation = ${formatRate(
      saturation
    )}\nretry rate = ${formatRate(retryRate)}`
  }

  if (key === "distributed_profiling_task_graph") {
    const stages = parseStages(code)
    const result = criticalPath(
      stages.length > 0
        ? stages
        : [
            { name: "fetch", deps: [], queueMs: 20, runMs: 70 },
            { name: "parse", deps: [0], queueMs: 30, runMs: 90 },
            { name: "enrich", deps: [1], queueMs: 40, runMs: 120 },
            { name: "store", deps: [1], queueMs: 10, runMs: 60 },
            { name: "notify", deps: [2, 3], queueMs: 15, runMs: 30 },
          ]
    )

    return `critical path ms = ${result.total}\ntail stage = ${result.tail}\nqueued ms = ${result.queued}`
  }

  if (key === "ch36_ex_retry_storm_window") {
    const claimed = parseNumber(code, /claimed:\s*(\d+)/, 100)
    const retried = parseNumber(code, /retried:\s*(\d+)/, 40)
    const busyWorkers = parseNumber(code, /busy_workers:\s*(\d+)/, 9)
    const totalWorkers = parseNumber(code, /total_workers:\s*(\d+)/, 10)

    const saturation = totalWorkers === 0 ? 0 : busyWorkers / totalWorkers
    const retryRate = claimed === 0 ? 0 : retried / claimed

    const knowsSaturation = hasSaturationFormula(code)
    const knowsRetryRate = hasRetryRateFormula(code)

    const stormThresholdSaturation = Number(
      code.match(/saturation\(\s*&?stats\s*\)\s*(?:>=|>)\s*(\d+(?:\.\d+)?)/)?.[1] ?? "0.85"
    )
    const stormThresholdRetry = Number(
      code.match(/retry_rate\(\s*&?stats\s*\)\s*(?:>=|>)\s*(\d+(?:\.\d+)?)/)?.[1] ?? "0.30"
    )
    const hasStormLogic =
      /fn\s+retry_storm/.test(code) &&
      /saturation\(\s*&?stats\s*\)/.test(code) &&
      /retry_rate\(\s*&?stats\s*\)/.test(code) &&
      /&&/.test(code)

    const shownSaturation = knowsSaturation ? saturation : 0
    const shownRetryRate = knowsRetryRate ? retryRate : 0
    const storm =
      knowsSaturation &&
      knowsRetryRate &&
      hasStormLogic &&
      saturation >= stormThresholdSaturation &&
      retryRate >= stormThresholdRetry

    return `saturation = ${formatRate(shownSaturation)}\nretry rate = ${formatRate(
      shownRetryRate
    )}\nstorm = ${storm}`
  }

  return null
}

type ObservabilityRequest = {
  traceId: string
  route: string
  bytes: number
}

function parseNumber(code: string, pattern: RegExp, fallback: number): number {
  const raw = code.match(pattern)?.[1]
  if (!raw) return fallback
  const parsed = Number(raw.replace(/_/g, ""))
  return Number.isNaN(parsed) ? fallback : parsed
}

function parseRequests(code: string): ObservabilityRequest[] {
  return Array.from(
    code.matchAll(
      /Request\s*{\s*trace_id:\s*"([^"]+)"\s*,\s*route:\s*"([^"]+)"\s*,\s*bytes:\s*([\d_]+)\s*,?\s*}/g
    ),
    (match) => ({
      traceId: match[1],
      route: match[2],
      bytes: Number(match[3].replace(/_/g, "")),
    })
  )
}

function hasTracingInstrumentation(code: string): boolean {
  const hasInstrumentAttr = /#\s*\[\s*instrument/.test(code)
  const hasTraceField = /trace_id\s*=\s*%?request\.trace_id/.test(code)
  const hasRouteField = /route\s*=\s*request\.route/.test(code)
  const hasWorkerSpan = /info_span!\(\s*"worker"\s*,\s*worker\s*=\s*"[^"]+"\s*\)/.test(code)
  const hasInstrumentCall = /\.instrument\(\s*worker(?:\.clone\(\))?\s*\)/.test(code)

  return hasInstrumentAttr && hasTraceField && hasRouteField && hasWorkerSpan && hasInstrumentCall
}

function hasSuccessRateFormula(code: string): boolean {
  return (
    /1\.0(?:_f64)?\s*-\s*stats\.errors\s+as\s+f64\s*\/\s*stats\.requests\s+as\s+f64/.test(code) ||
    /\(\s*stats\.requests\s*-\s*stats\.errors\s*\)\s+as\s+f64\s*\/\s*stats\.requests\s+as\s+f64/.test(code)
  )
}

function hasSaturationFormula(code: string): boolean {
  return (
    /stats\.busy_workers\s+as\s+f64\s*\/\s*stats\.total_workers\s+as\s+f64/.test(code) ||
    /\(\s*stats\.busy_workers\s+as\s+f64\s*\)\s*\/\s*\(\s*stats\.total_workers\s+as\s+f64\s*\)/.test(code)
  )
}

export function simulateCh43Output(code: string, key?: string): string | null {
  if (key === "observability_tracing_tokio_spans") {
    const requests = parseRequests(code)
    const processed = requests.filter((request) => request.bytes > 0).length
    const failures = requests.filter((request) => request.bytes === 0).length
    const lastTrace = requests[requests.length - 1]?.traceId ?? "none"
    const instrumented = hasTracingInstrumentation(code)

    return `instrumented = ${instrumented}\nprocessed = ${
      instrumented ? processed : 0
    }\nfailures = ${instrumented ? failures : 0}\nlast trace = ${
      instrumented ? lastTrace : "none"
    }`
  }

  if (key === "observability_metrics_slo_window") {
    const requests = parseNumber(code, /requests:\s*([\d_]+)/, 5000)
    const errors = parseNumber(code, /errors:\s*([\d_]+)/, 40)
    const queueP95 = parseNumber(code, /queue_p95_ms:\s*([\d_]+)/, 180)
    const handlerP95 = parseNumber(code, /handler_p95_ms:\s*([\d_]+)/, 210)
    const busyWorkers = parseNumber(code, /busy_workers:\s*([\d_]+)/, 19)
    const totalWorkers = parseNumber(code, /total_workers:\s*([\d_]+)/, 20)

    const hasE2EFormula = /stats\.queue_p95_ms\s*\+\s*stats\.handler_p95_ms/.test(code)
    const hasSuccess = hasSuccessRateFormula(code)
    const hasSaturation = hasSaturationFormula(code)
    const hasAlertLogic =
      /end_to_end_p95_ms\(\s*stats\s*\)\s*>\s*350/.test(code) &&
      /success_rate\(\s*stats\s*\)\s*<\s*0\.995/.test(code) &&
      /saturation\(\s*stats\s*\)\s*>\s*0\.90/.test(code)

    const successRate = requests === 0 ? 0 : 1.0 - errors / requests
    const e2e = queueP95 + handlerP95
    const saturation = totalWorkers === 0 ? 0 : busyWorkers / totalWorkers
    const alert = e2e > 350 || successRate < 0.995 || saturation > 0.9

    return `e2e p95 = ${hasE2EFormula ? e2e : 0}\nsuccess rate = ${hasSuccess ? successRate.toFixed(4) : "0.0000"}\nalert = ${
      hasAlertLogic && hasSaturation ? alert : false
    }`
  }

  if (key === "ch43_ex_trace_service") {
    const requests = parseRequests(code)
    const processed = requests.filter((request) => request.bytes > 0).length
    const lastTrace = requests[requests.length - 1]?.traceId ?? "none"
    const instrumented = hasTracingInstrumentation(code)

    return `instrumented = ${instrumented}\nprocessed = ${
      instrumented ? processed : 0
    }\nlast trace = ${instrumented ? lastTrace : "none"}`
  }

  return null
}

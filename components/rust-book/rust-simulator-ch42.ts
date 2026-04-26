function parseNumber(code: string, pattern: RegExp, fallback: number): number {
  const raw = code.match(pattern)?.[1]
  if (!raw) return fallback
  const parsed = Number(raw.replace(/_/g, ""))
  return Number.isNaN(parsed) ? fallback : parsed
}

function parseQuotedList(code: string, pattern: RegExp): string[] {
  const match = code.match(pattern)
  if (!match) return []
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1])
}

function hasQuotaGuard(code: string): boolean {
  return (
    /if\s+self\.used\s*\+\s*qty\s*>\s*self\.limit/.test(code) &&
    /return false/.test(code) &&
    /self\.used\s*\+=\s*qty/.test(code)
  )
}

function hasInvariantCheck(code: string): boolean {
  return /quota\.used\s*>\s*quota\.limit/.test(code) || /self\.used\s*<=\s*self\.limit/.test(code)
}

function hasAsyncIdempotentStore(code: string): boolean {
  const usesHashSet = /HashSet/.test(code)
  const insertsOnce =
    /applied\.insert\(\s*event_id\s*\)/.test(code) &&
    /if\s*!\s*applied\.insert\(\s*event_id\s*\)/.test(code)
  const countsDuplicates =
    /duplicate_count/.test(code) && /\*duplicates\s*\+=\s*1/.test(code)
  const awaitsMutex = /lock\(\)\.await/.test(code)
  return usesHashSet && insertsOnce && countsDuplicates && awaitsMutex
}

export function simulateCh42Output(code: string, key?: string): string | null {
  if (key === "testing_property_invariant_harness") {
    const limit = parseNumber(code, /let\s+limit\s*=\s*([\d_]+)/, 8)
    const valid = hasQuotaGuard(code) && hasInvariantCheck(code)
    return `cases = 5\nall valid = ${valid}\nlimit = ${limit}`
  }

  if (key === "testing_async_idempotent_delivery_harness") {
    const deliveries = parseQuotedList(code, /for\s+event_id\s+in\s+\[([^\]]+)\]/)
    const uniqueDeliveries = new Set(deliveries).size
    const valid = hasAsyncIdempotentStore(code)

    return `processed = ${valid ? uniqueDeliveries : deliveries.length}\nduplicates = ${
      valid ? deliveries.length - uniqueDeliveries : 0
    }\ndeliveries = ${deliveries.length || 3}`
  }

  if (key === "ch42_ex_property_invariant") {
    const valid = hasQuotaGuard(code) && hasInvariantCheck(code)
    const countsViolations =
      /violations\s*=\s*scenarios/.test(code) ||
      /filter\(\s*\|\w+\|\s*!\s*invariant_holds/.test(code) ||
      /filter\(\s*\|\w+\|\s*!\s*holds/.test(code)

    return `cases = 5\nall valid = ${valid}\nviolations = ${
      valid && countsViolations ? 0 : 1
    }`
  }

  return null
}

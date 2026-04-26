function parseNumberList(source?: string): number[] {
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

function parseBoolEntries(source?: string): boolean[] {
  if (!source) return []
  return Array.from(source.matchAll(/=>\s*(true|false)/g), (match) => match[1] === "true")
}

export function simulateCh20Output(code: string, key?: string): string | null {
  if (key === "metaprogramming_macro_rules_hygiene") {
    const outerTotal = Number(code.match(/let\s+total\s*=\s*(\d+)/)?.[1] ?? "40")
    const addOneArg = code.match(/add_one!\(\s*([^)]+)\s*\)/)?.[1]?.trim() ?? "total"
    const numericArg = Number(
      addOneArg.replace(/_/g, "").replace(/(?:i|u)(?:8|16|32|64|128|size)$/i, "")
    )

    const hasAddOne =
      /macro_rules!\s+add_one[\s\S]*let\s+temp\s*=\s*\$value[\s\S]*temp\s*\+\s*1/.test(code)
    const hasSumValues =
      /macro_rules!\s+sum_values[\s\S]*\$\([\s\S]*total\s*\+=\s*\$value[\s\S]*\)\*/.test(code)

    const sumArgs = parseNumberList(code.match(/sum_values!\(([^)]*)\)/)?.[1])
    const nextBase = Number.isNaN(numericArg) ? outerTotal : numericArg
    const next = hasAddOne ? nextBase + 1 : nextBase
    const sum = hasSumValues ? sumArgs.reduce((acc, value) => acc + value, 0) : (sumArgs[0] ?? 0)

    return `next = ${next}\nsum = ${sum}\nouter total = ${outerTotal}`
  }

  if (key === "metaprogramming_compile_time_dsl") {
    const hasRoutesMacro = /macro_rules!\s+routes/.test(code)
    const buildsRouteItems =
      /Route\s*{[\s\S]*method:\s*stringify!\(\s*\$method\s*\)[\s\S]*path:\s*\$path/.test(code)
    const hasAuthArms = /@auth\s+public/.test(code) && /@auth\s+private/.test(code)

    if (!(hasRoutesMacro && buildsRouteItems && hasAuthArms)) {
      return "routes = 0\nfirst = none\nprivate = 0"
    }

    const entries = Array.from(
      code.matchAll(/\b([A-Z]+)\s+"([^"]+)"\s*=>\s*(public|private)/g),
      (match) => ({
        method: match[1],
        path: match[2],
        auth: match[3],
      })
    )

    const first = entries[0]
    const privateCount = entries.filter((entry) => entry.auth === "private").length

    return `routes = ${entries.length}\nfirst = ${
      first ? `${first.method} ${first.path}` : "none"
    }\nprivate = ${privateCount}`
  }

  if (key === "ch20_ex_service_checks_macro") {
    const invocationText = code.match(/service_checks!\(\s*([\s\S]*?)\s*\)/)?.[1] ?? ""
    const checks = parseBoolEntries(invocationText)

    const hasMacro = /macro_rules!\s+service_checks/.test(code)
    const hasRepetition = /macro_rules!\s+service_checks[\s\S]*\$\([\s\S]*\)\*/.test(code)
    const usesIf = /if\s+\$status/.test(code) && /passed\s*\+=\s*1/.test(code)
    const usesBoolAsCount =
      /passed\s*\+=\s*\$status\s+as\s+usize/.test(code) ||
      /passed\s*\+=\s*\(\s*\$status\s+as\s+usize\s*\)/.test(code)

    const passed =
      hasMacro && hasRepetition && (usesIf || usesBoolAsCount)
        ? checks.filter(Boolean).length
        : 0

    return `passed = ${passed}\ntotal = ${checks.length}`
  }

  return null
}

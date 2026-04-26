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

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function parseStoreTotals(code: string): Record<string, number> {
  const totals: Record<string, number> = {}

  for (const match of code.matchAll(
    /store\.insert\(\s*"([^"]+)"\s*,\s*Order\s*{[\s\S]*?id:\s*"([^"]+)"\s*,[\s\S]*?lines:\s*vec!\[([^\]]*)\]/g
  )) {
    const key = match[1] ?? match[2]
    totals[key] = sum(parseNumericList(match[3]))
  }

  return totals
}

export function simulateCh41Output(code: string, key?: string): string | null {
  if (key === "error_handling_typed_contracts") {
    const totals = parseStoreTotals(code)
    const okId =
      code.match(/println!\(\s*"ok = \{\}"\s*,\s*bill_order\(&store,\s*"([^"]+)"\)\.unwrap\(\)\s*\)/)?.[1] ??
      "ord-ok"

    const missingId =
      code.match(/println!\(\s*"missing = \{\}"\s*,\s*bill_order\(&store,\s*"([^"]+)"\)\.unwrap_err\(\)\s*\)/)
        ?.[
        1
      ] ?? "ord-missing"

    const emptyId =
      code.match(/println!\(\s*"empty = \{\}"\s*,\s*bill_order\(&store,\s*"([^"]+)"\)\.unwrap_err\(\)\s*\)/)?.[1] ??
      "ord-empty"

    const hasDomainLayer = /enum\s+DomainError/.test(code) && /EmptyOrder/.test(code)
    const hasInfraLayer = /enum\s+InfraError/.test(code) && /MissingOrder/.test(code)
    const hasServiceLayer = /enum\s+ServiceError/.test(code) && /#\[from\]/.test(code)

    return `ok = ${hasDomainLayer && hasInfraLayer && hasServiceLayer ? totals[okId] ?? 0 : 0}\nmissing = ${
      hasInfraLayer ? `order ${missingId} not found in store` : "error"
    }\nempty = ${hasDomainLayer ? `order ${emptyId} has no lines` : "error"}`
  }

  if (key === "error_handling_async_context") {
    const manifestValue = code.match(/"manifest"\s*=>\s*Ok\(\s*"([^"]+)"\s*\)/)?.[1] ?? "ready"
    const notFoundText = code.match(/ErrorKind::NotFound\s*,\s*"([^"]+)"/)?.[1] ?? "missing blob"

    const contexts = Array.from(code.matchAll(/context\(\s*"([^"]+)"\s*\)/g), (match) => match[1])
    const hasSpawn = /tokio::spawn\(/.test(code)
    const hasManifestContext = contexts.includes("loading manifest")
    const lockfileContext = contexts.find((value) => value.includes("lockfile")) ?? "loading lockfile"

    return `manifest = ${hasSpawn && hasManifestContext ? manifestValue : "error"}\nfailed = ${
      contexts.some((value) => value.includes("lockfile")) ? `${lockfileContext}: ${notFoundText}` : notFoundText
    }`
  }

  if (key === "ch41_ex_typed_errors") {
    const hasEnum =
      /enum\s+ConfigError/.test(code) && /MissingPort/.test(code) && /InvalidPort/.test(code)

    const hasSignature =
      /fn\s+parse_port\s*\(\s*raw:\s*Option<\s*&str\s*>\s*\)\s*->\s*Result<\s*u16\s*,\s*ConfigError\s*>/.test(
        code
      )

    const handlesMissing =
      /ok_or\(\s*ConfigError::MissingPort\s*\)/.test(code) ||
      /None\s*=>\s*Err\(\s*ConfigError::MissingPort\s*\)/s.test(code)

    const handlesInvalid =
      /map_err\(\s*\|[^|]*\|\s*ConfigError::InvalidPort\s*\)/s.test(code) ||
      /Err\(\s*ConfigError::InvalidPort\s*\)/.test(code)

    const avoidsPanics = !/unwrap\(/.test(code) && !/expect\(/.test(code) && !/panic!/.test(code)
    const usesParse = /parse::<\s*u16\s*>\(\)|parse\(\)/.test(code)

    if (hasEnum && hasSignature && handlesMissing && handlesInvalid && avoidsPanics && usesParse) {
      return "missing = Err(MissingPort)\nbad = Err(InvalidPort)\nok = Ok(8080)"
    }

    return `missing = ${handlesMissing ? "Err(MissingPort)" : "Ok(0)"}\nbad = ${
      handlesInvalid ? "Err(InvalidPort)" : "Ok(0)"
    }\nok = ${usesParse ? "Ok(8080)" : "Ok(0)"}`
  }

  return null
}

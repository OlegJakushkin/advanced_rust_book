function parseNumberMatch(code: string, pattern: RegExp, fallback: number): number {
  const value = code.match(pattern)?.[1]
  return value === undefined ? fallback : Number(value)
}

export function simulateCh17Output(code: string, key?: string): string | null {
  if (key === "refactoring_result_owned_api") {
    const callMatch = code.match(
      /load_endpoint\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*Some\(\s*"(\d+)"\s*\)\s*\)/
    )

    const service = callMatch?.[1] ?? "billing"
    const host = callMatch?.[2] ?? "127.0.0.1"
    const port = Number(callMatch?.[3] ?? "443")

    return `endpoint = ${service}@${host}:${port}\nrequires tls = ${port === 443}`
  }

  if (key === "refactoring_traits_enums_testable") {
    const orderId = parseNumberMatch(code, /let\s+order_id\s*=\s*(\d+)/, 7)
    const usesRetry = /process\(\s*order_id\s*,\s*DeliveryMode::Retry\s*\)/.test(code)
    const action = usesRetry ? "queued" : "charged"
    const prefix =
      code.match(
        /impl\s+Notifier\s+for\s+\w+[\s\S]*?fn\s+notify\(&self,\s*order_id:\s*u64\)\s*->\s*String\s*{\s*format!\(\s*"([^"]*)\{\}"\s*,\s*order_id\s*\)/
      )?.[1] ?? "email:order-"
    const processed = /self\.processed\s*\+=\s*1/.test(code) ? 1 : 0

    return `${action} = order-${orderId}\nnotified = ${prefix}${orderId}\nprocessed = ${processed}`
  }

  if (key === "ch17_ex_result_refactor") {
    const hasSignature =
      /fn\s+parse_port\s*\(\s*raw:\s*Option<\s*&str\s*>\s*\)\s*->\s*Result<\s*u16\s*,\s*&'static str\s*>/.test(
        code
      )

    const usesParse = /parse::<\s*u16\s*>\(\)|parse\(\)/.test(code)

    const handlesMissing =
      /ok_or\(\s*"missing port"\s*\)/.test(code) ||
      /ok_or_else\(\s*\|\|\s*"missing port"\s*\)/.test(code) ||
      /None\s*=>\s*Err\(\s*"missing port"\s*\)/s.test(code)

    const handlesInvalid =
      /map_err\(\s*\|[^|]*\|\s*"invalid port"\s*\)/s.test(code) ||
      (/Err\(\s*"invalid port"\s*\)/.test(code) && usesParse)

    const avoidsPanics = !/unwrap\(/.test(code) && !/expect\(/.test(code) && !/panic!/.test(code)

    if (hasSignature && usesParse && handlesMissing && handlesInvalid && avoidsPanics) {
      return 'missing = Err("missing port")\nbad = Err("invalid port")\nok = Ok(8080)'
    }

    return `missing = ${handlesMissing && avoidsPanics ? 'Err("missing port")' : "Ok(0)"}\nbad = ${
      handlesInvalid && avoidsPanics ? 'Err("invalid port")' : "Ok(0)"
    }\nok = ${usesParse ? "Ok(8080)" : "Ok(0)"}`
  }

  return null
}

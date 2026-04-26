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

function parseStringField(code: string, field: string, fallback: string): string {
  const patterns = [
    new RegExp(`${field}:\\s*String::from\\("([^"]+)"\\)`),
    new RegExp(`${field}:\\s*"([^"]+)"\\.to_string\\(\\)`),
    new RegExp(`${field}:\\s*"([^"]+)"\\.into\\(\\)`),
  ]

  for (const pattern of patterns) {
    const value = code.match(pattern)?.[1]
    if (value) return value
  }

  return fallback
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function hasTransportMapping(code: string, requestVar = "request"): boolean {
  const mapsTenant =
    /tenant:\s*tenant\.(?:to_string|to_owned)\(\)/.test(code) ||
    /tenant:\s*tenant\.into\(\)/.test(code)

  const mapsCustomer = new RegExp(
    `customer_id:\\s*${requestVar}\\.customer_id(?:\\.clone\\(\\))?`
  ).test(code)

  const mapsLineTotals = new RegExp(
    `line_totals:\\s*${requestVar}\\.line_totals(?:\\.clone\\(\\))?`
  ).test(code)

  return mapsTenant && mapsCustomer && mapsLineTotals && !/Err\(\s*"unfinished"\s*\)/.test(code)
}

function hasRetryClassification(code: string): boolean {
  return (
    /GrpcCode::Unavailable/.test(code) &&
    /GrpcCode::DeadlineExceeded/.test(code) &&
    /RetryDecision\s*{\s*retry:\s*true/.test(code) &&
    /GrpcCode::Cancelled/.test(code) &&
    /RetryDecision\s*{\s*retry:\s*false/.test(code)
  )
}

function hasCancellationRule(code: string): boolean {
  return (
    /cancelled\s*\|\|\s*elapsed_ms\s*>=\s*deadline_ms/.test(code) ||
    /elapsed_ms\s*>=\s*deadline_ms\s*\|\|\s*cancelled/.test(code)
  )
}

export function simulateCh47Output(code: string, key?: string): string | null {
  if (key === "grpc_transport_to_domain_mapping") {
    const customerId = parseStringField(code, "customer_id", "cust-7")
    const lineTotals = parseNumberList(code.match(/line_totals:\s*vec!\[([^\]]+)\]/)?.[1])
    const total = sum(lineTotals)
    const mapped = hasTransportMapping(code)

    return `tenant = ${mapped ? "acme" : "broken"}\ncustomer = ${
      mapped ? customerId : "broken"
    }\ntotal cents = ${mapped ? total : 0}\ninvoice = ${mapped ? `inv-${customerId}` : "broken"}`
  }

  if (key === "grpc_status_deadline_retry") {
    const retryLogic = hasRetryClassification(code)
    const cancellationLogic = hasCancellationRule(code)

    return `retry unavailable = ${retryLogic}\nretry invalid = ${
      retryLogic ? "false" : "true"
    }\ncancelled = ${cancellationLogic}`
  }

  if (key === "ch47_ex_transport_mapping") {
    const customerId = parseStringField(code, "customer_id", "cust-7")
    const lineTotals = parseNumberList(code.match(/line_totals:\s*vec!\[([^\]]+)\]/)?.[1])
    const total = sum(lineTotals)
    const mapped = hasTransportMapping(code, "request")

    return `tenant = ${mapped ? "acme" : "broken"}\ncustomer = ${
      mapped ? customerId : "broken"
    }\ntotal cents = ${mapped ? total : 0}`
  }

  return null
}

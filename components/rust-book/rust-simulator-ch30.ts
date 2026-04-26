type ParsedDelivery = {
  messageId: string
  orderId: string
  attempt: number
}

function parseBindings(code: string): Record<string, string[]> {
  const bindings: Record<string, string[]> = {}

  for (const match of code.matchAll(/exchange\.bind\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g)) {
    const routingKey = match[1]
    const queue = match[2]

    if (!bindings[routingKey]) {
      bindings[routingKey] = []
    }

    bindings[routingKey].push(queue)
  }

  return bindings
}

function parseDirectRouteKey(code: string, variable: string, fallback: string): string {
  const match = code.match(new RegExp(`let\\s+${variable}\\s*=\\s*exchange\\.route\\(\\s*"([^"]+)"\\s*\\)`))
  return match?.[1] ?? fallback
}

function parseMainDeliveries(code: string): ParsedDelivery[] {
  return Array.from(
    code.matchAll(
      /consumer\.on_delivery\(\s*Delivery\s*{\s*message_id:\s*"([^"]+)"\s*,\s*order_id:\s*"([^"]+)"\s*,\s*attempt:\s*(\d+)\s*,?\s*}\s*\)/g
    ),
    (match) => ({
      messageId: match[1],
      orderId: match[2],
      attempt: Number(match[3]),
    })
  )
}

function hasIdempotentConsumerLogic(code: string): boolean {
  const duplicateGuard = /processed_ids\.contains\(\s*delivery\.message_id\s*\)/.test(code)
  const duplicateCounter = /self\.duplicates\s*\+=\s*1/.test(code)
  const successInsert = /processed_ids\.insert\(\s*delivery\.message_id\.to_string\(\)\s*\)/.test(code)
  const retryLimit = /delivery\.attempt\s*<\s*3/.test(code)
  const retryCounter = /self\.retried\s*\+=\s*1/.test(code)
  const retryPush =
    /retry_queue\.push_back\(\s*Delivery\s*{[\s\S]*attempt:\s*delivery\.attempt\s*\+\s*1[\s\S]*\.\.\s*delivery[\s\S]*}\s*\)/.test(
      code
    ) || (/retry_queue\.push_back\(/.test(code) && /attempt:\s*delivery\.attempt\s*\+\s*1/.test(code))
  const dlqPush = /self\.dlq\.push\(\s*delivery\s*\)/.test(code)
  const processedCounter = /self\.processed\s*\+=\s*1/.test(code)

  return (
    duplicateGuard &&
    duplicateCounter &&
    successInsert &&
    retryLimit &&
    retryCounter &&
    retryPush &&
    dlqPush &&
    processedCounter
  )
}

function simulateIdempotentConsumer(deliveries: ParsedDelivery[]) {
  const processedIds = new Set<string>()
  const retryQueue: ParsedDelivery[] = []
  let processed = 0
  let duplicates = 0
  let retried = 0
  let dlq = 0

  const handle = (delivery: ParsedDelivery) => {
    if (processedIds.has(delivery.messageId)) {
      duplicates += 1
      return
    }

    if (delivery.orderId === "ord-fail") {
      if (delivery.attempt < 3) {
        retried += 1
        retryQueue.push({
          ...delivery,
          attempt: delivery.attempt + 1,
        })
      } else {
        dlq += 1
      }
      return
    }

    processed += 1
    processedIds.add(delivery.messageId)
  }

  for (const delivery of deliveries) {
    handle(delivery)
  }

  let safetyCounter = 0
  while (retryQueue.length > 0 && safetyCounter < 16) {
    const next = retryQueue.shift()
    if (!next) break
    handle(next)
    safetyCounter += 1
  }

  return { processed, duplicates, retried, dlq }
}

export function simulateCh30Output(code: string, key?: string): string | null {
  if (key === "amqp_direct_exchange_routing") {
    const bindings = parseBindings(code)
    const createdKey = parseDirectRouteKey(code, "created", "orders.created")
    const cancelledKey = parseDirectRouteKey(code, "cancelled", "orders.cancelled")
    const unroutedKey = code.match(/exchange\.route\(\s*"([^"]+)"\s*\)\.len\(\)/)?.[1] ?? "orders.refunded"

    const created = bindings[createdKey] ?? []
    const cancelled = bindings[cancelledKey] ?? []
    const unrouted = bindings[unroutedKey] ?? []

    return `created = ${created.join(",")}\ncancelled = ${cancelled.join(",")}\nunrouted = ${unrouted.length}`
  }

  if (key === "amqp_idempotent_consumer" || key === "ch30_ex_idempotent_consumer") {
    if (!hasIdempotentConsumerLogic(code)) {
      return "processed = 3\nduplicates = 0\nretried = 0\ndlq = 0"
    }

    const deliveries = parseMainDeliveries(code)
    const result = simulateIdempotentConsumer(deliveries)

    return `processed = ${result.processed}\nduplicates = ${result.duplicates}\nretried = ${result.retried}\ndlq = ${result.dlq}`
  }

  return null
}

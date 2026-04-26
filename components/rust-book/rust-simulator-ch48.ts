type ClientState = {
  pending: number
}

function parseNumber(code: string, pattern: RegExp, fallback: number): number {
  const raw = code.match(pattern)?.[1]
  if (!raw) return fallback
  const parsed = Number(raw.replace(/_/g, ""))
  return Number.isNaN(parsed) ? fallback : parsed
}

function parseClientSetups(code: string): Array<{ id: string; pending: number }> {
  return Array.from(code.matchAll(/add_client\(\s*"([^"]+)"\s*,\s*(\d+)\s*\)/g), (match) => ({
    id: match[1],
    pending: Number(match[2]),
  }))
}

function parseBroadcastCalls(code: string): number {
  return (code.match(/hub\.broadcast\(\s*"[^"]+"\s*\)/g) ?? []).length
}

function hasConnectionLoopLogic(code: string): boolean {
  const hasInboundChannel = /mpsc::channel::<\s*InboundFrame\s*>\(\s*\d+\s*\)/.test(code)
  const hasOutboundChannel = /mpsc::channel::<\s*OutboundFrame\s*>\(\s*\d+\s*\)/.test(code)
  const hasWatchShutdown = /watch::channel\(\s*false\s*\)/.test(code)
  const hasSelect = /tokio::select!/.test(code)
  const hasSpawns = (code.match(/tokio::spawn\(/g) ?? []).length >= 3
  const handlesClose = /InboundFrame::Close/.test(code) && /shutdown_tx\.send\(\s*true\s*\)\.unwrap\(\)/.test(code)

  return hasInboundChannel && hasOutboundChannel && hasWatchShutdown && hasSelect && hasSpawns && handlesClose
}

function countInboundFrames(code: string): number {
  return (
    code.match(/inbound_tx[\s\S]{0,120}?send\(\s*InboundFrame::(?:Text|Ping|Close)/g) ?? []
  ).length
}

function countOutboundFrames(code: string): number {
  return (
    code.match(/outbound_tx[\s\S]{0,120}?send\(\s*OutboundFrame::(?:Text|Pong|Close)/g) ?? []
  ).length
}

function hasBoundedFanoutLogic(code: string): boolean {
  const checksLimit =
    /pending\.len\(\)\s*>=\s*self\.max_pending/.test(code) ||
    /client\.pending\.len\(\)\s*>=\s*self\.max_pending/.test(code)

  const removesClient = /self\.clients\.remove\(\s*id\s*\)/.test(code)
  const recordsEviction = /self\.evicted\.push\(\s*id\s*\)/.test(code)
  const pushesPayload = /pending\.push_back\(\s*payload\.to_string\(\)\s*\)/.test(code)
  const countsDelivered = /self\.delivered\s*\+=\s*1/.test(code)

  return checksLimit && removesClient && recordsEviction && pushesPayload && countsDelivered
}

function simulateHub(code: string, bounded: boolean) {
  const maxPending =
    parseNumber(code, /Hub::new\(\s*(\d+)\s*\)/, 0) ||
    parseNumber(code, /max_pending:\s*(\d+)/, 0)

  const clients = new Map<string, ClientState>()
  for (const setup of parseClientSetups(code)) {
    clients.set(setup.id, { pending: setup.pending })
  }

  const broadcasts = parseBroadcastCalls(code)
  const evicted: string[] = []
  let delivered = 0

  for (let i = 0; i < broadcasts; i += 1) {
    const ids = Array.from(clients.keys())

    for (const id of ids) {
      const client = clients.get(id)
      if (!client) continue

      if (bounded && client.pending >= maxPending) {
        clients.delete(id)
        evicted.push(id)
        continue
      }

      client.pending += 1
      delivered += 1
    }
  }

  return {
    active: clients.size,
    evicted: evicted.join(",") || "none",
    delivered,
  }
}

export function simulateCh48Output(code: string, key?: string): string | null {
  if (key === "websocket_connection_io_split") {
    const valid = hasConnectionLoopLogic(code)
    const inbound = valid ? countInboundFrames(code) : 0
    const outbound = valid ? countOutboundFrames(code) : 0
    const closed = valid && /println!\(\s*"closed = \{\}"\s*,\s*true\s*\)/.test(code)

    return `inbound = ${inbound}\noutbound = ${outbound}\nclosed = ${closed}`
  }

  if (key === "websocket_bounded_fanout_slow_consumers") {
    const state = simulateHub(code, hasBoundedFanoutLogic(code))
    return `active = ${state.active}\nevicted = ${state.evicted}\ndelivered = ${state.delivered}`
  }

  if (key === "ch48_ex_bounded_fanout") {
    const bounded = hasBoundedFanoutLogic(code)
    const state = simulateHub(code, bounded)

    return `active = ${state.active}\nevicted = ${state.evicted}\ndelivered = ${state.delivered}`
  }

  return null
}

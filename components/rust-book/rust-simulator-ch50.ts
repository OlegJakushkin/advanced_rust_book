type VersionedValue = {
  version: number
  author: string
  value: string
}

function parsePeerId(code: string): string {
  const direct = code.match(/let\s+peer\s*=\s*PeerId\("([^"]+)"\)/)?.[1]
  if (direct) return direct

  const fallback = Array.from(code.matchAll(/PeerId\("([^"]+)"\)/g), (match) => match[1])[0]
  return fallback ?? "peer-b"
}

function parseLastGossip(code: string): { topic: string; body: string } {
  const matches = Array.from(
    code.matchAll(
      /NetworkEvent::Gossip\s*{[\s\S]*?topic:\s*"([^"]+)"[\s\S]*?body:\s*String::from\("([^"]+)"\)/g
    ),
    (match) => ({
      topic: match[1],
      body: match[2],
    })
  )

  return matches[matches.length - 1] ?? { topic: "heads", body: "tip=9" }
}

function parseResponseBody(code: string): string {
  const matches = Array.from(
    code.matchAll(
      /Event::Response\s*{[\s\S]*?body:\s*String::from\("([^"]+)"\)/g
    ),
    (match) => match[1]
  )

  return matches[matches.length - 1] ?? "state-v3"
}

function parseVersionedValues(code: string): VersionedValue[] {
  return Array.from(
    code.matchAll(
      /VersionedValue\s*{\s*version:\s*(\d+)\s*,\s*author:\s*"([^"]+)"\s*,\s*value:\s*String::from\("([^"]+)"\)\s*,?\s*}/g
    ),
    (match) => ({
      version: Number(match[1]),
      author: match[2],
      value: match[3],
    })
  )
}

function hasVersionMergeLogic(code: string): boolean {
  const comparesHigher = /\w+\.version\s*>\s*\w+\.version/.test(code)
  const comparesLower = /\w+\.version\s*<\s*\w+\.version/.test(code)
  const tiesByAuthor = /\w+\.author\s*>\s*\w+\.author/.test(code)
  const folds = /into_iter\(\)\.fold\(\s*current\s*,\s*pick_newer\s*\)/.test(code)
  return comparesHigher && comparesLower && tiesByAuthor && folds
}

function pickNewest(values: VersionedValue[]): VersionedValue | null {
  if (values.length === 0) return null

  return values.reduce((best, next) => {
    if (next.version > best.version) return next
    if (next.version < best.version) return best
    return next.author > best.author ? next : best
  })
}

export function simulateCh50Output(code: string, key?: string): string | null {
  if (key === "libp2p_swarm_state_machine") {
    const peer = parsePeerId(code)
    const gossip = parseLastGossip(code)

    const hasConnectedInsert =
      /connected\.(?:insert|push)\(\s*peer\s*\)/.test(code) ||
      /connected\.(?:insert|push)\(\s*PeerId\(/.test(code)

    const hasPendingInsert =
      /pending_requests\.insert\(\s*request_id\s*,\s*peer\s*\)/.test(code) ||
      /pending_requests\.insert\(\s*\d+\s*,\s*peer\s*\)/.test(code)

    const hasPendingRemove = /pending_requests\.remove\(\s*&request_id\s*\)/.test(code)
    const hasGossipLog =
      /format!\(\s*"gossip \{\} \{\} \{\}"/.test(code) ||
      /push_back\(\s*format!\(\s*"gossip/.test(code)

    const connected = hasConnectedInsert ? 1 : 0
    const pending = hasPendingInsert ? (hasPendingRemove ? 0 : 1) : 0
    const last = hasGossipLog ? `gossip ${gossip.topic} ${peer} ${gossip.body}` : "none"

    return `connected = ${connected}\npending = ${pending}\nlast = ${last}`
  }

  if (key === "libp2p_state_sync_conflicts") {
    const values = parseVersionedValues(code)
    const hasMerge = hasVersionMergeLogic(code)

    const winner = hasMerge ? pickNewest(values) : values[0] ?? null

    return `version = ${winner?.version ?? 0}\nauthor = ${winner?.author ?? "none"}\nvalue = ${
      winner?.value ?? "none"
    }`
  }

  if (key === "ch50_ex_swarm_loop") {
    const peer = parsePeerId(code)
    const responseBody = parseResponseBody(code)

    const hasConnected =
      /connected\.push\(\s*peer\s*\)/.test(code) ||
      /connected\.insert\(\s*peer\s*\)/.test(code)

    const hasPendingInsert =
      /pending\.insert\(\s*id\s*,\s*peer\s*\)/.test(code) ||
      /pending\.insert\(\s*\d+\s*,\s*peer\s*\)/.test(code)

    const hasPendingRemove =
      /pending\.remove\(\s*&id\s*\)/.test(code) ||
      /pending\.remove\(\s*&request_id\s*\)/.test(code)

    const hasResponseLog =
      /format!\(\s*"response \{\} \{\}"/.test(code) ||
      /log\.push(?:_back)?\(\s*format!\(\s*"response/.test(code)

    return `connected = ${hasConnected ? 1 : 0}\npending = ${
      hasPendingInsert ? (hasPendingRemove ? 0 : 1) : 0
    }\nlast = ${hasResponseLog ? `response ${peer} ${responseBody}` : "none"}`
  }

  return null
}

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

export function simulateCh25Output(code: string, key?: string): string | null {
  if (key === "tokio_tasks_backpressure_spawn_blocking") {
    const buffer = Number(code.match(/mpsc::channel::<[^>]+>\((\d+)\)/)?.[1] ?? "1")
    const batches = Array.from(
      code.matchAll(/tx\.send\(\s*vec!\[([^\]]+)\]\s*\)\.await\.unwrap\(\)/g),
      (match) => parseNumericList(match[1])
    )

    const batchCount = batches.length
    const total = batches.reduce((running, batch) => running + sum(batch), 0)

    const usesTokioSpawn = (code.match(/tokio::spawn\(/g) ?? []).length >= 2
    const usesSpawnBlocking = /tokio::task::spawn_blocking\(/.test(code)
    const usesInterval = /time::interval\(/.test(code)

    if (usesTokioSpawn && usesSpawnBlocking && usesInterval) {
      return `buffer = ${buffer}\nbatches = ${batchCount}\ntotal = ${total}`
    }

    return `buffer = ${buffer}\nbatches = ${batchCount}\ntotal = 0`
  }

  if (key === "tokio_tcp_graceful_shutdown") {
    const accepted = (code.match(/TcpStream::connect\(\s*addr\s*\)/g) ?? []).length
    const rawReply = code.match(/write_all\(\s*b"([^"]*)"\s*\)/)?.[1] ?? "pong\\n"
    const reply = rawReply.replace(/\\n/g, "\n").trim()

    const usesWatch = /watch::channel\(\s*false\s*\)/.test(code)
    const usesSelect = /tokio::select!/.test(code)
    const sendsShutdown = /shutdown_tx\.send\(\s*true\s*\)\.unwrap\(\)/.test(code)

    if (usesWatch && usesSelect && sendsShutdown) {
      return `accepted = ${accepted}\nclient_a = ${reply}\nclient_b = ${reply}`
    }

    return `accepted = 0\nclient_a = ${reply}\nclient_b = ${reply}`
  }

  if (key === "ch25_ex_spawn_blocking") {
    const batch = parseNumericList(code.match(/let\s+batch\s*=\s*vec!\[([^\]]+)\]/)?.[1])
    const total = sum(batch)

    const usesSpawnBlocking =
      /tokio::task::spawn_blocking\(\s*move\s*\|\|/.test(code) ||
      /tokio::task::spawn_blocking\(\s*\|\|/.test(code)

    const awaitsJoin =
      /\.await\.unwrap\(\)/.test(code) ||
      /let\s+\w+\s*=\s*handle\.await/.test(code)

    if (usesSpawnBlocking && awaitsJoin) {
      return `spawn_blocking = true\ntotal = ${total}`
    }

    return `spawn_blocking = false\ntotal = ${total}`
  }

  return null
}

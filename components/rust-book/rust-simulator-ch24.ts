export function simulateCh24Output(code: string, key?: string): string | null {
  if (key === "async_rust_async_fn_await_block_on") {
    const callMatch = code.match(/block_on\(\s*build_label\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)\s*\)/)
    const service = callMatch?.[1] ?? "billing"
    const route = callMatch?.[2] ?? "/ready"
    const pendingCount = Math.max((code.match(/YieldOnce::new\(/g) ?? []).length, 1)
    const outputs = Array.from({ length: pendingCount }, () => "poll = pending")
    outputs.push(`label = ${service}:${route}`)
    return outputs.join("\n")
  }

  if (key === "async_rust_manual_future_state_machine") {
    const remaining = Number(code.match(/remaining_polls:\s*(\d+)/)?.[1] ?? "1")
    const readyValue = code.match(/Poll::Ready\(\s*"([^"]+)"\s*\)/)?.[1] ?? "connected"
    const outputs: string[] = []

    outputs.push("pending stage = Waiting")
    outputs.push(`pending retries = ${remaining}`)

    for (let next = remaining - 1; next >= 0; next -= 1) {
      outputs.push("pending stage = Waiting")
      outputs.push(`pending retries = ${next}`)
    }

    outputs.push(`ready = ${readyValue}`)
    return outputs.join("\n")
  }

  if (key === "ch24_ex_send_bound_spawn") {
    const hasSendBound =
      /Future<\s*Output\s*=\s*\(\s*\)\s*>\s*\+\s*Send\s*\+\s*'static/.test(code) ||
      /where[\s\S]*F:\s*Future<\s*Output\s*=\s*\(\s*\)\s*>\s*\+\s*Send\s*\+\s*'static/.test(code)
    const asyncMove = /spawn_send\(\s*async\s+move/.test(code)
    const usesRc = /use\s+std::rc::Rc/.test(code) || /Rc::new/.test(code) || /Rc::clone/.test(code)
    const usesArc = /use\s+std::sync::Arc/.test(code) && /Arc::new/.test(code) && /Arc::clone/.test(code)
    const clonesOwnedString =
      /let\s+shared\s*=\s*String::from\(/.test(code) && /let\s+worker\s*=\s*shared\.clone\(\)/.test(code)
    const sharedValue = code.match(/String::from\("([^"]+)"\)/)?.[1] ?? "cfg-v1"

    if (hasSendBound && asyncMove && !usesRc && (usesArc || clonesOwnedString)) {
      return `spawned = true\nshared = ${sharedValue}`
    }

    return "spawned = false\nshared = broken"
  }

  if (key === "ch24_ex_cancellation_cleanup") {
    const cleanupBeforeAwait =
      /async\s+fn\s+request[\s\S]*let\s+_cleanup\s*=\s*Cleanup\s*{\s*request_id\s*}\s*;[\s\S]*YieldOnce\s*\{\s*yielded:\s*false\s*\}\.await/s.test(
        code
      ) ||
      /async\s+fn\s+request[\s\S]*let\s+_cleanup\s*=\s*Cleanup\s*{\s*request_id:\s*request_id\s*}\s*;[\s\S]*YieldOnce\s*\{\s*yielded:\s*false\s*\}\.await/s.test(
        code
      )

    const dropPrintsRequest =
      /println!\(\s*"cleanup = dropped \{\}"\s*,\s*self\.request_id\s*\)/.test(code) ||
      /println!\(\s*"cleanup = dropped \{\}"\s*,\s*&self\.request_id\s*\)/.test(code)

    const cancelsOnPending =
      /if\s+let\s+Poll::Pending\s*=\s*Future::poll\(/.test(code) &&
      /println!\(\s*"cancelled = true"\s*\)/.test(code) &&
      /drop\(\s*future\s*\)/.test(code)

    const requestId = code.match(/request\("([^"]+)"\)/)?.[1] ?? "request-7"

    if (cleanupBeforeAwait && dropPrintsRequest && cancelsOnPending) {
      return `cancelled = true\ncleanup = dropped ${requestId}`
    }

    return "cancelled = false\ncleanup = skipped"
  }

  return null
}

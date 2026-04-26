function lastNumberMatch(code: string, pattern: RegExp, fallback: number): number {
  const matches = Array.from(code.matchAll(pattern))
  if (matches.length === 0) return fallback
  return Number(matches[matches.length - 1][1])
}

function lastStringMatch(code: string, pattern: RegExp, fallback: string): string {
  const matches = Array.from(code.matchAll(pattern))
  if (matches.length === 0) return fallback
  return matches[matches.length - 1][1]
}

export function simulateCh23Output(code: string, key?: string): string | null {
  if (key === "synchronization_mutex_condvar_queue") {
    const jobs = Array.from(code.matchAll(/push_back\(\s*"([^"]+)"\s*\)/g))
    const hasMutex = /Mutex::new/.test(code)
    const hasCondvar = /Condvar::new/.test(code)
    const usesWaitLoop = /while\s+state\.jobs\.is_empty\(\)\s*&&\s*!state\.closed/.test(code) && /ready\.wait\(/.test(code)
    const usesPop = /pop_front\(\)\.unwrap\(\)/.test(code)
    const closesQueue = /state\.closed\s*=\s*true/.test(code)

    const processed = hasMutex && hasCondvar && usesWaitLoop && usesPop ? jobs.length : Math.max(jobs.length - 1, 0)
    const remaining = hasMutex && hasCondvar && usesPop && closesQueue ? 0 : jobs.length

    return `processed = ${processed}\nremaining = ${remaining}`
  }

  if (key === "synchronization_rwlock_barrier") {
    const readerCount =
      Number(code.match(/for\s+_\s+in\s+0\.\.(\d+)/)?.[1] ?? "") ||
      (code.match(/handles\.push\(thread::spawn/g) ?? []).length

    const version = lastNumberMatch(code, /version(?:\s*:\s*|\s*=\s*)(\d+)/g, 1)
    const mode = lastStringMatch(code, /mode(?:\s*:\s*|\s*=\s*)"([^"]+)"/g, "steady")

    const hasRwLock = /RwLock::new/.test(code)
    const hasBarrier = /Barrier::new/.test(code)
    const usesRead = /read\(\)\.unwrap\(\)/.test(code)
    const usesWrite = /write\(\)\.unwrap\(\)/.test(code)
    const waits = /wait\(\)/.test(code)

    const readerVersionSum = hasRwLock && hasBarrier && usesRead && usesWrite && waits ? readerCount * version : version

    return `reader version sum = ${readerVersionSum}\nmode = ${mode}`
  }

  if (key === "synchronization_atomics_ordering") {
    const published = lastNumberMatch(code, /value\.store\(\s*(\d+)\s*,/g, 0)
    const hasRelease = /ready\.store\(\s*true\s*,\s*Ordering::(?:Release|SeqCst)\s*\)/.test(code)
    const hasAcquire = /ready\.load\(\s*Ordering::(?:Acquire|SeqCst)\s*\)/.test(code)

    if (hasRelease && hasAcquire) {
      return `ready = true\nvalue = ${published}`
    }

    return "ready = false\nvalue = 0"
  }

  if (key === "ch23_ex_acquire_release") {
    const published =
      Number(code.match(/publish\(\s*&value\s*,\s*&ready\s*,\s*(\d+)\s*\)/)?.[1] ?? "") ||
      lastNumberMatch(code, /value\.store\(\s*(\d+)\s*,/g, 0)

    const hasRelease = /ready\.store\(\s*true\s*,\s*Ordering::(?:Release|SeqCst)\s*\)/.test(code)
    const hasAcquire = /ready\.load\(\s*Ordering::(?:Acquire|SeqCst)\s*\)/.test(code)

    if (hasRelease && hasAcquire) {
      return `ready = true\nvalue = ${published}`
    }

    return "ready = false\nvalue = 0"
  }

  return null
}

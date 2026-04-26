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

export function simulateCh26Output(code: string, key?: string): string | null {
  if (key === "task_libraries_tokio_orchestration") {
    const buffer =
      Number(code.match(/mpsc::channel::<[^>]+>\((\d+)\)/)?.[1] ?? "") ||
      Number(code.match(/mpsc::channel\((\d+)\)/)?.[1] ?? "") ||
      0

    const submittedJobs = (code.match(/tx\.send\(Job\s*{/g) ?? []).length
    const retryJobs = (code.match(/needs_retry:\s*true/g) ?? []).length
    const usesJoinSet = /JoinSet::new\(\)/.test(code)
    const usesTokioSpawn = (code.match(/tokio::spawn\(/g) ?? []).length >= 2
    const cancelled =
      /shutdown_tx\.send\(\s*true\s*\)\.unwrap\(\)/.test(code) ||
      /shutdown_tx\.send_replace\(\s*true\s*\)/.test(code)

    const completed = usesJoinSet && usesTokioSpawn ? submittedJobs : Math.max(submittedJobs - retryJobs, 0)
    const retries = usesJoinSet ? retryJobs : 0

    return `buffer = ${buffer}\ncompleted = ${completed}\nretries = ${retries}\ncancelled = ${cancelled}`
  }

  if (key === "task_libraries_rayon_crossbeam") {
    const batches = Array.from(
      code.matchAll(/tx\.send\(\s*vec!\[([^\]]+)\]\s*\)\.unwrap\(\)/g),
      (match) => parseNumericList(match[1])
    )
    const factor =
      Number(code.match(/map\(\|\w+\|\s*\w+\s*\*\s*(\d+)\)/)?.[1] ?? "") ||
      Number(code.match(/map\(\|\w+\|\s*\w+\s*\+\s*(\d+)\)/)?.[1] ?? "") ||
      2
    const threads = Number(code.match(/num_threads\((\d+)\)/)?.[1] ?? "0")
    const usesRayon = /par_iter\(\)/.test(code) && /ThreadPoolBuilder::new\(\)/.test(code)
    const usesCrossbeam = /crossbeam::channel::bounded/.test(code)

    const total =
      usesRayon && usesCrossbeam
        ? batches.reduce((running, batch) => running + sum(batch.map((value) => value * factor)), 0)
        : 0

    return `batches = ${batches.length}\nscaled total = ${total}\npool threads = ${threads}`
  }

  if (key === "ch26_ex_bounded_queue_retry") {
    const capacity =
      Number(code.match(/bounded::<[^>]+>\((\d+)\)/)?.[1] ?? "") ||
      Number(code.match(/bounded\((\d+)\)/)?.[1] ?? "") ||
      0

    const queuedJobs = Array.from(code.matchAll(/tx\.send\(\s*"([^"]+)"\s*\)\.unwrap\(\)/g), (match) => match[1])
    const accepted = queuedJobs.filter((job) => job !== "retry").length
    const retried = /retried\s*\+=\s*1/.test(code) ? 1 : 0
    const cancelled = /cancelled\s*=\s*true/.test(code)

    return `capacity = ${capacity}\naccepted = ${accepted}\nretried = ${retried}\ncancelled = ${cancelled}`
  }

  return null
}

type StageSample = {
  name: string
  micros: number
}

type PipelineStats = {
  cpuUs: number
  ioWaitUs: number
  lockWaitUs: number
  serializeUs: number
  serializedBytes: number
}

function parseStageSamples(code: string): StageSample[] {
  return Array.from(
    code.matchAll(/StageSample\s*{\s*name:\s*"([^"]+)"\s*,\s*micros:\s*(\d+)\s*,?\s*}/g),
    (match) => ({
      name: match[1],
      micros: Number(match[2]),
    })
  )
}

function parseIntLiteral(code: string, field: string): number {
  // Rust integer literals may contain underscores as digit separators (e.g. 16_384).
  const match = code.match(new RegExp(`${field}:\\s*(\\d[\\d_]*)`))
  return Number((match?.[1] ?? "0").replace(/_/g, ""))
}

function parseStats(code: string): PipelineStats {
  return {
    cpuUs: parseIntLiteral(code, "cpu_us"),
    ioWaitUs: parseIntLiteral(code, "io_wait_us"),
    lockWaitUs: parseIntLiteral(code, "lock_wait_us"),
    serializeUs: parseIntLiteral(code, "serialize_us"),
    serializedBytes: parseIntLiteral(code, "serialized_bytes"),
  }
}

function computeDominant(stats: PipelineStats): string {
  const entries: Array<[string, number]> = [
    ["cpu", stats.cpuUs],
    ["io", stats.ioWaitUs],
    ["lock", stats.lockWaitUs],
    ["serialize", stats.serializeUs],
  ]

  return entries.reduce((best, current) => (current[1] > best[1] ? current : best))[0]
}

function computeWallTime(stats: PipelineStats): number {
  return stats.cpuUs + stats.ioWaitUs + stats.lockWaitUs + stats.serializeUs
}

export function simulateCh35Output(code: string, key?: string): string | null {
  if (key === "performance_profiling_hot_stage_summary") {
    const samples = parseStageSamples(code)
    const hottest = samples.reduce((best, current) => (current.micros > best.micros ? current : best), samples[0] ?? {
      name: "none",
      micros: 0,
    })
    const total = samples.reduce((sum, sample) => sum + sample.micros, 0)

    return `hottest = ${hottest.name}\nstage us = ${hottest.micros}\ntotal us = ${total}`
  }

  if (key === "performance_profiling_pipeline_bottleneck") {
    const stats = parseStats(code)

    return `dominant = ${computeDominant(stats)}\nserialized bytes = ${stats.serializedBytes}\nwall us = ${computeWallTime(stats)}`
  }

  if (key === "ch35_ex_bottleneck_report") {
    const stats = parseStats(code)
    const dominantBlock = code.match(/fn\s+dominant[\s\S]*?\n\}/)?.[0] ?? ""
    const wallBlock = code.match(/fn\s+wall_time[\s\S]*?\n\}/)?.[0] ?? ""

    const hasDominantLogic =
      ["cpu_us", "io_wait_us", "lock_wait_us", "serialize_us"].every((field) => dominantBlock.includes(field)) &&
      ["\"cpu\"", "\"io\"", "\"lock\"", "\"serialize\""].every((label) => dominantBlock.includes(label)) &&
      (/max_by_key/.test(dominantBlock) || /\bif\b/.test(dominantBlock))

    const hasWallTimeLogic =
      ["cpu_us", "io_wait_us", "lock_wait_us", "serialize_us"].every((field) => wallBlock.includes(field)) &&
      (wallBlock.match(/\+/g) ?? []).length >= 3

    if (hasDominantLogic && hasWallTimeLogic) {
      return `dominant = ${computeDominant(stats)}\nwall us = ${computeWallTime(stats)}\nbytes = ${stats.serializedBytes}`
    }

    return `dominant = cpu\nwall us = 0\nbytes = ${stats.serializedBytes}`
  }

  return null
}

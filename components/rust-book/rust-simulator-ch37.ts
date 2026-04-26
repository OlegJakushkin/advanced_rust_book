function parseNumber(code: string, pattern: RegExp, fallback: number): number {
  const raw = code.match(pattern)?.[1]
  if (!raw) return fallback
  const parsed = Number(raw.replace(/_/g, ""))
  return Number.isNaN(parsed) ? fallback : parsed
}

function ceilDiv(left: number, right: number): number {
  return Math.floor((left + right - 1) / right)
}

function hasCeilDivisionFormula(code: string): boolean {
  return (
    /div_ceil\(\s*threads_per_block(?:\s+as\s+usize)?\s*\)/.test(code) ||
    /\(\(\s*len(?:\s+as\s+u32)?\s*\)\s*\+\s*threads_per_block\s*-\s*1\s*\)\s*\/\s*threads_per_block/.test(code) ||
    /\(\(\s*a_len(?:\s+as\s+u32)?\s*\)\s*\+\s*threads_per_block\s*-\s*1\s*\)\s*\/\s*threads_per_block/.test(code)
  )
}

export function simulateCh37Output(code: string, key?: string): string | null {
  if (key === "cuda_gpu_kernel_launch_wrapper") {
    const len = parseNumber(code, /launch_vec_add\(\s*([\d_]+)\s*,\s*([\d_]+)\s*\)/, 4096)
    const threads = parseNumber(code, /launch_vec_add\(\s*[\d_]+\s*,\s*([\d_]+)\s*\)/, 256)
    const usesWrapper =
      /fn\s+build_launch_config/.test(code) &&
      /unsafe\s+fn\s+raw_launch_vec_add/.test(code) &&
      /raw_launch_vec_add\(/.test(code)

    const blocks = threads > 0 ? ceilDiv(len, threads) : 0
    const deviceBytes = len * 3 * 4

    return `blocks = ${usesWrapper ? blocks : 0}\nthreads = ${threads}\ndevice bytes = ${
      usesWrapper ? deviceBytes : 0
    }`
  }

  if (key === "cuda_gpu_transfer_budget") {
    const elements = parseNumber(code, /elements:\s*([\d_]+)/, 1_000_000)
    const flopsPerElement = parseNumber(code, /flops_per_element:\s*([\d_]+)/, 64)
    const inputBuffers = parseNumber(code, /input_buffers:\s*([\d_]+)/, 2)
    const outputBuffers = parseNumber(code, /output_buffers:\s*([\d_]+)/, 1)
    const launchUs = parseNumber(code, /let\s+launch_us\s*=\s*([\d_]+)/, 25)

    const bytes = elements * 4 * (inputBuffers + outputBuffers)
    const intensity = flopsPerElement / (4 * (inputBuffers + outputBuffers))
    const gpuFaster = bytes >= 8_000_000 && intensity >= 4.0 && launchUs <= 50

    return `transfer bytes = ${bytes}\nintensity = ${intensity.toFixed(2)}\ngpu faster = ${gpuFaster}`
  }

  if (key === "ch37_ex_safe_kernel_wrapper") {
    const len = parseNumber(code, /let\s+len\s*=\s*([\d_]+)/, 1024)
    const threads = parseNumber(code, /let\s+threads_per_block\s*=\s*([\d_]+)/, 128)

    const hasShapeCheck =
      /a_len\s*!=\s*b_len\s*\|\|\s*a_len\s*!=\s*out_len/.test(code) ||
      /a_len\s*==\s*b_len\s*&&\s*a_len\s*==\s*out_len/.test(code)
    const hasEmptyCheck = /a_len\s*==\s*0/.test(code)
    const hasThreadCheck = /threads_per_block\s*==\s*0/.test(code)
    const hasBlocksFormula = hasCeilDivisionFormula(code)

    const launchOk = hasShapeCheck && hasEmptyCheck && hasThreadCheck && hasBlocksFormula
    const blocks = threads > 0 ? ceilDiv(len, threads) : 0

    return `blocks = ${launchOk ? blocks : 0}\nthreads = ${threads}\nlaunch ok = ${launchOk}`
  }

  return null
}

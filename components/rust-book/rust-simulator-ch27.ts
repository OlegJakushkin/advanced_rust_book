function decodeRustString(value: string): string {
  return value
    .replace(/\\\\/g, "__BACKSLASH__")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/__BACKSLASH__/g, "\\")
}

function readCursorText(code: string, fallback: string): string {
  const match = code.match(/Cursor::new\(\s*"((?:[^"\\]|\\.)*)"\.as_bytes\(\)\s*\)/)
  return decodeRustString(match?.[1] ?? fallback)
}

function readNonEmptyLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
}

function computeBatchWrite(lines: string[], batchSize: number, hasFinalFlush: boolean) {
  if (batchSize <= 0) {
    return { batches: 0, bytes: 0 }
  }

  const fullGroups = Math.floor(lines.length / batchSize)
  const remainder = lines.length % batchSize
  const writtenLines = fullGroups * batchSize + (hasFinalFlush ? remainder : 0)
  const batches = fullGroups + (hasFinalFlush && remainder > 0 ? 1 : 0)
  const bytes = lines.slice(0, writtenLines).reduce((total, line) => total + line.length + 1, 0)

  return { batches, bytes }
}

export function simulateCh27Output(code: string, key?: string): string | null {
  if (key === "io_patterns_buffered_backpressure") {
    const input = readCursorText(code, "alpha\nbeta\ngamma\n")
    const lines = readNonEmptyLines(input)
    const batchSize = Number(code.match(/pending\.len\(\)\s*(?:==|>=)\s*(\d+)/)?.[1] ?? "2")
    const hasFinalFlush = /if\s+!pending\.is_empty\(\)/.test(code)
    const { batches, bytes } = computeBatchWrite(lines, batchSize, hasFinalFlush)

    return `sent = ${lines.length}\nreceived = ${lines.length}\nbatches = ${batches}\nbytes = ${bytes}`
  }

  if (key === "io_patterns_scatter_gather_socket") {
    const parts = Array.from(code.matchAll(/IoSlice::new\(\s*b"([^"]*)"\s*\)/g), (match) => match[1])
    const payload = parts.join("")
    const usesVectored = /write_vectored\(/.test(code)
    const nodelay = /set_nodelay\(\s*true\s*\)/.test(code)

    return `nodelay = ${nodelay}\nvectored parts = ${usesVectored ? parts.length : 0}\nclient = ${
      usesVectored ? payload : ""
    }`
  }

  if (key === "ch27_ex_buffered_pipeline") {
    const input = readCursorText(code, "red\nblue\ngreen\n")
    const lines = readNonEmptyLines(input)
    const capacity = Number(code.match(/sync_channel(?:::<[^>]+>)?\((\d+)\)/)?.[1] ?? "0")
    const batchSize = Number(code.match(/pending\.len\(\)\s*(?:==|>=)\s*(\d+)/)?.[1] ?? "0")
    const hasSyncChannel = /sync_channel/.test(code)
    const hasFinalFlush = /if\s+!pending\.is_empty\(\)/.test(code)
    const hasBufferedWriter = /BufWriter::new/.test(code) && /writer\.flush\(\)/.test(code)
    const hasWrites = /writeln!\(\s*writer\s*,\s*"\{\}"\s*,\s*item\s*\)/.test(code)

    if (hasSyncChannel && capacity === 1 && batchSize === 2 && hasFinalFlush && hasBufferedWriter && hasWrites) {
      const { batches, bytes } = computeBatchWrite(lines, batchSize, hasFinalFlush)
      return `capacity = ${capacity}\nreceived = ${lines.length}\nbatches = ${batches}\nbytes = ${bytes}`
    }

    return `capacity = ${capacity}\nreceived = ${lines.length}\nbatches = 0\nbytes = 0`
  }

  return null
}

// Deterministic simulator for Chapter 55 (ONNX model inference).
//
// The two runnable listings are pure-Rust forward passes over a fixed one-layer
// model: a matmul against WEIGHTS, a BIAS add, then argmax. This file reproduces
// their exact stdout. Where it is cheap to do so it re-parses the input vectors
// from the edited source and recomputes, so small numeric edits to the inputs
// are reflected; the weights and bias are treated as the fixed constants the
// listings declare.

const IN = 4
const OUT = 3

const WEIGHTS: number[][] = [
  [0.2, 0.8, -0.5, 0.1],
  [-0.3, 0.5, 0.9, 0.4],
  [0.6, -0.2, 0.3, -0.7],
]
const BIAS: number[] = [0.1, -0.2, 0.05]

// Default inputs the listings ship with, used when parsing fails.
const DEFAULT_INPUT: number[] = [0.5, -1.0, 2.0, 0.25]
const DEFAULT_BATCH: number[] = [0.5, -1.0, 2.0, 0.25, 1.5, 0.5, -0.5, 1.0]

function parseFloatList(source?: string): number[] {
  if (!source) return []

  return source
    .split(",")
    .map((part) => part.trim().replace(/_/g, "").replace(/f(?:32|64)$/i, ""))
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((value) => !Number.isNaN(value))
}

// Read the body of `input_tensor()` from `[ ... ]`.
function parseInputTensor(code: string): number[] {
  const match = code.match(/fn\s+input_tensor\s*\(\s*\)\s*->[^\{]*\{\s*\[([^\]]*)\]/)
  const parsed = parseFloatList(match?.[1])
  return parsed.length === IN ? parsed : DEFAULT_INPUT
}

// Read the body of `build_batch()` from the `vec![ ... ]` literal, stripping
// the trailing `// row N` comments before parsing the numbers.
function parseBatch(code: string): number[] {
  const match = code.match(/fn\s+build_batch\s*\(\s*\)\s*->[^\{]*\{\s*vec!\s*\[([\s\S]*?)\]/)
  if (!match) return DEFAULT_BATCH
  const cleaned = match[1].replace(/\/\/[^\n]*/g, " ")
  const parsed = parseFloatList(cleaned)
  return parsed.length >= IN && parsed.length % IN === 0 ? parsed : DEFAULT_BATCH
}

function forwardRow(row: number[]): number[] {
  const logits: number[] = []
  for (let o = 0; o < OUT; o++) {
    let sum = BIAS[o]
    for (let c = 0; c < IN; c++) {
      sum += WEIGHTS[o][c] * row[c]
    }
    logits.push(sum)
  }
  return logits
}

function argmax(logits: number[]): number {
  let best = 0
  for (let i = 1; i < logits.length; i++) {
    if (logits[i] > logits[best]) {
      best = i
    }
  }
  return best
}

// Match Rust's `{:.4}` formatting, including the way it renders negative zero.
function fmt4(value: number): string {
  const rounded = Object.is(value, -0) ? 0 : value
  const text = rounded.toFixed(4)
  return text === "-0.0000" ? "0.0000" : text
}

export function simulateCh55Output(code: string, key?: string): string | null {
  if (key === "onnx_session_load_run") {
    const input = parseInputTensor(code)
    const logits = forwardRow(input)
    const cls = argmax(logits)

    return [
      `input dims = ${IN}`,
      `classes = ${OUT}`,
      `logits = [${fmt4(logits[0])}, ${fmt4(logits[1])}, ${fmt4(logits[2])}]`,
      `predicted class = ${cls}`,
      `score = ${fmt4(logits[cls])}`,
    ].join("\n")
  }

  if (key === "onnx_tensor_batch_argmax") {
    const batch = parseBatch(code)
    const rows = Math.floor(batch.length / IN)

    const lines = [`batch rows = ${rows}`, `features per row = ${IN}`]
    for (let r = 0; r < rows; r++) {
      const row = batch.slice(r * IN, (r + 1) * IN)
      const logits = forwardRow(row)
      const cls = argmax(logits)
      lines.push(`row ${r} argmax = ${cls} score = ${fmt4(logits[cls])}`)
    }
    return lines.join("\n")
  }

  return null
}

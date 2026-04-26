function parseQuotedArray(code: string, variable: string): string[] {
  const match = code.match(new RegExp(`let\\s+${variable}\\s*=\\s*\\[([\\s\\S]*?)\\]`))
  if (!match) return []

  return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1])
}

function hashBytes(tag: number, bytes: number[]): number {
  let hash = (2166136261 ^ tag) >>> 0

  for (const byte of bytes) {
    hash ^= byte & 0xff
    hash = Math.imul(hash, 16777619) >>> 0
  }

  return hash >>> 0
}

function hashLeaf(text: string): number {
  const bytes = Array.from(text, (ch) => ch.charCodeAt(0) & 0xff)
  return hashBytes(0, bytes)
}

function hashNode(left: number, right: number): number {
  const bytes = [
    left & 0xff,
    (left >>> 8) & 0xff,
    (left >>> 16) & 0xff,
    (left >>> 24) & 0xff,
    right & 0xff,
    (right >>> 8) & 0xff,
    (right >>> 16) & 0xff,
    (right >>> 24) & 0xff,
  ]

  return hashBytes(1, bytes)
}

function buildMerkleRoot(leaves: string[]): { root: number; levels: number } {
  if (leaves.length === 0) {
    return { root: 0, levels: 0 }
  }

  let level = leaves.map(hashLeaf)
  let levels = 1

  while (level.length > 1) {
    const next: number[] = []

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]
      const right = i + 1 < level.length ? level[i + 1] : left
      next.push(hashNode(left, right))
    }

    level = next
    levels += 1
  }

  return { root: level[0] ?? 0, levels }
}

function formatHex(value: number): string {
  return value.toString(16).padStart(8, "0")
}

export function simulateCh38Output(code: string, key?: string): string | null {
  if (key === "merkle_tree_basic_proof") {
    const leaves = parseQuotedArray(code, "leaves")
    const { levels } = buildMerkleRoot(leaves)

    const hasProofPath =
      /fn\s+proof/.test(code) &&
      /sibling_is_left/.test(code) &&
      /sibling_index/.test(code)

    const hasVerifyLogic =
      /hash_leaf\(leaf\)/.test(code) &&
      /for\s+step\s+in\s+proof/.test(code) &&
      /if\s+step\.sibling_is_left/.test(code) &&
      /hash_node\(\s*step\.sibling\s*,\s*acc\s*\)/.test(code) &&
      /hash_node\(\s*acc\s*,\s*step\.sibling\s*\)/.test(code) &&
      /acc\s*==\s*expected_root/.test(code)

    return `leaf count = ${leaves.length}\nproof len = ${Math.max(levels - 1, 0)}\nverified = ${
      hasProofPath && hasVerifyLogic
    }`
  }

  if (key === "merkle_parallel_levels") {
    const leaves = parseQuotedArray(code, "leaves")
    const { levels } = buildMerkleRoot(leaves)

    const hasParallelLevel =
      /thread::scope\(/.test(code) &&
      /scope\.spawn\(/.test(code) &&
      /next_level_parallel/.test(code)

    const comparesRoots = /serial_root\s*==\s*parallel_root/.test(code)

    return `leaves = ${leaves.length}\nlevels = ${levels}\nroots match = ${hasParallelLevel && comparesRoots}`
  }

  if (key === "ch38_ex_merkle_proof_verify") {
    const hasVerifyLogic =
      /hash_leaf\(leaf\)/.test(code) &&
      /for\s+step\s+in\s+proof/.test(code) &&
      /if\s+step\.sibling_is_left/.test(code) &&
      /hash_node\(\s*step\.sibling\s*,\s*acc\s*\)/.test(code) &&
      /hash_node\(\s*acc\s*,\s*step\.sibling\s*\)/.test(code) &&
      /acc\s*==\s*expected_root/.test(code)

    return `verified good = ${hasVerifyLogic}\nverified bad = ${hasVerifyLogic ? "false" : "true"}`
  }

  return null
}

function parseNumberList(source?: string): number[] {
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

function parseByteLiterals(code: string): string[] {
  return Array.from(code.matchAll(/alloc_copy\(\s*b"([^"]*)"\s*\)/g), (match) => match[1])
}

function hasPortableSurfaceLogic(code: string): boolean {
  const hasAllocCrate = /#\s*\[\s*cfg\(\s*feature\s*=\s*"alloc"\s*\)\s*\]\s*extern crate alloc;/.test(code)
  const hasAllocVecUse =
    /#\s*\[\s*cfg\(\s*feature\s*=\s*"alloc"\s*\)\s*\]\s*use alloc::vec::Vec;/.test(code)
  const hasChecksum = /fn\s+checksum\s*\(\s*bytes:\s*&\[\s*u8\s*\]\s*\)\s*->\s*u32/.test(code)
  const hasEncodeFrame =
    /#\s*\[\s*cfg\(\s*feature\s*=\s*"alloc"\s*\)\s*\]\s*fn\s+encode_frame/.test(code) &&
    /Vec::with_capacity/.test(code) &&
    /extend_from_slice/.test(code)
  const hasStdHelper =
    /#\s*\[\s*cfg\(\s*feature\s*=\s*"std"\s*\)\s*\]\s*fn\s+write_diagnostic/.test(code) &&
    /format!\(\s*"\{\}:\{\}"/.test(code)

  return hasAllocCrate && hasAllocVecUse && hasChecksum && hasEncodeFrame && hasStdHelper
}

function hasPoolLogic(code: string): boolean {
  const hasBounds = /bytes\.len\(\)\s*>\s*BYTES/.test(code)
  const hasSearch =
    /while\s+index\s*<\s*SLOTS/.test(code) || /for\s+index\s+in\s+0\.\.SLOTS/.test(code)
  const hasMarkUsed = /self\.used\[index\]\s*=\s*true/.test(code)
  const hasStoreLen = /self\.lens\[index\]\s*=\s*bytes\.len\(\)/.test(code)
  const hasCopy = /copy_from_slice\(\s*bytes\s*\)/.test(code)
  const hasReturnSlot = /Some\(\s*SlotId\(\s*index\s*\)\s*\)/.test(code)
  const hasSlice =
    /&self\.data\[id\.0\]\[\.\.self\.lens\[id\.0\]\]/.test(code) ||
    /&self\.data\[_id\.0\]\[\.\.self\.lens\[_id\.0\]\]/.test(code)
  const hasRelease =
    /self\.used\[id\.0\]\s*=\s*false/.test(code) || /self\.used\[_id\.0\]\s*=\s*false/.test(code)

  return hasBounds && hasSearch && hasMarkUsed && hasStoreLen && hasCopy && hasReturnSlot && hasSlice && hasRelease
}

function hasExercisePoolLogic(code: string): boolean {
  const hasAlloc = hasPoolLogic(code)
  const hasView =
    /&self\.data\[id\.0\]\[\.\.self\.lens\[id\.0\]\]/.test(code) ||
    /&self\.data\[_id\.0\]\[\.\.self\.lens\[_id\.0\]\]/.test(code)
  const hasAvailable = /filter\(\|\&\&used\|\s*!used\)\.count\(\)/.test(code)
  return hasAlloc && hasView && hasAvailable
}

export function simulateCh54Output(code: string, key?: string): string | null {
  if (key === "no_std_portable_surface") {
    const payload = parseNumberList(code.match(/let\s+payload\s*=\s*\[([^\]]+)\]/)?.[1])
    const checksum = payload.reduce((total, value) => total + value, 0)
    const ready = hasPortableSurfaceLogic(code)

    return `portable modes = ${ready ? "core|alloc|std" : "broken"}\nchecksum = ${checksum}\nalloc-gated api = ${
      ready ? "encode_frame" : "broken"
    }`
  }

  if (key === "no_std_fixed_capacity_dma") {
    const byteLiterals = parseByteLiterals(code)
    const successfulAllocs = (code.match(/alloc_copy\(\s*b"[^"]*"\s*\)\.unwrap\(\)/g) ?? []).length
    const releases = (code.match(/release\(\s*[a-zA-Z_]\w*\s*\)/g) ?? []).length
    const overflow = /\.is_none\(\)/.test(code)
    const ready = hasPoolLogic(code)

    const firstLen = byteLiterals[0]?.length ?? 0
    const inUse = Math.max(successfulAllocs - releases, 0)

    return `in_use = ${ready ? inUse : 0}\noverflow = ${overflow}\nsent bytes = ${ready ? firstLen : 0}`
  }

  if (key === "ch54_ex_dma_pool") {
    const byteLiterals = parseByteLiterals(code)
    const firstLen = byteLiterals[0]?.length ?? 0
    const slots = Number(code.match(/Pool::<\s*(\d+)\s*,/)?.[1] ?? "2")
    const successfulAllocs = (code.match(/alloc_copy\(\s*b"[^"]*"\s*\)\.unwrap\(\)/g) ?? []).length
    const releases = (code.match(/release\(\s*[a-zA-Z_]\w*\s*\)/g) ?? []).length
    const overflow = /\.is_none\(\)/.test(code)
    const ready = hasExercisePoolLogic(code)

    const inUse = Math.max(successfulAllocs - releases, 0)
    const available = Math.max(slots - inUse, 0)

    return `first len = ${ready ? firstLen : 0}\noverflow = ${overflow}\navailable = ${
      ready ? available : 0
    }`
  }

  return null
}

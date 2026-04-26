function parseNumber(code: string, pattern: RegExp, fallback: number): number {
  const raw = code.match(pattern)?.[1]
  if (!raw) return fallback
  const parsed = Number(raw.replace(/_/g, ""))
  return Number.isNaN(parsed) ? fallback : parsed
}

function parseString(code: string, pattern: RegExp, fallback: string): string {
  return code.match(pattern)?.[1] ?? fallback
}

function hasProofBoundaryLogic(code: string): boolean {
  const hasSumConstraint =
    /witness\.left\s*\+\s*witness\.right\s*!=\s*statement\.public_total/.test(code) ||
    /statement\.public_total\s*!=\s*witness\.left\s*\+\s*witness\.right/.test(code)

  const hasLimitConstraint = /statement\.public_total\s*>\s*statement\.public_limit/.test(code)

  const hasProofReturn =
    /ProofArtifact\s*{[\s\S]*public_total:\s*statement\.public_total[\s\S]*public_limit:\s*statement\.public_limit[\s\S]*proof_bytes_len:\s*[\d_]+[\s\S]*}/.test(
      code
    )

  const hasVerifyLogic =
    /statement\.public_total\s*==\s*proof\.public_total/.test(code) &&
    /statement\.public_limit\s*==\s*proof\.public_limit/.test(code) &&
    /proof\.proof_bytes_len\s*>\s*0/.test(code)

  return hasSumConstraint && hasLimitConstraint && hasProofReturn && hasVerifyLogic
}

function hasTranscriptLogic(code: string): boolean {
  const hasTranscriptType = /struct\s+Transcript/.test(code)
  const hasAppend = /fn\s+append_u64/.test(code)
  const hasChallenge = /fn\s+challenge/.test(code)
  const comparesSameDomain = /prover_challenge\s*==\s*verifier_challenge/.test(code)
  const comparesOtherDomain = /prover_challenge\s*!=\s*other_domain_challenge/.test(code)

  return hasTranscriptType && hasAppend && hasChallenge && comparesSameDomain && comparesOtherDomain
}

export function simulateCh51Output(code: string, key?: string): string | null {
  if (key === "zkp_statement_witness_proof") {
    const publicTotal = parseNumber(code, /public_total:\s*([\d_]+)/, 45)
    const proofBytes = parseNumber(code, /proof_bytes_len:\s*([\d_]+)/, 96)
    const valid = hasProofBoundaryLogic(code)

    return `public total = ${publicTotal}\nproof bytes = ${proofBytes}\nverified = ${valid}`
  }

  if (key === "zkp_transcript_domain_separation") {
    const domain = parseString(code, /let\s+domain\s*=\s*"([^"]+)"/, "billing-proof:v1")
    const valid = hasTranscriptLogic(code)

    return `domain = ${domain}\nchallenge match = ${valid}\ndomain separation = ${valid}`
  }

  if (key === "ch51_ex_proof_boundary") {
    const publicTotal = parseNumber(code, /public_total:\s*([\d_]+)/, 45)
    const proofBytes = parseNumber(code, /proof_bytes_len:\s*([\d_]+)/, 96)
    const valid = hasProofBoundaryLogic(code)

    return `verified = ${valid}\npublic total = ${publicTotal}\nproof bytes = ${proofBytes}`
  }

  return null
}

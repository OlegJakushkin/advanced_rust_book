function parseNumber(code: string, pattern: RegExp, fallback: number): number {
  const raw = code.match(pattern)?.[1]
  if (!raw) return fallback
  const parsed = Number(raw.replace(/_/g, ""))
  return Number.isNaN(parsed) ? fallback : parsed
}

function parseStringField(code: string, field: string, fallback: string): string {
  const patterns = [
    new RegExp(`${field}:\\s*String::from\\("([^"]+)"\\)`),
    new RegExp(`${field}:\\s*"([^"]+)"\\.to_string\\(\\)`),
    new RegExp(`${field}:\\s*"([^"]+)"\\.into\\(\\)`),
    new RegExp(`${field}:\\s*"([^"]+)"`),
  ]

  for (const pattern of patterns) {
    const value = code.match(pattern)?.[1]
    if (value) return value
  }

  return fallback
}

function hasVerificationBoundarySeparation(code: string): boolean {
  const verificationStruct =
    code.match(/struct\s+VerificationRequest\s*{([\s\S]*?)}/)?.[1] ?? ""

  const hasClaim = /claim:\s*PublicClaim/.test(verificationStruct)
  const hasProof = /proof:\s*ProofArtifact/.test(verificationStruct)
  const leaksWitness = /WitnessMaterial|witness/i.test(verificationStruct)

  const buildFn =
    /fn\s+build_verification_request\(\s*claim:\s*PublicClaim\s*,\s*proof:\s*ProofArtifact\s*\)\s*->\s*VerificationRequest/.test(
      code
    ) && /VerificationRequest\s*{\s*claim\s*,\s*proof\s*}/.test(code)

  return hasClaim && hasProof && !leaksWitness && buildFn
}

function hasQueueProfileLogic(code: string): boolean {
  const hasQueueName =
    /fn\s+queue_name/.test(code) &&
    /job\.gpu_requested/.test(code) &&
    /"zkml\.gpu"/.test(code) &&
    /"zkml\.cpu"/.test(code)

  const hasDominantStage =
    /fn\s+dominant_stage/.test(code) &&
    /times\.witness_ms/.test(code) &&
    /times\.prove_ms/.test(code) &&
    /times\.verify_ms/.test(code) &&
    /times\.transfer_ms/.test(code)

  const hasE2E =
    /fn\s+end_to_end_ms/.test(code) &&
    /times\.witness_ms\s*\+\s*times\.prove_ms\s*\+\s*times\.verify_ms\s*\+\s*times\.transfer_ms/.test(code)

  return hasQueueName && hasDominantStage && hasE2E
}

export function simulateCh53Output(code: string, key?: string): string | null {
  if (key === "zkml_verification_boundary_types") {
    const modelId = parseStringField(code, "model_id", "llm-int8:v3")
    const tokenCount = parseNumber(code, /token_count:\s*([\d_]+)/, 128)
    const proofBytes = parseNumber(code, /proof_bytes_len:\s*([\d_]+)/, 2048)
    const keptPrivate = hasVerificationBoundarySeparation(code)

    return `model = ${modelId}\npublic tokens = ${tokenCount}\nproof bytes = ${proofBytes}\nwitness kept private = ${keptPrivate}`
  }

  if (key === "zkml_proving_queue_profile") {
    const artifactId = parseStringField(code, "artifact_id", "model-sha256:abc123")
    const gpuRequested = /gpu_requested:\s*true/.test(code)
    const witnessMs = parseNumber(code, /witness_ms:\s*([\d_]+)/, 320)
    const proveMs = parseNumber(code, /prove_ms:\s*([\d_]+)/, 1280)
    const verifyMs = parseNumber(code, /verify_ms:\s*([\d_]+)/, 40)
    const transferMs = parseNumber(code, /transfer_ms:\s*([\d_]+)/, 240)

    const entries: Array<[string, number]> = [
      ["witness", witnessMs],
      ["prove", proveMs],
      ["verify", verifyMs],
      ["transfer", transferMs],
    ]

    const dominant = entries.reduce((best, next) => (next[1] > best[1] ? next : best))[0]
    const route = gpuRequested ? "zkml.gpu" : "zkml.cpu"
    const e2e = witnessMs + proveMs + verifyMs + transferMs
    const valid = hasQueueProfileLogic(code)

    return `route = ${valid ? route : "broken"}\ndominant = ${valid ? dominant : "broken"}\ne2e ms = ${
      valid ? e2e : 0
    }\nartifact = ${valid ? artifactId : "broken"}`
  }

  if (key === "ch53_ex_gpu_queue_boundary") {
    const gpuRequested = /gpu_requested:\s*true/.test(code)
    const publicOutputsMatch = code.match(/public_outputs:\s*vec!\[([\s\S]*?)\]/)
    const publicOutputCount = publicOutputsMatch
      ? (publicOutputsMatch[1].match(/String::from\("([^"]+)"\)|"([^"]+)"/g) ?? []).length
      : 0

    const mapsProofPath =
      /proof_path:\s*job\.proof_path\.clone\(\)/.test(code) || /proof_path:\s*job\.proof_path/.test(code)
    const countsPublicOutputs = /public_output_count:\s*job\.public_outputs\.len\(\)/.test(code)
    const keepsWitnessOut = /witness_included:\s*false/.test(code)

    const valid = mapsProofPath && countsPublicOutputs && keepsWitnessOut
    const route = gpuRequested ? "zkml.gpu" : "zkml.cpu"

    return `prove queue = ${valid ? route : "broken"}\nverify payload = ${
      valid ? publicOutputCount : 0
    }\nwitness leaked = ${valid ? "false" : "true"}`
  }

  return null
}

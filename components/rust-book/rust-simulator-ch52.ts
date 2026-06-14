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

function countVecStringItems(code: string, field: string, fallback: number): number {
  const body = code.match(new RegExp(`${field}:\\s*vec!\\[([\\s\\S]*?)\\]`))?.[1]
  if (!body) return fallback

  const matches = body.match(/"([^"]+)"/g) ?? []
  return matches.length
}

export function simulateCh52Output(code: string, key?: string): string | null {
  if (key === "zokrates_workflow_command_plan") {
    const circuit = code.match(/plan_for\(\s*"([^"]+)"/)?.[1] ?? "age_check"
    const contract =
      code.match(/PathBuf::from\("([^"]+Verifier\.sol)"\)/)?.[1] ?? "artifacts/AgeCheckVerifier.sol"

    const hasWorkflowStages = [
      '"compile"',
      '"setup"',
      '"compute-witness"',
      '"generate-proof"',
      '"export-verifier"',
      '"verify"',
    ].every((stage) => code.includes(stage))

    const hasCompileShape =
      /format!\(\s*"\{\}\.zok"\s*,\s*circuit\s*\)/.test(code) && /"-o"\.into\(\)/.test(code)

    const hasProofShape =
      /"generate-proof"\.into\(\)/.test(code) && /"-i"\.into\(\)/.test(code)

    const ready = hasWorkflowStages && hasCompileShape && hasProofShape
    const compiled = `artifacts/${circuit}`

    return `steps = ${ready ? 6 : 0}\ncompile = ${
      ready ? `zokrates compile -i ${circuit}.zok -o ${compiled}` : "broken"
    }\nproof = ${ready ? `zokrates generate-proof -i ${compiled}` : "broken"}\ncontract = ${contract}`
  }

  if (key === "zokrates_ethereum_verifier_boundary") {
    const contract = parseStringField(code, "verifier_contract", "contracts/AgeCheckVerifier.sol")
    const publicInputs = countVecStringItems(code, "public_inputs", 2)

    const hasFunction = /function:\s*"verifyTx"/.test(code)
    const hasPublicInputLen = /public_inputs_len:\s*bundle\.public_inputs\.len\(\)/.test(code)
    const usesProofArtifact =
      /proof_source:\s*bundle\.proof_json_path\.clone\(\)/.test(code) ||
      /proof_source:\s*bundle\.proof_json_path/.test(code)

    return `contract = ${contract}\nverifier fn = ${hasFunction ? "verifyTx" : "broken"}\npublic inputs = ${
      hasPublicInputLen ? publicInputs : 0
    }\nwitness leaked = ${!usesProofArtifact}`
  }

  if (key === "ch52_ex_verifier_request") {
    const contract = parseStringField(code, "verifier_contract", "contracts/AgeCheckVerifier.sol")
    const publicInputs = countVecStringItems(code, "public_inputs", 2)

    const mapsContract =
      /contract:\s*bundle\.verifier_contract\.clone\(\)/.test(code) ||
      /contract:\s*bundle\.verifier_contract/.test(code)

    const countsPublicInputs = /public_inputs_len:\s*bundle\.public_inputs\.len\(\)/.test(code)

    const usesProofPath =
      /proof_path:\s*bundle\.proof_path\.clone\(\)/.test(code) ||
      /proof_path:\s*bundle\.proof_path/.test(code)

    const keepsWitnessOut = /witness_included:\s*false/.test(code)

    const ready = mapsContract && countsPublicInputs && usesProofPath && keepsWitnessOut

    return `contract = ${ready ? contract : "broken"}\npublic inputs = ${
      ready ? publicInputs : 0
    }\nwitness included = ${ready ? "false" : "true"}`
  }

  return null
}

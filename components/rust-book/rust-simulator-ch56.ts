// Deterministic output models for Chapter 56 (Smart Contracts in Rust).
//
// Each model parses the user-editable values out of the code so that editing
// the snippet changes the printed output, while still checking that the core
// structure (the account/instruction logic, the platform table) is intact.

function hasCounterProgramLogic(code: string): boolean {
  const decodesLe = /u64::from_le_bytes/.test(code)
  const encodesLe = /to_le_bytes/.test(code)
  const hasEntry = /fn\s+process_instruction\s*\(/.test(code)
  const handlesIncrement = /Instruction::Increment\s*=>\s*current\s*\+\s*1/.test(code)
  const handlesSet = /Instruction::SetTo\(\s*value\s*\)\s*=>\s*\*value/.test(code)
  const writesBack = /write_counter\(\s*data\s*,\s*next\s*\)/.test(code)
  return decodesLe && encodesLe && hasEntry && handlesIncrement && handlesSet && writesBack
}

// Replay the sequence of process_instruction calls found in main() so that the
// final counter reflects whatever instructions the reader leaves in place.
interface CounterStep {
  kind: "set" | "increment"
  value: number
}

function parseCounterSteps(code: string): CounterStep[] {
  const steps: CounterStep[] = []
  const callRegex = /process_instruction\(\s*&mut\s+account\.data\s*,\s*&Instruction::(Increment|SetTo\(\s*(\d+)\s*\))\s*\)/g
  let match: RegExpExecArray | null

  while ((match = callRegex.exec(code)) !== null) {
    if (match[1].startsWith("Increment")) {
      steps.push({ kind: "increment", value: 0 })
    } else {
      steps.push({ kind: "set", value: Number(match[2] ?? "0") })
    }
  }

  return steps
}

function parseOwner(code: string): string {
  return code.match(/owner:\s*"([^"]*)"/)?.[1] ?? "CounterProgram1111"
}

interface PlatformRow {
  name: string
  state: string
  target: string
  serde: string
  entry: string
}

function hasPlatformCompareLogic(code: string): boolean {
  const hasEnum = /enum\s+Platform\s*\{/.test(code)
  const hasDescribe = /fn\s+describe\s*\(/.test(code)
  const iteratesAll =
    /\[\s*Platform::Solana\s*,\s*Platform::SeiCosmWasm\s*,\s*Platform::EvmSolidity\s*\]/.test(code)
  const printsRow = /\{\}\s*\|\s*state=\{\}\s*\|\s*target=\{\}\s*\|\s*serde=\{\}\s*\|\s*entry=\{\}/.test(code)
  return hasEnum && hasDescribe && iteratesAll && printsRow
}

function parsePlatformRow(code: string, variant: string): PlatformRow | null {
  const armRegex = new RegExp(
    `Platform::${variant}\\s*=>\\s*PlatformModel\\s*\\{([\\s\\S]*?)\\}`
  )
  const arm = code.match(armRegex)?.[1]
  if (!arm) return null

  const field = (label: string) => arm.match(new RegExp(`${label}:\\s*"([^"]*)"`))?.[1] ?? ""

  return {
    name: field("name"),
    state: field("state_model"),
    target: field("execution_target"),
    serde: field("serialization"),
    entry: field("entry_shape"),
  }
}

export function simulateCh56Output(code: string, key?: string): string | null {
  if (key === "smart_contract_solana_counter") {
    const ready = hasCounterProgramLogic(code)
    const owner = parseOwner(code)

    if (!ready) {
      return `after set = 0\nafter increment = 0\ncounter = 0\nowner = ${owner}`
    }

    const steps = parseCounterSteps(code)
    let counter = 0
    let afterSet = 0
    let afterIncrement = 0
    let sawSet = false
    let sawIncrement = false

    for (const step of steps) {
      if (step.kind === "set") {
        counter = step.value
        afterSet = counter
        sawSet = true
      } else {
        counter += 1
        afterIncrement = counter
        sawIncrement = true
      }
    }

    const setLine = sawSet ? afterSet : 0
    const incLine = sawIncrement ? afterIncrement : 0

    return `after set = ${setLine}\nafter increment = ${incLine}\ncounter = ${counter}\nowner = ${owner}`
  }

  if (key === "smart_contract_platform_compare") {
    const ready = hasPlatformCompareLogic(code)
    if (!ready) return "platform table unavailable"

    const variants = ["Solana", "SeiCosmWasm", "EvmSolidity"]
    const lines: string[] = []

    for (const variant of variants) {
      const row = parsePlatformRow(code, variant)
      if (!row) return "platform table unavailable"
      lines.push(
        `${row.name} | state=${row.state} | target=${row.target} | serde=${row.serde} | entry=${row.entry}`
      )
    }

    return lines.join("\n")
  }

  return null
}

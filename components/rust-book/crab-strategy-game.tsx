"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { RefreshCw, RotateCcw, ScrollText, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { RustCodeEditor } from "@/components/rust-code-editor"
import { cn } from "@/lib/utils"
import {
  ACTIONS,
  CONDITIONS,
  DIRECT_ACTIONS,
  compileStrategy,
  type CompiledStrategy,
  type DirectAction,
  type StrategyAction,
  type StrategyCondition,
  type StrategyRule,
} from "./crab-strategy-compiler"
import { DEFAULT_CRAB_STRATEGY_CODE } from "./crab-strategy-defaults"

type Position = {
  x: number
  y: number
}

type Template = {
  name: string
  crab: Position
  predators: Position[]
  obstacles: Position[]
  fish: Position[]
}

const GRID_COLS = 12
const GRID_ROWS = 9
const TURN_LIMIT = 50
const STORAGE_KEY = "rust-book-ch01-crab-strategy"

type SimulationFrame = {
  turn: number
  crab: Position
  predators: Position[]
  fish: Position[]
  score: number
  fishCollected: number
  caught: boolean
  chosenAction: string
  matchedRule: string
  event: string
}

type TurnLogEntry = {
  turn: number
  chosenAction: string
  matchedRule: string
  event: string
  score: number
}

type SimulationResult = {
  seed: number
  beachName: string
  frames: SimulationFrame[]
  logs: TurnLogEntry[]
  finalScore: number
  turnsSurvived: number
  fishCollected: number
  caught: boolean
}

const BEACH_TEMPLATES: Template[] = [
  {
    name: "Foamline Cove",
    crab: { x: 1, y: 7 },
    predators: [{ x: 10, y: 1 }, { x: 9, y: 4 }],
    obstacles: [
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 8, y: 3 },
      { x: 2, y: 5 },
      { x: 6, y: 5 },
      { x: 7, y: 6 },
      { x: 4, y: 7 },
    ],
    fish: [
      { x: 1, y: 2 },
      { x: 6, y: 2 },
      { x: 9, y: 2 },
      { x: 3, y: 6 },
      { x: 10, y: 6 },
    ],
  },
  {
    name: "Sunny Tide Reach",
    crab: { x: 2, y: 7 },
    predators: [{ x: 9, y: 1 }, { x: 10, y: 5 }],
    obstacles: [
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 5, y: 2 },
      { x: 7, y: 2 },
      { x: 7, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 8, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ],
    fish: [
      { x: 1, y: 1 },
      { x: 10, y: 2 },
      { x: 6, y: 3 },
      { x: 2, y: 5 },
      { x: 9, y: 7 },
    ],
  },
  {
    name: "Coral Smile Beach",
    crab: { x: 1, y: 6 },
    predators: [{ x: 10, y: 2 }, { x: 8, y: 6 }],
    obstacles: [
      { x: 4, y: 1 },
      { x: 5, y: 1 },
      { x: 6, y: 1 },
      { x: 2, y: 4 },
      { x: 4, y: 3 },
      { x: 8, y: 4 },
      { x: 3, y: 6 },
      { x: 5, y: 6 },
      { x: 7, y: 7 },
    ],
    fish: [
      { x: 2, y: 1 },
      { x: 9, y: 1 },
      { x: 6, y: 4 },
      { x: 10, y: 5 },
      { x: 1, y: 7 },
    ],
  },
]

const DEFAULT_STRATEGY_CODE = DEFAULT_CRAB_STRATEGY_CODE

const DIRECTION_DELTAS: Record<Exclude<DirectAction, "stay">, Position> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

function posKey(position: Position) {
  return `${position.x},${position.y}`
}

function samePos(left: Position, right: Position) {
  return left.x === right.x && left.y === right.y
}

function inBounds(position: Position) {
  return position.x >= 0 && position.x < GRID_COLS && position.y >= 0 && position.y < GRID_ROWS
}

function manhattan(left: Position, right: Position) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y)
}

function clonePosition(position: Position): Position {
  return { x: position.x, y: position.y }
}

function isDirectAction(action: StrategyAction): action is DirectAction {
  return (DIRECT_ACTIONS as readonly string[]).includes(action)
}

function step(position: Position, action: Exclude<DirectAction, "stay">): Position {
  const delta = DIRECTION_DELTAS[action]
  return { x: position.x + delta.x, y: position.y + delta.y }
}

function makeObstacleSet(obstacles: Position[]) {
  return new Set(obstacles.map(posKey))
}

function createRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function getTemplateForSeed(seed: number) {
  return BEACH_TEMPLATES[Math.abs(seed) % BEACH_TEMPLATES.length]
}

function getNeighbors(position: Position) {
  return (["up", "right", "down", "left"] as const)
    .map((direction) => ({ direction, position: step(position, direction) }))
    .filter((candidate) => inBounds(candidate.position))
}

function isOpenCell(position: Position, obstacleSet: Set<string>) {
  return inBounds(position) && !obstacleSet.has(posKey(position))
}

function minPredatorDistance(position: Position, predators: Position[]) {
  if (predators.length === 0) return 999
  return Math.min(...predators.map((predator) => manhattan(position, predator)))
}

function shortestDistanceToAnyFish(start: Position, fish: Position[], obstacleSet: Set<string>) {
  if (fish.length === 0) return 999

  const targetKeys = new Set(fish.map(posKey))
  const queue: Array<{ position: Position; distance: number }> = [{ position: start, distance: 0 }]
  const visited = new Set([posKey(start)])

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) break

    if (targetKeys.has(posKey(current.position))) {
      return current.distance
    }

    for (const neighbor of getNeighbors(current.position)) {
      const key = posKey(neighbor.position)
      if (visited.has(key) || !isOpenCell(neighbor.position, obstacleSet)) continue
      visited.add(key)
      queue.push({ position: neighbor.position, distance: current.distance + 1 })
    }
  }

  return 999
}

function chooseBestCandidate(
  candidates: Position[],
  predators: Position[],
  fish: Position[],
  obstacleSet: Set<string>,
  mode: "escape" | "chase"
) {
  let best = candidates[0]

  for (const candidate of candidates.slice(1)) {
    const candidatePredatorDistance = minPredatorDistance(candidate, predators)
    const bestPredatorDistance = minPredatorDistance(best, predators)
    const candidateFishDistance = shortestDistanceToAnyFish(candidate, fish, obstacleSet)
    const bestFishDistance = shortestDistanceToAnyFish(best, fish, obstacleSet)

    const candidateScore =
      mode === "escape"
        ? candidatePredatorDistance * 100 - candidateFishDistance
        : -candidateFishDistance * 100 + candidatePredatorDistance
    const bestScore =
      mode === "escape" ? bestPredatorDistance * 100 - bestFishDistance : -bestFishDistance * 100 + bestPredatorDistance

    if (candidateScore > bestScore) {
      best = candidate
    }
  }

  return best
}

function directionFromPositions(from: Position, to: Position): DirectAction {
  if (samePos(from, to)) return "stay"
  if (to.x > from.x) return "right"
  if (to.x < from.x) return "left"
  if (to.y > from.y) return "down"
  return "up"
}

function findPathWithAStar(
  start: Position,
  goal: Position,
  obstacleSet: Set<string>,
  extraBlocked: Set<string>
) {
  const startKey = posKey(start)
  const goalKey = posKey(goal)
  const open = [clonePosition(start)]
  const openSet = new Set([startKey])
  const cameFrom = new Map<string, string>()
  const gScore = new Map<string, number>([[startKey, 0]])
  const fScore = new Map<string, number>([[startKey, manhattan(start, goal)]])

  while (open.length > 0) {
    open.sort((left, right) => (fScore.get(posKey(left)) ?? 99999) - (fScore.get(posKey(right)) ?? 99999))
    const current = open.shift()
    if (!current) break

    const currentKey = posKey(current)
    openSet.delete(currentKey)

    if (currentKey === goalKey) {
      const path = [clonePosition(current)]
      let cursor = currentKey
      while (cameFrom.has(cursor)) {
        const previous = cameFrom.get(cursor)!
        const [x, y] = previous.split(",").map(Number)
        path.unshift({ x, y })
        cursor = previous
      }
      return path
    }

    for (const neighbor of getNeighbors(current)) {
      const neighborKey = posKey(neighbor.position)
      const blockedByPredator = extraBlocked.has(neighborKey) && neighborKey !== goalKey
      if (!isOpenCell(neighbor.position, obstacleSet) || blockedByPredator) continue

      const tentative = (gScore.get(currentKey) ?? 99999) + 1
      if (tentative >= (gScore.get(neighborKey) ?? 99999)) continue

      cameFrom.set(neighborKey, currentKey)
      gScore.set(neighborKey, tentative)
      fScore.set(neighborKey, tentative + manhattan(neighbor.position, goal))

      if (!openSet.has(neighborKey)) {
        open.push(clonePosition(neighbor.position))
        openSet.add(neighborKey)
      }
    }
  }

  return [clonePosition(start)]
}

function chooseWanderMove(
  crab: Position,
  obstacleSet: Set<string>,
  turn: number,
  clockwise: boolean
): DirectAction {
  const baseOrder = clockwise
    ? (["right", "down", "left", "up"] as const)
    : (["left", "down", "right", "up"] as const)

  for (let index = 0; index < baseOrder.length; index += 1) {
    const direction = baseOrder[(index + turn) % baseOrder.length]
    const next = step(crab, direction)
    if (isOpenCell(next, obstacleSet)) {
      return direction
    }
  }

  return "stay"
}

function chooseRandomSafeMove(
  crab: Position,
  predators: Position[],
  obstacleSet: Set<string>,
  rng: () => number
): DirectAction {
  const directMoves = (["up", "right", "down", "left"] as const).filter((direction) =>
    isOpenCell(step(crab, direction), obstacleSet)
  )
  const safeMoves = directMoves.filter((direction) => minPredatorDistance(step(crab, direction), predators) >= 2)
  const choices = safeMoves.length > 0 ? safeMoves : directMoves
  if (choices.length === 0) return "stay"
  return choices[Math.floor(rng() * choices.length)] ?? "stay"
}

function evaluateCondition(
  condition: StrategyCondition,
  crab: Position,
  predators: Position[],
  fish: Position[],
  obstacleSet: Set<string>
) {
  const minDistance = minPredatorDistance(crab, predators)
  const hasFishAt = (position: Position) => fish.some((item) => samePos(item, position))
  const isSafeDirection = (direction: Exclude<DirectAction, "stay">) => {
    const next = step(crab, direction)
    return isOpenCell(next, obstacleSet) && minPredatorDistance(next, predators) >= 2
  }

  switch (condition) {
    case "predator_adjacent":
      return minDistance <= 1
    case "predator_near":
      return minDistance <= 2
    case "fish_here":
      return hasFishAt(crab)
    case "fish_up":
      return hasFishAt(step(crab, "up"))
    case "fish_right":
      return hasFishAt(step(crab, "right"))
    case "fish_down":
      return hasFishAt(step(crab, "down"))
    case "fish_left":
      return hasFishAt(step(crab, "left"))
    case "open_up":
      return isOpenCell(step(crab, "up"), obstacleSet)
    case "open_right":
      return isOpenCell(step(crab, "right"), obstacleSet)
    case "open_down":
      return isOpenCell(step(crab, "down"), obstacleSet)
    case "open_left":
      return isOpenCell(step(crab, "left"), obstacleSet)
    case "safe_up":
      return isSafeDirection("up")
    case "safe_right":
      return isSafeDirection("right")
    case "safe_down":
      return isSafeDirection("down")
    case "safe_left":
      return isSafeDirection("left")
    case "on_sand":
      return crab.y >= GRID_ROWS - 3
    case "on_water":
      return crab.y < GRID_ROWS - 3
  }
}

function resolveAction(
  action: StrategyAction,
  crab: Position,
  predators: Position[],
  fish: Position[],
  obstacleSet: Set<string>,
  turn: number,
  rng: () => number
): { actionTaken: DirectAction; detail: string; blocked: boolean } {
  if (action === "escape") {
    const candidates = [crab, ...getNeighbors(crab).map((item) => item.position)].filter((position) =>
      isOpenCell(position, obstacleSet)
    )
    const best = chooseBestCandidate(candidates, predators, fish, obstacleSet, "escape")
    return {
      actionTaken: directionFromPositions(crab, best),
      detail: `escape → ${directionFromPositions(crab, best)}`,
      blocked: false,
    }
  }

  if (action === "chase_fish") {
    const candidates = [crab, ...getNeighbors(crab).map((item) => item.position)].filter((position) =>
      isOpenCell(position, obstacleSet)
    )
    const best = chooseBestCandidate(candidates, predators, fish, obstacleSet, "chase")
    return {
      actionTaken: directionFromPositions(crab, best),
      detail: `chase_fish → ${directionFromPositions(crab, best)}`,
      blocked: false,
    }
  }

  if (action === "wander_clockwise") {
    const actionTaken = chooseWanderMove(crab, obstacleSet, turn, true)
    return { actionTaken, detail: `wander_clockwise → ${actionTaken}`, blocked: false }
  }

  if (action === "wander_counterclockwise") {
    const actionTaken = chooseWanderMove(crab, obstacleSet, turn, false)
    return { actionTaken, detail: `wander_counterclockwise → ${actionTaken}`, blocked: false }
  }

  if (action === "random_safe") {
    const actionTaken = chooseRandomSafeMove(crab, predators, obstacleSet, rng)
    return { actionTaken, detail: `random_safe → ${actionTaken}`, blocked: false }
  }

  if (!isDirectAction(action)) {
    return { actionTaken: "stay", detail: "stay", blocked: false }
  }

  if (action === "stay") {
    return { actionTaken: "stay", detail: "stay", blocked: false }
  }

  const next = step(crab, action)
  if (!isOpenCell(next, obstacleSet)) {
    return { actionTaken: "stay", detail: `${action} (blocked)`, blocked: true }
  }

  return { actionTaken: action, detail: action, blocked: false }
}

function ruleMatches(
  rule: StrategyRule,
  crab: Position,
  predators: Position[],
  fish: Position[],
  obstacleSet: Set<string>
) {
  return rule.conditions.every((condition) =>
    evaluateCondition(condition, crab, predators, fish, obstacleSet)
  )
}

function snakeToPascalCase(value: string) {
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")
}

function chooseStrategyMove(
  strategy: CompiledStrategy,
  crab: Position,
  predators: Position[],
  fish: Position[],
  obstacleSet: Set<string>,
  turn: number,
  rng: () => number
) {
  for (const rule of strategy.rules) {
    if (ruleMatches(rule, crab, predators, fish, obstacleSet)) {
      const resolved = resolveAction(rule.action, crab, predators, fish, obstacleSet, turn, rng)
      return { matchedRule: rule.label, ...resolved }
    }
  }

  const resolved = resolveAction(strategy.fallback, crab, predators, fish, obstacleSet, turn, rng)
  return { matchedRule: `fallback:${strategy.fallback}`, ...resolved }
}

function randomSpawnPosition(
  currentSeedRng: () => number,
  obstacleSet: Set<string>,
  crab: Position,
  predators: Position[],
  fish: Position[]
) {
  const candidates: Position[] = []

  for (let y = 1; y < GRID_ROWS - 1; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      const position = { x, y }
      if (!isOpenCell(position, obstacleSet)) continue
      if (samePos(position, crab)) continue
      if (predators.some((predator) => samePos(predator, position))) continue
      if (fish.some((item) => samePos(item, position))) continue
      candidates.push(position)
    }
  }

  if (candidates.length === 0) return null
  return candidates[Math.floor(currentSeedRng() * candidates.length)] ?? null
}

function simulateBeachRun(strategy: CompiledStrategy, seed: number): SimulationResult {
  const rng = createRng(seed)
  const template = getTemplateForSeed(seed)
  const obstacleSet = makeObstacleSet(template.obstacles)

  let crab = clonePosition(template.crab)
  let predators = template.predators.map(clonePosition)
  let fish = template.fish.map(clonePosition)
  let score = 0
  let fishCollected = 0
  let caught = false
  let respawnQueue: number[] = []

  const frames: SimulationFrame[] = [
    {
      turn: 0,
      crab: clonePosition(crab),
      predators: predators.map(clonePosition),
      fish: fish.map(clonePosition),
      score: 0,
      fishCollected: 0,
      caught: false,
      chosenAction: "ready",
      matchedRule: "preview",
      event: "The tide is calm. Press run and watch the beach come alive.",
    },
  ]
  const logs: TurnLogEntry[] = []

  for (let turn = 1; turn <= TURN_LIMIT; turn += 1) {
    const decision = chooseStrategyMove(strategy, crab, predators, fish, obstacleSet, turn, rng)
    const eventParts: string[] = []

    if (decision.blocked) {
      score -= 2
      eventParts.push("bonked a rock and lost tempo")
    }

    const nextCrab = decision.actionTaken === "stay" ? clonePosition(crab) : step(crab, decision.actionTaken as Exclude<DirectAction, "stay">)
    crab = isOpenCell(nextCrab, obstacleSet) ? nextCrab : crab

    if (fish.some((item) => samePos(item, crab))) {
      fish = fish.filter((item) => !samePos(item, crab))
      fishCollected += 1
      score += 12
      respawnQueue.push(4 + Math.floor(rng() * 4))
      eventParts.push("snapped up a fish +12")
    }

    score += 1

    const movedPredators: Position[] = []
    for (let predatorIndex = 0; predatorIndex < predators.length; predatorIndex += 1) {
      const predator = predators[predatorIndex]
      const occupiedByOthers = new Set<string>(
        predators
          .filter((_, index) => index !== predatorIndex)
          .map(posKey)
          .concat(movedPredators.map(posKey))
      )

      const path = findPathWithAStar(predator, crab, obstacleSet, occupiedByOthers)
      const nextPredator = path[1] ?? predator
      movedPredators.push(clonePosition(nextPredator))
    }
    predators = movedPredators

    if (predators.some((predator) => samePos(predator, crab))) {
      caught = true
      score -= 18
      eventParts.push("caught by an octopus")
    } else if (minPredatorDistance(crab, predators) <= 1) {
      eventParts.push("an octopus is closing in")
    }

    respawnQueue = respawnQueue
      .map((timer) => timer - 1)
      .filter((timer) => {
        if (timer > 0) return true
        const spawned = randomSpawnPosition(rng, obstacleSet, crab, predators, fish)
        if (spawned) {
          fish.push(spawned)
          eventParts.push("a fish resurfaced from the tide")
        }
        return false
      })

    if (eventParts.length === 0) {
      eventParts.push("kept scuttling through the surf")
    }

    const event = eventParts.join(" · ")
    const frame: SimulationFrame = {
      turn,
      crab: clonePosition(crab),
      predators: predators.map(clonePosition),
      fish: fish.map(clonePosition),
      score,
      fishCollected,
      caught,
      chosenAction: decision.detail,
      matchedRule: decision.matchedRule,
      event,
    }

    frames.push(frame)
    logs.push({
      turn,
      chosenAction: decision.detail,
      matchedRule: decision.matchedRule,
      event,
      score,
    })

    if (caught) {
      break
    }
  }

  if (!caught && frames.length > 1) {
    const lastFrame = frames[frames.length - 1]
    lastFrame.score += 15
    lastFrame.event = `${lastFrame.event} · survived the full tide and earned a beach bonus +15`
    logs[logs.length - 1] = {
      ...logs[logs.length - 1],
      score: lastFrame.score,
      event: lastFrame.event,
    }
    score = lastFrame.score
  }

  return {
    seed,
    beachName: template.name,
    frames,
    logs,
    finalScore: frames[frames.length - 1]?.score ?? 0,
    turnsSurvived: Math.max(frames.length - 1, 0),
    fishCollected,
    caught,
  }
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.closePath()
  ctx.fill()
}

function strokeRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  roundedRectPath(ctx, x, y, width, height, radius)
  ctx.closePath()
  ctx.stroke()
}

function drawEmoji(
  ctx: CanvasRenderingContext2D,
  emoji: string,
  x: number,
  y: number,
  size: number,
  shadowColor: string
) {
  ctx.save()
  ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.shadowColor = shadowColor
  ctx.shadowBlur = 14
  ctx.fillText(emoji, x, y)
  ctx.restore()
}

function drawBeachScene(frame: SimulationFrame, seed: number, beachName: string, canvas: HTMLCanvasElement, time: number) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  const width = canvas.width
  const height = canvas.height
  const horizonY = 160
  const sandStartY = 350
  const cell = 44
  const gridWidth = GRID_COLS * cell
  const gridHeight = GRID_ROWS * cell
  const gridLeft = Math.round((width - gridWidth) / 2)
  const gridTop = 78

  ctx.clearRect(0, 0, width, height)

  const skyGradient = ctx.createLinearGradient(0, 0, 0, horizonY)
  skyGradient.addColorStop(0, "#8dd6ff")
  skyGradient.addColorStop(0.6, "#b6e6ff")
  skyGradient.addColorStop(1, "#dff5ff")
  ctx.fillStyle = skyGradient
  ctx.fillRect(0, 0, width, horizonY)

  const sunX = width - 112
  const sunY = 84
  ctx.save()
  ctx.globalAlpha = 0.9
  ctx.fillStyle = "#ffd76a"
  ctx.beginPath()
  ctx.arc(sunX, sunY, 40, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  const oceanGradient = ctx.createLinearGradient(0, horizonY - 30, 0, sandStartY)
  oceanGradient.addColorStop(0, "#52c7ea")
  oceanGradient.addColorStop(0.5, "#26a7d9")
  oceanGradient.addColorStop(1, "#1280c0")
  ctx.fillStyle = oceanGradient
  ctx.fillRect(0, horizonY - 30, width, sandStartY - (horizonY - 30))

  const waveTime = time / 1000
  for (let layer = 0; layer < 3; layer += 1) {
    ctx.beginPath()
    ctx.moveTo(0, horizonY + layer * 18)
    for (let x = 0; x <= width; x += 12) {
      const y =
        horizonY +
        layer * 18 +
        Math.sin((x / 48) + waveTime * (1.4 + layer * 0.25) + seed * 0.01) * (6 + layer * 2)
      ctx.lineTo(x, y)
    }
    ctx.lineTo(width, horizonY + 90)
    ctx.lineTo(0, horizonY + 90)
    ctx.closePath()
    ctx.fillStyle = layer === 0 ? "rgba(255,255,255,0.22)" : layer === 1 ? "rgba(255,255,255,0.12)" : "rgba(0,85,150,0.08)"
    ctx.fill()
  }

  const sandGradient = ctx.createLinearGradient(0, sandStartY, 0, height)
  sandGradient.addColorStop(0, "#f8d694")
  sandGradient.addColorStop(0.55, "#efc674")
  sandGradient.addColorStop(1, "#dca452")
  ctx.fillStyle = sandGradient
  ctx.fillRect(0, sandStartY, width, height - sandStartY)

  ctx.strokeStyle = "rgba(255,255,255,0.55)"
  ctx.lineWidth = 4
  ctx.beginPath()
  for (let x = 0; x <= width; x += 10) {
    const y = sandStartY + Math.sin((x / 36) + waveTime * 2.6 + seed * 0.005) * 5
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  ctx.save()
  ctx.shadowColor = "rgba(27, 53, 87, 0.22)"
  ctx.shadowBlur = 26
  ctx.fillStyle = "rgba(255,255,255,0.12)"
  fillRoundedRect(ctx, gridLeft - 16, gridTop - 16, gridWidth + 32, gridHeight + 32, 28)
  ctx.restore()

  ctx.fillStyle = "rgba(255,255,255,0.16)"
  fillRoundedRect(ctx, gridLeft - 8, gridTop - 8, gridWidth + 16, gridHeight + 16, 24)
  ctx.strokeStyle = "rgba(255,255,255,0.28)"
  ctx.lineWidth = 1
  strokeRoundedRect(ctx, gridLeft - 8, gridTop - 8, gridWidth + 16, gridHeight + 16, 24)

  const obstacleSet = makeObstacleSet(getTemplateForSeed(seed).obstacles)

  for (let y = 0; y < GRID_ROWS; y += 1) {
    for (let x = 0; x < GRID_COLS; x += 1) {
      const cellX = gridLeft + x * cell
      const cellY = gridTop + y * cell
      const isSandTile = y >= GRID_ROWS - 3
      const shimmer = 0.08 + (Math.sin(waveTime * 2 + x * 0.8 + y * 0.5) + 1) * 0.02

      ctx.fillStyle = isSandTile
        ? `rgba(255, 240, 197, ${0.24 + shimmer})`
        : `rgba(193, 242, 255, ${0.14 + shimmer})`
      fillRoundedRect(ctx, cellX + 2, cellY + 2, cell - 4, cell - 4, 12)

      ctx.strokeStyle = "rgba(255,255,255,0.14)"
      ctx.lineWidth = 1
      strokeRoundedRect(ctx, cellX + 2, cellY + 2, cell - 4, cell - 4, 12)

      if ((x + y + seed) % 7 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.09)"
        ctx.beginPath()
        ctx.arc(cellX + cell * 0.72, cellY + cell * 0.28, 4, 0, Math.PI * 2)
        ctx.fill()
      }

      if (obstacleSet.has(posKey({ x, y }))) {
        ctx.fillStyle = "rgba(72, 96, 120, 0.42)"
        fillRoundedRect(ctx, cellX + 4, cellY + 4, cell - 8, cell - 8, 12)
        drawEmoji(ctx, "🪨", cellX + cell / 2, cellY + cell / 2 + 1, cell * 0.48, "rgba(15,23,42,0.18)")
      }
    }
  }

  frame.fish.forEach((fish) => {
    const x = gridLeft + fish.x * cell + cell / 2
    const y = gridTop + fish.y * cell + cell / 2
    ctx.fillStyle = "rgba(255,255,255,0.26)"
    ctx.beginPath()
    ctx.arc(x, y, cell * 0.28, 0, Math.PI * 2)
    ctx.fill()
    drawEmoji(ctx, "🐟", x, y + 1, cell * 0.48, "rgba(34,197,94,0.28)")
  })

  frame.predators.forEach((predator) => {
    const x = gridLeft + predator.x * cell + cell / 2
    const y = gridTop + predator.y * cell + cell / 2
    ctx.fillStyle = "rgba(255, 122, 122, 0.22)"
    ctx.beginPath()
    ctx.arc(x, y, cell * 0.32, 0, Math.PI * 2)
    ctx.fill()
    drawEmoji(ctx, "🐙", x, y + 1, cell * 0.56, "rgba(220,38,38,0.35)")
  })

  const crabX = gridLeft + frame.crab.x * cell + cell / 2
  const crabY = gridTop + frame.crab.y * cell + cell / 2
  ctx.fillStyle = frame.caught ? "rgba(255, 99, 99, 0.30)" : "rgba(255, 255, 255, 0.32)"
  ctx.beginPath()
  ctx.arc(crabX, crabY, cell * 0.34, 0, Math.PI * 2)
  ctx.fill()
  drawEmoji(ctx, "🦀", crabX, crabY + 1, cell * 0.62, frame.caught ? "rgba(220,38,38,0.45)" : "rgba(59,130,246,0.28)")

  ctx.fillStyle = "#09304b"
  ctx.font = '600 16px "Inter", ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(`${beachName} • Beach seed ${seed}`, 24, 32)

  ctx.fillStyle = "#0f4d73"
  ctx.font = '500 13px "Inter", ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(`Turn ${frame.turn}/${TURN_LIMIT} • ${frame.caught ? "strategy caught" : "strategy replay"}`, 24, 52)

  ctx.textAlign = "right"
  ctx.fillStyle = "#0b3b58"
  ctx.font = '700 16px "Inter", ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(`Score ${frame.score}`, width - 24, 32)
  ctx.font = '500 13px "Inter", ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(`Fish ${frame.fishCollected}`, width - 24, 52)
  ctx.textAlign = "left"

  ctx.fillStyle = "rgba(9, 48, 75, 0.88)"
  fillRoundedRect(ctx, 20, height - 56, width - 40, 36, 14)
  ctx.fillStyle = "#f8fafc"
  ctx.font = '500 13px "Inter", ui-sans-serif, system-ui, sans-serif'
  ctx.fillText(`${frame.chosenAction} • ${frame.event}`, 36, height - 32)
}

export function CrabStrategyGame() {
  const [code, setCode] = useState(DEFAULT_STRATEGY_CODE)
  const [output, setOutput] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentSeed, setCurrentSeed] = useState(1337)
  const [simulation, setSimulation] = useState<SimulationResult | null>(null)
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [readyToPersist, setReadyToPersist] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const runStrategy = useCallback((seed: number, strategySource: string) => {
    setIsRunning(true)

    window.setTimeout(() => {
      const compiled = compileStrategy(strategySource)

      if (!compiled.strategy) {
        setOutput(compiled.output)
        setSimulation(null)
        setCurrentFrameIndex(0)
        setIsPlaying(false)
        setIsRunning(false)
        return
      }

      const result = simulateBeachRun(compiled.strategy, seed)
      setCurrentSeed(seed)
      setOutput(
        [
          compiled.output,
          `Beach = ${result.beachName}`,
          `Final score = ${result.finalScore}`,
          result.caught ? "Status = caught by an octopus" : "Status = survived the full 50-step tide",
        ].join("\n")
      )
      setSimulation(result)
      setCurrentFrameIndex(0)
      setIsPlaying(true)
      setIsRunning(false)
    }, 420)
  }, [])

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    const initialCode = saved || DEFAULT_STRATEGY_CODE
    setCode(initialCode)
    runStrategy(1337, initialCode)
    setReadyToPersist(true)
  }, [runStrategy])

  useEffect(() => {
    if (!readyToPersist) return
    localStorage.setItem(STORAGE_KEY, code)
  }, [code, readyToPersist])

  useEffect(() => {
    if (!simulation || !isPlaying) return
    if (currentFrameIndex >= simulation.frames.length - 1) {
      setIsPlaying(false)
      return
    }

    const timer = window.setTimeout(() => {
      setCurrentFrameIndex((value) => Math.min(value + 1, simulation.frames.length - 1))
    }, 360)

    return () => window.clearTimeout(timer)
  }, [currentFrameIndex, isPlaying, simulation])

  const activeFrame = useMemo<SimulationFrame>(() => {
    if (simulation) {
      return simulation.frames[Math.min(currentFrameIndex, simulation.frames.length - 1)]
    }

    const template = getTemplateForSeed(currentSeed)
    return {
      turn: 0,
      crab: clonePosition(template.crab),
      predators: template.predators.map(clonePosition),
      fish: template.fish.map(clonePosition),
      score: 0,
      fishCollected: 0,
      caught: false,
      chosenAction: "ready",
      matchedRule: "preview",
      event: "Press Run to compile your strategy and send the crab into the tide.",
    }
  }, [currentFrameIndex, currentSeed, simulation])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let frameHandle = 0
    const render = (time: number) => {
      drawBeachScene(activeFrame, currentSeed, simulation?.beachName ?? getTemplateForSeed(currentSeed).name, canvas, time)
      frameHandle = window.requestAnimationFrame(render)
    }

    frameHandle = window.requestAnimationFrame(render)
    return () => window.cancelAnimationFrame(frameHandle)
  }, [activeFrame, currentSeed, simulation])

  const handleReplay = () => {
    runStrategy(currentSeed, code)
  }

  const handleNewBeach = () => {
    runStrategy(Math.floor(Math.random() * 1000000), code)
  }

  const scoreCardTone = simulation?.caught
    ? "border-red-500/30 bg-red-500/10 text-red-100"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground">🦀 Beach strategy lab</h3>
                <p className="text-sm text-muted-foreground">
                  Write a Rust trait-based strategy, compile it, and let the crab chase fish for 50 tide steps while
                  octopuses hunt with A*.
                </p>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                UTF-8 beach board
              </div>
            </div>

            <RustCodeEditor
              code={code}
              onChange={setCode}
              onRun={() => runStrategy(currentSeed, code)}
              output={output}
              isRunning={isRunning}
              filename="crab_strategy.rs"
              originalCode={DEFAULT_STRATEGY_CODE}
              onRevert={() => setCode(DEFAULT_STRATEGY_CODE)}
            />

            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              The default template is intentionally trait-first now: it models a <code className="rounded bg-muted px-1 py-0.5">BeachView</code>{" "}
              interface and a <code className="rounded bg-muted px-1 py-0.5">CrabStrategy</code> implementation, while still
              showing enums, const arrays, lifetimes, iterators, closures, <code className="rounded bg-muted px-1 py-0.5">impl Trait</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">Option</code>, and <code className="rounded bg-muted px-1 py-0.5">matches!</code>.
              For older saved snippets, the web lab still understands the legacy builder syntax too.
            </p>

            <details className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
              <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                BeachView + Action quick reference
              </summary>
              <div className="mt-3 rounded-lg border border-border bg-background p-3 text-xs text-muted-foreground">
                <div className="font-mono text-foreground">trait CrabStrategy {"{"} fn choose_action(&amp;self, view: &amp;dyn BeachView) -&gt; Action; {"}"}</div>
                <div className="mt-1">Use <span className="font-mono text-foreground">view.some_condition()</span> inside <span className="font-mono text-foreground">choose_action</span>, then return an <span className="font-mono text-foreground">Action::Variant</span>.</div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Conditions</div>
                  <div className="flex flex-wrap gap-2">
                    {CONDITIONS.map((condition) => (
                      <span
                        key={condition}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {`view.${condition}()`}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Actions</div>
                  <div className="flex flex-wrap gap-2">
                    {ACTIONS.map((action) => (
                      <span
                        key={action}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground"
                      >
                        {`Action::${snakeToPascalCase(action)}`}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <div className="border-b border-border bg-gradient-to-r from-sky-100/70 via-cyan-100/60 to-amber-100/70 px-5 py-4 dark:from-sky-950/40 dark:via-cyan-950/30 dark:to-amber-950/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Canvas replay</div>
                  <div className="text-xs text-muted-foreground">
                    Current beach: {simulation?.beachName ?? getTemplateForSeed(currentSeed).name} · seed {currentSeed}
                  </div>
                </div>
                <div className="text-xs font-medium text-muted-foreground">
                  Step {activeFrame.turn}/{TURN_LIMIT}
                </div>
              </div>
            </div>

            <div className="p-4">
              <canvas
                ref={canvasRef}
                width={720}
                height={500}
                className="h-auto w-full rounded-2xl border border-sky-200/40 bg-sky-50/70 shadow-inner dark:border-sky-900/40 dark:bg-sky-950/30"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={cn("rounded-2xl border p-4 shadow-sm", scoreCardTone)}>
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]">
                <Trophy className="h-4 w-4" />
                Strategy score
              </div>
              <div className="text-3xl font-bold text-foreground">{simulation?.finalScore ?? activeFrame.score}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {simulation
                  ? simulation.caught
                    ? "Caught before the tide finished."
                    : "Survived the full beach run."
                  : "Run the strategy to score the beach."}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Run summary</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-2xl font-bold text-foreground">{simulation?.fishCollected ?? activeFrame.fishCollected}</div>
                  <div className="text-xs text-muted-foreground">Fish</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{simulation?.turnsSurvived ?? activeFrame.turn}</div>
                  <div className="text-xs text-muted-foreground">Turns</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">{simulation?.caught ? "🐙" : "🙂"}</div>
                  <div className="text-xs text-muted-foreground">{simulation?.caught ? "Caught" : "Clear"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleReplay} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Replay same beach
            </Button>
            <Button onClick={handleNewBeach} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              New beach
            </Button>
            <Button
              onClick={() => setIsPlaying((value) => !value)}
              variant="outline"
              disabled={!simulation}
              className="gap-2"
            >
              {isPlaying ? "Pause replay" : "Resume replay"}
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Strategy log</h4>
            </div>

            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              {[
                ["🦀", "Your crab"],
                ["🐟", "Fish score +12 and respawn later"],
                ["🐙", "Octopuses hunt with A*"],
                ["🪨", "Obstacles block both sides"],
              ].map(([icon, label]) => (
                <div key={label} className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                  <span className="mr-2 text-base">{icon}</span>
                  {label}
                </div>
              ))}
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {(simulation?.logs ?? []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                  Compile a strategy to generate the 50-move log.
                </div>
              ) : (
                [...(simulation?.logs ?? [])].reverse().map((entry) => {
                  const isCurrent = entry.turn === activeFrame.turn
                  return (
                    <div
                      key={entry.turn}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm transition-colors",
                        isCurrent ? "border-primary bg-primary/10" : "border-border bg-muted/20"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium text-foreground">Turn {entry.turn}</div>
                        <div className="text-xs text-muted-foreground">score {entry.score}</div>
                      </div>
                      <div className="mt-1 text-xs text-primary">{entry.matchedRule}</div>
                      <div className="mt-1 text-muted-foreground">
                        <span className="font-medium text-foreground">{entry.chosenAction}</span> · {entry.event}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import type { InferOutput } from 'valibot'

import { array, number, object, optional, parse, picklist, string, unknown } from 'valibot'

const positionSchema = object({ column: number(), line: number() })

// The part of `alint --format json` that this action reads.
const runResultSchema = object({
  diagnostics: array(object({
    evidence: optional(unknown()),
    filePath: string(),
    loc: optional(object({ end: optional(positionSchema), start: positionSchema })),
    message: string(),
    ruleId: string(),
    severity: picklist(['error', 'warn']),
  })),
  // Counts of rule executions. Output from an old alint version does not have them.
  execution: optional(object({ cached: number(), completed: number() })),
  usage: object({ inputTokens: number(), outputTokens: number() }),
})

export type Diagnostic = RunResult['diagnostics'][number]
export type RunResult = InferOutput<typeof runResultSchema>

export function parseRunResult(json: string): RunResult {
  return parse(runResultSchema, JSON.parse(json))
}

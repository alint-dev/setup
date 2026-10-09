import type { RunResult } from './output'

import { x } from 'tinyexec'

import { parseRunResult } from './output'

/** Runs `alint --format json` on the targets and returns the parsed result. */
export async function runAlint(command: string, targets: readonly string[], cwd: string): Promise<RunResult> {
  const result = await x(command, ['--format', 'json', ...targets], { nodeOptions: { cwd } })

  // alint returns 1 when a diagnostic is an error. The check run reports that, so only 2 and above stop the action.
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    throw new Error(`alint exited with code ${result.exitCode}.\n${result.stderr || result.stdout}`)
  }

  return parseRunResult(result.stdout)
}

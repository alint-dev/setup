import type { Diagnostic, RunResult } from './output'

export interface Annotation {
  annotation_level: 'failure' | 'warning'
  end_line: number
  message: string
  path: string
  start_line: number
  title: string
}

export type Conclusion = 'failure' | 'neutral' | 'success'

export interface Finding {
  line: number
  message: string
  path: string
  ruleId: string
  severity: Diagnostic['severity']
  suggestion?: string
}

export interface SummaryContext {
  repository: string
  runUrl?: string
  serverUrl: string
  sha: string
  /** The cost of the run, from `formatUsage`. */
  usage: string
}

/** Identifies the summary comment so that later runs rewrite it instead of adding another one. */
export const summaryMarker = '<!-- alint-summary -->'

const suggestionParagraph = /\n\s*Suggestion:/u

// GitHub rejects a comment or a check summary above 65536 characters.
// One row is a few hundred characters, so this cap keeps the table far below the limit.
const maxSummaryRows = 100

export function formatSummary(findings: readonly Finding[], context: SummaryContext): string {
  const icon = toConclusion(findings) === 'failure' ? '❌' : findings.length > 0 ? '⚠️' : '✅'
  const shortSha = context.sha.slice(0, 7)
  const lines = [summaryMarker, `### ${icon} alint · ${formatTitle(findings)}`, '']

  if (findings.length === 0) {
    lines.push(`Checked the changes at \`${shortSha}\`.`)
  }
  else {
    lines.push('| | Location | Rule | Finding |', '| --- | --- | --- | --- |')

    for (const finding of findings.slice(0, maxSummaryRows)) {
      const link = `${context.serverUrl}/${context.repository}/blob/${context.sha}/${encodeURI(finding.path)}#L${finding.line}`
      const detail = finding.suggestion === undefined
        ? escapeCell(finding.message)
        : `${escapeCell(finding.message)}<br><sub>💡 ${escapeCell(finding.suggestion)}</sub>`

      lines.push(`| ${finding.severity === 'error' ? '❌' : '⚠️'} | [\`${finding.path}:${finding.line}\`](${link}) | \`${finding.ruleId}\` | ${detail} |`)
    }

    if (findings.length > maxSummaryRows) {
      lines.push('', `${findings.length - maxSummaryRows} more findings are in the check annotations.`)
    }
  }

  const footer = [
    `Commit \`${shortSha}\``,
    context.runUrl === undefined ? undefined : `[run](${context.runUrl})`,
    context.usage,
  ].filter(part => part !== undefined)

  lines.push('', `<sub>${footer.join(' · ')}</sub>`)

  return lines.join('\n')
}

export function formatTitle(findings: readonly Finding[]): string {
  if (findings.length === 0) {
    return 'No findings'
  }

  const errors = findings.filter(finding => finding.severity === 'error').length
  const warnings = findings.length - errors

  return [
    errors > 0 ? pluralize(errors, 'error') : undefined,
    warnings > 0 ? pluralize(warnings, 'warning') : undefined,
  ].filter(part => part !== undefined).join(', ')
}

/** States the cost of a run, so that a reader can see from the check run whether the cache works. */
export function formatUsage(result: Pick<RunResult, 'execution' | 'usage'>): string {
  const tokens = `${result.usage.inputTokens.toLocaleString('en-US')} input / ${result.usage.outputTokens.toLocaleString('en-US')} output tokens`

  return result.execution === undefined
    ? tokens
    : `${pluralize(result.execution.completed, 'rule run')}, ${result.execution.cached} cached · ${tokens}`
}

export function toAnnotations(findings: readonly Finding[]): Annotation[] {
  return findings.map(finding => ({
    annotation_level: finding.severity === 'error' ? 'failure' : 'warning',
    end_line: finding.line,
    message: finding.suggestion === undefined ? finding.message : `${finding.message}\n\n${finding.suggestion}`,
    path: finding.path,
    start_line: finding.line,
    title: finding.ruleId,
  }))
}

export function toConclusion(findings: readonly Finding[]): Conclusion {
  if (findings.some(finding => finding.severity === 'error')) {
    return 'failure'
  }

  return findings.length > 0 ? 'neutral' : 'success'
}

/** Converts diagnostics to findings with repository-relative paths. Errors come first. */
export function toFindings(
  diagnostics: readonly Diagnostic[],
  toRepositoryPath: (filePath: string) => string,
): Finding[] {
  return diagnostics
    .map((diagnostic): Finding => {
      // Some rules append the remediation to the message as a `Suggestion:` paragraph.
      // https://github.com/alint-dev/alint/blob/ab0be9a/packages/plugin-js/src/rules/no-mixed-layers-without-abstraction/rule.ts#L391-L396
      const [message = '', ...paragraphs] = diagnostic.message.split(suggestionParagraph)

      return {
        // A diagnostic without a location is about the whole file. An annotation needs a line.
        line: diagnostic.loc?.start.line ?? 1,
        message: message.trim(),
        path: toRepositoryPath(diagnostic.filePath),
        ruleId: diagnostic.ruleId,
        severity: diagnostic.severity,
        suggestion: suggestionFrom(diagnostic.evidence) ?? (paragraphs.join('\n').trim() || undefined),
      }
    })
    .sort((a, b) =>
      Number(b.severity === 'error') - Number(a.severity === 'error')
      || a.path.localeCompare(b.path)
      || a.line - b.line,
    )
}

function escapeCell(value: string): string {
  return value.replaceAll('|', '\\|').replaceAll(/\s*\n\s*/gu, ' ')
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

// Declarative rules and `@alint-js/plugin-js` rules put the remediation text in `evidence.suggestion`.
function suggestionFrom(evidence: unknown): string | undefined {
  if (typeof evidence !== 'object' || evidence === null || !('suggestion' in evidence) || typeof evidence.suggestion !== 'string') {
    return undefined
  }

  return evidence.suggestion.trim() || undefined
}

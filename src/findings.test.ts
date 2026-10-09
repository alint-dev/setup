import type { Diagnostic } from './output'

import { describe, expect, it } from 'vitest'

import { formatSummary, formatTitle, formatUsage, summaryMarker, toAnnotations, toConclusion, toFindings } from './findings'

const context = { repository: 'acme/app', serverUrl: 'https://github.com', sha: '0123456789abcdef', usage: '1,000 input / 234 output tokens' }
const identity = (filePath: string) => filePath

function diagnostic(overrides: Partial<Diagnostic>): Diagnostic {
  return {
    filePath: 'src/a.ts',
    loc: { start: { column: 1, line: 3 } },
    message: 'Problem.',
    ruleId: 'demo/rule',
    severity: 'warn',
    ...overrides,
  }
}

describe('findings', () => {
  it('puts errors first and gives a file-wide diagnostic line 1', () => {
    const findings = toFindings([
      diagnostic({ filePath: 'src/b.ts' }),
      diagnostic({ filePath: 'src/c.ts', severity: 'error' }),
      diagnostic({ loc: undefined }),
    ], identity)

    expect(findings.map(finding => `${finding.severity} ${finding.path}:${finding.line}`)).toEqual([
      'error src/c.ts:3',
      'warn src/a.ts:1',
      'warn src/b.ts:3',
    ])
  })

  it('reads the suggestion from evidence', () => {
    const findings = toFindings([
      diagnostic({ evidence: { suggestion: ' Inline the helper. ' } }),
      diagnostic({ evidence: { suggestion: 42 } }),
    ], identity)

    expect(findings[0]?.suggestion).toBe('Inline the helper.')
    expect(findings[1]?.suggestion).toBeUndefined()
    expect(toAnnotations(findings)[0]).toEqual({
      annotation_level: 'warning',
      end_line: 3,
      message: 'Problem.\n\nInline the helper.',
      path: 'src/a.ts',
      start_line: 3,
      title: 'demo/rule',
    })
  })

  it('reads the suggestion from a Suggestion paragraph of the message', () => {
    const findings = toFindings([
      diagnostic({ message: 'Two layers are mixed.\nSuggestion: Extract the storage calls.' }),
      diagnostic({ evidence: { suggestion: 'From evidence.' }, message: 'Two layers are mixed.\nSuggestion: From message.' }),
    ], identity)

    expect(findings[0]?.message).toBe('Two layers are mixed.')
    expect(findings[0]?.suggestion).toBe('Extract the storage calls.')
    expect(findings[1]?.message).toBe('Two layers are mixed.')
    expect(findings[1]?.suggestion).toBe('From evidence.')
  })

  it('states the rule runs and the tokens of a run', () => {
    const usage = { inputTokens: 1000, outputTokens: 234 }

    expect(formatUsage({ execution: { cached: 12, completed: 1 }, usage })).toBe('1 rule run, 12 cached · 1,000 input / 234 output tokens')
    expect(formatUsage({ usage })).toBe('1,000 input / 234 output tokens')
  })

  it('fails the check only when a finding is an error', () => {
    const warnings = toFindings([diagnostic({})], identity)
    const errors = toFindings([diagnostic({}), diagnostic({ severity: 'error' })], identity)

    expect(toConclusion([])).toBe('success')
    expect(toConclusion(warnings)).toBe('neutral')
    expect(toConclusion(errors)).toBe('failure')
    expect(formatTitle([])).toBe('No findings')
    expect(formatTitle(errors)).toBe('1 error, 1 warning')
  })

  it('formats a table row that stays in one cell', () => {
    const findings = toFindings([
      diagnostic({ evidence: { suggestion: 'Use a | b.' }, message: 'First line.\nSecond line.', severity: 'error' }),
    ], identity)
    const summary = formatSummary(findings, { ...context, runUrl: 'https://github.com/acme/app/actions/runs/7' })

    expect(summary.startsWith(summaryMarker)).toBe(true)
    expect(summary).toContain('### ❌ alint · 1 error')
    expect(summary).toContain('| ❌ | [`src/a.ts:3`](https://github.com/acme/app/blob/0123456789abcdef/src/a.ts#L3) | `demo/rule` | First line. Second line.<br><sub>💡 Use a \\| b.</sub> |')
    expect(summary).toContain('<sub>Commit `0123456` · [run](https://github.com/acme/app/actions/runs/7) · 1,000 input / 234 output tokens</sub>')
  })

  it('formats a clean result without a table', () => {
    const summary = formatSummary([], context)

    expect(summary).toContain('### ✅ alint · No findings')
    expect(summary).toContain('Checked the changes at `0123456`.')
    expect(summary).not.toContain('| --- |')
  })

  it('caps the table and reports the remaining findings', () => {
    const findings = toFindings(
      Array.from({ length: 103 }, (_, index) => diagnostic({ loc: { start: { column: 1, line: index + 1 } } })),
      identity,
    )
    const summary = formatSummary(findings, context)

    expect(summary.split('\n').filter(line => line.startsWith('| ⚠️'))).toHaveLength(100)
    expect(summary).toContain('3 more findings are in the check annotations.')
  })
})

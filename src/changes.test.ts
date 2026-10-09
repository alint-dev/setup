import type { Diagnostic } from './output'

import { describe, expect, it } from 'vitest'

import { filterToChangedLines, parsePatch, toChangedLines } from './changes'

function diagnostic(filePath: string, line?: number, endLine?: number): Diagnostic {
  return {
    filePath,
    loc: line === undefined
      ? undefined
      : { end: endLine === undefined ? undefined : { column: 1, line: endLine }, start: { column: 1, line } },
    message: 'Problem.',
    ruleId: 'demo/rule',
    severity: 'warn',
  }
}

describe('changed lines', () => {
  it('reads the new-file ranges from hunk headers', () => {
    const patch = [
      '@@ -1,2 +1,3 @@ export function a() {',
      ' context',
      '+added',
      '@@ -10 +11 @@',
      '-old',
      '+new',
      '@@ -20,2 +20,0 @@',
      '-removed',
    ].join('\n')

    expect(parsePatch(patch)).toEqual([
      { endLine: 3, startLine: 1 },
      { endLine: 11, startLine: 11 },
    ])
  })

  it('ignores removed files and keeps each line of a file without a patch', () => {
    const changedLines = toChangedLines([
      { filename: 'src/a.ts', patch: '@@ -1 +1,2 @@', status: 'modified' },
      { filename: 'src/big.ts', status: 'modified' },
      { filename: 'src/gone.ts', patch: '@@ -1 +0,0 @@', status: 'removed' },
    ])

    expect([...changedLines.entries()]).toEqual([
      ['src/a.ts', [{ endLine: 2, startLine: 1 }]],
      ['src/big.ts', 'all'],
    ])
  })

  it('keeps diagnostics on changed lines and file-wide diagnostics', () => {
    const changedLines = toChangedLines([
      { filename: 'src/a.ts', patch: '@@ -5,0 +5,2 @@', status: 'modified' },
      { filename: 'src/big.ts', status: 'modified' },
    ])
    const kept = filterToChangedLines([
      diagnostic('src/a.ts', 5),
      diagnostic('src/a.ts', 7),
      diagnostic('src/a.ts', 3, 5),
      diagnostic('src/a.ts'),
      diagnostic('src/big.ts', 900),
      diagnostic('src/other.ts', 5),
    ], changedLines, filePath => filePath)

    expect(kept.map(item => `${item.filePath}:${item.loc?.start.line ?? 'file'}`)).toEqual([
      'src/a.ts:5',
      'src/a.ts:3',
      'src/a.ts:file',
      'src/big.ts:900',
    ])
  })
})

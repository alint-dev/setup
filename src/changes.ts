import type { Diagnostic } from './output'

/** Changed lines of each file. `all` means that GitHub did not send a patch, so each line counts. */
export type ChangedLines = ReadonlyMap<string, 'all' | readonly LineRange[]>

export interface LineRange {
  endLine: number
  startLine: number
}

export interface PullRequestFile {
  filename: string
  /** GitHub omits the patch of a binary file and of a very large diff. */
  patch?: string
  status: string
}

const hunkHeader = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/u

/** Keeps file-wide diagnostics and diagnostics whose location intersects a changed line. */
export function filterToChangedLines(
  diagnostics: readonly Diagnostic[],
  changedLines: ChangedLines,
  toRepositoryPath: (filePath: string) => string,
): Diagnostic[] {
  return diagnostics.filter((diagnostic) => {
    const ranges = changedLines.get(toRepositoryPath(diagnostic.filePath))

    if (ranges === undefined) {
      return false
    }

    if (ranges === 'all' || diagnostic.loc === undefined) {
      return true
    }

    const startLine = diagnostic.loc.start.line
    const endLine = diagnostic.loc.end?.line ?? startLine

    return ranges.some(range => startLine <= range.endLine && endLine >= range.startLine)
  })
}

/** Reads the new-file line ranges from the hunk headers of a unified diff. */
export function parsePatch(patch: string): LineRange[] {
  const ranges: LineRange[] = []

  for (const line of patch.split('\n')) {
    const match = hunkHeader.exec(line)

    if (match === null) {
      continue
    }

    const startLine = Number(match[1])
    // A hunk header without a count covers one line. A count of 0 is a deletion with no new lines.
    const count = match[2] === undefined ? 1 : Number(match[2])

    if (count > 0) {
      ranges.push({ endLine: startLine + count - 1, startLine })
    }
  }

  return ranges
}

export function toChangedLines(files: readonly PullRequestFile[]): ChangedLines {
  return new Map(
    files
      .filter(file => file.status !== 'removed')
      .map(file => [file.filename, file.patch === undefined ? 'all' : parsePatch(file.patch)]),
  )
}

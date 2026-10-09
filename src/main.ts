import type { InferOutput } from 'valibot'

import type { ChangedFile, ChangedLines } from './changes'
import type { Repository } from './github'
import type { RunResult } from './output'

import { existsSync } from 'node:fs'
import { appendFile, readFile } from 'node:fs/promises'

import { relative, resolve } from 'pathe'
import { number, object, optional, parse, string } from 'valibot'

import { filterToChangedLines, toChangedLines } from './changes'
import { formatSummary, formatTitle, formatUsage, toAnnotations, toConclusion, toFindings } from './findings'
import { listComparedFiles, listPullRequestFiles, publishCheckRun, publishSummaryComment } from './github'
import { runAlint } from './lint'

type Event = InferOutput<typeof eventSchema>

interface Scope {
  /** Present when the scope is the changes of a pull request or a push. */
  changedLines?: ChangedLines
  targets: string[]
}

// The part of the pull request and push event payloads that this action reads.
const eventSchema = object({
  after: optional(string()),
  before: optional(string()),
  pull_request: optional(object({ head: object({ sha: string() }), number: number() })),
  repository: optional(object({ default_branch: string() })),
})

// Git uses this id for the missing side when a push creates or deletes a branch.
const zeroCommit = /^0+$/u

export async function run(env: NodeJS.ProcessEnv, cwd: string): Promise<void> {
  const repository: Repository = {
    apiUrl: env.GITHUB_API_URL ?? 'https://api.github.com',
    repository: required(env, 'GITHUB_REPOSITORY'),
    token: required(env, 'GITHUB_TOKEN'),
  }
  const workspace = env.GITHUB_WORKSPACE ?? cwd
  const serverUrl = env.GITHUB_SERVER_URL ?? 'https://github.com'
  const event = await readEvent(env.GITHUB_EVENT_PATH)
  const pullRequest = event.pull_request
  // On a pull request event, GITHUB_SHA is the temporary merge commit.
  // A check run on that commit does not show on the pull request, so the head commit comes first.
  const sha = pullRequest?.head.sha ?? required(env, 'GITHUB_SHA')
  const toRepositoryPath = (filePath: string) => relative(workspace, resolve(cwd, filePath))

  const scope = await resolveScope(repository, event, env.INPUT_FILES ?? '', cwd, workspace)
  const result: RunResult = scope.targets.length === 0
    ? { diagnostics: [], usage: { inputTokens: 0, outputTokens: 0 } }
    : await runAlint(required(env, 'ALINT_COMMAND'), scope.targets, cwd)
  const diagnostics = scope.changedLines === undefined
    ? result.diagnostics
    : filterToChangedLines(result.diagnostics, scope.changedLines, toRepositoryPath)

  const findings = toFindings(diagnostics, toRepositoryPath)
  const title = formatTitle(findings)
  const summary = formatSummary(findings, {
    repository: repository.repository,
    runUrl: env.GITHUB_RUN_ID === undefined ? undefined : `${serverUrl}/${repository.repository}/actions/runs/${env.GITHUB_RUN_ID}`,
    serverUrl,
    sha,
    usage: formatUsage(result),
  })

  if (env.GITHUB_STEP_SUMMARY !== undefined) {
    await appendFile(env.GITHUB_STEP_SUMMARY, `${summary}\n`)
  }

  if (env.GITHUB_OUTPUT !== undefined) {
    const errors = findings.filter(finding => finding.severity === 'error').length

    await appendFile(env.GITHUB_OUTPUT, `errors=${errors}\nwarnings=${findings.length - errors}\n`)
  }

  await publishCheckRun(repository, {
    annotations: toAnnotations(findings),
    conclusion: toConclusion(findings),
    name: env.INPUT_CHECK_NAME || 'alint',
    sha,
    summary,
    title,
  })

  if (pullRequest !== undefined) {
    await publishSummaryComment(repository, pullRequest.number, summary, findings.length > 0)
  }

  console.info(`Published ${title.toLowerCase()} to ${repository.repository}@${sha.slice(0, 7)}.`)
}

/** Lists the files that the event changed. `undefined` means that the event has no changes, for example a manual run. */
async function listChangedFiles(repository: Repository, event: Event): Promise<ChangedFile[] | undefined> {
  if (event.pull_request !== undefined) {
    return listPullRequestFiles(repository, event.pull_request.number)
  }

  if (event.before === undefined || event.after === undefined) {
    return undefined
  }

  // A push that deletes a branch has no commit to read.
  if (zeroCommit.test(event.after)) {
    return []
  }

  // A push that creates a branch has no previous commit, so the default branch is the base.
  const base = zeroCommit.test(event.before) ? event.repository?.default_branch : event.before

  return base === undefined ? undefined : listComparedFiles(repository, base, event.after)
}

async function readEvent(eventPath: string | undefined): Promise<Event> {
  return eventPath === undefined
    ? {}
    : parse(eventSchema, JSON.parse(await readFile(eventPath, 'utf8')))
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]

  if (!value) {
    throw new Error(`${name} is not set.`)
  }

  return value
}

/**
 * Selects what alint reads.
 *
 * Explicit files win. A pull request or a push without explicit files gets its changed files,
 * and the result keeps only the changed lines. Other events get the whole working directory.
 */
async function resolveScope(
  repository: Repository,
  event: Event,
  files: string,
  cwd: string,
  workspace: string,
): Promise<Scope> {
  const explicit = files.split(/\s+/u).filter(Boolean)

  if (explicit.length > 0) {
    return { targets: explicit }
  }

  const changedFiles = await listChangedFiles(repository, event)

  if (changedFiles === undefined) {
    return { targets: ['.'] }
  }

  const changedLines = toChangedLines(changedFiles)
  const targets = [...changedLines.keys()]
    .map(path => relative(cwd, resolve(workspace, path)))
    // A file outside the working directory belongs to another project. A file that the checkout does not have cannot be read.
    .filter(path => !path.startsWith('..') && existsSync(resolve(cwd, path)))

  return { changedLines, targets }
}

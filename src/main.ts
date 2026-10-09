import type { ChangedLines } from './changes'
import type { Repository } from './github'

import { existsSync } from 'node:fs'
import { appendFile, readFile } from 'node:fs/promises'

import { relative, resolve } from 'pathe'
import { number, object, optional, parse, string } from 'valibot'

import { filterToChangedLines, toChangedLines } from './changes'
import { formatSummary, formatTitle, toAnnotations, toConclusion, toFindings } from './findings'
import { listPullRequestFiles, publishCheckRun, publishSummaryComment } from './github'
import { runAlint } from './lint'

interface PullRequest {
  number: number
  sha: string
}

interface Scope {
  /** Present when the scope is the changes of a pull request. */
  changedLines?: ChangedLines
  targets: string[]
}

const eventSchema = object({
  pull_request: optional(object({ head: object({ sha: string() }), number: number() })),
})

export async function run(env: NodeJS.ProcessEnv, cwd: string): Promise<void> {
  const repository: Repository = {
    apiUrl: env.GITHUB_API_URL ?? 'https://api.github.com',
    repository: required(env, 'GITHUB_REPOSITORY'),
    token: required(env, 'GITHUB_TOKEN'),
  }
  const workspace = env.GITHUB_WORKSPACE ?? cwd
  const serverUrl = env.GITHUB_SERVER_URL ?? 'https://github.com'
  const pullRequest = await readPullRequest(env.GITHUB_EVENT_PATH)
  // On a pull request event, GITHUB_SHA is the temporary merge commit.
  // A check run on that commit does not show on the pull request, so the head commit comes first.
  const sha = pullRequest?.sha ?? required(env, 'GITHUB_SHA')
  const toRepositoryPath = (filePath: string) => relative(workspace, resolve(cwd, filePath))

  const scope = await resolveScope(repository, pullRequest, env.INPUT_FILES ?? '', cwd, workspace)
  const result = scope.targets.length === 0
    ? { diagnostics: [], usage: { totalTokens: 0 } }
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
    totalTokens: result.usage.totalTokens,
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

async function readPullRequest(eventPath: string | undefined): Promise<PullRequest | undefined> {
  if (eventPath === undefined) {
    return undefined
  }

  const event = parse(eventSchema, JSON.parse(await readFile(eventPath, 'utf8')))

  return event.pull_request === undefined
    ? undefined
    : { number: event.pull_request.number, sha: event.pull_request.head.sha }
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
 * Explicit files win. A pull request without explicit files gets its changed files,
 * and the result keeps only the changed lines. Other events get the whole working directory.
 */
async function resolveScope(
  repository: Repository,
  pullRequest: PullRequest | undefined,
  files: string,
  cwd: string,
  workspace: string,
): Promise<Scope> {
  const explicit = files.split(/\s+/u).filter(Boolean)

  if (explicit.length > 0) {
    return { targets: explicit }
  }

  if (pullRequest === undefined) {
    return { targets: ['.'] }
  }

  const changedLines = toChangedLines(await listPullRequestFiles(repository, pullRequest.number))
  const targets = [...changedLines.keys()]
    .map(path => relative(cwd, resolve(workspace, path)))
    // A file outside the working directory belongs to another project. A file that the checkout does not have cannot be read.
    .filter(path => !path.startsWith('..') && existsSync(resolve(cwd, path)))

  return { changedLines, targets }
}

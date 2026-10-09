import type { AddressInfo } from 'node:net'

import type { PullRequestFile } from './changes'
import type { Diagnostic } from './output'

import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { summaryMarker } from './findings'
import { run } from './main'

interface FakeApi {
  comments?: Array<{ body: string, id: number }>
  files?: PullRequestFile[]
  status?: number
}

interface RecordedRequest {
  body?: Record<string, any>
  method: string
  url: string
}

const servers: Array<() => Promise<void>> = []

afterEach(async () => {
  await Promise.all(servers.splice(0).map(close => close()))
})

describe('action', () => {
  it('lints the changed files of a pull request and publishes the findings on changed lines', async () => {
    const api = await startGitHubApi({
      files: [
        { filename: 'src/a.ts', patch: '@@ -1,0 +2,2 @@', status: 'modified' },
        { filename: 'src/gone.ts', patch: '@@ -1 +0,0 @@', status: 'removed' },
        { filename: 'docs/missing.md', patch: '@@ -1 +1 @@', status: 'modified' },
      ],
    })
    const workspace = await createWorkspace({
      diagnostics: [warning('src/a.ts', 2), { ...warning('src/a.ts', 3), severity: 'error' }, warning('src/a.ts', 40)],
    })

    await run(environment(workspace, api.url), workspace)

    expect(await readArguments(workspace)).toEqual(['--format', 'json', 'src/a.ts'])
    expect(api.requests.map(request => `${request.method} ${request.url}`)).toEqual([
      'GET /repos/acme/app/pulls/12/files?per_page=100&page=1',
      'POST /repos/acme/app/check-runs',
      'GET /repos/acme/app/issues/12/comments?per_page=100&page=1',
      'POST /repos/acme/app/issues/12/comments',
    ])

    const checkRun = api.requests[1]?.body
    expect(checkRun?.name).toBe('alint')
    expect(checkRun?.conclusion).toBe('failure')
    // The event head commit wins over GITHUB_SHA, which is the merge commit on pull request events.
    expect(checkRun?.head_sha).toBe('abcdef0123')
    expect(checkRun?.output.title).toBe('1 error, 1 warning')
    expect(checkRun?.output.annotations.map((annotation: { path: string, start_line: number }) => `${annotation.path}:${annotation.start_line}`)).toEqual([
      'src/a.ts:3',
      'src/a.ts:2',
    ])

    const comment = api.requests[3]?.body?.body
    expect(comment).toContain(summaryMarker)
    expect(await readFile(join(workspace, 'summary.md'), 'utf8')).toBe(`${comment}\n`)
    expect(await readFile(join(workspace, 'output.txt'), 'utf8')).toBe('errors=1\nwarnings=1\n')
  })

  it('does not run alint when the pull request changed no file that exists', async () => {
    const api = await startGitHubApi({ comments: [{ body: `${summaryMarker}\nold`, id: 2 }], files: [] })
    const workspace = await createWorkspace({ diagnostics: [] })

    await run(environment(workspace, api.url), workspace)

    await expect(readArguments(workspace)).rejects.toThrow('ENOENT')
    expect(api.requests[1]?.body?.conclusion).toBe('success')
    // A comment that exists is rewritten with the clean result.
    expect(api.requests.at(-1)?.method).toBe('PATCH')
    expect(api.requests.at(-1)?.url).toBe('/repos/acme/app/issues/comments/2')
  })

  it('uses repository paths when the working directory is a subdirectory', async () => {
    const api = await startGitHubApi({
      files: [
        { filename: 'packages/app/src/a.ts', patch: '@@ -1 +1 @@', status: 'modified' },
        { filename: 'src/a.ts', patch: '@@ -1 +1 @@', status: 'modified' },
      ],
    })
    const workspace = await createWorkspace({ diagnostics: [warning('packages/app/src/a.ts', 1)] })
    const cwd = join(workspace, 'packages/app')

    await run(environment(workspace, api.url), cwd)

    expect(await readArguments(workspace)).toEqual(['--format', 'json', 'src/a.ts'])
    expect(api.requests[1]?.body?.output.annotations[0].path).toBe('packages/app/src/a.ts')
  })

  it('lints explicit files without the changed-line filter', async () => {
    const api = await startGitHubApi({})
    const workspace = await createWorkspace({ diagnostics: [warning('src/a.ts', 40)] })

    await run({ ...environment(workspace, api.url), INPUT_CHECK_NAME: 'alint (docs)', INPUT_FILES: 'src\ndocs' }, workspace)

    expect(await readArguments(workspace)).toEqual(['--format', 'json', 'src', 'docs'])
    expect(api.requests[0]?.url).toBe('/repos/acme/app/check-runs')
    expect(api.requests[0]?.body?.name).toBe('alint (docs)')
    expect(api.requests[0]?.body?.output.annotations).toHaveLength(1)
  })

  it('lints the working directory and writes no comment outside a pull request', async () => {
    const api = await startGitHubApi({})
    const workspace = await createWorkspace({ diagnostics: [warning('src/a.ts', 40)] })

    await run({ ...environment(workspace, api.url), GITHUB_EVENT_PATH: join(workspace, 'push.json') }, workspace)

    expect(await readArguments(workspace)).toEqual(['--format', 'json', '.'])
    expect(api.requests.map(request => `${request.method} ${request.url}`)).toEqual(['POST /repos/acme/app/check-runs'])
    expect(api.requests[0]?.body?.head_sha).toBe('push-commit')
  })

  it('sends annotations above the request limit in update requests', async () => {
    const api = await startGitHubApi({})
    const workspace = await createWorkspace({
      diagnostics: Array.from({ length: 120 }, (_, index) => warning('src/a.ts', index + 1)),
    })

    await run({ ...environment(workspace, api.url), INPUT_FILES: 'src' }, workspace)

    expect(api.requests.slice(0, 3).map(request => `${request.method} ${request.url}`)).toEqual([
      'POST /repos/acme/app/check-runs',
      'PATCH /repos/acme/app/check-runs/77',
      'PATCH /repos/acme/app/check-runs/77',
    ])
    expect(api.requests.slice(0, 3).map(request => request.body?.output.annotations.length)).toEqual([50, 50, 20])
  })

  it('fails when alint cannot complete the run', async () => {
    const api = await startGitHubApi({})
    const workspace = await createWorkspace({ diagnostics: [], exitCode: 2, stderr: 'No provider is configured.' })

    await expect(run({ ...environment(workspace, api.url), INPUT_FILES: 'src' }, workspace))
      .rejects
      .toThrow('alint exited with code 2.\nNo provider is configured.')
    expect(api.requests).toEqual([])
  })

  it('fails when GitHub rejects the request', async () => {
    const api = await startGitHubApi({ status: 403 })
    const workspace = await createWorkspace({ diagnostics: [] })

    await expect(run({ ...environment(workspace, api.url), INPUT_FILES: 'src' }, workspace))
      .rejects
      .toThrow('GitHub POST /check-runs failed with 403')
  })
})

/**
 * Creates a repository checkout with a program that stands in for alint.
 *
 * The program records its arguments and prints the prepared result, so the tests
 * run the real process boundary without a model provider.
 */
async function createWorkspace(result: { diagnostics: Diagnostic[], exitCode?: number, stderr?: string }): Promise<string> {
  const workspace = await mkdtemp(join(tmpdir(), 'alint-setup-'))

  await mkdir(join(workspace, 'packages/app/src'), { recursive: true })
  await mkdir(join(workspace, 'src'), { recursive: true })
  await writeFile(join(workspace, 'src/a.ts'), '')
  await writeFile(join(workspace, 'packages/app/src/a.ts'), '')
  await writeFile(join(workspace, 'event.json'), JSON.stringify({ pull_request: { head: { sha: 'abcdef0123' }, number: 12 } }))
  await writeFile(join(workspace, 'push.json'), JSON.stringify({ ref: 'refs/heads/main' }))
  await writeFile(join(workspace, 'result.json'), JSON.stringify({
    exitCode: result.exitCode ?? 0,
    stderr: result.stderr ?? '',
    stdout: JSON.stringify({
      diagnostics: result.diagnostics.map(diagnostic => ({ ...diagnostic, filePath: join(workspace, diagnostic.filePath) })),
      usage: { inputTokens: 10, outputTokens: 5, records: [], totalTokens: 15 },
    }),
  }))
  await writeFile(join(workspace, 'alint'), [
    '#!/usr/bin/env node',
    'const { readFileSync, writeFileSync } = require("node:fs")',
    'const { join } = require("node:path")',
    'const result = JSON.parse(readFileSync(join(__dirname, "result.json"), "utf8"))',
    'writeFileSync(join(__dirname, "arguments.json"), JSON.stringify(process.argv.slice(2)))',
    'process.stdout.write(result.stdout)',
    'process.stderr.write(result.stderr)',
    'process.exitCode = result.exitCode',
  ].join('\n'))
  await chmod(join(workspace, 'alint'), 0o755)

  return workspace
}

function environment(workspace: string, apiUrl: string): NodeJS.ProcessEnv {
  return {
    ALINT_COMMAND: join(workspace, 'alint'),
    GITHUB_API_URL: apiUrl,
    GITHUB_EVENT_PATH: join(workspace, 'event.json'),
    GITHUB_OUTPUT: join(workspace, 'output.txt'),
    GITHUB_REPOSITORY: 'acme/app',
    GITHUB_SHA: 'push-commit',
    GITHUB_STEP_SUMMARY: join(workspace, 'summary.md'),
    GITHUB_TOKEN: 'test-token',
    GITHUB_WORKSPACE: workspace,
  }
}

async function readArguments(workspace: string): Promise<string[]> {
  return JSON.parse(await readFile(join(workspace, 'arguments.json'), 'utf8'))
}

async function startGitHubApi(options: FakeApi) {
  const requests: RecordedRequest[] = []
  const server = createServer((request, response) => {
    let text = ''

    request.on('data', chunk => text += chunk)
    request.on('end', () => {
      const url = request.url ?? ''

      requests.push({ body: text === '' ? undefined : JSON.parse(text), method: request.method ?? '', url })
      response.writeHead(options.status ?? 200, { 'Content-Type': 'application/json' })

      if (request.method !== 'GET') {
        response.end(JSON.stringify({ id: 77 }))
        return
      }

      response.end(JSON.stringify(url.includes('/pulls/') ? options.files ?? [] : options.comments ?? []))
    })
  })

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  servers.push(() => new Promise(resolve => server.close(() => resolve())))

  return { requests, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }
}

function warning(filePath: string, line: number): Diagnostic {
  return {
    filePath,
    loc: { start: { column: 1, line } },
    message: `Problem at line ${line}.`,
    ruleId: 'demo/rule',
    severity: 'warn',
  }
}

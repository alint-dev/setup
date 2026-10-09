# alint-dev/setup

GitHub Action that runs [`alint`](https://github.com/alint-dev/alint) on a pull request and publishes the result.

The action does these steps:

1. Installs `alint`.
2. Writes the model provider configuration.
3. Restores the `alint` cache.
4. Lints the changed files of the pull request and keeps the findings on changed lines.
5. Publishes a check run with line annotations, one summary comment, and a job summary.

## Usage

```yaml
name: alint

on:
  pull_request:

jobs:
  alint:
    runs-on: ubuntu-latest
    permissions:
      checks: write
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@v6
      - uses: alint-dev/setup@main
        with:
          provider-endpoint: https://api.openai.com/v1
          provider-model: gpt-5.4-mini
          api-key: ${{ secrets.OPENAI_API_KEY }}
```

If the `alint` configuration imports packages, install the project dependencies before this action.

## Inputs

| Input | Default | Description |
| --- | --- | --- |
| `version` | | Version of `@alint-js/cli` to install. When empty, the action uses the `alint` in `node_modules`, or installs the latest version. |
| `provider-endpoint` | | Endpoint of an OpenAI-compatible model provider. When empty, the action does not write provider configuration. |
| `provider-model` | | Model id for the provider. Required with `provider-endpoint`. |
| `api-key` | | API key for the provider. The action sends it as a Bearer token. |
| `files` | | Files or directories to lint, separated by spaces or lines. |
| `working-directory` | `.` | Directory that contains the `alint` configuration. |
| `check-name` | `alint` | Name of the check run. |
| `github-token` | `github.token` | Token that creates the check run and the summary comment. |

## Outputs

| Output | Description |
| --- | --- |
| `errors` | Number of error findings. |
| `warnings` | Number of warning findings. |

## Behavior

- The check run fails when a finding is an error. It is neutral when there are only warnings, and it passes when there are no findings.
- The step itself fails only when `alint` cannot complete the run or GitHub rejects a request.
- Each run rewrites the same summary comment. A pull request that never had findings gets no comment.
- On a pull request, the action reads the changed files from the GitHub API. The checkout does not need the full history.
- When `files` is set, the action lints those files and keeps each finding.
- On other events, the action lints the working directory and writes no comment.
- A pull request from a fork gets no secrets and a read-only token. The action skips it with a notice.

## When not to use it

Do not use this action for local runs or for a CI system other than GitHub Actions. Run the `alint` CLI there.

## Development

```bash
pnpm install
pnpm test:run
pnpm build
```

The action runs `dist/index.mjs`. Run `pnpm build` and commit `dist` with each source change. CI fails when `dist` does not match the source.

The `e2e` job runs the action on `test/fixture`. Its rule does not call a model, so the job needs no provider.

## License

MIT

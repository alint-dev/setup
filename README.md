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
| `provider-endpoint` | | Endpoint of an OpenAI-compatible model provider. |
| `provider-model` | | Model id for the provider. Required with `provider-endpoint`. |
| `api-key` | | API key for the provider. The action sends it as a Bearer token. |
| `provider-config` | | Complete provider configuration in TOML. Use it instead of `provider-endpoint`. |
| `files` | | Files or directories to lint, separated by spaces or lines. |
| `working-directory` | `.` | Directory that contains the `alint` configuration. |
| `check-name` | `alint` | Name of the check run. |
| `github-token` | `github.token` | Token that creates the check run and the summary comment. |

When `provider-endpoint` and `provider-config` are empty, the action does not write provider configuration.

### Provider configuration

`provider-endpoint` writes one model with no other properties. Use `provider-config` when a rule requests a model by alias or by capability, or when the model needs default parameters:

```yaml
- uses: alint-dev/setup@main
  with:
    provider-config: |
      version = 1

      [[providers]]
      id = "deepseek"
      type = "openai-compatible"
      endpoint = "https://api.deepseek.com/v1"

      [providers.headers]
      Authorization = "Bearer ${{ secrets.DEEPSEEK_API_KEY }}"

      [[providers.models]]
      id = "deepseek-flash"
      size = "small"
      aliases = [ "default" ]
      capabilities = [ "tool-call" ]

      [providers.models.default_params]
      thinking = { type = "disabled" }
```

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
- On a push, the action lints the files that the push changed and writes no comment. A new branch is compared with the default branch.
- On other events, for example a manual run, the action lints the working directory.
- When `files` is set, the action lints those files and keeps each finding.
- A pull request from a fork gets no secrets and a read-only token. The action skips it with a notice.
- With `provider-endpoint`, an empty `api-key` also skips the action. A Dependabot pull request has no access to secrets, for example. With `provider-config`, add your own `if` condition for such runs.

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

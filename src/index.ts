import process from 'node:process'

import { errorMessageFrom } from '@moeru/std'

import { run } from './main'

run(process.env, process.cwd()).catch((error: unknown) => {
  // https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions#setting-an-error-message
  console.error(`::error title=alint::${(errorMessageFrom(error) ?? 'unknown error').replaceAll('\n', '%0A')}`)
  process.exitCode = 1
})

// A rule that does not call a model, so the end-to-end workflow needs no provider.
export default [{
  files: ['**/*.ts'],
  ignores: ['alint.config.ts'],
  plugins: {
    fixture: {
      rules: {
        'no-fixme': {
          create: context => ({
            onTargetFile: async (target) => {
              const file = await context.src.readFile(target.file)

              file.lines.forEach((line, index) => {
                if (line.includes('FIXME')) {
                  context.report({
                    evidence: { suggestion: 'Resolve the note or remove it.' },
                    filePath: target.file.path,
                    loc: { start: { column: 1, line: index + 1 } },
                    message: 'A FIXME note is in the changed code.',
                  })
                }
              })
            },
          }),
        },
      },
    },
  },
  rules: { 'fixture/no-fixme': 'warn' },
}]

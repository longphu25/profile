const quote = (value) => JSON.stringify(value)

const isE2eTest = (file) => {
  const normalized = file.replaceAll('\\', '/')
  return normalized.startsWith('tests/e2e/') || normalized.includes('/tests/e2e/')
}

export default {
  '*.{ts,tsx,js,jsx}': (files) => {
    const commands = []
    const biomeFiles = files.filter((file) => !isE2eTest(file))

    if (biomeFiles.length > 0) {
      commands.push(`biome format --write ${biomeFiles.map(quote).join(' ')}`)
    }

    commands.push(`eslint --fix ${files.map(quote).join(' ')}`)
    return commands
  },
}

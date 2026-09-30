// Keeps every workspace package version in sync with the root version.
// Runs as release-it's after:bump hook so the bumps land in the release commit.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = JSON.parse(readFileSync('package.json', 'utf8'))

for (const dir of ['apps', 'packages']) {
  let entries = []
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    continue
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const file = join(dir, entry.name, 'package.json')
    try {
      const pkg = JSON.parse(readFileSync(file, 'utf8'))
      if (pkg.version === root.version) continue
      pkg.version = root.version
      writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
      console.log(`${pkg.name ?? entry.name}: -> ${root.version}`)
    } catch {
      // no package.json or not parseable — skip
    }
  }
}

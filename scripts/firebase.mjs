// Runs the project's pinned firebase-tools with Java on PATH. Homebrew's openjdk@21 is
// keg-only, so `java` often isn't found even when it's installed.
//   node scripts/firebase.mjs emulators:start …
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = { ...process.env }

function hasJava(pathValue) {
  return spawnSync('java', ['-version'], { env: { ...env, PATH: pathValue }, stdio: 'ignore' }).status === 0
}

if (!hasJava(env.PATH ?? '')) {
  const candidates = [
    env.JAVA_HOME && join(env.JAVA_HOME, 'bin'),
    '/opt/homebrew/opt/openjdk@21/bin',
    '/opt/homebrew/opt/openjdk/bin',
    '/usr/local/opt/openjdk@21/bin',
    '/usr/local/opt/openjdk/bin',
  ].filter(Boolean)
  const found = candidates.find((dir) => existsSync(join(dir, 'java')))
  if (!found) {
    console.error('The Firebase emulators need Java 21+. Install it with `brew install openjdk@21` (or any JDK 21) and try again.')
    process.exit(1)
  }
  env.PATH = `${found}:${env.PATH ?? ''}`
}

const bin = join(root, 'node_modules', '.bin', 'firebase')
const child = spawn(bin, [...process.argv.slice(2), '--project', 'demo-bara'], { cwd: root, env, stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 1))

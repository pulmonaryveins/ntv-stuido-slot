// Compresses the optional scenery model into public/models/town.glb.
// Usage: npm run glb:compress -- [input.glb]   (default: ./mining_town.glb)
import { spawnSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'

const input = process.argv[2] ?? 'mining_town.glb'
const output = 'public/models/town.glb'

if (!existsSync(input)) {
  console.error(`Input not found: ${input}`)
  process.exit(1)
}

const result = spawnSync(
  'npx',
  ['gltf-transform', 'optimize', input, output, '--compress', 'meshopt', '--texture-compress', 'webp'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
)
if (result.status !== 0) process.exit(result.status ?? 1)

const mb = (p) => (statSync(p).size / 1024 / 1024).toFixed(2)
console.log(`${input} ${mb(input)} MB -> ${output} ${mb(output)} MB`)

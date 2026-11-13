// Puts the body-tracking files where the app serves them, so nothing is loaded
// from a CDN while a child plays:
//   public/mediapipe/wasm/                     copied from node_modules on every install (git-ignored)
//   public/mediapipe/pose_landmarker_lite.task downloaded once and committed
// Run: node scripts/fetch-pose-assets.mjs   (also runs after `npm install`)
import { cp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const wasmFrom = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const target = join(root, 'public/mediapipe')
const model = join(target, 'pose_landmarker_lite.task')
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

const exists = path => stat(path).then(() => true, () => false)

await mkdir(target, { recursive: true })

if (await exists(wasmFrom)) {
  // Only the pair FilesetResolver.forVisionTasks() loads (vision_wasm_internal.*): the package also has a
  // "_module_" build for module workers, another 15 MB the game never asks for
  await rm(join(target, 'wasm'), { recursive: true, force: true })
  await cp(wasmFrom, join(target, 'wasm'), {
    recursive: true,
    filter: source => !basename(source).includes('_module_'),
  })
  console.log('pose assets: copied wasm files')
} else {
  console.error(`pose assets: ${wasmFrom} is missing; run npm install first`)
  process.exit(1)
}

if (await exists(model)) {
  console.log('pose assets: model already present')
} else {
  try {
    const response = await fetch(MODEL_URL)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await writeFile(model, Buffer.from(await response.arrayBuffer()))
    console.log('pose assets: downloaded the pose model')
  } catch (e) {
    console.error(`pose assets: could not download the model (${e.message}).`)
    console.error(`Download it by hand from\n  ${MODEL_URL}\nand save it as\n  ${model}`)
    process.exit(1)
  }
}

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

try {
  // Remove pnpm-lock.yaml if it exists
  const lockfilePath = path.join(process.cwd(), 'pnpm-lock.yaml')
  if (fs.existsSync(lockfilePath)) {
    fs.unlinkSync(lockfilePath)
    console.log('[v0] Removed pnpm-lock.yaml')
  }

  // Run pnpm install
  console.log('[v0] Running pnpm install...')
  execSync('pnpm install', { stdio: 'inherit' })
  console.log('[v0] pnpm install completed successfully')
} catch (error) {
  console.error('[v0] Error during lockfile regeneration:', error.message)
  process.exit(1)
}

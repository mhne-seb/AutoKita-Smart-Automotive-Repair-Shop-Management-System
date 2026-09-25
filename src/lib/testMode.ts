import fs from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'src', 'config', 'test-mode.json')

export function isVerificationBypassed(): boolean {
  if (process.env.BYPASS_VERIFICATION === 'true' || process.env.BYPASS_VERIFICATION === '1') {
    return true
  }
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8')
      const parsed = JSON.parse(content)
      return Boolean(parsed.bypassVerification)
    }
  } catch {
    // Return false on read error
  }
  return false
}

export function setVerificationBypassed(bypass: boolean): void {
  const dir = path.dirname(CONFIG_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ bypassVerification: bypass, updatedAt: new Date().toISOString() }, null, 2),
    'utf-8',
  )
}

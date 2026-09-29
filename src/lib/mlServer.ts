// Calls to the Python server (models/predict_server.py): the ML predictions
// and the email/PDF parser. Locally that's your laptop on port 5001; online
// it's the Render server, set with ML_SERVER_URL. The key is sent when
// ML_API_KEY is set (the same value must be set on the server).
const ML_SERVER = (process.env.ML_SERVER_URL || 'http://127.0.0.1:5001').replace(/\/$/, '')

// A sleeping free Render server takes about a minute to wake up, so wait
// almost as long as a Vercel function is allowed to run (maxDuration = 60).
const WAIT_MS = 55_000

// Thrown when the server answered but refused or failed, so callers can tell
// that apart from "couldn't reach it at all" (which is a plain fetch error).
export class MlServerError extends Error {
  constructor(public status: number, public detail?: string) {
    super(`ML server ${status}${detail ? `: ${detail}` : ''}`)
  }
}

// Throws when the server can't be reached, rejects our key, or fails (401,
// 5xx) — callers already treat a throw as "predictions unavailable". Other
// statuses (like 422 for a PDF it couldn't read) come back for the caller.
export async function mlFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (process.env.ML_API_KEY) headers.set('X-API-Key', process.env.ML_API_KEY)

  const res = await fetch(`${ML_SERVER}${path}`, { ...init, headers, signal: AbortSignal.timeout(WAIT_MS) })
  if (res.status === 401 || res.status >= 500) {
    const detail = await res.json().then((j) => j?.detail, () => undefined)
    throw new MlServerError(res.status, detail)
  }
  return res
}

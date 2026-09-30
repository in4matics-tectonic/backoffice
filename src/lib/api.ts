import type { User } from '../types'

// Token lives in sessionStorage only (gone when the tab closes); never in the bundle or localStorage.
const KEY = 'momentum.session'
const BASE = import.meta.env.VITE_API_URL ?? ''

interface Session { token: string; user: User; expiresAt: number }

let listeners: (() => void)[] = []
const notify = () => listeners.forEach((l) => l())

export function onSessionChange(fn: () => void) {
  listeners.push(fn)
  return () => { listeners = listeners.filter((l) => l !== fn) }
}

export function getSession(): Session | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as Session | null
    if (!s || s.expiresAt < Date.now()) return null
    return s
  } catch {
    return null
  }
}

export function logout() {
  sessionStorage.removeItem(KEY)
  notify()
}

export class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code }
}

export async function login(username: string, password: string) {
  const res = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error ?? 'login_failed')
  // The backoffice is for KBC staff only
  if (body.user?.role !== 'adviseur') throw new ApiError(403, 'not_adviseur')
  const session: Session = { token: body.token, user: body.user, expiresAt: Date.now() + (body.expiresIn - 30) * 1000 }
  sessionStorage.setItem(KEY, JSON.stringify(session))
  notify()
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const s = getSession()
  if (!s) { logout(); throw new ApiError(401, 'unauthorized') }
  const res = await fetch(`${BASE}/v1${path}`, {
    ...init,
    headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), authorization: `Bearer ${s.token}` },
  })
  if (res.status === 401) { logout(); throw new ApiError(401, 'unauthorized') }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, body?.error ?? 'request_failed')
  return body as T
}

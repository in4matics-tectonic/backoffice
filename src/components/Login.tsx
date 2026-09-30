import { useState } from 'react'
import { Lock } from 'lucide-react'
import kbcLogo from '../assets/kbc-logo.svg'
import { ApiError, login } from '../lib/api'

const FOUT: Record<string, string> = {
  invalid_credentials: 'Onjuiste gebruikersnaam of wachtwoord.',
  not_adviseur: 'Deze backoffice is enkel voor KBC-medewerkers.',
}

export function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBezig(true)
    setFout(null)
    try {
      await login(username.trim(), password)
    } catch (err) {
      const code = err instanceof ApiError ? err.code : ''
      setFout(FOUT[code] ?? (err instanceof ApiError && err.status === 429 ? 'Te veel pogingen, probeer over een minuut opnieuw.' : 'Aanmelden mislukt.'))
    } finally {
      setPassword('')
      setBezig(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-kbc-900 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <img src={kbcLogo} alt="KBC" className="size-12" />
          <div>
            <h1 className="text-lg font-semibold text-kbc-900">Momentum Backoffice</h1>
            <p className="text-sm text-slate-500">Enkel voor KBC-medewerkers</p>
          </div>
        </div>
        <label className="block text-sm">
          <span className="text-slate-600">Gebruikersnaam</span>
          <input autoFocus autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-kbc-400 focus:ring-2 focus:ring-kbc-100" />
        </label>
        <label className="block text-sm">
          <span className="text-slate-600">Wachtwoord</span>
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-kbc-400 focus:ring-2 focus:ring-kbc-100" />
        </label>
        {fout && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fout}</p>}
        <button disabled={bezig} className="w-full rounded-lg bg-kbc-800 py-2.5 font-medium text-white hover:bg-kbc-600 disabled:opacity-60">
          <span className="inline-flex items-center gap-2"><Lock size={14} /> {bezig ? 'Bezig…' : 'Aanmelden'}</span>
        </button>
        <p className="text-xs text-slate-400">Sessie verloopt na 1 uur. Alle raadplegingen worden gelogd.</p>
      </form>
    </div>
  )
}

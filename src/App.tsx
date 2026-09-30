import { useEffect, useState, useSyncExternalStore } from 'react'
import { LogOut, Radar as RadarIcon, ScrollText, Search, Users } from 'lucide-react'
import type { Demo, KlantKort, Momenten } from './types'
import { api, getSession, logout, onSessionChange } from './lib/api'
import { usePoll } from './lib/usePoll'
import { Login } from './components/Login'
import { KlantLijst, type KlantRij } from './components/KlantLijst'
import { Klantfiche } from './components/Klantfiche'
import { Afspeelbalk } from './components/Afspeelbalk'
import { Radar } from './components/Radar'
import { AuditLog } from './components/AuditLog'
import { Kaart } from './components/ui'
import kbcLogo from './assets/kbc-logo.svg'

const POLL_MS = 1500
type Pagina = 'radar' | 'klanten' | 'audit'

function useSession() {
  const session = useSyncExternalStore(onSessionChange, () => sessionStorage.getItem('momentum.session'))
  const s = session ? getSession() : null
  // Log out automatically when the token expires
  useEffect(() => {
    if (!s) return
    const t = setTimeout(logout, s.expiresAt - Date.now())
    return () => clearTimeout(t)
  }, [s?.expiresAt]) // eslint-disable-line react-hooks/exhaustive-deps
  return s
}

export default function App() {
  const session = useSession()
  return session ? <Dashboard gebruiker={session.user.sub} /> : <Login />
}

const NAV: { id: Pagina; label: string; icon: typeof Users }[] = [
  { id: 'radar', label: 'Moment Radar', icon: RadarIcon },
  { id: 'klanten', label: 'Klanten', icon: Users },
  { id: 'audit', label: 'Auditlog', icon: ScrollText },
]

function Dashboard({ gebruiker }: { gebruiker: string }) {
  const [pagina, setPagina] = useState<Pagina>('radar')
  const [gekozen, setGekozen] = useState<string | null>(null)
  const [zoek, setZoek] = useState('')

  // One live tick: demo clock + moments of every customer
  const { data, error } = usePoll(async () => {
    const [klanten, demo] = await Promise.all([
      api<KlantKort[]>('/klanten'),
      api<Demo>('/demo').catch(() => null), // demo routes are off outside DEMO_MODE
    ])
    const rijen: KlantRij[] = await Promise.all(
      klanten.map(async (k) => ({ ...k, momenten: (await api<Momenten>(`/klanten/${k.id}/momenten`)).momenten })),
    )
    return { rijen, demo }
  }, POLL_MS)

  const rijen = data?.rijen ?? []
  const week = data?.demo?.week ?? 0
  const actief = gekozen ?? rijen[0]?.id ?? null
  const klant = rijen.find((r) => r.id === actief)
  const openKlant = (id: string) => { setGekozen(id); setPagina('klanten') }

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="flex flex-col bg-kbc-800 p-4 text-white md:sticky md:top-0 md:h-screen">
        <div className="mb-6 flex items-center gap-3 px-1">
          <img src={kbcLogo} alt="KBC" className="size-10 rounded-lg bg-white p-0.5" />
          <span className="text-lg font-semibold">Kate Studio</span>
        </div>
        <nav className="flex gap-1 md:flex-col">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setPagina(n.id)}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm ${pagina === n.id ? 'bg-white/15 font-medium' : 'text-kbc-100/80 hover:bg-white/10'}`}>
              <n.icon size={16} /> {n.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto hidden space-y-3 md:block">
          <p className="rounded-xl bg-white/10 p-3 text-xs text-kbc-100/90">
            Van <b className="text-white">Next Best Offer</b> naar <b className="text-white">Next Best Moment</b>.
          </p>
          <div className="flex items-center justify-between px-1 text-xs text-kbc-100/80">
            <span>{gebruiker}</span>
            <button onClick={logout} className="inline-flex items-center gap-1 hover:text-white"><LogOut size={13} /> Afmelden</button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <span className={`size-2 rounded-full ${error ? 'bg-red-500' : 'animate-pulse bg-kbc-green'}`} />
            {error ? 'Verbinding verloren, opnieuw proberen…' : 'Live verbonden met Momentum API'}
          </p>
          <Afspeelbalk demo={data?.demo ?? null} />
          <button onClick={logout} className="inline-flex items-center gap-1 text-sm text-slate-600 md:hidden"><LogOut size={14} /> Afmelden</button>
        </div>

        <main className="mx-auto max-w-[1400px] p-6">
          {!data && <p className="text-slate-500">Laden…</p>}
          {data && pagina === 'radar' && <Radar rijen={rijen} week={week} openKlant={openKlant} />}
          {data && pagina === 'klanten' && (
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
              <aside className="space-y-2">
                <h1 className="mb-2 text-2xl font-semibold text-kbc-800">Klanten</h1>
                <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200 focus-within:ring-kbc-400">
                  <Search size={16} className="text-slate-400" />
                  <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek naam of klantnummer" className="w-full bg-transparent text-sm outline-none" />
                </label>
                <KlantLijst klanten={rijen} gekozen={actief} kies={setGekozen} zoek={zoek} />
              </aside>
              <div className="min-w-0">
                {klant && <Klantfiche key={klant.id} klantId={klant.id} momenten={klant.momenten} week={week} />}
              </div>
            </div>
          )}
          {data && pagina === 'audit' && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold text-kbc-800">Auditlog</h1>
              <p className="text-sm text-slate-500">Elke raadpleging van persoonsgegevens en elke wijziging wordt gelogd.</p>
              <Kaart><AuditLog max={100} /></Kaart>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

import { Bot, CheckCircle2, UserRound, Zap } from 'lucide-react'
import type { AgentBeslissing } from '../types'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { MOMENT_LABEL, pct } from '../lib/labels'

/**
 * KBC's next-best-channel agent for this customer: per life moment it decides whether Kate handles it on her own in
 * the app, or whether an adviser takes it (and leaves a task). The decision and its reasons come from the backend.
 */
export function AgentKaart({ klantId }: { klantId: string }) {
  const { data } = usePoll(() => api<AgentBeslissing[]>(`/klanten/${klantId}/agent`), 1500, [klantId])
  const beslissingen = data ?? []

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-semibold text-kbc-800"><Bot size={18} /> KBC Agent</h3>
        <span className="text-xs text-slate-500">Kiest per moment: Kate in de app, of een adviseur</span>
      </div>
      {beslissingen.length === 0 && (
        <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Nog niets te beslissen: geen enkel moment is zeker genoeg om de klant te benaderen.</p>
      )}
      <div className="space-y-3">
        {beslissingen.map((b) => <Beslissing key={b.id} b={b} />)}
      </div>
    </section>
  )
}

function Beslissing({ b }: { b: AgentBeslissing }) {
  const auto = b.kanaal === 'automatisch'
  const taak = b.status === 'taak'
  return (
    <article className={`rounded-xl p-4 ring-1 ${auto ? 'bg-kbc-green/5 ring-kbc-green/30' : taak ? 'bg-amber-50 ring-amber-300' : 'bg-slate-50 ring-slate-200'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-kbc-800">{MOMENT_LABEL[b.moment]} · {pct(b.score)}</p>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${auto ? 'bg-kbc-green/15 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
          {auto ? <><Zap size={13} /> Automatisch: Kate in de app</> : <><UserRound size={13} /> Adviseur in de lus</>}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-1.5 text-xs">
        <Balk label="Engagement via de app" waarde={b.engagement.app} aan={auto} />
        <Balk label="Engagement via een adviseur" waarde={b.engagement.adviseur} aan={!auto} />
      </div>

      <ul className="mt-3 space-y-0.5 text-xs text-slate-600">
        {b.redenen.map((r) => <li key={r}>· {r}</li>)}
      </ul>

      <p className={`mt-3 flex items-start gap-1.5 rounded-lg px-3 py-2 text-sm ${taak ? 'bg-amber-100 font-medium text-amber-950' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>
        {b.status === 'afgehandeld' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-kbc-green" /> : auto ? <Zap size={16} className="mt-0.5 shrink-0 text-kbc-green" /> : <UserRound size={16} className="mt-0.5 shrink-0" />}
        <span>{b.status === 'afgehandeld' ? `Afgehandeld door de adviseur. ${b.actie.replace(/^Taak voor de adviseur: /, '')}` : b.actie}</span>
      </p>
      {taak && b.voorstellen.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500">Voorstel van de agent:</span>
          {b.voorstellen.map((v) => <span key={v.id} className="rounded-full bg-white px-2 py-0.5 ring-1 ring-amber-300">{v.naam}</span>)}
        </div>
      )}
    </article>
  )
}

function Balk({ label, waarde, aan }: { label: string; waarde: number; aan: boolean }) {
  return (
    <>
      <span className={aan ? 'font-medium text-kbc-800' : 'text-slate-500'}>{label}</span>
      <div className="h-2 rounded-full bg-slate-200"><div className={`h-full rounded-full ${aan ? 'bg-kbc-600' : 'bg-slate-400'}`} style={{ width: pct(waarde) }} /></div>
      <b className={`tabular-nums ${aan ? 'text-kbc-800' : 'text-slate-500'}`}>{pct(waarde)}</b>
    </>
  )
}

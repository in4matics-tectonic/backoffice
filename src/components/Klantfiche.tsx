import { Check, CircleHelp, ShieldAlert, ShieldCheck, ShieldOff, Sparkles, Wallet } from 'lucide-react'
import type { Bron, Domein, Klant, Moment, Product, Rekening } from '../types'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { BRON_LABEL, DOMEIN_LABEL, eur, MOMENT_LABEL, pct } from '../lib/labels'
import { DOMEIN_ICON } from './icons'
import { ScoreMeter } from './ScoreMeter'
import { FaseBadge } from './FaseBadge'
import { ScoreVerloop } from './ScoreVerloop'
import { SignaalTijdlijn } from './SignaalTijdlijn'
import { AdviesKaart } from './AdviesKaart'
import { AuditLog } from './AuditLog'
import { Kaart } from './ui'

interface Profiel { klant: Klant; producten: Product[]; rekeningen: Rekening[] }

const STATUS = {
  geregeld: { icon: Check, cls: 'bg-kbc-green/15 text-green-800', label: 'geregeld' },
  kans: { icon: CircleHelp, cls: 'bg-slate-100 text-slate-500', label: 'kans' },
  nieuw: { icon: Sparkles, cls: 'bg-kbc-100 text-kbc-600', label: 'nieuw' },
}

export function Klantfiche({ klantId, momenten, week }: { klantId: string; momenten: Moment[]; week: number }) {
  // Profile changes rarely (consent toggles), so poll it slowly
  const { data: p } = usePoll<Profiel>(async () => {
    const [klant, producten, rekeningen] = await Promise.all([
      api<Klant>(`/klanten/${klantId}`),
      api<Product[]>(`/klanten/${klantId}/producten`),
      api<Rekening[]>(`/klanten/${klantId}/rekeningen`),
    ])
    return { klant, producten, rekeningen }
  }, 10000, [klantId])

  if (!p) return <div className="p-8 text-slate-500">Klantfiche laden…</div>
  const { klant } = p
  const saldo = p.rekeningen.reduce((s, r) => s + r.saldo, 0)
  const nieuw = new Set(momenten.flatMap((m) => m.acties.map((a) => a.domein)))

  return (
    <div className="space-y-4">
      {/* Header */}
      <section className="rounded-2xl bg-kbc-800 p-5 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-kbc-100/70">{klant.id}</p>
            <h2 className="text-2xl font-semibold">{klant.naam}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.producten.map((pr) => <span key={pr.code} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs">{pr.naam}</span>)}
            </div>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 text-xs text-kbc-100/70"><Wallet size={12} /> Totaal saldo ({p.rekeningen.length} rek.)</p>
            <p className="text-xl font-semibold tabular-nums">{eur(saldo)}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Kaart titel="Levenslandschap">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-4 xl:grid-cols-7">
            {(Object.keys(DOMEIN_LABEL) as Domein[]).map((d) => {
              const st = STATUS[klant.landschap[d]]
              const Icon = DOMEIN_ICON[d]
              const kans = nieuw.has(d) && klant.landschap[d] !== 'geregeld'
              return (
                <div key={d} title={`${DOMEIN_LABEL[d]}: ${st.label}`}
                  className={`relative flex flex-col items-center gap-1 rounded-xl p-2 text-center ${kans ? 'ring-2 ring-kbc-400' : ''}`}>
                  <div className={`grid size-10 place-items-center rounded-full ${st.cls}`}><Icon size={18} /></div>
                  <span className="text-[11px] text-slate-600">{DOMEIN_LABEL[d]}</span>
                  <st.icon size={12} className="absolute right-1 top-1 text-slate-400" />
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">Blauwe rand = domein waar het playbook iets voorstelt.</p>
        </Kaart>

        <Kaart titel="Toestemming ‘Op jouw maat’">
          <ul className="grid grid-cols-2 gap-2">
            {(Object.keys(klant.toestemming) as Bron[]).map((b) => (
              <li key={b} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${klant.toestemming[b] ? 'bg-kbc-green/10 text-green-900' : 'bg-slate-100 text-slate-500 line-through'}`}>
                {klant.toestemming[b] ? <ShieldCheck size={16} /> : <ShieldOff size={16} />} {BRON_LABEL[b]}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Signalen van bronnen zonder toestemming worden niet opgeslagen.</p>
        </Kaart>
      </div>

      {momenten.length === 0 && (
        <Kaart titel="Levensmomenten">
          <p className="text-sm text-slate-500">Geen actieve levensmomenten gedetecteerd voor deze klant (week {week}).</p>
        </Kaart>
      )}

      {momenten.map((m) => (
        <Kaart key={m.moment} titel={`Moment · ${MOMENT_LABEL[m.moment]}`}
          extra={<div className="flex items-center gap-2">
            {m.signalenDetail.some((s) => s.gevoelig) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800"><ShieldAlert size={12} /> Gevoelig</span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs ${m.bevestigd ? 'bg-kbc-green/15 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
              {m.bevestigd ? 'Bevestigd door klant' : 'Niet bevestigd'}
            </span>
            <FaseBadge fase={m.fase} />
          </div>}>
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-500">Intentiescore</span>
                  <span className="text-4xl font-semibold tabular-nums text-kbc-800">{pct(m.score)}</span>
                </div>
                <div className="mt-2"><ScoreMeter score={m.score} fase={m.fase} groot /></div>
              </div>
              <div>
                <h4 className="mb-1 text-sm font-semibold text-slate-700">Verloop</h4>
                <ScoreVerloop signalen={m.signalenDetail} huidigeWeek={week} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-slate-700">Signaaltijdlijn ({m.signalenDetail.length})</h4>
                <SignaalTijdlijn signalen={m.signalenDetail} />
              </div>
            </div>
            <AdviesKaart moment={m} />
          </div>
        </Kaart>
      ))}

      <Kaart titel="Auditlog van deze klant"><AuditLog klantId={klantId} /></Kaart>
    </div>
  )
}

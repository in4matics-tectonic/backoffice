import { ShieldAlert } from 'lucide-react'
import type { KlantKort, Moment } from '../types'
import { MOMENT_LABEL, pct } from '../lib/labels'
import { FaseBadge } from './FaseBadge'
import { ScoreMeter } from './ScoreMeter'

export interface KlantRij extends KlantKort { momenten: Moment[] }

/** Customers sorted by strongest intent, so the adviser sees who needs attention first. */
export function KlantLijst({ klanten, gekozen, kies, zoek }: { klanten: KlantRij[]; gekozen: string | null; kies: (id: string) => void; zoek: string }) {
  const top = (k: KlantRij) => k.momenten.reduce<Moment | null>((a, m) => (!a || m.score > a.score ? m : a), null)
  const q = zoek.trim().toLowerCase()
  const lijst = klanten
    .filter((k) => !q || k.naam.toLowerCase().includes(q) || k.id.toLowerCase().includes(q))
    .sort((a, b) => (top(b)?.score ?? 0) - (top(a)?.score ?? 0))

  return (
    <ul className="space-y-2">
      {lijst.map((k) => {
        const m = top(k)
        return (
          <li key={k.id}>
            <button onClick={() => kies(k.id)}
              className={`w-full rounded-xl p-3 text-left ring-1 transition ${gekozen === k.id ? 'bg-kbc-100 ring-kbc-400' : 'bg-white ring-slate-200 hover:ring-kbc-400'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-kbc-800">{k.naam}</span>
                {m && <FaseBadge fase={m.fase} />}
              </div>
              <p className="text-xs text-slate-500">{k.id}</p>
              {m ? (
                <div className="mt-2">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-600">
                      {MOMENT_LABEL[m.moment]}
                      {m.signalenDetail.some((s) => s.gevoelig) && <ShieldAlert size={12} className="text-amber-700" aria-label="gevoelig" />}
                    </span>
                    <span className="font-semibold tabular-nums">{pct(m.score)}</span>
                  </div>
                  <ScoreMeter score={m.score} fase={m.fase} />
                </div>
              ) : <p className="mt-2 text-xs text-slate-400">Geen actief moment</p>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

import { useState } from 'react'
import { Eye, EyeOff, ShieldAlert } from 'lucide-react'
import type { Signaal } from '../types'
import { BRON_LABEL } from '../lib/labels'
import { BRON_ICON } from './icons'

/** Newest first. Sensitive (health-related) labels are masked until the adviser explicitly reveals them. */
export function SignaalTijdlijn({ signalen }: { signalen: Signaal[] }) {
  const [zichtbaar, setZichtbaar] = useState<Set<string>>(new Set())
  const lijst = [...signalen].sort((a, b) => b.week - a.week || b.id.localeCompare(a.id))
  if (lijst.length === 0) return <p className="text-sm text-slate-500">Nog geen signalen.</p>

  return (
    <ol className="relative space-y-2 border-l-2 border-kbc-100 pl-4">
      {lijst.map((s) => {
        const Icon = BRON_ICON[s.bron]
        const toon = !s.gevoelig || zichtbaar.has(s.id)
        return (
          <li key={s.id} className="slide-in relative rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
            <span className="absolute -left-[25px] top-3 grid size-4 place-items-center rounded-full bg-kbc-400 ring-4 ring-kbc-50" />
            <div className="flex items-start gap-2.5">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-kbc-100 text-kbc-800"><Icon size={16} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{BRON_LABEL[s.bron]}</span>
                  <span>week {s.week}</span>
                  {s.gevoelig && (
                    <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 text-amber-800">
                      <ShieldAlert size={12} /> gevoelig
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-800">
                  {toon ? s.label : <span className="italic text-slate-400">Gezondheidsgerelateerd signaal (verborgen)</span>}
                  {s.gevoelig && (
                    <button onClick={() => setZichtbaar((z) => { const n = new Set(z); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n })}
                      className="ml-2 inline-flex items-center gap-1 text-xs text-kbc-600 hover:underline">
                      {toon ? <><EyeOff size={12} /> verberg</> : <><Eye size={12} /> toon</>}
                    </button>
                  )}
                </p>
              </div>
              <div className="w-16 shrink-0 text-right" title="Gewicht van het signaal">
                <div className="text-xs font-medium tabular-nums text-slate-700">{s.gewicht > 0 ? '+' : ''}{s.gewicht.toFixed(2)}</div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${s.gewicht < 0 ? 'bg-red-400' : 'bg-kbc-600'}`} style={{ width: `${Math.abs(s.gewicht) * 100}%` }} />
                </div>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

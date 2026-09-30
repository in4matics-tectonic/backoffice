import type { Fase } from '../types'
import { DREMPELS, FASE_KLEUR, pct } from '../lib/labels'

/** Score 0-100% with the 40/70/90 thresholds from the tech doc. */
export function ScoreMeter({ score, fase, groot = false }: { score: number; fase: Fase; groot?: boolean }) {
  return (
    <div className="w-full">
      <div className={`relative w-full overflow-hidden rounded-full bg-slate-100 ${groot ? 'h-4' : 'h-2'}`}>
        <div className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: pct(score), background: FASE_KLEUR[fase] === '#cdeefb' ? '#9fdcf6' : FASE_KLEUR[fase] }} />
        {Object.values(DREMPELS).map((d) => (
          <div key={d} className="absolute top-0 h-full w-0.5 bg-white" style={{ left: pct(d) }} />
        ))}
      </div>
      {groot && (
        <div className="relative mt-1 h-4 text-[11px] text-slate-500">
          {Object.entries(DREMPELS).map(([naam, d]) => (
            <span key={naam} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(d) }}>{pct(d)}</span>
          ))}
        </div>
      )}
    </div>
  )
}

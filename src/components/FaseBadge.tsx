import type { Fase } from '../types'
import { FASE_KLEUR, FASE_LABEL } from '../lib/labels'

export function FaseBadge({ fase }: { fase: Fase }) {
  const donker = fase === 'vragen' || fase === 'voorstel'
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: FASE_KLEUR[fase], color: donker ? '#fff' : '#00243f' }}>
      {FASE_LABEL[fase]}
    </span>
  )
}

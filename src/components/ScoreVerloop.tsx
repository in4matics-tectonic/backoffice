import { useState } from 'react'
import type { Signaal } from '../types'
import { DREMPELS, pct } from '../lib/labels'
import { scoreVerloop } from '../lib/score'

const W = 320, H = 110, PAD = { l: 28, r: 8, t: 8, b: 20 }

/** Step chart: the score jumps whenever a signal comes in. */
export function ScoreVerloop({ signalen, huidigeWeek }: { signalen: Signaal[]; huidigeWeek: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const punten = scoreVerloop(signalen)
  if (punten.length === 0) return null
  const maxWeek = Math.max(20, huidigeWeek, ...punten.map((p) => p.week))
  const x = (w: number) => PAD.l + (w / maxWeek) * (W - PAD.l - PAD.r)
  const y = (s: number) => PAD.t + (1 - s) * (H - PAD.t - PAD.b)

  let d = `M ${x(0)} ${y(0)}`
  for (const p of punten) d += ` H ${x(p.week)} V ${y(p.score)}`
  d += ` H ${x(Math.max(huidigeWeek, punten.at(-1)!.week))}`

  const h = hover !== null ? punten[hover] : null

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Verloop van de score per week">
        {[0, ...Object.values(DREMPELS), 1].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray={t > 0 && t < 1 ? '3 3' : undefined} />
            <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end" fontSize="8" fill="#64748b">{pct(t)}</text>
          </g>
        ))}
        {[0, 5, 10, 15, 20].filter((w) => w <= maxWeek).map((w) => (
          <text key={w} x={x(w)} y={H - 6} textAnchor="middle" fontSize="8" fill="#64748b">wk {w}</text>
        ))}
        <path d={d} fill="none" stroke="#0097db" strokeWidth="2" strokeLinejoin="round" />
        {punten.map((p, i) => (
          <g key={p.week} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <circle cx={x(p.week)} cy={y(p.score)} r="10" fill="transparent" />
            <circle cx={x(p.week)} cy={y(p.score)} r={hover === i ? 5 : 4} fill="#0097db" stroke="#fff" strokeWidth="2" />
          </g>
        ))}
      </svg>
      {h && (
        <div className="pointer-events-none absolute rounded-md bg-kbc-900 px-2 py-1 text-xs text-white shadow"
          style={{ left: `${(x(h.week) / W) * 100}%`, top: 0, transform: 'translateX(-50%)' }}>
          Week {h.week}: <b>{pct(h.score)}</b>
        </div>
      )}
    </div>
  )
}

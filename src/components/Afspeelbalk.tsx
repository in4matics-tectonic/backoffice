import { useEffect, useState } from 'react'
import { Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import type { Demo } from '../types'
import { api } from '../lib/api'

/** Demo clock controls (Speel af / Volgende / Reset). Only works when the backend runs with DEMO_MODE=true. */
export function Afspeelbalk({ demo }: { demo: Demo | null }) {
  const [speelt, setSpeelt] = useState(false)
  const laatste = demo?.weken.at(-1) ?? 0
  const volgende = () => api('/demo/volgende', { method: 'POST' }).catch(() => setSpeelt(false))

  useEffect(() => {
    if (!speelt || !demo) return
    if (demo.week >= laatste) { setSpeelt(false); return }
    const t = setTimeout(volgende, 1800)
    return () => clearTimeout(t)
  }, [speelt, demo?.week, laatste]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!demo) return null
  const btn = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-40'
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-lg bg-kbc-100 px-2.5 py-1.5 text-sm tabular-nums text-kbc-800">Demoweek <b>{demo.week}</b></span>
      <button className={`${btn} bg-kbc-600 text-white hover:bg-kbc-800`} disabled={demo.week >= laatste}
        onClick={() => setSpeelt((s) => !s)}>
        {speelt ? <><Pause size={14} /> Pauze</> : <><Play size={14} /> Speel af</>}
      </button>
      <button className={`${btn} bg-white text-kbc-800 ring-1 ring-slate-200 hover:ring-kbc-400`} disabled={speelt || demo.week >= laatste} onClick={volgende}>
        <SkipForward size={14} /> Volgende
      </button>
      <button className={`${btn} bg-white text-kbc-800 ring-1 ring-slate-200 hover:ring-kbc-400`}
        onClick={() => { setSpeelt(false); api('/demo/reset', { method: 'POST' }) }}>
        <RotateCcw size={14} /> Reset
      </button>
    </div>
  )
}

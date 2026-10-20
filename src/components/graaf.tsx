import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, Minus, Plus, X } from 'lucide-react'
import type { LinkStatus } from '../types'
import { LINK_KLEUR, LINK_LABEL, LINK_STREEP } from '../lib/labels'
import { STATUSSEN } from '../lib/useGraafCanvas'

// UI shared by the force graphs (EcosysteemBrein, KlantenNetwerk).

export function StatusPil({ status }: { status: LinkStatus }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
      <StatusStip status={status} />
      {LINK_LABEL[status]}
    </span>
  )
}

/** Filled for active and known, hollow for possible: status never depends on color alone. */
export function StatusStip({ status }: { status: LinkStatus }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ background: status === 'mogelijk' ? '#fff' : LINK_KLEUR[status], boxShadow: `inset 0 0 0 2px ${LINK_KLEUR[status]}` }} />
}

/** Legend that doubles as a filter: one toggle per link status, with its line style and a count. */
export function StatusFilter({ filter, zet, tel }: { filter: Record<LinkStatus, boolean>; zet: (f: Record<LinkStatus, boolean>) => void; tel: (s: LinkStatus) => number }) {
  return STATUSSEN.map((s) => (
    <button key={s} onClick={() => zet({ ...filter, [s]: !filter[s] })} aria-pressed={filter[s]}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 transition ${filter[s] ? 'bg-white text-slate-700 ring-slate-300' : 'bg-slate-100 text-slate-400 ring-transparent line-through'}`}>
      <svg width="30" height="10" aria-hidden>
        <line x1="1" y1="5" x2="20" y2="5" stroke={LINK_KLEUR[s]} strokeWidth="2" strokeDasharray={LINK_STREEP[s]} strokeLinecap="round" />
        <circle cx="25" cy="5" r="4" fill={s === 'mogelijk' ? '#fff' : LINK_KLEUR[s]} stroke={LINK_KLEUR[s]} strokeWidth="2" />
      </svg>
      {LINK_LABEL[s]} <b className="tabular-nums">{tel(s)}</b>
    </button>
  ))
}

export function ZoomKnoppen({ zoom, pas }: { zoom: (f: number) => void; pas: () => void }) {
  const knop = 'grid size-7 place-items-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-kbc-400'
  return (
    <div className="ml-auto flex items-center gap-1">
      <button aria-label="Uitzoomen" title="Uitzoomen" onClick={() => zoom(1 / 1.25)} className={knop}><Minus size={14} /></button>
      <button aria-label="Inzoomen" title="Inzoomen" onClick={() => zoom(1.25)} className={knop}><Plus size={14} /></button>
      <button aria-label="Passend maken" title="Passend maken" onClick={pas} className={knop}><Maximize2 size={13} /></button>
    </div>
  )
}

/** Full-screen layer over the whole dashboard (portalled to <body>, so no parent's layout touches it). Esc or the close button closes it. */
export function VolScherm({ titel, sub, sluit, children }: { titel: string; sub?: React.ReactNode; sluit: () => void; children: React.ReactNode }) {
  const knop = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    knop.current?.focus()
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && sluit()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    addEventListener('keydown', esc)
    return () => { removeEventListener('keydown', esc); document.body.style.overflow = overflow }
  }, [sluit])
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={titel} className="fixed inset-0 z-50 flex flex-col gap-3 bg-kbc-50 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-kbc-800">{titel}</h2>
          {sub && <p className="text-sm text-slate-500">{sub}</p>}
        </div>
        <button ref={knop} onClick={sluit} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200 hover:ring-kbc-400">
          <X size={15} /> Sluiten <kbd className="text-xs text-slate-400">Esc</kbd>
        </button>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>,
    document.body,
  )
}

/** Opens a graph full screen. */
export function VolSchermKnop({ open }: { open: () => void }) {
  return (
    <button onClick={open} title="Volledig scherm" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-kbc-100 hover:text-kbc-800">
      <Maximize2 size={12} /> Volledig scherm
    </button>
  )
}

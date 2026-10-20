import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, Send, Smartphone, X } from 'lucide-react'
import type { Kans, Link } from '../types'
import { api, ApiError } from '../lib/api'
import { KANS_STATUS_LABEL, LINK_KLEUR, pct } from '../lib/labels'
import { useBridge } from '../lib/pocBridge'

const FOUT: Record<string, string> = {
  al_verstuurd: 'Deze kans werd al naar de klant gestuurd.',
  geen_mogelijke_link: 'Deze link is niet meer mogelijk voor deze klant.',
}
const MAX_BERICHT = 280

/**
 * Confirm before a possible link goes to the customer's KBC Mobile as a new opportunity. Shows what the customer
 * will see; the score and the reasons come from the backend, the adviser only adds an optional note.
 */
export function KansDialoog({ klantId, klantNaam, link, ecosysteemNaam, sluit, verstuurd }: {
  klantId: string; klantNaam: string; link: Link; ecosysteemNaam: string; sluit: () => void; verstuurd: (k: Kans) => void
}) {
  const [bericht, setBericht] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [klaar, setKlaar] = useState<Kans | null>(null)
  const veld = useRef<HTMLTextAreaElement>(null)
  const waarom = [...new Set((link.waarom ?? []).map((w) => w.reden))]

  useEffect(() => {
    veld.current?.focus()
    // Capture phase on window, so Esc closes only this dialog and not a full-screen view behind it
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); sluit() } }
    addEventListener('keydown', esc, true)
    return () => removeEventListener('keydown', esc, true)
  }, [sluit])

  const verstuur = async () => {
    setBezig(true)
    setFout(null)
    try {
      const kans = await api<Kans>(`/klanten/${klantId}/kansen`, {
        method: 'POST',
        body: JSON.stringify({ link: link.id, ...(bericht.trim() ? { bericht: bericht.trim() } : {}) }),
      })
      setKlaar(kans)
      verstuurd(kans)
    } catch (e) {
      setFout(FOUT[(e as ApiError).code] ?? 'Versturen mislukt. Probeer het opnieuw.')
    } finally {
      setBezig(false)
    }
  }

  // Pitch tour: type the adviser's note visibly, then send it like a click would
  const typen = useRef(0)
  useEffect(() => () => clearInterval(typen.current), [])
  useBridge((m) => {
    if (m.kateStudio === 'kansTyp') {
      clearInterval(typen.current)
      const tekst = m.tekst.slice(0, MAX_BERICHT)
      let n = 0
      typen.current = window.setInterval(() => {
        n += 1
        setBericht(tekst.slice(0, n))
        if (n >= tekst.length) clearInterval(typen.current)
      }, 25)
    }
    if (m.kateStudio === 'kansVerstuur' && !bezig && !klaar) verstuur()
  }, [bericht, bezig, klaar])

  return createPortal(
    <div className="fixed inset-0 z-[60] grid place-items-center bg-kbc-900/40 p-4" onPointerDown={(e) => e.target === e.currentTarget && sluit()}>
      <div role="dialog" aria-modal="true" aria-labelledby="kans-titel" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="kans-titel" className="flex items-center gap-2 text-lg font-semibold text-kbc-800"><Smartphone size={18} /> Kans sturen naar KBC Mobile</h2>
            <p className="text-sm text-slate-500">Voor {klantNaam}</p>
          </div>
          <button onClick={sluit} aria-label="Sluiten" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
        </div>

        {klaar ? (
          <div className="space-y-4 text-center">
            <CheckCircle2 size={40} className="mx-auto text-kbc-green" />
            <p className="text-sm text-slate-700"><b className="text-kbc-800">{link.naam}</b> staat klaar in de app van {klantNaam}.</p>
            <p className="text-xs text-slate-500">Status: {KANS_STATUS_LABEL[klaar.status]}. Je ziet hier live wanneer de klant reageert.</p>
            <button onClick={sluit} className="w-full rounded-lg bg-kbc-800 px-4 py-2 text-sm font-medium text-white hover:bg-kbc-900">Sluiten</button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Preview: what the customer will see */}
            <div className="rounded-xl bg-kbc-50 p-4 ring-1 ring-kbc-100">
              <p className="text-xs font-medium uppercase tracking-wide text-kbc-600">Nieuwe kans · {ecosysteemNaam}</p>
              <p className="mt-0.5 font-semibold text-kbc-800">{link.naam}</p>
              {waarom.length > 0 && (
                <>
                  <p className="mt-2 text-xs font-medium text-slate-500">Waarom zie ik dit?</p>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-xs text-slate-600">{waarom.map((w) => <li key={w}>{w}</li>)}</ul>
                </>
              )}
              {bericht.trim() && <p className="mt-2 rounded-lg bg-white p-2 text-xs italic text-slate-700">“{bericht.trim()}”</p>}
            </div>

            {link.score != null && (
              <div>
                <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Kans op interesse (enkel voor jou)</span><b className="tabular-nums text-kbc-800">{pct(link.score)}</b></div>
                <div className="h-1.5 rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: pct(link.score), background: LINK_KLEUR.mogelijk }} /></div>
              </div>
            )}

            <label className="block">
              <span className="mb-1 flex justify-between text-xs text-slate-500"><span>Persoonlijk bericht (optioneel)</span><span className="tabular-nums">{bericht.length}/{MAX_BERICHT}</span></span>
              <textarea ref={veld} value={bericht} onChange={(e) => setBericht(e.target.value.slice(0, MAX_BERICHT))} rows={3}
                placeholder="Bv. Dit kan interessant zijn voor jullie nieuwe wagen."
                className="w-full resize-none rounded-lg px-3 py-2 text-sm ring-1 ring-slate-200 outline-none focus:ring-kbc-400" />
            </label>

            {fout && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{fout}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={sluit} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">Annuleren</button>
              <button onClick={verstuur} disabled={bezig}
                className="inline-flex items-center gap-1.5 rounded-lg bg-kbc-800 px-4 py-2 text-sm font-medium text-white hover:bg-kbc-900 disabled:opacity-60">
                <Send size={14} /> {bezig ? 'Versturen…' : 'Versturen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/** Where a sent opportunity stands, for detail panels. */
export function KansStatusRegel({ kans }: { kans: Kans }) {
  const tint = kans.status === 'interesse' ? 'bg-kbc-green/15 text-green-800' : kans.status === 'afgewezen' ? 'bg-slate-100 text-slate-500' : 'bg-kbc-100 text-kbc-800'
  return (
    <div className={`rounded-lg px-3 py-2 text-xs ${tint}`}>
      <p className="flex items-center gap-1.5 font-medium"><Smartphone size={13} /> {KANS_STATUS_LABEL[kans.status]}</p>
      <p className="mt-0.5 opacity-80">
        Verstuurd {new Date(kans.verstuurdOp).toLocaleString('nl-BE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} door {kans.verstuurdDoor}
      </p>
      {kans.bericht && <p className="mt-1 italic opacity-80">“{kans.bericht}”</p>}
    </div>
  )
}

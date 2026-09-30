import { Ban, Lightbulb, Lock, MessageCircle, Sparkles, UserRound } from 'lucide-react'
import type { Moment } from '../types'
import { MOMENT_LABEL } from '../lib/labels'

const UITVOERING: Record<string, { label: string; cls: string }> = {
  STP: { label: 'Kate regelt automatisch', cls: 'bg-emerald-50 text-emerald-800' },
  INFO: { label: 'Info', cls: 'bg-slate-100 text-slate-700' },
  ADVISEUR: { label: 'Adviseur', cls: 'bg-violet-50 text-violet-800' },
}

/**
 * Rule-based "next best action" per phase. Deterministic on purpose: the score and phase come from the backend,
 * the LLM never decides. (The LLM advice card from the tech doc can later replace the texts, not the rules.)
 */
function advies(m: Moment) {
  const gevoelig = m.signalenDetail.some((s) => s.gevoelig)
  const naam = MOMENT_LABEL[m.moment].toLowerCase()
  switch (m.fase) {
    case 'stil':
      return { kanaal: 'Niets', actie: 'Enkel opvolgen, nog geen contact.', nietDoen: 'Klant niet contacteren op basis van een zwak signaal.' }
    case 'info':
      return { kanaal: 'Kate in app', actie: `Relevante info rond ${naam} tonen in KBC Mobile.`, nietDoen: 'Geen producten voorstellen.' }
    case 'vragen':
      return {
        kanaal: 'Kate in app',
        actie: `Kate vraagt de klant of ${naam} klopt.`,
        nietDoen: gevoelig ? 'Gevoelig moment: niet feliciteren en niets verkopen vóór bevestiging.' : 'Nog niet feliciteren of verkopen.',
      }
    case 'voorstel':
      return {
        kanaal: m.acties.some((a) => a.uitvoering === 'ADVISEUR') ? 'Kate in app + adviseur' : 'Kate in app',
        actie: m.acties[0] ? `Starten met: ${m.acties[0].titel}.` : 'Gezinsplan bespreken.',
        nietDoen: 'Geen producten voorstellen die de klant al heeft.',
      }
  }
}

export function AdviesKaart({ moment }: { moment: Moment }) {
  const a = advies(moment)
  const waarom = moment.signalenDetail
    .filter((s) => !s.gevoelig)
    .sort((x, y) => y.gewicht - x.gewicht)
    .slice(0, 3)
    .map((s) => s.label)
  const zichtbaarVoorKlant = moment.fase === 'voorstel'

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-kbc-900 p-4 text-white">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-kbc-400"><Lightbulb size={14} /> Volgende beste actie</div>
        <p className="font-medium">{a.actie}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="flex items-center gap-1 text-kbc-100/70"><MessageCircle size={14} /> Kanaal</dt><dd>{a.kanaal}</dd>
          <dt className="flex items-center gap-1 text-kbc-100/70"><Ban size={14} /> Niet doen</dt><dd>{a.nietDoen}</dd>
          {waarom.length > 0 && (<><dt className="flex items-center gap-1 text-kbc-100/70"><Sparkles size={14} /> Waarom</dt>
            <dd>{waarom.join(' · ')}{moment.signalenDetail.some((s) => s.gevoelig) && ' · + gevoelige signalen'}</dd></>)}
        </dl>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Playbook ({moment.acties.length})</h4>
          {!zichtbaarVoorKlant && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500"><Lock size={12} /> Klant ziet dit pas na bevestiging</span>
          )}
        </div>
        <ul className={`space-y-1.5 ${zichtbaarVoorKlant ? '' : 'opacity-60'}`}>
          {moment.acties.map((act) => (
            <li key={act.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
              <span className="flex items-center gap-2">
                {act.uitvoering === 'ADVISEUR' && <UserRound size={14} className="text-violet-700" />}
                {act.titel}
                {act.kateCoin && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-900">+{act.kateCoin.bedrag} Kate Coins</span>}
              </span>
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${UITVOERING[act.uitvoering].cls}`}>{UITVOERING[act.uitvoering].label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
